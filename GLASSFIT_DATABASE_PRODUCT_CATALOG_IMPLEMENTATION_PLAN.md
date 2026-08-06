# GlassFit Implementation Plan: Replace Mock Product List with Supabase Products

## 1. Objective

Replace the hardcoded or mock product list currently used by the GlassFit frontend with active records loaded from `public.products` in Supabase.

This step changes only the source of the product catalog data.

The existing frontend layout, product cards, selection behavior, visualization workflow, Three.js renderer, procedural window implementation, cabinet model, overlay controls, and final image generation should continue to work.

At this stage:

- `public.products` is the source of product identity and catalog information.
- Existing local model/rendering logic remains responsible for choosing the correct 3D implementation.
- `product_templates`, `product_parameters`, `product_components`, `structural_rules`, `product_assets`, and `product_variations` are not required for this step.
- R2 is not required yet.
- The frontend must no longer depend on a hardcoded list to decide which products are visible.

## 2. Schema Source of Truth

Use the existing GlassFit SQL schema exactly as implemented.

The relevant table is:

```sql
public.products
```

Relevant columns:

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

Allowed `product_type` values:

```text
Window
Door
Partition
Cabinet
Enclosure
Railing
Other
```

Allowed `status` values:

```text
Active
Inactive
```

There is no `is_structural` column in `public.products`.

Structural behavior is represented later through:

```text
public.product_templates.model_strategy
```

with:

```text
Fixed
Parametric
```

The current implementation must query only active products:

```text
status = Active
```

The schema already permits public read access to active product records for both anonymous and authenticated users.

## 3. Expected Result

Before this change:

```text
Frontend imports a hardcoded product list
→ product cards are rendered
→ product type determines which model is opened
```

After this change:

```text
Frontend queries public.products
→ active products are returned
→ database products are mapped into the existing frontend product-card shape
→ customer selects a database product
→ existing model/rendering implementation is chosen using product_type
```

Example mapping:

```text
Database product:
Standard Aluminum Window
product_type: Window

Frontend renderer:
Existing parametric window implementation
```

```text
Database product:
Three-Drawer Cabinet
product_type: Cabinet

Frontend renderer:
Existing cabinet GLB or procedural fallback
```

The database controls whether the product appears in the catalog. The existing frontend still controls how the product is rendered until templates and assets are connected in a later implementation.

## 4. Scope

### Included

- Query active products from Supabase.
- Replace hardcoded catalog products with query results.
- Preserve anonymous catalog browsing.
- Preserve authenticated catalog browsing.
- Map database products into the existing frontend product interface.
- Preserve the existing window and cabinet rendering behavior.
- Add loading, empty, and error states.
- Prevent unsupported database product types from crashing the visualization.
- Pass `product_id` through the frontend selection and overlay state.
- Keep existing mock/local 3D assets temporarily.

### Not included

- Creating product templates.
- Loading structural parameters from the database.
- Loading structural rules from the database.
- Loading GLB files from R2.
- Loading catalog images from R2.
- Loading product variations.
- Saving product configurations.
- Quotation generation.
- Admin product-management forms.
- Removing the existing local renderer implementations.
- Changing the procedural window architecture.

## 5. Important Architecture Rule

Do not use `product_name` as the permanent technical identifier for rendering.

Use:

```text
product_id
```

as the database identity.

Use:

```text
product_type
```

only as a temporary adapter for selecting the current renderer.

Temporary mapping:

```ts
Window -> existing parametric window
Cabinet -> existing cabinet renderer
```

Do not permanently encode behavior such as:

```ts
if (product.product_name === "Standard Aluminum Window")
```

Names can be edited by admins. The product UUID is stable, and the type is the correct temporary classification.

## 6. Codebase Review Instructions for the Implementing Agent

Before changing code, inspect the current repository and identify:

1. The hardcoded product list or model registry.
2. The component that renders product cards or product choices.
3. The type currently used for a product/model option.
4. The function that creates an active overlay.
5. The place where `window` and `cabinet` renderer keys are selected.
6. The active overlay and placed overlay interfaces.
7. Any comparison page or product-detail page using the same mock data.
8. Existing Supabase browser and server client helpers.
9. Whether the catalog page is currently a Server Component or Client Component.

Known MVP references may include files similar to:

```text
src/lib/productModels.ts
src/lib/types.ts
src/components/ProductModelPanel.tsx
src/components/GlassFitMvp.tsx
src/lib/modelRenderer.ts
```

The actual repository must be treated as authoritative. Do not rename files unnecessarily if the current codebase uses different locations.

## 7. Recommended Data Types

Create a database-facing product type.

```ts
export type DatabaseProduct = {
  product_id: string;
  product_name: string;
  product_type:
    | "Window"
    | "Door"
    | "Partition"
    | "Cabinet"
    | "Enclosure"
    | "Railing"
    | "Other";
  description: string | null;
  base_price: number;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
};
```

Do not include `created_by` and `updated_by` in the public catalog query unless the frontend actually needs them.

Create or update the UI-facing type so it carries the database UUID.

```ts
export type CatalogProduct = {
  id: string;
  name: string;
  type: DatabaseProduct["product_type"];
  description: string | null;
  basePrice: number;
  rendererKey: SupportedRendererKey | null;
};
```

Temporary renderer type:

```ts
export type SupportedRendererKey = "window" | "cabinet";
```

## 8. Product-to-Renderer Adapter

Create one explicit adapter function.

```text
Database product type
→ supported existing renderer key
```

Suggested behavior:

```ts
function resolveRendererKey(
  productType: DatabaseProduct["product_type"]
): SupportedRendererKey | null {
  switch (productType) {
    case "Window":
      return "window";
    case "Cabinet":
      return "cabinet";
    default:
      return null;
  }
}
```

This adapter is intentionally temporary.

Later it will be replaced or expanded using:

```text
product_templates.model_strategy
product_assets
product_components
```

The catalog may display unsupported products, but the visualization action must be disabled or show a clear message until a renderer exists.

Recommended customer-facing message:

```text
This product is available in the catalog, but its visualization model is not available yet.
```

Do not silently load a different product model.

## 9. Supabase Query

Query `public.products` using the existing Supabase client.

Required fields:

```text
product_id
product_name
product_type
description
base_price
status
created_at
updated_at
```

Required filtering:

```text
status = Active
```

Recommended ordering:

```text
product_type ascending
product_name ascending
```

Equivalent Supabase query:

```ts
const { data, error } = await supabase
  .from("products")
  .select(`
    product_id,
    product_name,
    product_type,
    description,
    base_price,
    status,
    created_at,
    updated_at
  `)
  .eq("status", "Active")
  .order("product_type", { ascending: true })
  .order("product_name", { ascending: true });
```

Do not add a filter for `is_structural`; that column does not exist.

The query must work for anonymous visitors because browsing does not require an account.

## 10. Recommended Fetching Strategy

Use server-side fetching for the initial catalog when the current route supports Server Components.

Preferred approach:

```text
Server Component queries Supabase
→ serializable active products are passed to the client catalog component
→ client handles selection and visualization interaction
```

Benefits:

- No client-side loading flash for the initial catalog.
- Supabase query logic stays centralized.
- The page can render catalog content before hydration.
- Anonymous users remain supported through the publishable key and RLS.

If the existing catalog is deeply embedded inside a client-only visualization component, a client-side fetch is acceptable for this step.

Do not restructure the entire application solely to force server-side fetching.

Choose the smallest change that matches the current codebase.

## 11. Suggested Service Layer

Create a reusable catalog function rather than placing the Supabase query directly inside multiple UI components.

Suggested file:

```text
src/lib/products/getActiveProducts.ts
```

or follow the repository’s current data-access convention.

Responsibilities:

- Create or receive the appropriate Supabase client.
- Query active products.
- Return typed data.
- Throw or return a normalized application error.
- Contain no UI code.

Example interface:

```ts
export async function getActiveProducts(): Promise<DatabaseProduct[]>
```

If separate browser and server functions are needed, use shared query logic where practical.

Avoid duplicating the full select string across catalog, product details, and visualization components.

## 12. Replace the Mock Product List

Locate the current hardcoded list, likely containing entries similar to:

```ts
[
  {
    id: "cabinet",
    label: "Cabinet",
    modelPath: "/models/ikea-3-drawer.glb"
  },
  {
    id: "window",
    label: "Window",
    modelPath: "/models/glass_window.glb"
  }
]
```

Change its responsibility.

It must no longer be the list of products that customers can browse.

It may remain temporarily as a renderer registry:

```ts
export const rendererRegistry = {
  window: {
    rendererKey: "window",
    fallbackModelPath: "/models/glass_window.glb"
  },
  cabinet: {
    rendererKey: "cabinet",
    fallbackModelPath: "/models/ikea-3-drawer.glb"
  }
};
```

New separation:

```text
Supabase products
→ determines what products exist and appear

Local renderer registry
→ determines how currently supported types are visualized
```

This prevents database identity from being mixed with local asset implementation.

## 13. Product Selection Changes

When the customer chooses a product, pass the complete mapped catalog product or at least:

```text
product_id
product_name
product_type
renderer_key
base_price
```

The active overlay state must retain:

```text
productId
productName
productType
rendererKey
```

Example:

```ts
type ActiveProductReference = {
  productId: string;
  productName: string;
  productType: DatabaseProduct["product_type"];
  rendererKey: SupportedRendererKey;
};
```

Do not retain only:

```text
window
cabinet
```

The renderer key is not the product’s database identity.

This change prepares the application for later insertion into:

```text
public.product_configurations.product_id
```

## 14. Overlay State Compatibility

Update the active and placed overlay types carefully.

Minimum additional fields:

```text
productId: string
productName: string
productType: string
rendererKey: "window" | "cabinet"
```

Preserve all current fields used by the MVP, including:

- transform;
- model path;
- glass settings;
- realism settings;
- occlusion selections;
- cached transparent render;
- display name;
- layer state.

Do not remove existing overlay behavior.

When creating display names, use the database product name.

Example:

```text
Standard Aluminum Window 1
Standard Aluminum Window 2
Three-Drawer Cabinet 1
```

If the current UI needs shorter names, maintain a separate display label but keep the full database product name in state.

## 15. Catalog UI States

The frontend must handle four states.

### Loading

Show a product-loading state without rendering mock products.

```text
Loading products...
```

### Success

Render active products returned by Supabase.

### Empty

If no active products exist:

```text
No products are currently available.
```

Do not silently fall back to mock products because this would hide database or content problems.

### Error

Show a user-safe message:

```text
Products could not be loaded. Please refresh the page and try again.
```

Log the detailed Supabase error for development.

Do not expose database internals, policies, SQL, or raw PostgREST errors to customers.

## 16. Supported and Unsupported Products

For this implementation:

| Database `product_type` | Current renderer | Visualization availability |
|---|---|---|
| `Window` | Parametric window | Enabled |
| `Cabinet` | Existing cabinet model/fallback | Enabled |
| `Door` | None | Disabled |
| `Partition` | None | Disabled |
| `Enclosure` | None | Disabled |
| `Railing` | None | Disabled |
| `Other` | None | Disabled |

The catalog may still show unsupported products because they are legitimate business products.

Disable only the visualization action.

Do not prevent the product from appearing unless the business has set:

```text
status = Inactive
```

## 17. Public Catalog and Authentication

The catalog must remain accessible without authentication.

The schema has public read policies for active:

- products;
- templates;
- parameters;
- components;
- structural rules;
- assets;
- variations.

This step uses only `products`.

Do not call `getCurrentUser()` as a requirement for catalog fetching.

Authentication remains required later when saving the final snapshot or proceeding to booking.

## 18. Validation and Error Handling

Validate the database response before using it in the visualization.

At minimum:

- `product_id` must be a non-empty UUID string.
- `product_name` must be non-empty.
- `product_type` must match a supported schema value.
- `base_price` must be a finite, nonnegative number.
- `status` must be `Active`.
- Unsupported renderers must resolve to `null`, not throw.

If generated Supabase database types are already available, use them.

Recommended future command:

```bash
supabase gen types typescript --project-id <project-id> --schema public
```

For this implementation, manual types are acceptable if the repository is not yet using the Supabase CLI.

Do not use `any` for product records.

## 19. Pricing Display

`public.products.base_price` may currently be `0.00` because final pricing rules are not settled.

The catalog must not display:

```text
₱0.00
```

as though the product is free.

Recommended display logic:

```text
base_price > 0
→ display “Starting at ₱...”

base_price = 0
→ display “Price available after configuration”
```

This is only catalog presentation.

Do not implement quotation calculation in this task.

## 20. Cache and Refresh Behavior

For the first implementation, fresh reads are preferable while product management is being tested.

If using a Next.js Server Component:

```ts
export const dynamic = "force-dynamic";
```

or use the project’s preferred no-cache strategy.

If using client fetching, add a manual retry path or refetch when the page reloads.

Do not introduce a complex state-management or caching library solely for two product records.

A lightweight fetch through the existing Supabase client is sufficient.

## 21. Suggested File Changes

The implementing agent must adapt these suggestions to the actual repository.

### Likely new files

```text
src/lib/products/types.ts
src/lib/products/getActiveProducts.ts
src/lib/products/productRendererAdapter.ts
```

### Likely modified files

```text
src/lib/productModels.ts
src/lib/types.ts
src/components/ProductModelPanel.tsx
src/components/GlassFitMvp.tsx
```

Possible catalog-specific files may also need changes:

```text
src/app/products/page.tsx
src/components/ProductCatalog.tsx
src/components/ProductCard.tsx
```

Do not create duplicate product systems. Reuse the existing catalog and visualization entry points.

## 22. Implementation Steps

### Step A: Inspect current product flow

Trace:

```text
hardcoded product definition
→ product card/panel
→ selection callback
→ active overlay creation
→ renderer/model selection
```

Document the exact files before editing.

### Step B: Add database product types

Add typed representations for:

- raw Supabase product;
- mapped catalog product;
- renderer key.

### Step C: Add active-products query

Create a reusable query that reads only active `public.products`.

### Step D: Add renderer adapter

Map `Window` and `Cabinet` to the existing implementations.

### Step E: Replace mock catalog source

Feed database products into the current UI.

Do not remove the current renderer registry.

### Step F: Carry product UUID through selection

Update product selection and overlay state to retain `product_id`.

### Step G: Add UI states

Handle loading, empty, query error, and unsupported renderer states.

### Step H: Verify public access

Test while logged out and logged in.

### Step I: Remove obsolete mock fallback

Remove any automatic fallback that re-adds mock catalog products after a database query fails.

Keep model-level procedural fallbacks because those are still required.

## 23. Acceptance Criteria

The task is complete when all of the following are true:

1. The frontend reads products from `public.products`.
2. The hardcoded product array no longer determines which catalog products appear.
3. Only records with `status = 'Active'` appear to customers.
4. The catalog works while logged out.
5. The catalog works while logged in.
6. `Standard Aluminum Window` appears from its database record.
7. Selecting the window opens the existing parametric-window visualization.
8. `Three-Drawer Cabinet` appears from its database record.
9. Selecting the cabinet opens the existing cabinet visualization.
10. The active overlay retains the selected database `product_id`.
11. Multiple instances of the same product retain the same `product_id` but have separate overlay instance IDs.
12. Unsupported product types do not crash the application.
13. An empty database result shows an empty state rather than mock products.
14. A Supabase failure shows an error state rather than mock products.
15. A `base_price` of zero is not presented as a free product.
16. Existing upload, segmentation, overlay editing, realism, glass appearance, duplicate, reorder, and PNG export behavior still works.
17. TypeScript compilation succeeds.
18. Linting succeeds.
19. Production build succeeds.

## 24. Test Cases

### Test 1: Anonymous catalog read

- Sign out.
- Open the catalog.
- Confirm both active database products appear.

Expected:

```text
Supabase query succeeds through public RLS.
```

### Test 2: Window selection

- Select `Standard Aluminum Window`.
- Enter the visualization workspace.
- Add the product.

Expected:

```text
Existing parametric window is used.
Selected productId equals the window product UUID.
```

### Test 3: Cabinet selection

- Select `Three-Drawer Cabinet`.
- Add it to the visualization.

Expected:

```text
Existing cabinet renderer or procedural fallback is used.
Selected productId equals the cabinet product UUID.
```

### Test 4: Inactive product

Run temporarily:

```sql
update public.products
set status = 'Inactive'
where product_name = 'Three-Drawer Cabinet';
```

Reload the catalog.

Expected:

```text
Cabinet does not appear to an anonymous or customer user.
```

Restore it afterward.

### Test 5: Empty catalog

Temporarily set all products inactive.

Expected:

```text
No products are currently available.
```

No mock cards should appear.

### Test 6: Unsupported product type

Insert or activate a `Door` product without a renderer.

Expected:

```text
Product appears in the catalog.
Visualization action is disabled or produces a controlled availability message.
```

### Test 7: Database error

Temporarily use an invalid environment value or block the request in development.

Expected:

```text
User-safe catalog error appears.
Raw Supabase details are logged only for development.
```

### Test 8: Duplicate overlay

Add the same database window twice.

Expected:

```text
Both overlays share the same productId.
Each overlay has a different overlay instance ID.
Both remain independently editable.
```

## 25. Rollback Plan

If the database integration causes a blocking issue:

1. Revert only the catalog data-source changes.
2. Preserve the new product types where harmless.
3. Restore the old mock list temporarily.
4. Do not revert Supabase authentication or the database schema.
5. Do not remove `product_id` support from overlay state once later persistence work depends on it.

Rollback is for development recovery only. Mock catalog data must not remain the final implementation.

## 26. Future Follow-Up After This Task

After database products are successfully driving the catalog, the next database-backed product step should be:

```text
Insert and load public.product_templates
```

Expected records:

```text
Standard Aluminum Window
model_strategy = Parametric

Three-Drawer Cabinet
model_strategy = Fixed
```

That later step will replace the temporary `product_type` renderer mapping with template-driven behavior.

After templates:

```text
product_parameters
product_components
structural_rules
product_assets
product_variations
```

This plan intentionally stops before those additions.

## 27. Definition of Done

The database is now the authoritative product catalog.

Supabase determines:

- which products exist;
- which products are active;
- their names;
- their types;
- their descriptions;
- their base catalog prices.

The existing frontend renderer registry temporarily determines:

- whether the current build can visualize the product;
- whether to use the parametric window;
- whether to use the cabinet model;
- which local fallback asset is used.

The product UUID is preserved through the frontend so later snapshot, configuration, variation, and quotation records can reference the exact selected product.
