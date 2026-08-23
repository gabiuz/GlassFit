# GlassFit Admin Product Upload + Structural Validation Implementation Plan

## 1. Purpose

This plan upgrades the existing GlassFit Admin product workflow so an Admin can create, upload, configure, validate, and publish products without manually writing SQL or manually constructing R2 paths.

The new Admin workflow must automate the **same Supabase + Cloudflare R2 architecture that already works manually**.

The goal is not to create a second product-management system.

The goal is:

```text
CURRENT MANUAL PROCESS
        ↓
automate the same operations
        ↓
ADMIN UI
```

The resulting product records and R2 assets must be indistinguishable from products created manually.

The same customer-side runtime must continue to read:

```text
products
product_templates
product_parameters
product_components
structural_rules
product_assets
```

and the same R2 object keys.

---

# 2. Critical UI Requirement

The existing Admin UI already has its own visual language.

**Do not redesign the Admin application just to fit this workflow.**

The implementation must reuse the existing:

```text
Admin shell
sidebar / navigation
page headers
cards
input components
select components
buttons
modals
dialogs
tables
tabs
badges
status indicators
spacing
typography
border radius
colors
loading states
error states
empty states
```

Any new UI needed by this plan must be assembled from the same components and layout patterns already used in the Admin application.

## Do not introduce

```text
a separate design system
new button styles
new typography scales
new random card layouts
new colors just for product upload
unrelated dashboard patterns
```

If the current Admin already has a reusable:

```text
FormField
Button
Card
Modal
Table
Tabs
Stepper
Badge
Toast
```

use those.

If a needed interaction does not yet exist, create the **smallest reusable component that visually matches the current Admin UI**.

---

# 3. Core Principle

The Admin workflow should create exactly the same underlying structure as the manual process.

Manual:

```text
INSERT products
↓
copy product_id

INSERT product_templates
↓
INSERT product_parameters
↓
INSERT product_components
↓
INSERT structural_rules

upload files to R2
↓
INSERT product_assets

UPDATE products SET status = 'Active'
```

Admin:

```text
Product Wizard
↓
server actions / API
↓
same rows
same relationships
same R2 objects
same runtime behavior
```

The customer visualization must not know or care whether the product was added:

```text
manually
or
through Admin
```

---

# 4. High-Level Admin Workflow

The final Admin product workflow is:

```text
1. Basic Product Information
        ↓
2. Visualization Strategy
        ↓
3. Catalog Assets
        ↓
4. Structural Components
        ↓
5. Dimensions & Structural Rules
        ↓
6. 3D Product Validation Workspace
        ↓
7. Validation Review
        ↓
8. Activate Product
```

The product remains:

```text
Inactive
```

until the validation workflow has passed.

---

# 5. Important Product Categories

The Admin workflow must support two primary visualization strategies.

## Fixed

Use when:

```text
the product is represented by one complete runtime GLB
the structure does not rebuild from component parts
```

Fixed flow:

```text
Product
↓
Template = Fixed
↓
Catalog Assets
↓
Whole Model / runtime model
↓
3D Validation
↓
Publish
```

Fixed products skip most structural-component steps.

## Parametric

Use when:

```text
width / height / other parameters affect the real model
components resize
components repeat
components reposition
structural rules can change quantities
```

Parametric flow:

```text
Product
↓
Template = Parametric
↓
Builder Profile
↓
Catalog Assets
↓
Component Batch Upload
↓
Component Mapping
↓
Parameters
↓
Rules
↓
3D Validation
↓
Publish
```

---

# 6. Builder Profiles

Product Type and 3D construction behavior must remain separate concepts.

Do not use:

```text
Window = one builder
Door = one builder
Cabinet = one builder
```

because products in the same category can have completely different structures.

Use:

```text
Product Type
= business/catalog classification

Builder Profile
= runtime construction strategy
```

Initial builder profiles can live in application code.

Recommended first set:

```text
fixed_model_v1
frame_panels_v1
sliding_leaf_v1
cabinet_box_v1
custom_parametric_v1
```

Only implement profiles that the current products actually need.

Do not build unused profiles prematurely.

---

# 7. Builder Profile Storage

For the first implementation, store the selected builder profile in:

```text
product_templates.base_configuration
```

Example:

```json
{
  "builder_key": "frame_panels_v1",
  "width": 2100,
  "height": 1500,
  "pane_count": 2,
  "mullion_count": 0
}
```

Sliding Door:

```json
{
  "builder_key": "sliding_leaf_v1",
  "width": 2400,
  "height": 2100,
  "leaf_count": 2
}
```

Do not add a new database table unless the number/complexity of builder profiles actually requires one later.

---

# 8. Product Wizard State

The Admin wizard should maintain one working product across steps.

Recommended state:

```ts
type AdminProductDraft = {
  productId: string | null;

  basicInfo: {
    productName: string;
    productType: string;
    description: string;
    basePrice: number | null;
  };

  visualization: {
    modelStrategy: "Fixed" | "Parametric" | null;
    builderKey: string | null;
    measurementUnit: string;
  };

  catalogAssets: {
    imageAssetId?: string;
    previewAssetId?: string;
  };

  parameters: ProductParameterDraft[];
  components: ProductComponentDraft[];
  structuralRules: StructuralRuleDraft[];

  validation: {
    automaticPassed: boolean;
    manuallyApproved: boolean;
  };
};
```

This is Admin UI state only.

The database remains authoritative after each successful step.

---

# 9. Draft Persistence Philosophy

Do not wait until the final screen to write everything.

Create/update records incrementally so the Admin can leave and return.

Recommended:

```text
Step 1 completed
→ products row exists

Step 2 completed
→ template exists

Step 3 completed
→ catalog assets exist

Step 4 completed
→ components/assets exist

Step 5 completed
→ parameters/rules exist
```

The Product remains:

```text
Inactive
```

throughout.

This makes the workflow resilient to:

```text
page refresh
upload failure
browser close
network interruption
Admin returning later
```

---

# 10. Product Workflow Entry Points

The Admin Product Management page should preserve its current layout.

Add actions using existing buttons/menu patterns.

Recommended:

```text
Add Product
Edit Product
Continue Setup
Validate Product
Activate Product
Deactivate Product
```

For an incomplete product:

```text
Status: Inactive
Setup: Incomplete
```

The row/card can expose:

```text
Continue Setup
```

rather than forcing the Admin to start over.

---

# 11. Step 1 — Basic Product Information

## UI

Reuse the current Admin form layout.

Fields:

```text
Product Name
Product Type
Description
Base Price
```

Product Type values remain schema-controlled:

```text
Window
Door
Partition
Cabinet
Enclosure
Railing
Other
```

Initial status:

```text
Inactive
```

## Backend operation

Create:

```text
public.products
```

immediately after valid submission.

Server determines:

```text
created_by
```

from the authenticated Admin.

Do not let the browser submit arbitrary `created_by`.

## Result

Return:

```text
product_id
```

The wizard route should then become product-specific, for example:

```text
/admin/products/{productId}/setup
```

---

# 12. Milestone 1 — Product Creation Check

Do not continue implementation until this milestone passes.

## Validate

- Product can be created from Admin.
- `product_id` is returned.
- `product_type` is correct.
- `status = Inactive`.
- `created_by` matches current Admin.
- Product appears in Admin list.
- Product does not appear publicly.
- Reopening the draft returns to setup.

## Database check

```sql
select
  product_id,
  product_name,
  product_type,
  created_by,
  base_price,
  status
from public.products
where product_id = 'TEST_PRODUCT_ID'::uuid;
```

## Milestone pass condition

```text
PASS
→ continue to Visualization Strategy
```

---

# 13. Step 2 — Visualization Strategy

## UI

Reuse the current Admin card/radio/select patterns.

Admin selects:

```text
Fixed
Parametric
```

If Parametric, show:

```text
Builder Profile
```

Use a select/card choice matching the current Admin visual design.

Examples:

```text
Frame + Panels
Sliding Leaf System
Cabinet System
Custom Parametric
```

Provide a concise description under each option.

---

# 14. Builder Profile Configuration

Application-code definition example:

```ts
type BuilderProfile = {
  key: string;
  label: string;
  description: string;
  suggestedProductTypes: string[];
  componentRoles: BuilderComponentRole[];
  supportsStructuralRules: boolean;
  defaultParameters: BuilderDefaultParameter[];
};
```

Example conceptual role:

```ts
{
  key: "left_door_glass",
  label: "Left Door Glass",
  componentType: "Glass",
  assemblyGroup: "left_leaf",
  required: false,
  repeatable: false,
  suggestedResizeAxes: ["x", "z"]
}
```

Important:

```text
required / optional
```

must be profile-specific.

Do not make mullion/sill universally required.

---

# 15. Backend Operation for Step 2

Create or update:

```text
product_templates
```

For Parametric:

```text
model_strategy = Parametric
measurement_unit = mm
base_configuration.builder_key = ...
```

For Fixed:

```text
model_strategy = Fixed
```

One product should still have one active template in the current lean architecture.

---

# 16. Milestone 2 — Template Check

## Validate

- Template belongs to correct product.
- Correct model strategy is saved.
- Builder key is saved for Parametric.
- Editing/reloading restores selection.
- Fixed products do not show irrelevant structural UI.
- Parametric products proceed to structural workflow.

## Database check

```sql
select
  template_id,
  product_id,
  template_name,
  model_strategy,
  measurement_unit,
  base_configuration,
  status
from public.product_templates
where product_id = 'TEST_PRODUCT_ID'::uuid;
```

## Pass condition

```text
PASS
→ continue to Catalog Assets
```

---

# 17. Step 3 — Catalog Assets

## UI

Reuse existing upload/card components if available.

Two upload areas:

```text
Catalog Image
Whole 3D Preview
```

Show:

```text
selected file
upload progress
success/error
replace
remove
```

Use existing Admin toast/status styling.

---

# 18. Catalog Asset Upload Architecture

Do not proxy large file bytes through the Next.js server if avoidable.

Recommended:

```text
Browser
↓ request signed upload
Server
↓ validates Admin/product/file metadata
↓ prepares target object
Browser
↓ direct PUT
Cloudflare R2
↓
Browser confirms upload
↓
Server verifies and creates product_assets
```

R2 credentials remain server-side.

---

# 19. Versioned R2 Keys

For new Admin uploads, use version-friendly object keys.

Recommended:

```text
products/{product_id}/catalog/{asset_id}.webp
products/{product_id}/catalog/{asset_id}.glb
```

Component:

```text
products/{product_id}/components/{component_id}/{asset_id}.glb
```

This avoids stale browser/CDN caches on replacement.

Existing manually uploaded paths remain valid.

The runtime always uses:

```text
product_assets.r2_object_key
```

so both patterns work.

---

# 20. Asset Upload Confirmation

Recommended sequence:

```text
1. Server prepares pending asset ID/object key
2. Server creates presigned PUT URL
3. Browser uploads directly to R2
4. Browser reports completion
5. Server verifies object
6. Server creates/activates product_assets row
7. Previous primary asset becomes inactive if replacing
```

Do not mark an asset Active before upload verification.

---

# 21. Milestone 3 — Catalog Asset Check

## Validate

- Image uploads successfully.
- GLB uploads successfully.
- Upload progress works.
- Individual retry works.
- Replace works.
- `product_assets` records point to real R2 objects.
- Catalog Image can be loaded.
- Catalog 3D Preview can be loaded.
- No R2 secrets are exposed in the client.
- Product remains Inactive.

## Pass condition

```text
PASS
→ continue to Structural Components
```

---

# 22. Step 4 — Structural Components

Only show this for Parametric products.

Fixed products can skip this section.

## Batch upload

Admin should be able to:

```text
Select Multiple GLBs
or
Drag/Drop Multiple GLBs
```

Then render a mapping table using the existing Admin table/card design.

Recommended columns:

```text
File
Suggested Role
Component Name
Type
Assembly
Quantity
Upload Status
Actions
```

---

# 23. Filename Suggestions

Auto-suggest roles from filenames.

Examples:

```text
Frame_Left
→ frame_left

Track_Top
→ track_top

Left_Door_Glass
→ left_door_glass
```

Suggestions are editable and must not be treated as truth.

---

# 24. Component Mapping

Each selected file maps to:

```text
component_key
component_name
component_type
base_quantity
component_data
```

Current component types:

```text
Procedural
Model
Glass
Frame
Panel
Hardware
Other
```

Always support:

```text
Custom Component
```

Do not hardcode one universal list of roles.

---

# 25. Assembly Groups

Support optional:

```text
assembly_group
```

inside `component_data`.

Example:

```json
{
  "runtime_role": "left_door_glass",
  "assembly_group": "left_leaf",
  "repeatable": false
}
```

Examples:

```text
static_frame
left_leaf
right_leaf
panels
hardware
shelves
doors
```

These are product-specific.

---

# 26. Component Behavior UI

Admin should not edit JSON.

Use normal form controls:

```text
Component Name
Component Key
Component Type
Assembly Group
Base Quantity
Repeatable
```

Advanced:

```text
Resize Width
Resize Height
Resize Depth
```

Save this into `component_data`.

---

# 27. GLB Inspection

After upload, inspect each GLB with Three.js.

Use:

```text
THREE.Box3
```

to calculate source dimensions.

Store:

```json
{
  "source_dimensions_mm": {
    "x": ...,
    "y": ...,
    "z": ...
  }
}
```

inside `component_data`.

Allow Admin confirmation for:

```text
Width Axis
Height Axis
Depth Axis
```

Do not assume all product families share the same export orientation.

---

# 28. Component Creation + Upload Sequence

For each mapped GLB:

```text
1. Validate metadata
2. Create product_components row
3. Receive component_id
4. Prepare asset_id/object key
5. Generate presigned R2 PUT URL
6. Upload GLB
7. Verify R2 object
8. Create active Component Model asset
9. Measure GLB
10. Update component_data source dimensions
```

Use controlled concurrency.

Recommended initial limit:

```text
3 simultaneous uploads
```

Show per-file:

```text
Waiting
Uploading
Processing
Ready
Failed
```

Retry failures individually.

---

# 29. Milestone 4 — Component Upload Check

Test first with a manually proven Window.

## Validate

- Multiple GLBs can be selected.
- Suggested roles are editable.
- Each component gets a valid `component_id`.
- Each file gets a unique R2 key.
- Each successful upload gets one active Component Model asset.
- R2 URLs load.
- GLBs load in Three.js.
- Metadata persists.
- Refresh restores completed uploads.
- One failed upload does not remove successful files.
- Retry only retries the failed file.

## Manual comparison

Compare an Admin-created test product with a known manual product.

They must use the same relationships:

```text
product
→ template
→ components
→ product_assets
→ R2
```

## Pass condition

```text
PASS
→ continue to Parameters & Rules
```

---

# 30. Step 5 — Parameters

Reuse the existing Admin form design.

Fields:

```text
Parameter Name
Key
Type
Minimum
Default
Maximum
Step
Unit
Affects Structure
```

Common parameters:

```text
Width
Height
```

Do not assume they are the only future parameters.

Validation:

```text
minimum <= default <= maximum
step > 0
key unique within template
```

Server repeats validation.

---

# 31. Structural Rules UI

Only show if needed.

Example UI:

```text
WHEN

[ Width ] [ >= ] [ 2400 ] [ mm ]

THEN

[ Pane Count ] = [ 3 ]
[ Divider Quantity ] = [ 2 ]
[ Glass Quantity ] = [ 3 ]
```

Convert this form into:

```text
condition_data
action_data
```

Do not expose raw JSON to the Admin.

---

# 32. Rule Validation

Before saving:

```text
condition parameter exists
operator supported
action supported by builder
referenced component exists
values valid
```

Example blocking error:

```text
Rule references frame_center,
but this product has no frame_center component.
```

This validation is critical.

---

# 33. Milestone 5 — Parameters / Rules Check

## Validate

- Parameters create/edit correctly.
- Defaults remain within min/max.
- Products with no rules remain valid.
- Rules cannot reference missing components.
- Reload restores parameters/rules.
- Existing structural resolver consumes Admin-created data.

## Regression test

For a known Window:

```text
default
threshold - step
threshold
threshold + step
maximum
```

Verify resolver output at each point.

## Pass condition

```text
PASS
→ begin 3D Validation Workspace
```

---

# 34. Step 6 — Mandatory 3D Product Validation Workspace

This is required before activation.

It is not the customer room visualization.

Use:

```text
neutral / empty Three.js scene
```

Do not include:

```text
space image
FastAPI
YOLO
realism
occlusion
Canvas room composition
```

Purpose:

> Verify that the actual structural product behaves correctly before customers can see it.

---

# 35. Validation Workspace UI

Keep the existing Admin shell/layout.

Recommended page structure:

```text
Existing Admin header / breadcrumb

Main Area
├── 3D Product Preview
└── Current dimensions / test state

Side / adjacent existing-panel style
├── Parameters
├── Recommended Tests
├── Components
├── Assemblies
└── Automatic Validation
```

Do not make a separate visually unrelated 3D editor.

Reuse current:

```text
Card
Input
Slider
Button
Checkbox
Accordion
Badge
Toast
```

components.

---

# 36. Same Runtime as Customer Visualization

This is non-negotiable.

Admin Validation must use the same:

```text
getProductStructuralDefinition(productId)
structuralResolver
componentModelCache
parametricProductBuilder
builder profile registry
```

as customer visualization.

Do not create two builders.

The only difference is:

```text
Admin
→ neutral empty workspace

Customer
→ prepared room image + realism/occlusion
```

---

# 37. Validation Workspace Startup

```text
product_id
↓
load template
↓
load parameters
↓
load components
↓
load structural rules
↓
load Component Model assets
↓
resolve default structure
↓
build THREE.Group
↓
render product
```

If any stage fails, show a clear Admin error.

---

# 38. Parameter Controls

Generate controls from:

```text
product_parameters
```

Admin can test:

```text
minimum
default
maximum
arbitrary valid values
```

Changes rebuild/update the generated model.

---

# 39. Automatic Test Presets

Always generate:

```text
Default
Minimum
Maximum
```

For each structural threshold:

```text
Before Threshold
At Threshold
After Threshold
```

Use `step_value` when possible:

```text
threshold - step
threshold
threshold + step
```

Example:

```text
width >= 2400
step = 50

2350
2400
2450
```

---

# 40. Component Debugger

Show resolved components grouped using current list/accordion styles.

Example Window:

```text
Static Frame
✓ Frame Left
✓ Frame Right
✓ Frame Top

Panels
✓ Glass Panel 1
✓ Glass Panel 2
```

Sliding Door:

```text
Static Frame
✓ Track Top
✓ Track Bottom

Left Leaf
✓ Leaf
✓ Glass
✓ Handle

Right Leaf
✓ Leaf
✓ Glass
✓ Handle
```

Support temporary:

```text
show
hide
isolate
highlight
```

These are preview-only controls.

---

# 41. Assembly Debugger

If `assembly_group` exists, show:

```text
Static Frame
Left Leaf
Right Leaf
```

Admin can isolate a complete assembly.

Useful for:

```text
doors
cabinets
sliding systems
hardware groups
```

---

# 42. Automatic Validation Checks

Before manual approval, run automatic validation.

## Product

```text
product exists
status Inactive
```

## Template

```text
template exists
strategy valid
builder key supported
```

## Parameters

```text
required parameters exist
default within min/max
step valid
```

## Components

```text
required profile roles present
component keys unique
required models uploaded
source dimensions valid
```

## Assets

```text
R2 object exists
GLB loads
catalog image exists
catalog preview exists where required
```

## Rules

```text
condition parses
parameter exists
component references exist
operators/actions supported
```

## Runtime

```text
resolver completes
no NaN
no Infinity
no invalid scale
Three.js build completes
generated group has expected objects
```

---

# 43. Automatic Validation UI

Reuse current status/badge/callout components.

Example:

```text
Automatic Validation

✓ Product data
✓ Catalog assets
✓ Parameters
✓ 14 component models
✓ Structural rules
✓ Default model build

0 Errors
2 Warnings
```

Warnings do not necessarily block activation.

Errors do.

---

# 44. Manual Validation Checklist

After automatic checks pass:

```text
[ ] Default configuration looks correct
[ ] Minimum dimensions look correct
[ ] Maximum dimensions look correct
[ ] Structural rule boundaries were reviewed
[ ] No visible gaps or overlaps
[ ] Glass/panels are correctly positioned
[ ] Hardware is correctly positioned
[ ] Product matches intended design
```

Use existing checkbox styling.

---

# 45. Milestone 6 — Validation Workspace Check

Test at minimum:

```text
A. Basic Window with divider
B. Window without center/sill
C. Sliding Door with multiple assemblies
D. Fixed model when available
```

## Window without center/sill

Verify:

```text
no fake center spacing
no fake sill
component quantities come from real product data
```

## Sliding Door

Verify:

```text
all real components load
left/right assemblies stay grouped
no Window-specific assumptions
width/height adjustments remain valid
```

## Pass condition

```text
PASS
→ implement final review / activation
```

---

# 46. Step 7 — Final Review

Use existing Admin cards/table design.

Example:

```text
Product
Pocket Sliding Door

Strategy
Parametric / Sliding Leaf System

Catalog Assets
2 / 2 Ready

Components
14 / 14 Ready

Parameters
Width, Height

Rules
0

Automatic Validation
Passed

Manual Review
Approved
```

Actions:

```text
Back to Edit
Activate Product
```

---

# 47. Step 8 — Activation

Server-side validation must run again.

Do not trust old client state.

If blocking errors exist:

```text
reject activation
```

If valid:

```text
products.status
Inactive → Active
```

Use the current authenticated Admin as `updated_by`.

---

# 48. Milestone 7 — Publish / Customer Regression

## Validate

- Invalid product cannot activate.
- Valid product activates.
- Product appears in customer catalog.
- Correct Catalog Image appears.
- Product Details loads correct whole GLB.
- Catalog Visualize uses correct `product_id`.
- Product Details Visualize uses correct `product_id`.
- Upload flow preserves selected product.
- Customer workspace loads same structural definition tested by Admin.
- Admin-created product behaves like manually created product.

## Critical requirement

No runtime branch should exist like:

```text
if adminCreated
```

Manual and Admin products must be identical to the runtime.

---

# 49. Editing an Active Product

Structural changes to an Active product require revalidation.

Recommended behavior:

```text
Admin edits structural configuration
↓
mark product/setup as needing validation
↓
block re-publication until validation passes
```

Simplest v1 approach:

```text
set product Inactive before major structural edits
```

Then validate again before activation.

---

# 50. Asset Replacement

Recommended:

```text
1. create new asset ID
2. upload to new versioned R2 key
3. verify object
4. mark old asset Inactive
5. activate new asset
6. require revalidation if structural
```

Avoid overwriting the same R2 object key for new Admin uploads.

---

# 51. Component Removal

Before deletion, check references.

Block removal if used by:

```text
structural_rules
builder requirements
other structural metadata
```

Example:

```text
Cannot remove frame_center.
Rule "Three Pane Width" still references it.
```

---

# 52. Security

Every Admin mutation must verify server-side:

```text
authenticated user
Admin account type
Active profile
Active Admin role
required permission if permissions exist
```

Never trust route visibility alone.

---

# 53. R2 Security

Never expose:

```text
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

to the client.

Use short-lived presigned PUT URLs for one object key.

Validate before signing:

```text
product ownership/context
file type
file extension
size
component relation
```

---

# 54. File Guard Rails

Images:

```text
PNG
JPEG
WebP
```

Models:

```text
GLB
model/gltf-binary
```

Choose model-size limits based on real project GLBs.

Do not choose arbitrary small limits that reject current valid assets.

---

# 55. Upload Progress / Retry

Provide real per-file upload progress.

Do not fake it.

Allow:

```text
Retry
Replace
Remove before final confirmation
```

per file.

Do not restart successful uploads when one file fails.

---

# 56. Avoid One-Shot Implementation

Build in this order only:

```text
Milestone 1
Product draft

Milestone 2
Template / strategy

Milestone 3
Catalog assets

Milestone 4
Component batch upload

Milestone 5
Parameters / rules

Milestone 6
3D validation workspace

Milestone 7
Activation + customer regression
```

Do not implement everything and test only at the end.

---

# 57. Recommended Development Slices

Keep commits/features small.

Example:

```text
feat/admin-product-draft
feat/admin-product-strategy
feat/admin-catalog-upload
feat/admin-component-upload
feat/admin-product-rules
feat/admin-product-validation
feat/admin-product-publish
```

Equivalent naming is fine.

Avoid one massive commit.

---

# 58. Shared Runtime Modules

Admin and customer should reuse:

```text
getProductStructuralDefinition
getR2AssetUrl
builderProfiles
structuralResolver
componentModelCache
parametricProductBuilder
structuralValidation
```

Recommended conceptual location:

```text
src/lib/products/
├── structuralData.ts
├── builderProfiles.ts
├── structuralResolver.ts
├── componentModelCache.ts
├── parametricProductBuilder.ts
└── structuralValidation.ts
```

---

# 59. Admin-Specific Modules

Only Admin workflow concerns should be separate.

Example:

```text
src/lib/admin/products/
├── productDraft.ts
├── assetUpload.ts
├── productMutations.ts
└── productValidationActions.ts
```

Possible UI organization:

```text
components/admin/products/
├── ProductSetupFlow
├── BasicInfoSection
├── VisualizationStrategySection
├── CatalogAssetsSection
├── ComponentUploadSection
├── ParametersRulesSection
├── ProductValidationWorkspace
└── ProductPublishReview
```

Adapt names to the current codebase.

---

# 60. Reuse Existing Pages Instead of Replacing Them

If the Admin already has:

```text
Create Product
Edit Product
Product list
Product detail/edit page
```

extend those.

The workflow can appear as:

```text
existing page header
existing breadcrumb

[ Basic ]
[ Visualization ]
[ Assets ]
[ Components ]
[ Parameters ]
[ Validate ]
```

if tabs match the current UI better than a stepper.

The exact navigation pattern should follow the current Admin.

The required workflow behavior matters more than forcing a specific visual stepper.

---

# 61. UI Reuse Rule

Before creating a new component:

```text
search current Admin codebase
```

for an equivalent.

Examples:

```text
Need file card?
→ reuse current file/asset card

Need tabs?
→ reuse Admin tabs

Need confirmation?
→ reuse dialog

Need status?
→ reuse badge

Need panel?
→ reuse existing page section/card
```

Only create a new primitive when an equivalent does not exist.

---

# 62. New 3D Viewport, Existing Styling

The Three.js validation viewport is genuinely new.

Create something like:

```text
ProductValidationViewport
```

But its surrounding UI must use existing Admin components/layout.

Do not introduce a new design language.

---

# 63. Publish Invariants — Parametric

Before Active:

```text
Product
✓ exists

Template
✓ Active
✓ Parametric
✓ supported builder_key

Catalog
✓ Catalog Image
✓ Catalog 3D Preview

Parameters
✓ required parameters

Components
✓ required builder roles
✓ required GLB assets

Rules
✓ all references valid

Runtime
✓ resolver succeeds
✓ model builds

Admin Validation
✓ automatic checks pass
✓ manual review approved
```

---

# 64. Publish Invariants — Fixed

For Fixed:

```text
Product
✓

Template
✓ Fixed

Required Assets
✓

3D Validation
✓ model loads
✓ scale/orientation acceptable
```

Skip Parametric-only requirements.

---

# 65. End-to-End Definition of Done

The Admin feature is complete when:

```text
ADMIN
↓
Add Product
↓
enter basic information
↓
choose visualization strategy
↓
upload catalog assets
↓
batch upload component GLBs
↓
confirm mappings
↓
configure dimensions/rules
↓
open empty 3D validation workspace
↓
test default/min/max/thresholds
↓
automatic validation passes
↓
manual review approved
↓
activate product
```

Then:

```text
CUSTOMER CATALOG
↓
product appears
↓
Product Details uses catalog assets
↓
Visualize preserves product_id
↓
space image FastAPI pipeline
↓
same structural loader
↓
same component R2 assets
↓
same resolver/builder validated in Admin
↓
correct overlay
```

---

# 66. Final Milestone Checklist

## Milestone 1 — Product Draft

- [ ] Existing Admin UI reused
- [ ] Product created Inactive
- [ ] Correct Admin `created_by`
- [ ] Draft survives reload
- [ ] Public catalog excludes draft

## Milestone 2 — Strategy

- [ ] Fixed/Parametric saves
- [ ] Builder profile saves
- [ ] Reload restores settings
- [ ] No Product Type → Builder hardcoding

## Milestone 3 — Catalog Assets

- [ ] Direct R2 upload works
- [ ] Catalog Image registered
- [ ] Catalog 3D Preview registered
- [ ] Replace works
- [ ] Retry works
- [ ] Asset URLs load

## Milestone 4 — Components

- [ ] Multi-file selection works
- [ ] Mapping editable
- [ ] Components created
- [ ] R2 assets linked
- [ ] Per-file progress
- [ ] Individual retry
- [ ] GLB dimensions captured
- [ ] Refresh restores state

## Milestone 5 — Parameters / Rules

- [ ] Parameters persist
- [ ] Min/default/max validated
- [ ] Missing-component rule references blocked
- [ ] Zero-rule products supported
- [ ] Shared resolver consumes data

## Milestone 6 — 3D Validation

- [ ] Uses shared customer builder
- [ ] Neutral workspace
- [ ] Width/height controls
- [ ] Default/min/max presets
- [ ] Threshold presets
- [ ] Component debugger
- [ ] Assembly debugger
- [ ] Automatic validation
- [ ] Manual approval

## Milestone 7 — Publish

- [ ] Server revalidates
- [ ] Invalid product blocked
- [ ] Valid product activates
- [ ] Customer catalog works
- [ ] Product Details works
- [ ] Visualize carries correct product_id
- [ ] Customer gets same model validated by Admin

---

# 67. Guiding Architecture

```text
ADMIN UI
= easy authoring interface

SERVER
= authorization + Supabase writes + upload signing + validation

SUPABASE
= product structure and business metadata

CLOUDFLARE R2
= product media and GLB files

SHARED STRUCTURAL RUNTIME
= converts Supabase + R2 data into a Three.js product

ADMIN 3D VALIDATION
= tests that shared runtime before publication

CUSTOMER VISUALIZATION
= uses the same runtime over the prepared room image
```

The Admin feature is successful when an Admin does not need to understand:

```text
SQL
UUIDs
R2 object keys
JSONB
component IDs
product_assets
Three.js source measurements
```

while the resulting product remains structurally identical to one created through the existing manual workflow.
