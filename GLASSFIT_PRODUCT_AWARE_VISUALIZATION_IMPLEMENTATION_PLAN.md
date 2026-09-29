# GlassFit Product-Aware Visualization Implementation Plan

## 1. Purpose

This implementation plan connects the currently working GlassFit product catalog and product-details flow to the photo-based visualization workspace.

The key requirement is:

> When the customer clicks **Visualize** for a product, GlassFit must preserve that product's real `product_id` through the upload flow so that, after the space image is prepared, the correct product structure and R2 component assets are loaded as the active overlay.

This implementation will reuse the behavior already proven in the MVP:

- FastAPI image validation and analysis;
- brightness / lighting analysis;
- scene/depth analysis where currently used;
- YOLOv8 segmentation and masks;
- backend-assisted image preparation;
- Three.js product rendering;
- one live editable Three.js overlay at a time;
- cached transparent layers for placed products;
- Canvas compositing;
- ambient-light matching;
- object-aware layering;
- Auto Realism / visual matching;
- glass appearance handling;
- final visualization generation.

The difference is that the real GlassFit application will now be **database- and R2-driven** instead of using hardcoded/local product model definitions.

---

# 2. Current Implemented State

The project already has:

```text
Frontend
Registration / Login
Supabase connection

Product Catalog
    ↓
public.products
+
public.product_assets

Cloudflare R2
    ↓
Catalog Image
Catalog 3D Preview

Product Details
    ↓
2D preview
+
interactive whole-model 3D preview
```

The Window structural data and structural GLB assets have also already been added to:

```text
Supabase
├── product_templates
├── product_parameters
├── product_components
├── structural_rules
└── product_assets

Cloudflare R2
└── Component Model GLBs
```

The space-image frontend currently exists, and the FastAPI service has been copied from the validated MVP.

---

# 3. Target Customer Flow

There are two ways to enter visualization.

## 3.1 Product Catalog

```text
Product Card
│
├── View Product
│      ↓
│   Product Details
│
└── Visualize
       ↓
    Upload Space Image
```

## 3.2 Product Details

```text
Product Details
│
├── 2D / 3D product inspection
│
└── Visualize
       ↓
    Upload Space Image
```

Both **Visualize** buttons must lead to the exact same visualization pipeline.

The selected product must always be identified by:

```text
products.product_id
```

Never by:

```text
product_name
product_type
"window"
"cabinet"
local renderer key
```

---

# 4. Recommended Visualization Routes

Use the product UUID directly in the visualization route.

Recommended:

```text
/visualize/[productId]/upload
```

and later:

```text
/visualize/[productId]/workspace
```

Example:

```text
/products/8c37...
```

Product Details Visualize:

```text
/visualize/8c37.../upload
```

Catalog Visualize:

```text
/visualize/8c37.../upload
```

After successful FastAPI image preparation:

```text
/visualize/8c37.../workspace
```

The route itself therefore carries the authoritative selected product.

This is preferable to a renderer key such as:

```text
/visualize/window
```

because GlassFit may eventually have multiple Window products with different structures.

---

# 5. Product Catalog Button Behavior

Each product card already has its real:

```text
product.product_id
```

The card should support:

```text
View Product
→ /products/{product_id}
```

and:

```text
Visualize
→ /visualize/{product_id}/upload
```

Conceptual example:

```tsx
<Link href={`/products/${product.product_id}`}>
  View Product
</Link>

<Link href={`/visualize/${product.product_id}/upload`}>
  Visualize
</Link>
```

No product data needs to be duplicated into query parameters.

The target page should load the product from Supabase using the UUID.

---

# 6. Product Details Button Behavior

The currently working Product Details page should remain unchanged for:

```text
Catalog Image
Catalog 3D Preview
```

Add or connect:

```text
Visualize
```

to:

```text
/visualize/{product_id}/upload
```

The Product Details page must not pass the whole GLB or component list through client navigation.

It only passes identity:

```text
product_id
```

The visualization flow retrieves the current structural data independently.

---

# 7. Upload Page Responsibility

Route:

```text
/visualize/[productId]/upload
```

The upload page has two responsibilities:

1. Verify and display the selected product.
2. Prepare the customer's space image through FastAPI.

It should **not render the structural product yet**.

---

# 8. Validate the Selected Product

When the upload route opens, load the product using `productId`.

Validate:

```text
product exists
status = Active
```

Recommended data:

```text
product_id
product_name
product_type
description
primary Catalog Image
```

The upload page can show a small selected-product summary:

```text
You are visualizing:

Standard Aluminum Window

[product image]

Change Product
```

This gives the customer confirmation that the correct product will be placed after upload.

If the UUID is invalid or inactive:

```text
do not continue to visualization
```

Show a safe not-found/unavailable state.

---

# 9. Upload Page State

Recommended states:

```text
idle
validating
analyzing
ready
error
```

The initial page should know:

```ts
type SelectedVisualizationProduct = {
  productId: string;
  productName: string;
  productType: string;
  catalogImageUrl: string | null;
};
```

The customer then selects the space image.

---

# 10. Space-Image Pipeline

Use the finalized space-image pipeline.

```text
Customer selects image
        ↓
Frontend guard rails
        ↓
Immediate local preview
        ↓
POST original file to FastAPI
        ↓
FastAPI validates again
        ↓
Existing tested analysis pipeline
        ↓
Workspace image normalization
        ↓
Segmentation / masks
        ↓
Return session result
```

The existing tested FastAPI behavior should be preserved.

---

# 11. Frontend Guard Rails

Initial checks:

```text
JPEG / PNG
maximum ~12 MB
valid decodable image
valid dimensions
```

The frontend checks are for immediate user experience.

FastAPI repeats all important validation.

---

# 12. FastAPI Responsibilities

FastAPI remains responsible for the heavy work:

```text
validation
EXIF/orientation handling
brightness analysis
ambient/light analysis
scene detection
depth analysis where currently used
YOLOv8 segmentation
mask generation
workspace image preparation
```

Initial workspace target:

```text
maximum long edge ≈ 1920px
no upscaling
high-quality output
```

The existing analysis should continue using the proven input behavior until regression testing confirms optimizations are safe.

---

# 13. FastAPI Session Result

Conceptually:

```ts
type SpaceImageSession = {
  sessionId: string;

  workspaceImage: {
    url: string;
    width: number;
    height: number;
  };

  brightness: BrightnessAnalysis;
  lighting: LightingAnalysis;

  detectedObjects: DetectedObject[];

  segmentation: {
    mode: string;
    model: string | null;
  };

  warnings: string[];

  // Existing depth / scene output where currently used.
};
```

This remains temporary frontend/session data.

Do **not** insert it into Supabase.

---

# 14. Transition to the Workspace

After FastAPI successfully returns the prepared image:

```text
selected product_id
+
space-image session
        ↓
Visualization Workspace
```

There are two implementation options.

## Recommended first implementation

Keep the upload result in a visualization session provider/store and navigate to:

```text
/visualize/{product_id}/workspace
```

The workspace receives:

```text
productId
```

from the URL and:

```text
SpaceImageSession
```

from active client session state.

If the workspace is opened directly without a prepared image session:

```text
redirect back to /visualize/{product_id}/upload
```

This preserves the intentionally non-persistent visualization workflow.

---

# 15. Visualization Session Provider

Create a dedicated client-side provider/store for the active visualization.

Conceptually:

```ts
type VisualizationSessionState = {
  selectedProductId: string | null;

  spaceImageSession: SpaceImageSession | null;

  structuralDefinition: ProductStructuralDefinition | null;

  activeOverlay: ActiveOverlay | null;

  placedOverlays: PlacedOverlay[];
};
```

This provider is temporary.

It is not backed by Supabase.

Refreshing/leaving the flow may reset the unfinished visualization.

---

# 16. Workspace Startup Sequence

When:

```text
/visualize/{product_id}/workspace
```

loads, follow this sequence:

```text
1. Confirm SpaceImageSession exists
2. Read product_id from route
3. Load structural definition from Supabase
4. Resolve R2 URLs for Component Model assets
5. Load/cache required component GLBs
6. Resolve default product structure
7. Build the product
8. Create it as the active Three.js overlay
9. Display it over the prepared workspace image
```

This guarantees that the overlay always corresponds to the product used to enter the visualization flow.

---

# 17. Structural Definition Loader

Create a generic server/data function such as:

```text
getProductStructuralDefinition(productId)
```

It should load:

```text
products
    ↓
product_templates
    ↓
product_parameters
product_components
structural_rules
```

and for every component:

```text
active Component Model product_asset
```

The loader must use the real Supabase relationships.

---

# 18. Structural Definition Result

Conceptually:

```ts
type ProductStructuralDefinition = {
  product: {
    productId: string;
    productName: string;
    productType: string;
  };

  template: {
    templateId: string;
    modelStrategy: "Fixed" | "Parametric";
    measurementUnit: string;
    baseConfiguration: Record<string, unknown>;
  };

  parameters: ProductParameter[];

  components: ProductComponentDefinition[];

  rules: StructuralRule[];
};
```

Each component should include:

```ts
{
  componentId: string;
  componentKey: string;
  componentName: string;
  componentType: string;

  baseQuantity: number;

  componentData: ...;

  model: {
    r2ObjectKey: string;
    url: string;
  };
}
```

---

# 19. R2 URL Resolution

Reuse the existing R2 helper.

Database:

```text
product_assets.r2_object_key
```

Example:

```text
products/{product_id}/components/{component_id}/model.glb
```

Frontend URL:

```text
NEXT_PUBLIC_R2_ASSET_BASE_URL
+
r2_object_key
```

Do not store full `r2.dev` URLs inside structural logic.

---

# 20. Product Strategy Resolution

The visualization system should support both structural strategies.

```text
product_templates.model_strategy
```

determines the build path.

## Parametric

```text
template
+ parameters
+ components
+ structural rules
→ generated runtime model
```

Current Window uses this path.

## Fixed

Future fixed products may use:

```text
Whole Model
```

or another appropriate runtime asset.

This means the visualization entry flow can remain generic for future products.

---

# 21. Current Window Component Sources

The current Window structural assets are:

```text
frame_bottom.glb
frame_center.glb
frame_left.glb
frame_right.glb
frame_top.glb
glass_panel.glb
window_sill.glb
```

These are already represented through:

```text
product_components
+
Component Model product_assets
```

The runtime should not use these original filenames as identity.

Use:

```text
component_key
component_id
```

from Supabase.

---

# 22. Component GLB Cache

The builder should download each **source component model once**.

For the Window:

```text
7 source GLBs
```

Cache by:

```text
component_id
```

or stable resolved asset URL.

Example:

```ts
Map<string, THREE.Object3D>
```

Then runtime instances are clones.

Example:

```text
glass_panel source
        ↓
load once
        ↓
clone GlassPanel_1
clone GlassPanel_2
clone GlassPanel_3
```

Similarly:

```text
frame_center source
        ↓
load once
        ↓
clone Mullion_1
clone Mullion_2
```

Do not download the same component file repeatedly.

---

# 23. Pure Structural Resolver

Create a structure resolver that does **not** depend on Three.js.

Conceptual input:

```ts
resolveProductStructure({
  template,
  parameters,
  components,
  structuralRules,
  values
});
```

Conceptual output:

```ts
{
  resolvedValues: {
    width: 2100,
    height: 1500,
    pane_count: 2,
    mullion_count: 1
  },

  componentQuantities: {
    frame_left: 1,
    frame_right: 1,
    frame_top: 1,
    frame_bottom: 1,
    frame_center: 1,
    glass_panel: 2,
    window_sill: 1
  }
}
```

For a width that triggers the rule:

```text
pane_count = 3
mullion_count = 2
frame_center × 2
glass_panel × 3
```

The structural resolver becomes the shared source for:

```text
rendering
future pricing
future quotation
```

---

# 24. Structural Rule Evaluation

Evaluate rules using:

```text
priority
```

in deterministic order.

Initial supported condition contract for the current Window:

```json
{
  "parameter": "width",
  "operator": ">=",
  "value": 2400,
  "unit": "mm"
}
```

Initial supported action:

```json
{
  "set": {
    "pane_count": 3,
    "mullion_count": 2
  },
  "component_quantities": {
    "frame_center": 2,
    "glass_panel": 3
  }
}
```

Do not hardcode:

```ts
if (productType === "Window" && width >= 2400)
```

inside React.

The rule should come from Supabase.

---

# 25. Parametric Three.js Builder

After resolving the structure:

```text
resolved structure
        ↓
GLB cache
        ↓
clone component instances
        ↓
resize allowed axes
        ↓
position components
        ↓
THREE.Group
```

The builder should return a single parent:

```text
GeneratedProduct
```

The Canvas/overlay editor treats this generated parent the same way the MVP treated one complete model.

---

# 26. Component Resize Behavior

Keep the already-proven structural principle:

```text
Left / Right frame
→ height changes

Top / Bottom frame
→ width changes

Center frame
→ height changes
→ may repeat

Glass panel
→ width and height change
→ may repeat

Window sill
→ width changes
```

Do not uniformly scale the whole Window.

Structural dimensions modify only the intended pieces.

---

# 27. Verify Source GLB Dimensions Before Final Builder Math

Before relying on component scaling, inspect each GLB's authored bounds.

Use:

```text
THREE.Box3
getSize()
```

Record verified source dimensions in:

```text
product_components.component_data
```

if they are not already stored.

Runtime scaling should use:

```text
target dimension / authored source dimension
```

rather than assuming Blender export dimensions.

---

# 28. Structural Dimensions vs Scene Placement

These remain separate.

## Structural values

Examples:

```text
width = 2100 mm
height = 1500 mm
pane count = 2
```

Affect:

```text
generated product construction
future quotation
```

## Scene placement

Examples:

```text
overlay x / y
scene scale
2D rotation
yaw
pitch
```

Affect only:

```text
appearance in the uploaded image
```

Changing scene scale must not change the real Window dimensions.

---

# 29. Initial Overlay Created from the Selected Product

This is the critical product-aware behavior.

When the workspace finishes loading the selected product:

```text
route product_id
        ↓
structural definition
        ↓
default configuration
        ↓
generated runtime product
        ↓
active overlay
```

Therefore:

```text
Catalog Window A → Visualize
→ Window A overlay

Catalog Window B → Visualize
→ Window B overlay
```

Even if both products have:

```text
product_type = Window
```

they remain independent because the visualization is driven by `product_id`.

---

# 30. Default Configuration

When first entering the workspace, initialize from:

```text
product_templates.base_configuration
```

and parameter defaults from:

```text
product_parameters.default_value
```

The resolver applies active structural rules afterward.

This should produce the customer's first overlay automatically.

No manual "choose model" step is required when visualization is launched from a specific product.

---

# 31. Product Selection Behavior Inside the Workspace

For the **first implementation**, keep the scope simple:

```text
Visualize Product A
→ workspace starts with Product A
```

The existing MVP's generic "choose cabinet/window" model selector should **not** remain the authoritative selector.

Later, if GlassFit supports adding another product into the same scene:

```text
Add Product
→ database-backed product selector
→ choose another product_id
→ load its structural definition
```

But that is a later step.

---

# 32. One Live Three.js Overlay

Preserve the proven MVP performance architecture.

```text
selected generated product
        ↓
ONE live Three.js renderer
        ↓
customer edits
        ↓
Apply Overlay
        ↓
transparent cached render + metadata
        ↓
live renderer becomes available
```

Placed overlays must not remain separate live WebGL renderers.

This is important for low- to mid-range mobile devices.

---

# 33. Overlay Metadata

A placed overlay should retain enough temporary metadata to re-edit it during the active session.

Conceptually:

```ts
type PlacedOverlay = {
  overlayId: string;

  productId: string;
  templateId: string;

  visualParameterValues: Record<string, unknown>;

  resolvedStructure: ResolvedStructure;

  transform: OverlayTransform;

  ambientSettings: ...;
  autoRealismSettings: ...;
  glassSettings: ...;
  occlusionObjectIds: string[];

  flattenedImageDataUrl: string;
};
```

This stays session-only.

It is not inserted into Supabase during editing.

---

# 34. Space Image + Product Rendering

The workspace composition becomes:

```text
FastAPI workspace image
        ↓
Canvas background
        ↓
Selected product generated from Supabase/R2
        ↓
Three.js active overlay
        ↓
FastAPI lighting analysis
        ↓
Ambient Light Adjustment
        ↓
Auto Realism
        ↓
Object masks
        ↓
Object-aware layering
```

This preserves the MVP pipeline while replacing the local product source with real database/R2 structural assets.

---

# 35. Ambient Light Adjustment

Use the FastAPI global analysis result as the base:

```text
brightness
ambient color
contrast
saturation
sharpness
noise
light direction
```

The Three.js renderer should receive this information from visualization session state.

Do not query Supabase for realism values.

Local position-based matching remains session-side and should be debounced during dragging.

---

# 36. Segmentation and Object-Aware Layering

Use the FastAPI returned:

```text
objects
mask_url
```

exactly as the MVP pipeline proved.

Each overlay independently stores:

```text
occlusionObjectIds
```

This permits:

```text
Window 1 behind chair
Window 2 in front of chair
```

without changing the backend segmentation.

---

# 37. Glass Appearance

The current Window should retain the proven MVP Glass Appearance behavior.

Examples:

```text
Clear
Frosted
Opaque
Reflective
Outdoor View
```

This remains overlay-specific.

Product variations from the database can later constrain which glass options are actually allowed for a particular business product.

For the first integration, preserve the tested visual behavior before introducing additional variation logic.

---

# 38. Auto Realism and Shadows

Reuse the proven MVP behavior.

Do not redesign realism during structural integration.

The implementation priority is:

```text
same visual result
+
real product data
+
real structural models
```

before improving the realism algorithms.

The Window-specific no-floor-shadow behavior from the proven MVP should remain unless later evaluation changes it.

---

# 39. Product Details Must Continue Using the Whole GLB

Do not change the currently working Product Details viewer.

```text
Product Details
→ Catalog 3D Preview
→ whole window preview.glb
```

Visualization:

```text
Visualize
→ Component Model GLBs
→ parametric product
```

These remain separate pipelines.

---

# 40. Failure Handling

## Invalid product

```text
product_id does not exist
or
product inactive
```

Result:

```text
do not enter visualization
```

## Missing template

For a product intended to be parametric:

```text
show product-unavailable error
```

Do not silently substitute a different product.

## Missing Component Model asset

Stop structural assembly and show a useful error.

The wrong overlay must never be shown.

## Component GLB load failure

Retry only as appropriate, then fail the selected product gracefully.

## FastAPI analysis failure

Preserve the MVP fallback philosophy where possible.

If the workspace image is still usable:

```text
manual overlay controls may continue
```

without advanced segmentation/realism.

---

# 41. Loading UX

Entering the workspace may involve:

```text
Supabase structural query
+
several R2 GLB requests
+
Three.js initialization
```

Use a clear loading state:

```text
Preparing your product...
```

Potential stages:

```text
Loading product configuration
Loading product components
Building product
Preparing visualization
```

Avoid displaying an empty canvas while assets are being fetched.

---

# 42. Performance Rules

Maintain these rules throughout implementation:

```text
FastAPI handles heavy image analysis
workspace image ~1920px long edge initially
one live Three.js overlay
component GLBs cached
repeated structural pieces cloned
placed overlays flattened/cached
no Supabase writes during editing
no Supabase reads every frame
no R2 re-download for cloned pieces
realism calculations debounced
renderer pixel ratio capped where appropriate
```

---

# 43. Suggested Frontend Modules

Exact filenames should follow the current repository, but the architecture should separate responsibilities.

Suggested structure:

```text
src/
├── app/
│   └── visualize/
│       └── [productId]/
│           ├── upload/
│           │   └── page.tsx
│           └── workspace/
│               └── page.tsx
│
├── components/
│   └── visualization/
│       ├── SpaceImageUpload.tsx
│       ├── VisualizationWorkspace.tsx
│       ├── OverlayControls.tsx
│       ├── PlacedOverlayPanel.tsx
│       └── ObjectTogglePanel.tsx
│
└── lib/
    ├── imageApi.ts
    ├── r2.ts
    └── visualization/
        ├── structuralData.ts
        ├── structuralResolver.ts
        ├── componentModelCache.ts
        ├── parametricProductBuilder.ts
        ├── visualizationSession.tsx
        └── types.ts
```

Do not blindly duplicate MVP files if the current repo already has equivalent components.

---

# 44. Suggested Responsibilities

## `structuralData.ts`

```text
Supabase queries only
```

Functions such as:

```text
getProductStructuralDefinition(productId)
```

## `structuralResolver.ts`

```text
pure business/structural logic
no Three.js
no React
no Supabase
```

## `componentModelCache.ts`

```text
GLTFLoader
R2 loading
cache source models
clone helpers
```

## `parametricProductBuilder.ts`

```text
Three.js assembly
component scaling
component positioning
generated THREE.Group
```

## `visualizationSession.tsx`

```text
temporary active session state
selected product
space image analysis
active overlay
placed overlays
```

---

# 45. Implementation Phases

## Phase 1 — Route/Product Identity

Implement:

```text
Catalog Visualize
→ /visualize/{product_id}/upload

Product Details Visualize
→ /visualize/{product_id}/upload
```

Acceptance:

- both routes carry the correct UUID;
- upload page shows the correct product.

---

## Phase 2 — Upload/FastAPI Integration

Implement the finalized space-image pipeline.

Acceptance:

- selected image validated;
- FastAPI runs;
- normalized workspace image returned;
- analysis stored in session;
- route proceeds to workspace.

---

## Phase 3 — Structural Data Loader

Implement:

```text
getProductStructuralDefinition(productId)
```

Acceptance:

- correct template;
- correct parameters;
- correct components;
- correct rules;
- every component has its correct R2 Component Model URL.

---

## Phase 4 — Component Model Cache

Load and cache all component source GLBs.

Acceptance:

- each unique source GLB downloaded once;
- clones can be created independently;
- failed assets are reported clearly.

---

## Phase 5 — Structural Resolver

Implement data-driven rules.

Acceptance for the current Window:

```text
default width
→ 2 panes
→ 1 center frame
```

and:

```text
width >= configured threshold
→ 3 panes
→ 2 center frames
```

No product-type hardcoding.

---

## Phase 6 — Standalone Parametric Builder

Build the Window without the photo workspace first.

Acceptance:

- all seven component sources are used correctly;
- dimensions change intended pieces only;
- glass panels repeat;
- center frame repeats;
- geometry remains aligned.

---

## Phase 7 — Product-Aware Initial Overlay

Connect the generated product to the real workspace.

Acceptance:

```text
Product A Visualize
→ Product A active overlay
```

No manual model selector required.

---

## Phase 8 — Reconnect MVP Realism

Apply:

```text
FastAPI lighting
Ambient Light Adjustment
Auto Realism
Glass Appearance
Object-aware masks
```

Acceptance:

- visual quality remains comparable to the validated MVP.

---

## Phase 9 — Multiple Overlay Architecture

Restore:

```text
Apply Overlay
Edit
Duplicate
Hide
Delete
Reorder
```

using one live Three.js renderer and cached placed overlays.

All overlays retain their own `product_id`.

---

## Phase 10 — Mobile Validation

Test:

```text
upload
FastAPI processing
R2 component loading
parametric rebuilding
dragging
resizing
realism
multiple placed overlays
final output
```

on at least one mid-range mobile device.

---

# 46. Important Regression Baseline

Before replacing the MVP's local product implementation, preserve a known-good reference.

Use the same:

```text
room image
Window dimensions
Glass Appearance
overlay transform
lighting settings
occlusion selection
```

Compare:

```text
old MVP/local Window
vs
Supabase/R2 structural Window
```

The goal is not pixel-for-pixel identical geometry if the GLBs differ, but realism quality and behavior should not materially regress.

---

# 47. Current Window Acceptance Scenario

The first full end-to-end test should be:

```text
1. Open Product Catalog
2. Locate Standard Aluminum Window
3. Click Visualize
4. Confirm upload page displays Standard Aluminum Window
5. Upload valid room image
6. FastAPI prepares/analyzes image
7. Enter workspace
8. Structural definition loads using Window product_id
9. Seven component GLBs load from R2
10. Default Window is generated
11. Window automatically becomes active overlay
12. Change structural width
13. Verify structural rule changes pane/mullion count
14. Move/resize/rotate overlay on photo
15. Verify ambient matching
16. Verify object-aware layering
17. Apply overlay
18. Verify cached-layer behavior
19. Generate final visualization
```

Repeat the same test by entering through:

```text
Product Details
→ Visualize
```

The resulting selected product must be identical.

---

# 48. Future Product Behavior

The architecture should allow a future product to work without creating a new visualization route.

Example:

```text
Sliding Window product_id A
→ its template/components/rules

Awning Window product_id B
→ its template/components/rules

Cabinet product_id C
→ Fixed or Parametric strategy
```

All enter:

```text
/visualize/{product_id}/upload
```

The product data determines what is built.

---

# 49. Non-Goals for This Stage

Do not implement yet:

```text
quotation persistence
booking
final snapshot database persistence
admin structural editor
automatic R2 upload from Admin
database-backed saved unfinished visualization sessions
pricing calculations
manual quotation dimensions
cross-session overlay recovery
```

Those remain later milestones.

---

# 50. Definition of Done

This implementation is complete when:

> A customer can click **Visualize** from either the Product Catalog or Product Details, upload a valid space image, have FastAPI prepare/analyze that image, and enter the visualization workspace where GlassFit automatically loads and renders the correct product corresponding to the selected `product_id` using its real Supabase structural definition and R2 component GLBs, while preserving the tested MVP realism, segmentation, Canvas compositing, and one-live-overlay performance architecture.

The key end-to-end contract is:

```text
PRODUCT_ID
    ↓
UPLOAD
    ↓
FASTAPI SPACE PREPARATION
    ↓
STRUCTURAL DATA FROM SUPABASE
    ↓
COMPONENT GLBs FROM R2
    ↓
RESOLVED PARAMETRIC PRODUCT
    ↓
ACTIVE THREE.JS OVERLAY
    ↓
MVP-PROVEN REALISM / OCCLUSION / CANVAS PIPELINE
```
