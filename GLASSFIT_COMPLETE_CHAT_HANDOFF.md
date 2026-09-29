# GlassFit Project Handoff — Complete Chat Context

**Project:** GlassFit  
**Purpose of this file:** Handoff document for continuing the project in a new ChatGPT conversation without losing the technical decisions, architecture, database work, implementation progress, and immediate next steps established in this chat.

---

# 1. Project Overview

GlassFit is a web-based, photo-based visualization and consultation-support system for customized glass and aluminum products.

The system is intended to let customers:

1. Browse available products without needing an account.
2. View normal 2D product previews.
3. View interactive 3D product models that can be rotated and inspected.
4. Upload an image of their real space.
5. Place one or more customized products into that uploaded image.
6. Move, resize, rotate, adjust angle, and manage multiple overlays.
7. Apply realism features such as:
   - ambient light matching;
   - positional visual matching;
   - object-aware layering;
   - shadows;
   - camera-quality matching;
   - glass visualization modes.
8. Generate one final composed visualization image.
9. Confirm or manually enter real-life dimensions for quotation purposes.
10. Generate an approximate quotation.
11. Generate a PDF quotation/reference.
12. Create a signed booking reference.
13. Continue the consultation through Messenger or Viber.

GlassFit is explicitly **not** meant to become a full ERP, construction-management, scheduling, payment, fabrication, inventory, or messaging platform.

---

# 2. Core Research / Capstone Goal

The capstone's main purpose is to solve the visualization gap in customized glass and aluminum consultation.

The business currently relies heavily on:

- static product images;
- sketches;
- verbal explanations;
- Messenger/Viber;
- SketchUp references;
- manual quotation workflows.

This creates:

- customer uncertainty;
- repeated clarifications;
- design revisions;
- delayed approval;
- possible material/labor waste;
- poor understanding of spatial fit.

GlassFit's final outcome is a browser-accessible system that gives customers a realistic visual reference of customized products inside their actual space before fabrication and installation.

The system is designed specifically to avoid real-time AR complexity and instead uses an asynchronous:

```text
capture photo
→ configure product in photo
→ generate final output
```

workflow.

The current capstone also emphasizes support for low- to mid-range devices by shifting computationally heavy image analysis to backend services while keeping interactive visualization in the browser.

---

# 3. Current MVP Architecture

The MVP already validates the core visualization pipeline.

## Frontend

- Next.js 16.x
- React 19.x
- TypeScript
- Tailwind CSS 4
- Three.js
- HTML Canvas

## Backend

- FastAPI
- OpenCV
- NumPy
- YOLOv8 segmentation
- Uvicorn

## Current MVP Product Types

- Cabinet
- Window

## Current MVP Visualization Flow

```text
User uploads room/space photo
→ frontend sends image to FastAPI
→ backend analyzes brightness/lighting
→ backend detects foreground objects and masks
→ frontend displays uploaded photo
→ user adds a product
→ Three.js renders the model
→ user adjusts placement and realism
→ placed overlays are cached as transparent rendered layers
→ user can add/edit/duplicate/hide/delete/reorder overlays
→ Canvas composites everything
→ final PNG is generated
```

Only one overlay is live in Three.js at a time. Already-placed overlays are stored as cached transparent renders plus temporary metadata during the active session.

This was intentional to reduce GPU/client load.

---

# 4. Important Visualization Architecture Decision

The MVP originally treated each product as one complete GLB model.

That approach was tested and replaced for the window with a new parametric / structural concept.

The test was successful.

## Validated Parametric Window Concept

The window starts as a normal aluminum-framed window with:

- outer frame;
- center partition/mullion;
- two glass panes.

Instead of stretching one entire model, the product is built from structural parts.

Example:

```text
small width
→ 2 panes
→ 1 mullion

larger width threshold reached
→ 3 panes
→ 2 mullions
```

The product structure itself changes when the configured width crosses a business-defined threshold.

This proved that GlassFit can support products where structural components are added, removed, repeated, resized, or replaced based on customer configuration.

---

# 5. Structural Product Philosophy

The architecture must support both:

## Fixed products

A product that uses one complete 3D model and does not need structural regeneration.

Example:

```text
Three-Drawer Cabinet
→ one GLB model
```

## Parametric / structural products

A product assembled or generated from parts and rules.

Example:

```text
Window
→ frame pieces
→ glass panes
→ mullions
→ width/height parameters
→ structural thresholds
```

The database does **not** have an `is_structural` column on `products`.

Instead, structural strategy belongs in:

```text
product_templates.model_strategy
```

Allowed values:

```text
Fixed
Parametric
```

---

# 6. Important Product Design Decision

A product can have only one structural template in the current lean design.

If the structural design is fundamentally different, it should be a **different product**, not another template of the same product.

Example:

```text
Sliding Window
Fixed Window
Awning Window
```

should be separate products if their structural construction is genuinely different.

This keeps the schema simpler and matches the user's intended business logic.

---

# 7. Product Variations

`product_variations` is still used for choices that keep the product fundamentally the same.

Examples:

```text
Material
- Wood
- Metal

Color
- White
- Black
- Brown

Finish
- Matte
- Glossy

Glass Type
- Clear
- Frosted
- Reflective

Design
- Plain
- Framed
```

Example:

A cabinet with the same exact construction but available in wood, metal, different colors, or finish is still one product.

Those choices belong in:

```text
product_variations
```

The selected variations for a customer's configured instance belong in:

```text
configuration_variations
```

---

# 8. Final Database Philosophy

The original capstone database was already good for the non-structural business flow.

The goal was **not** to overengineer the schema.

The new design keeps the original workflow and adds only what is needed for:

- profiles;
- structural generation;
- R2 asset references;
- current product configuration;
- final snapshot;
- quotation;
- booking handoff.

The final lean design contains **16 tables**.

---

# 9. Final 16 Tables

1. `profiles`
2. `admin_roles`
3. `products`
4. `product_assets`
5. `product_variations`
6. `product_templates`
7. `product_parameters`
8. `product_components`
9. `structural_rules`
10. `product_configurations`
11. `configuration_variations`
12. `visualization_snapshots`
13. `quotation_estimates`
14. `quotation_items`
15. `signed_booking_links`
16. `booking_requests`

---

# 10. What Each Table Stores

## 1. `profiles`

Stores authenticated people using GlassFit.

Both:

- customers;
- admins.

Important fields include:

```text
profile_id
admin_role_id
first_name
last_name
full_name
email
contact_number
auth_provider
account_type
status
created_at
updated_at
```

`full_name` is now a generated stored column:

```sql
full_name varchar(101)
generated always as (
  trim(first_name || ' ' || last_name)
) stored
```

`account_type` values:

```text
Customer
Admin
```

---

## 2. `admin_roles`

Stores the admin's role.

Seed roles currently include:

```text
Owner
Manager
Staff
```

It also stores a JSON permissions object.

---

## 3. `products`

Stores the main business product catalog records.

Examples:

```text
Standard Aluminum Window
Three-Drawer Cabinet
```

Important fields:

```text
product_id
created_by
updated_by
product_name
product_type
description
base_price
status
created_at
updated_at
```

Allowed `product_type`:

```text
Window
Door
Partition
Cabinet
Enclosure
Railing
Other
```

Allowed status:

```text
Active
Inactive
```

There is **no** `is_structural` column.

---

## 4. `product_assets`

Stores references to permanent product files.

The actual files will live in Cloudflare R2.

The database stores:

```text
r2_object_key
```

Asset types supported by the current schema:

```text
Thumbnail
Catalog Image
Catalog 3D Preview
Whole Model
Component Model
Texture
Material Map
Variation Preview
Other
```

It can link assets to:

```text
product_id
template_id
component_id
```

Use cases:

```text
Catalog Image
→ normal 2D product details preview

Catalog 3D Preview
→ interactive complete product model used on product-details page

Whole Model
→ complete runtime model for a fixed product

Component Model
→ structural part used by a parametric product
```

Only one active primary asset per product and asset type is allowed through a unique partial index.

---

## 5. `product_variations`

Stores business-defined options that do not fundamentally change the product's structural identity.

Examples:

```text
Color
Material
Finish
Glass Type
Frame Type
Design
```

Fields include:

```text
variation_type
variation_name
additional_price
preview_asset_id
render_data
status
```

---

## 6. `product_templates`

Stores the construction/rendering strategy of a product.

Important fields:

```text
template_id
product_id
template_name
model_strategy
measurement_unit
base_configuration
status
```

Allowed `model_strategy`:

```text
Fixed
Parametric
```

Current schema allows one template per product.

---

## 7. `product_parameters`

Defines configurable structural values.

Examples:

```text
width
height
number of shelves
number of panels
```

Important fields:

```text
parameter_key
parameter_name
parameter_type
minimum_value
maximum_value
default_value
step_value
unit
affects_structure
display_order
```

---

## 8. `product_components`

Stores the structural parts used to build a product.

Examples:

```text
frame
mullion
glass panel
handle
cabinet door
shelf
divider
```

It also includes pricing-related fields:

```text
base_quantity
pricing_method
unit_price
pricing_unit
component_data
```

Allowed pricing methods include:

```text
Included
Per Piece
Per Length
Per Area
Fixed
Other
```

This was intentionally kept in the component table instead of creating a separate pricing-rules table.

---

## 9. `structural_rules`

Stores conditions that tell GlassFit how a parametric product changes.

Example:

```text
If width >= 2400 mm
→ panel_count = 3
→ mullion_count = 2
```

Fields:

```text
rule_name
priority
condition_data JSONB
action_data JSONB
status
```

---

## 10. `product_configurations`

One row represents one configured / placed product instance in the final visualization.

Important fields:

```text
configuration_id
snapshot_id
product_id
template_id
visual_parameter_values JSONB
quotation_width
quotation_height
quotation_depth
quotation_measurement_unit
measurement_source
measurement_confirmed
quantity
estimated_configuration_price
created_at
updated_at
```

This table has an important dual role.

### Visualization structural values

Stored in:

```text
visual_parameter_values JSONB
```

Example:

```json
{
  "width": 1800,
  "height": 1200,
  "panel_count": 2
}
```

These are the values used to generate the visual 3D product.

### Quotation measurement values

Stored separately in:

```text
quotation_width
quotation_height
quotation_depth
quotation_measurement_unit
```

These can be estimated by GlassFit or manually entered by the user before quotation generation.

Important rule:

> Manually changing quotation dimensions must NOT resize or change the visualization.

Those measurements are only inputs for approximate quotation calculation.

Allowed `measurement_source`:

```text
Estimated
Manual
```

Each placed product instance gets its own configuration row.

Example:

Two identical windows in one final image = two separate `product_configurations` rows.

---

## 11. `configuration_variations`

Stores the actual variations selected for a product configuration.

Example:

```text
Cabinet Configuration 1
→ Material: Wood
→ Color: Brown
→ Finish: Matte
```

It also stores:

```text
additional_price_snapshot
```

so the selected variation's price can be frozen at configuration/quotation time.

---

## 12. `visualization_snapshots`

This is intentionally very lean.

It stores **only the final composed visualization image** and ownership.

Current important fields:

```text
snapshot_id
profile_id
final_image_r2_key
created_at
```

The original uploaded room image is not permanently required.

The snapshot does **not** store:

- overlays;
- realism settings;
- detected objects;
- segmentation masks;
- occlusion selections;
- Three.js transforms;
- shadow settings;
- ambient settings;
- structural data.

Those exist only during the active session.

The final image itself is the permanent visual reference.

---

## 13. `quotation_estimates`

Stores the overall approximate quotation.

Important fields:

```text
quotation_id
snapshot_id
profile_id
quotation_number
total_estimated_amount
currency
quotation_note
pdf_r2_object_key
status
created_at
updated_at
```

Allowed status:

```text
Draft
Generated
Expired
Cancelled
```

The generated PDF reference is stored directly here.

No separate PDF table is needed.

---

## 14. `quotation_items`

Stores the cost breakdown for a quotation.

Possible items:

```text
Aluminum frame
Glass panels
Hardware
Labor
Configured Window
Configured Cabinet
```

Fields include:

```text
quotation_id
configuration_id
item_name
quantity
unit
unit_price
estimated_subtotal
pricing_details JSONB
item_note
display_order
```

Each quotation item can optionally point to a specific `product_configuration`.

Old quotation pricing must remain unchanged even if admins update product/component pricing later.

---

## 15. `signed_booking_links`

Stores the secure booking/consultation reference.

Fields include:

```text
link_id
profile_id
quotation_id
snapshot_id
token_hash
expires_at
status
created_at
```

Allowed status:

```text
Active
Expired
Revoked
Used
```

The database stores only the hash of the public token.

---

## 16. `booking_requests`

Stores the customer's request to continue through Messenger or Viber.

Fields include:

```text
booking_request_id
profile_id
link_id
selected_platform
status
updated_by
created_at
updated_at
```

Platform values:

```text
Messenger
Viber
```

Status values:

```text
Pending
Ongoing
Done
Cancelled
```

GlassFit does not store:

- the full Messenger/Viber conversation;
- final schedule;
- private negotiation messages.

---

# 11. Final Business Rules

The revised structural-compatible business rules are:

1. A customer may browse products without an account.
2. A customer must create an account or log in before proceeding with booking.
3. A profile represents one authenticated GlassFit account.
4. A profile is either Customer or Admin.
5. An admin may have one admin role.
6. Visualization editing may happen entirely within an active browser session.
7. Temporary overlay, realism, segmentation, and occlusion state is not persisted.
8. The system stores only the final composed visualization image.
9. A customer may have many finalized visualization snapshots.
10. One final visualization snapshot may contain multiple configured product instances.
11. A product represents one business product.
12. Structurally different designs should be separate products.
13. A product may have many permanent 2D/3D assets.
14. Product assets live in R2; Supabase stores object keys and metadata.
15. A product may have many variations.
16. A product has one rendering/construction template.
17. The template may be Fixed or Parametric.
18. Parametric templates may have configurable parameters.
19. Parametric templates may have structural components.
20. Parametric templates may have structural rules.
21. Structural rules may add/remove/repeat/resize/replace components.
22. Customer visual configuration values are stored in JSONB.
23. Product variations remain separate from structural parameters.
24. One product configuration represents one configured product instance.
25. Two copies of the same product in one image produce two configuration records.
26. The same resolved component structure should be used for visualization and pricing.
27. Quotation dimensions may be estimated by the computer.
28. Before final output/quotation generation, the customer is asked to confirm dimensions.
29. The customer may manually enter real-world dimensions.
30. Manual quotation dimensions do not change the visualization.
31. Approximate pricing may use product base price, variations, structural components, measurements, and labor.
32. Final pricing logic still needs confirmation from the business/client.
33. The quotation is approximate and subject to actual measurement and negotiation.
34. Old quotations preserve historical prices.
35. A quotation is generated from one finalized snapshot and its configurations.
36. The quotation may contain multiple items.
37. The quotation PDF is stored in R2; its key is stored in `quotation_estimates`.
38. A signed booking link is created only after the customer logs in and confirms intent to proceed.
39. Each signed booking link connects one customer, quotation, and final visualization snapshot.
40. Booking links expire.
41. A booking request is created when the customer chooses Messenger or Viber.
42. Each booking request belongs to one customer.
43. Each booking request belongs to one signed booking link.
44. Admins may manage products, product variations, structural data, and pricing data.
45. Admins may view and update booking request statuses.
46. Actual scheduling and negotiation remain outside GlassFit.

---

# 12. Temporary Customer Space Image Strategy

Temporary customer uploads should **not** create database rows.

Recommended architecture:

```text
Customer selects image
→ browser creates preview
→ original uploads to temporary R2/session path
→ backend performs image analysis / segmentation
→ frontend performs visualization
→ temporary masks / processing outputs remain temporary
→ final composed image is generated
→ final image is permanently uploaded to R2
→ visualization_snapshots row is created
→ temporary session files expire automatically
```

Suggested temporary R2 path:

```text
temporary-visualizations/{session_id}/original.webp
temporary-visualizations/{session_id}/mask.png
temporary-visualizations/{session_id}/processed.webp
```

The database does not need a temporary-upload table.

Use an R2 lifecycle rule to automatically delete abandoned temporary files.

---

# 13. Permanent Product Asset Strategy

Permanent product catalog and 3D assets should be stored in R2.

Examples:

```text
products/window-01/catalog/thumbnail.webp
products/window-01/catalog/main-preview.webp
products/window-01/catalog/window-preview.glb
products/window-01/models/window-complete.glb
products/window-01/components/frame.glb
products/window-01/components/mullion.glb
products/window-01/textures/glass.webp
```

`product_assets` stores only the R2 key and metadata.

---

# 14. Product Catalog Loading Strategy

Do not load every 3D model on the catalog page.

Recommended behavior:

```text
Catalog list
→ load only thumbnails

Product details page
→ load normal 2D product preview
→ optionally enable/load interactive 3D preview

Visualization workspace
→ load only the selected product's required runtime assets
```

This is important for reducing client load.

---

# 15. Product Details Page Goal

The next intended product-details experience is:

```text
Catalog
→ click View Product
→ open product-details page
→ show normal 2D image preview by default
→ customer enables 3D
→ load the product's 3D preview
→ customer can freely rotate/orbit/inspect the model
```

For the current window:

```text
Catalog Image
→ 2D window preview

Catalog 3D Preview
→ current complete window model
```

For this product-details feature, the complete window model can be used directly.

The parametric structural builder is primarily needed later in the actual visualization/configuration workspace.

Relevant `product_assets.asset_type` values:

```text
Catalog Image
Catalog 3D Preview
```

---

# 16. Supabase Setup Completed

The user has already:

1. Created the Supabase project.
2. Applied the SQL schema successfully.
3. Connected the frontend to Supabase.
4. Installed and configured Supabase SSR.
5. Added separate browser and server Supabase clients.
6. Added the Next.js session refresh proxy.
7. Implemented email/password signup.
8. Implemented Google signup.
9. Implemented profile creation / profile verification.
10. Added frontend user validation and error handling.
11. Inserted test products into `public.products`.
12. Updated the product catalog to load database products instead of mock product definitions.

---

# 17. Supabase Client Setup

The frontend uses `@supabase/ssr`.

## Server client

Conceptually:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
```

It uses:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

## Browser client

Conceptually:

```ts
import { createBrowserClient } from "@supabase/ssr";
```

The same public environment variables are used.

The service-role key must never be placed in a `NEXT_PUBLIC_` variable.

---

# 18. Authentication Decisions

Supabase Auth is now used instead of Firebase.

`profiles.profile_id` maps directly to:

```text
auth.users.id
```

The profile table uses:

```text
first_name
last_name
full_name generated
email
contact_number
auth_provider
account_type
status
```

Email/password and Google authentication are working.

---

# 19. Signup Validation Work

The signup form already had:

- first name validation;
- last name validation;
- email validation;
- Philippine mobile number validation;
- password requirements;
- user-friendly validation messages.

The form was updated to:

- normalize names/email/phone;
- handle Supabase errors;
- handle duplicate/invalid email cases;
- handle weak passwords;
- handle rate limits;
- handle network/offline errors;
- support email verification behavior;
- use proper accessibility attributes;
- use Supabase instead of simulated registration.

Phone numbers should be stored consistently, e.g.:

```text
+639171234567
```

rather than display-formatted spacing.

---

# 20. Current Product Records Inserted

Two MVP product records were inserted into `public.products`:

```text
Standard Aluminum Window
product_type: Window
```

and:

```text
Three-Drawer Cabinet
product_type: Cabinet
```

They were inserted with an active admin profile as `created_by`.

`base_price` is currently 0.00 because client pricing rules are not finalized yet.

The frontend should not display `₱0.00` as if the product were free.

Recommended UI:

```text
Price available after configuration
```

when `base_price = 0`.

---

# 21. Current Product Catalog Integration

An implementation plan was created to replace the mock product list with Supabase `public.products`.

The intended architecture:

```text
Supabase products
→ determines what products exist and are visible

Local renderer registry
→ temporarily determines how currently supported product types are visualized
```

Temporary renderer mapping:

```text
Window
→ existing parametric window implementation

Cabinet
→ existing cabinet renderer
```

The frontend should preserve the database `product_id` all the way through product selection and overlay state.

Do not use `product_name` as the technical identity.

The current database UUID must become the authoritative product identity.

---

# 22. Important Current Schema Detail: `profiles`

The original SQL had:

```text
full_name varchar(100) not null
```

The schema has now been updated to:

```sql
first_name varchar(50) not null,
last_name varchar(50) not null,
full_name varchar(101)
  generated always as (
    trim(first_name || ' ' || last_name)
  ) stored
```

Additional constraints were added to prevent blank first/last names.

Indexes were added for:

```text
last_name
full_name
```

An updated SQL schema file was generated in this chat.

---

# 23. Final SQL Schema Characteristics

The current schema contains:

- primary keys;
- foreign keys;
- unique constraints;
- `CHECK` constraints;
- JSON object checks;
- cross-table validation triggers;
- admin audit triggers;
- `updated_at` triggers;
- explicit indexes;
- Row Level Security;
- table grants;
- seed admin roles.

Important helper functions include concepts such as:

```text
is_admin()
owns_snapshot()
owns_configuration()
owns_quotation()
owns_booking_link()
```

---

# 24. Important Cross-Table Integrity Rules

The SQL enforces:

- product admin audit fields must reference active admins;
- template must belong to selected product;
- component assets must belong to the correct template;
- variation preview assets must belong to the same product;
- product configuration template must belong to the selected product;
- selected variation must belong to the configured product;
- quotation customer must own the snapshot;
- quotation item configuration must belong to the quotation snapshot;
- booking link customer/snapshot must match quotation;
- booking request customer must match booking link.

---

# 25. Important RLS Behavior

Public / anonymous catalog users may read active:

```text
products
product_templates
product_parameters
product_components
structural_rules
product_assets
product_variations
```

Customers may manage only their own:

```text
profiles
visualization_snapshots
product_configurations
configuration_variations
booking_requests
```

Quotations and signed booking links are primarily meant to be generated by trusted backend/service-role code.

Customers may read their own quotation and booking reference data.

Admins may manage catalog and quotation-related tables according to active admin status.

---

# 26. Final Snapshot Philosophy

This changed from the original capstone's persistent overlay concept.

The final decision is:

> GlassFit does not need to reopen the old visualization workspace.

Once the final output is generated:

```text
final image
→ becomes the permanent visual reference
```

The session-specific data resets after the customer leaves.

Do not persist:

- overlay transforms;
- layer ordering;
- object occlusion choices;
- detected objects;
- segmentation masks;
- local lighting maps;
- Auto Realism values;
- shadow settings;
- Three.js edit state.

The final image already visually contains all of those effects.

The structured configuration information needed for quotation comes from other tables.

---

# 27. Quotation Measurement Confirmation Modal

A major UX/business decision was made for quotation accuracy.

Before final output / quotation generation, GlassFit should ask the user to confirm dimensions.

Example:

```text
Is your window dimension correct?

Width: 1.80 m
Height: 1.20 m
```

The values initially shown may be GlassFit's estimated/configured dimensions.

The customer can:

```text
Confirm
```

or:

```text
Manually enter real-life dimensions
```

Important:

> Manual quotation measurements do not alter the 3D visualization.

They are used only for approximate pricing.

This preserves the difference between:

```text
visual model configuration
```

and:

```text
quotation measurement input
```

---

# 28. Pricing Philosophy

Final client pricing logic is still unknown and must be confirmed with the business.

The schema is intentionally flexible enough to support pricing based on combinations of:

- product base price;
- variation additional price;
- structural component quantities;
- component length;
- component area;
- component count;
- manually confirmed width/height/depth;
- labor;
- other fixed charges.

The structural component list should eventually be the single source used for both:

```text
visual generation
and
pricing calculation
```

to prevent the displayed product and quotation from disagreeing.

---

# 29. Quotation Immutability

Once a quotation is generated, its price data should remain historical.

If an admin later changes:

```text
component unit price
variation price
product base price
```

the old quotation should **not** change.

Therefore:

- quotation items store copied/frozen values;
- selected variation price snapshots are retained;
- quotation totals are generated and stored at the time of generation.

---

# 30. PDF Generation Direction

The PDF should eventually use:

```text
final visualization snapshot
+ product configurations
+ selected variations
+ confirmed quotation measurements
+ quotation items
+ total estimate
```

The PDF is a consultation reference, not a formal guaranteed final price.

The PDF should clearly explain that:

- dimensions may still require professional verification;
- final price may change based on actual site conditions;
- availability and negotiation may affect the final amount;
- the system-generated quotation is approximate.

The PDF file itself will be stored in R2.

The database stores:

```text
quotation_estimates.pdf_r2_object_key
```

No separate PDF table is currently planned.

---

# 31. Existing Capstone Business Terminology

The project should keep the original paper's terminology:

```text
signed_booking_links
booking_requests
```

Do not rename these to consultation tables unless the manuscript itself is later revised.

The actual scheduling and negotiation continue outside GlassFit.

---

# 32. R2 Plan

Cloudflare R2 will be used for heavy/permanent files.

Permanent examples:

```text
product thumbnails
catalog product images
catalog 3D previews
whole GLB models
structural component GLBs
textures
material maps
final visualization images
generated quotation PDFs
```

Temporary examples:

```text
uploaded customer space image
segmentation masks
processing outputs
```

Temporary files should use expiring session paths and should not require database records.

---

# 33. Current Repository State

At the point of this handoff, the repository includes:

- working frontend;
- Supabase connection;
- Supabase SSR auth setup;
- working email signup;
- working Google signup;
- working profile access;
- database schema SQL;
- database-backed product catalog;
- current MVP visualization frontend;
- existing parametric window test;
- existing cabinet model/fallback;
- image-analysis FastAPI backend from the MVP documentation.

The user stated earlier that before database work, the repository was mainly frontend + SQL. Authentication and product loading have since been connected.

---

# 34. Files Created During This Chat

Important artifacts created in this chat include:

```text
GLASSFIT_MVP_PARAMETRIC_WINDOW_IMPLEMENTATION_PLAN.md
```

Purpose:
Plan to replace the generated MVP window with a parametric two-pane window architecture.

```text
GLASSFIT_REVISED_DATA_DICTIONARY.docx
GLASSFIT_REVISED_DATA_DICTIONARY.md
```

Earlier larger dictionary iteration.

```text
GLASSFIT_FINAL_DATA_DICTIONARY.md
```

Earlier finalized dictionary iteration before simplification.

```text
GLASSFIT_UPDATED_16_TABLE_DATA_DICTIONARY.md
```

The lean 16-table data dictionary aligned with the current architecture.

```text
glassfit_schema.sql
```

Initial 16-table Supabase SQL schema.

```text
glassfit_schema_updated.sql
```

Latest schema update with:

```text
first_name
last_name
generated full_name
```

```text
GLASSFIT_DATABASE_PRODUCT_CATALOG_IMPLEMENTATION_PLAN.md
```

Plan for replacing mock frontend product data with `public.products`.

---

# 35. Source Files / Reference Materials

The project conversation has referenced these main files:

```text
GlassFit Chapter 1-3 (9)(1).pdf
```

This is the capstone manuscript and should be treated as the main source for:

- goals;
- scope;
- business flow;
- original database design;
- requirements;
- use cases;
- methodology.

```text
GLASSFIT_MVP_IMPLEMENTATION_GUIDE.md
```

This documents the actual MVP implementation and should be used to understand:

- current Next.js frontend;
- FastAPI backend;
- Three.js renderer;
- object segmentation;
- realism pipeline;
- canvas compositor;
- overlay state.

```text
glassfit_schema(1).sql
```

This should be treated as the authoritative database schema unless a newer schema file is supplied.

The latest update in this chat is:

```text
glassfit_schema_updated.sql
```

which modifies the `profiles` table to use separate first and last names plus generated full name.

---

# 36. Important Instruction for Future Chat

Always refer to the actual uploaded SQL schema before giving:

- insert statements;
- column names;
- constraints;
- enum/allowed values;
- foreign-key relationships;
- RLS behavior;
- migration advice.

Do not invent fields such as:

```text
is_structural
```

because the actual schema does not contain that field.

The user explicitly requested that all database work must use the actual schema as source of truth.

---

# 37. Immediate Current Goal

The current feature being planned is the **product-details page**.

The user wants:

```text
Catalog
→ click View Product
→ product-details
```

On product-details:

1. Show a normal 2D product image by default.
2. Allow the user to enable/switch to 3D.
3. When 3D is enabled:
   - load the product's 3D preview model;
   - allow free rotation/orbit;
   - allow zoom/inspection.
4. For the current test:
   - use the window model already available in the project.

Database asset mapping should use:

```text
Catalog Image
Catalog 3D Preview
```

from `product_assets`.

The actual files should eventually live in R2.

---

# 38. Recommended Next Technical Step

Before wiring the product-details UI, add the window's two required asset records:

```text
1. Catalog Image
2. Catalog 3D Preview
```

to `public.product_assets`.

The next chat should inspect the actual schema before generating the exact insert query.

Important fields will likely include:

```text
product_id
template_id nullable
component_id nullable
created_by
updated_by nullable
asset_type
r2_object_key
file_name
mime_type
byte_size
display_order
is_primary
status
```

For product-details, the 3D preview can be product-level:

```text
template_id = null
component_id = null
```

unless the implementation intentionally ties it to the template.

---

# 39. Existing Product Asset Behavior to Preserve

For product-details:

```text
Catalog Image
→ default preview
```

When the user enables 3D:

```text
Catalog 3D Preview
→ Three.js interactive product viewer
```

Do not load the parametric structural builder just to show the 3D catalog preview.

The product-details 3D preview can use the complete window model.

The parametric builder becomes important in the actual configuration/visualization workspace.

---

# 40. Performance Principle

One of the explicit project goals is to reduce client load.

Therefore:

- do not preload all GLBs in the catalog;
- use thumbnail/catalog images for browsing;
- load the 3D preview only after the customer enables 3D or opens the relevant product;
- keep backend-assisted image processing;
- retain the one-live-Three.js-overlay strategy in the visualization workspace;
- use R2 for heavy assets instead of Supabase database storage.

---

# 41. What Not to Reintroduce

Do not reintroduce unnecessary tables for:

- detected objects;
- occlusion state;
- realism state;
- temporary upload records;
- overlay persistence;
- generated mesh persistence;
- separate quotation PDF table.

These were intentionally removed/simplified because the current GlassFit workflow does not need persistent editable visualization sessions.

---

# 42. Key Conceptual Relationship

The clean final mental model is:

```text
profiles
    ↓
visualization_snapshots
    ↓
product_configurations
    ↓
configuration_variations

products
    ↓
product_assets
    ↓
product_variations
    ↓
product_templates
        ↓
        product_parameters
        product_components
        structural_rules

visualization_snapshots
    ↓
quotation_estimates
    ↓
quotation_items
    ↓
signed_booking_links
    ↓
booking_requests
```

More precisely:

```text
one customer
→ many final snapshots

one snapshot
→ many product configurations

one product
→ many assets
→ many variations
→ one template

one template
→ many parameters
→ many components
→ many structural rules

one snapshot
→ one quotation

one quotation
→ many quotation items

one quotation
→ one signed booking link

one signed booking link
→ one booking request
```

---

# 43. Critical Distinction: Visual Dimensions vs Quotation Dimensions

Never merge these concepts.

## Visual configuration

Used to construct the product for the visualization.

Stored in:

```text
product_configurations.visual_parameter_values
```

## Quotation measurements

Used only for estimating price.

Stored in:

```text
quotation_width
quotation_height
quotation_depth
quotation_measurement_unit
```

The user may manually change quotation measurements without changing the rendered product.

---

# 44. Critical Distinction: Product Identity vs Renderer Identity

Do not treat:

```text
window
cabinet
```

as product IDs.

The real product identity is:

```text
products.product_id
```

The local renderer key is only a temporary implementation detail.

Example:

```text
product_id: UUID from Supabase
product_type: Window
rendererKey: window
```

This distinction is important for later saved configurations and quotations.

---

# 45. Critical Distinction: Product Catalog 3D vs Configurator 3D

These are related but not identical.

## Catalog 3D Preview

Purpose:

- inspect the product;
- rotate;
- zoom;
- understand the design.

Can use:

```text
complete GLB
```

## Visualization / Configurator 3D

Purpose:

- generate the customer's configured structure;
- respond to width/height/variation changes;
- visually fit the product into the uploaded space.

For parametric products, this should use:

```text
template
+ parameters
+ components
+ structural rules
```

---

# 46. Current Validation Status

Validated successfully during this project work:

- parametric window is technically possible;
- database schema applied successfully in Supabase;
- frontend Supabase connection works;
- Supabase SSR cookie handling works;
- email signup works;
- Google signup works;
- profiles work;
- database products appear in the catalog;
- public active product reading works.

---

# 47. Recommended New Chat Starting Prompt

A useful continuation prompt for the next chat is:

```text
We are continuing GlassFit. Read this handoff file first and treat the latest uploaded SQL schema as the source of truth.

Current goal:
Implement the product-details asset flow.

The product already appears in the Supabase-backed catalog. When the user clicks View Product, I want product-details to:
1. show the product's primary Catalog Image by default;
2. switch to an interactive 3D viewer when the user enables 3D;
3. load the primary Catalog 3D Preview;
4. allow orbit/rotation/zoom;
5. use the current window model for the first test.

First inspect the actual schema and current frontend codebase before proposing code changes.
```

---

# 48. Final Project Direction

The project is now moving from feasibility to full integration.

The validated technical architecture is:

```text
Supabase
→ users, products, structural metadata, configurations, quotations, bookings

Cloudflare R2
→ heavy product media, GLBs, textures, final images, PDFs

Next.js / Three.js
→ catalog, product details, structural configuration, visualization

FastAPI / CV
→ image analysis and segmentation

Canvas
→ final visual composite

Messenger / Viber
→ external consultation handoff
```

The database should remain lean.

The final visualization snapshot should remain simple.

The structural product architecture should be data-driven.

The quotation should use confirmed configuration/measurement data rather than trying to derive price from the final image.

The user experience should remain accessible to low- and mid-range devices by loading heavy assets only when required and offloading image-processing tasks to backend services.
