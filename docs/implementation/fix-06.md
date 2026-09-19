# Implementation Specification: Per-Product Comparison Variants and Product Selection Simplification (fix-05)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Technical Specification for Per-Product, Per-Panel Variant Persistence, Correct Variant Rendering, and In-Viewport Overlay Target Deprecation in Favor of the Product Selection Control Bar  
**Version:** 1.2.1  
**Date:** September 19, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Revised - Implementation Required  
**Upstream Specifications:** `docs/implementation/fix-04.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/prd-glassfit.md`, `docs/qad-glassfit.md`  

---

## 1. Problem Context & Empirical Defect Analysis

During end-to-end testing of the comparison page (`/comparison`), multiple defects were identified in the Product Variant comparison workflow:

### 1.1 Defect 1: Variant Selection Does Not Persist Independently Per Model and Panel

- **Observed Behavior:** When the user selects a variant finish in Panel A (left panel) or Panel B (right panel), the selected window may fail to reflect the requested finish. In multi-product scenes, selecting another model also causes the previously configured model to fall back to its original finish or inherit a global comparison pair. The user therefore cannot configure Model A as Gray in Panel A and Black in Panel B, switch to Model B, and continue seeing Model A as Gray and Black while editing Model B.
- **Required Behavior:** Every placed model must retain two independent preview selections: one for Panel A and one for Panel B. Changing the active product changes only which model the variant controls edit. It must not erase, reset, or visually replace the selections already made for any other model. All saved per-model selections must render together in both comparison panels.
- **Root Cause:** The `ProductVariantScene` component (line 129 of `Comparison.tsx`) calls `getComparisonLayerImageUrls(overlays, selectedOverlayId, finish)` to resolve which image URL to render for each overlay. This function (line 29-41 of `multiProductPresentation.ts`) looks up `overlay.variationImageDataUrls?.[finish]` for the selected overlay and falls back to `overlay.flattenedImageDataUrl` when the requested finish key is not found.

  The helper accepts only one selected overlay and one global finish, so it cannot resolve a distinct Panel A and Panel B finish for every overlay. Non-selected overlays fall back to their committed or original appearance instead of their saved comparison selections. The comparison state must therefore be keyed by `overlayId`, with separate `left` and `right` values for each product.

  The problem originates in `handleContinueToComparison` (line 1566 of `ProductModelWorkspace.tsx`): the active product overlay is created via `createPlacedOverlay()` (line 1576), which only stores the **current** finish in `variationImageDataUrls` (lines 1276-1278 of `ProductModelWorkspace.tsx`):

  ```typescript
  const variationImageDataUrls: Partial<Record<AluminumFinishKey, string>> = {
    [currentFinish]: activeImageDataUrl,
  };
  ```

  Similarly, overlays that were placed earlier (via the Add Product flow) also only have a single finish entry. As a result, when the comparison page requests `overlay.variationImageDataUrls?.['silver']` or `overlay.variationImageDataUrls?.['black']`, the key does not exist, and the fallback returns `flattenedImageDataUrl`, which is always the image captured with the original finish.

  The function `captureCurrentProductVariationLayers` (line 1162 of `ProductModelWorkspace.tsx`) already captures isolated product layer images for all three aluminum finishes (white, black, silver), but it is never called during the comparison transition flow. The `generateVariationSnapshots` function (line 1452) captures full-scene composite snapshots (background + all placed layers) for each finish, which is used for the single-product comparison fallback path, but does not update individual overlay `variationImageDataUrls`.

  Follow-up diagnosis found a second cause in `ProductModelRenderer`: the fixed-model branch loaded the same GLB without applying the requested `alumFinish`. Consequently, all three captured URLs could contain visually identical materials even after the variation map was populated. Fixed and parametric models must use the same material classification and finish palette.

### 1.2 Defect 2: In-Viewport Overlay Click Target Inaccuracy and Fragility

- **Observed Behavior:** The interactive click target buttons in the `ProductVariantScene` component attempted to project 2D bounding boxes over 3D composite images in the comparison viewport. Because of responsive container padding (`p-6`), `object-contain` letterboxing/pillarboxing, and varying aspect ratios across devices, the click target boxes were frequently displaced, misaligned, or collapsed.
- **Root Cause & Architectural Decision:** Projecting dynamic 2D interaction frames over multi-layered Three.js offscreen composite captures in a responsive container introduces fragile geometric heuristics and lifecycle sync issues (`ResizeObserver`, coordinate scaling). Rather than maintaining fragile in-viewport interaction boxes, the system architecture was simplified: the in-viewport click targets were completely removed from `ProductVariantScene`, and product selection was centralized in the dedicated "Choose a product to compare" button bar located directly above the viewports.

---

## 2. Traceability & Specification Mapping

| Traceability Code | Specification Reference | Architectural Function |
|---|---|---|
| PRD-F6 | Product Variant Comparison Engine | Side-by-side and slider visualization of aluminum finish variations in client space |
| PRD-F15 | Multi-Product Scene Composition | Allows comparing finish variations across multiple placed products simultaneously |
| PRD-F16 | Scene Layer Management & Editing | Enables per-product finish selection within the comparison workflow |
| SDD-C4 | Parametric 3D Assembly Engine | Renders per-variation product layers with correct material properties |
| SDD-C5 | Visualization Session & State Persistence | Preserves variation layer data across workspace-to-comparison transition |
| DSD-UI12 | Comparison Viewport & Variant Selection | Interactive comparison panels with per-product finish switching |
| QAD-TC26 | Variant Comparison Accuracy | Validates that finish selection visually updates the correct product in the comparison viewport |
| BAN-PUNCT-01 | Zero em-dashes in documentation | Hyphens, colons, and parentheses used exclusively |
| BAN-SPEC-02 | Spec-linked commits and tasks | Direct traceability to PRD, SDD, DSD, and QAD |
| BAN-TYPE-05 | Zero `any` in TypeScript | Strict typing across overlay variation maps and frame computations |
| BAN-UI-09 | Strict UI consistency | Reuses established GlassFit Tailwind tokens and presentation components |

---

## 3. Architectural Scope & Boundaries

### 3.1 In Scope

| Target File | Modification Rationale |
|---|---|
| `src/features/visualization/components/ProductModelWorkspace.tsx` | Capture all three finish variations once when creating each overlay, reject incomplete captures, and pass the complete overlays to comparison. |
| `src/features/comparison/components/Comparison.tsx` | Centralize product selection in the control bar, maintain scalable per-overlay Panel A and Panel B preview state, render all saved selections together, and show an actionable regeneration message for incomplete variation data. |
| `src/lib/visualization/modelRenderer.ts` | Apply requested finish and glass inputs to fixed whole-model assets. |
| `src/lib/visualization/materialClassifier.ts` and `parametricProductBuilder.ts` | Share one material application function across fixed and parametric model paths. |
| `src/lib/visualization/multiProductPresentation.ts` | Validate variation completeness, resolve every overlay layer from its per-panel saved selection, and provide immutable helpers for committing selected finishes. |

### 3.2 Out of Scope

| System Component | Rationale |
|---|---|
| `src/lib/visualization/visualizationSession.tsx` | Session state management for `comparisonOverlays` and `variationSnapshots` is working correctly; the fix targets the data population at transition time. |
| `src/lib/visualization/colorVariations.ts` | Aluminum finish normalization and variation definitions are correct and unchanged. |
| `fastapi-service/` | Space image analysis, YOLOv8 segmentation, and lighting detection are unaffected. |
| `supabase/migrations/` | No database schema changes required. |

---

## 4. Technical Implementation

### 4.1 Fix Defect 1: Render, Populate, and Persist Per-Product Variation Layers

The defect where previously placed products (e.g. Fixed Window 1) did not change finish in comparison occurred because `createPlacedOverlay()` only stored the current active finish:
```typescript
const variationImageDataUrls: Partial<Record<AluminumFinishKey, string>> = {
  [currentFinish]: activeImageDataUrl,
};
```
When a product was placed in the workspace (via "Add Product" or when switching layers), it was saved into `placedOverlays` with only a single finish. Later, only the active product (e.g. Fixed Window 2) had full variations captured during `handleContinueToComparison`.

#### Comprehensive Resolution:

1. **In `createPlacedOverlay` (lines 1272-1285):** Call `captureCurrentProductVariationLayers()` at the exact moment any overlay is placed. Because the 3D renderer, camera framing, lighting, and parameters are actively loaded for that product, all three finishes (`white`, `black`, `silver`) are captured accurately for each placed overlay:
```typescript
const activeImageDataUrl = await captureCurrentProductLayer();
const currentFinish = normalizeAluminumFinish(
  currentConfiguration.aluminumFinish,
);
const variationLayers = await captureCurrentProductVariationLayers();
const variationImageDataUrls: Partial<Record<AluminumFinishKey, string>> = {
  ...variationLayers,
  [currentFinish]: activeImageDataUrl,
};
const placedLayer = preserveActivePlacedLayer({
  activeImageDataUrl,
  currentFinish,
  variationImageDataUrls,
});
```
Add `captureCurrentProductVariationLayers` to the `createPlacedOverlay` dependency array.

2. **In `handleContinueToComparison`:** Call `createPlacedOverlay()` once for the active product and use its complete variation map. Do not call `captureCurrentProductVariationLayers()` separately because `createPlacedOverlay()` already performs that work.

3. **In `captureCurrentProductVariationLayers`:** Throw a descriptive preparation error if any renderer returns no canvas or any required finish remains missing. Do not navigate to comparison with a partial variation map.

4. **In `ProductModelRenderer`:** Forward `glassAppearance` and `alumFinish` to the fixed-model loading path. After loading and normalizing the GLB, apply the same shared presentation materials used for parametric assemblies.

Key design decisions:
1. **Accurate multi-product capture:** By capturing variations inside `createPlacedOverlay`, every window (Fixed Window 1, Fixed Window 2, etc.) captures its isolated 3D variation layers while its specific geometry and dimensions are active in the renderer.
2. **Deterministic finish switching:** In `/comparison`, each viewport resolves every overlay from that overlay's saved finish for the relevant panel. Selecting a product changes only the target edited by the controls.
3. **Single capture path:** The active overlay is not rendered a second time during navigation, reducing comparison preparation work and preventing two capture paths from diverging.
4. **Fixed-model parity:** Whole-model GLBs and parametric assemblies honor the same white, black, and silver material definitions.

#### Per-Product, Per-Panel Comparison State

Use one normalized state map keyed by the stable `overlayId`. Do not create a fixed number of model-specific state variables.

```typescript
type ProductVariantSelection = {
  left: AluminumFinishKey;
  right: AluminumFinishKey;
};

type ProductVariantSelections = Record<string, ProductVariantSelection>;
```

Initialize the map from `comparisonOverlays`. Both sides initially use each overlay's own normalized committed finish unless the session already contains valid saved comparison selections.

```typescript
const initialSelections = Object.fromEntries(
  comparisonOverlays.map((overlay) => {
    const initialFinish = normalizeAluminumFinish(overlay.aluminumFinish);
    return [
      overlay.overlayId,
      { left: initialFinish, right: initialFinish },
    ];
  }),
) satisfies ProductVariantSelections;
```

Panel changes must update only one field of one selected overlay:

```typescript
const updateSelectedProductVariant = (
  panel: "left" | "right",
  finish: AluminumFinishKey,
) => {
  setProductVariantSelections((current) => ({
    ...current,
    [selectedComparisonOverlayId]: {
      ...(current[selectedComparisonOverlayId] ?? {
        left: selectedOverlayInitialFinish,
        right: selectedOverlayInitialFinish,
      }),
      [panel]: finish,
    },
  }));
};
```

For each viewport, resolve every overlay independently. Panel A uses `productVariantSelections[overlay.overlayId].left`; Panel B uses `.right`. Fall back to the overlay's normalized current finish only when no saved selection exists. Never use the active product's finish as the finish for all overlays, and never fall back to another overlay's selection.

When `comparisonOverlays` changes, reconcile the record by stable `overlayId`: preserve entries for overlays that still exist, initialize entries only for new overlays, and remove entries for deleted overlays. Do not recreate the full map whenever the active product changes.

Example state after editing two products:

```typescript
{
  "model-a-overlay-id": { left: "silver", right: "black" },
  "model-b-overlay-id": { left: "white", right: "silver" },
}
```

With this state, Panel A renders Model A as Gray/Silver and Model B as White. Panel B renders Model A as Black and Model B as Silver, regardless of which model is currently active in the selector bar. The same record-based design must work for any number of placed models.

State behavior requirements:

1. Selecting a product button updates only `selectedComparisonOverlayId`.
2. The Panel A and Panel B controls derive their selected cards from `productVariantSelections[selectedComparisonOverlayId]`.
3. Changing a Panel A card updates only the selected overlay's `left` value.
4. Changing a Panel B card updates only the selected overlay's `right` value.
5. Panel A renders every overlay using its own `left` value. Panel B renders every overlay using its own `right` value.
6. Switching products never resets, copies, or removes another overlay's selections.
7. Returning to a previously edited product restores that product's saved values in the controls.
8. Adding another model extends the map with one new entry and preserves all existing entries by `overlayId`.
9. Removing a model removes only its entry. Reordering models does not affect selections because array indexes are never used as state keys.

The scene resolver must receive the panel side and the complete selection map, or receive a precomputed finish map for that side. It maps over all overlays and chooses the matching variation image for each overlay.

```typescript
const leftLayerImageUrls = getComparisonLayerImageUrls(
  comparisonOverlays,
  productVariantSelections,
  "left",
);

const rightLayerImageUrls = getComparisonLayerImageUrls(
  comparisonOverlays,
  productVariantSelections,
  "right",
);
```

Panel interactions remain preview state until the user proceeds. For the current quotation flow, Panel A is the chosen configuration, so commit every overlay using that overlay's saved `left` finish. Panel B remains comparison-only. The commit must be immutable and synchronize the resulting overlay array to both comparison and placed session collections.

If any overlay lacks a required variation layer, replace the variant preview with an actionable prompt to return to Edit Placement and regenerate the comparison. Do not silently fall back to a different finish.

### 4.2 Fix Defect 2: Remove Viewport Overlay Targets in Favor of Dedicated Product Selector

While guarding against zero dimensions resolved initial NaN coordinates, computing 2D bounding boxes over 3D composite scenes with varying aspect ratios and container padding remains fragile and prone to misalignment across responsive viewports.

The architectural decision was made to remove the in-viewport click target buttons entirely from `ProductVariantScene` and exclusively utilize the dedicated "Choose a product to compare" button bar located directly above the comparison scenes.

This is a complete removal of viewport-based product selection, not a visual hiding of the existing controls. `ProductVariantScene` is presentation-only and must not accept an overlay-selection callback or attach click, pointer, keyboard, or touch handlers for selecting a product. Clicking anywhere inside either comparison viewport must have no effect on `selectedComparisonOverlayId`.

```typescript
// ProductVariantScene simplified:
function ProductVariantScene({
  backgroundImage,
  overlays,
  layerImageUrls,
}: {
  backgroundImage: string;
  overlays: PlacedOverlay[];
  layerImageUrls: string[];
}) {
  return (
    <div className="absolute inset-0 rounded-[15px] bg-neutral-100">
      <ComparisonImage
        alt="Uploaded room"
        className="absolute inset-0 h-full w-full rounded-[15px] object-contain"
        src={backgroundImage}
      />
      {layerImageUrls.map((imageUrl, index) => (
        <ComparisonImage
          key={overlays[index]?.overlayId}
          alt=""
          className="absolute inset-0 h-full w-full rounded-[15px] object-contain pointer-events-none"
          src={imageUrl}
        />
      ))}
    </div>
  );
}
```

Key benefits of this simplification:
1. **Zero Misalignment Risk:** Eliminates complex 2D frame calculations (`getComparisonOverlayFrame`), `ResizeObserver` lifecycle management, and aspect ratio projection heuristics.
2. **Clear UX Hierarchy:** Users explicitly select which product to compare via the prominent pill buttons ("Fixed Window 1", "Fixed Window 2") in the product selector bar.
3. **Clean Presentation:** The viewport remains an unobstructed preview of the client space without translucent bounding boxes or overlapping labels.
4. **Copy Updated:** The helper copy was updated from "Click a model in the preview or choose it below" to "Choose a product below. Only that product changes finish."

Implementation requirements:
1. Remove in-viewport overlay buttons, hit areas, bounding boxes, selection frames, floating product labels, and selection indicators from both side-by-side and slider views.
2. Remove viewport-selection-only props and callbacks from `ProductVariantScene` and its call sites, including `onSelectOverlay` or equivalent handlers.
3. Remove coordinate projection, responsive hitbox positioning, overlay frame calculations, `ResizeObserver` state, and related pointer handling when they are not used elsewhere.
4. Keep rendered product layers non-interactive with `pointer-events-none` so the viewport remains a pure visual preview.
5. Use the existing "Choose a product to compare" button bar as the only control that updates `selectedComparisonOverlayId`.
6. Preserve the existing selector layout and styling. This change does not redesign the Fixed Window 1, Fixed Window 2, and subsequent product buttons.
7. Preserve every product's saved Panel A and Panel B appearances when the selected product changes. Only the active editing target changes.

---

## 5. Verification Plan

### 5.1 Static Verification

Execute lint, typecheck, and production build to confirm zero regressions:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

The unit suite must include regression coverage for fixed-model material application, missing variation detection, immutable per-overlay state updates, per-panel rendering of all saved overlay selections, stable selection across product switching, scalable initialization for additional models, and Panel A commit behavior for every configured overlay.

### 5.2 Manual End-to-End Verification Scenarios

1. **Test Scenario 1: Single Product Variant Changes Left Panel**
   - Navigate to `/visualize/[productId]/workspace` with an uploaded room photo and a Fixed Window product.
   - Configure the window with White Aluminum finish. Click "Continue to Compare".
   - On the comparison page, switch to "Product Variant" compare mode (right toggle).
   - In Panel A (Left), click "Silver Aluminum".
   - **Expected Result:** The left comparison viewport updates the window to display with a silver aluminum frame finish. The window model visually changes from white to silver.

2. **Test Scenario 2: Single Product Variant Changes Right Panel**
   - From the same comparison state, in Panel B (Right), click "Black Aluminum".
   - **Expected Result:** The right comparison viewport updates the window to display with a black aluminum frame finish. The left viewport retains the silver finish from Scenario 1.

3. **Test Scenario 3: Multi-Product Overlay Selection and Variant Change**
   - Place 3 Fixed Windows at different positions in the workspace. Click "Continue to Compare".
   - Switch to "Product Variant" mode and select "Fixed Window 1". Set Panel A to Silver Aluminum and Panel B to Black Aluminum.
   - Select "Fixed Window 2". Set Panel A to White Aluminum and Panel B to Silver Aluminum.
   - **Expected Result:** While Fixed Window 2 is active, Fixed Window 1 remains Silver in Panel A and Black in Panel B. Fixed Window 2 displays White in Panel A and Silver in Panel B. Fixed Window 3 retains its initialized finish on both sides.
   - Select "Fixed Window 1" again.
   - **Expected Result:** The controls restore Silver for Panel A and Black for Panel B. Fixed Window 2 remains White in Panel A and Silver in Panel B. The active product button reflects the selection state (`bg-[#07b6d3] text-white`).

4. **Test Scenario 4: Product Selection via Dedicated Control Bar**
   - Navigate to the comparison page with placed overlays.
   - Observe the comparison viewport and verify a clean, unobstructed view of the room without misplaced bounding boxes or overlapping floating tags.
   - Record the currently active product, then click multiple locations on product images and empty areas inside both comparison viewports.
   - **Expected Result:** Viewport clicks do nothing. The active product and every model's saved Panel A and Panel B appearances remain unchanged.
   - Click different product pills ("Fixed Window 1", "Fixed Window 2") in the "Choose a product to compare" bar.
   - **Expected Result:** Active button styling toggles instantly, the button bar is the only product-selection mechanism, and variant finish changes apply to the newly selected product.

5. **Test Scenario 5: Slider Mode Variant Reflection**
   - Switch to "Slider" view mode (left toggle) with "Product Variant" compare mode active.
   - Configure different Panel A and Panel B variants for at least two products.
   - **Expected Result:** The left side of the slider shows every product using its saved Panel A finish, and the right side shows every product using its saved Panel B finish. Dragging the slider does not reset any product.

6. **Test Scenario 6: Swap Button Preserves Variant Reflection**
   - With different saved variants for multiple products in Panel A and Panel B, click the "Swap" button.
   - **Expected Result:** For every overlay, the saved `left` and `right` values swap. The complete Panel A and Panel B scenes exchange appearances without losing any per-product selection.

7. **Test Scenario 7: Scalability Beyond Two Products**
   - Place at least 5 products and assign a distinct valid Panel A and Panel B combination to each one.
   - Switch through every product button in a non-sequential order.
   - **Expected Result:** Each product restores its own control selections when active, all products continuously display their saved finishes in both panels, and no selection is associated with an array index or another product.

---

## 6. Risk Assessment & Mitigation

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| `captureCurrentProductVariationLayers` increases comparison transition time | Low | High | The function renders 3 offscreen snapshots sequentially (one per finish). The active product uses this capture path once through `createPlacedOverlay`; duplicate transition capture was removed. The "Preparing comparison..." loading state covers this. |
| Multi-product variation capture overhead | Low | Low | Capturing 3 offscreen layers sequentially during `createPlacedOverlay` takes ~200-300ms, which occurs seamlessly during product placement transitions without perceptible UI freezing. |
| Viewport click target removal eliminates interaction fragility | Low | Low | Centralizing selection in the dedicated "Choose a product to compare" pill bar removes all 2D-to-3D coordinate projection inaccuracies and provides a clearer, accessible interaction model. |
| `captureCurrentProductVariationLayers` may fail for catalog-image products without a `structuralDefinition` | Low | Low | The function already handles this case (lines 1165-1171) by falling back to `captureCurrentProductLayer()` for all variations, producing identical images. The comparison page will show the same image for all finishes, which is correct behavior for products without parametric 3D models. |
| Stored lightweight sessions omit variation layers | Medium | Medium | Product Variant mode detects incomplete maps and displays a regeneration action instead of silently substituting the original finish. |
| Per-product state is reset during overlay reconciliation | High | Medium | Reconcile by stable `overlayId`, preserve existing entries, initialize only new overlays, and remove only deleted overlay entries. |
| Variant state grows as more products are added | Low | Low | The record stores only two small finish keys per overlay and scales linearly with the number of placed products. |

---

## Self-Check & Quality Checklist

- [x] Document metadata aligns with GlassFit master documentation index (`docs/index.md`)
- [x] Primary operating directives map to core specifications (PRD-F6, PRD-F15, PRD-F16, SDD-C4, SDD-C5, DSD-UI12, QAD-TC26)
- [x] Zero em-dashes present in text or code comments (enforced by BAN-PUNCT-01)
- [x] Root causes pinpointed with exact file paths and line numbers (`Comparison.tsx:128-129,178`, `ProductModelWorkspace.tsx:1276-1278,1566-1581`)
- [x] Fixed and parametric model rendering paths honor the same finish palette
- [x] Preview state remains separate from the committed quotation configuration
- [x] Concrete before-and-after code provided for both fixes
- [x] Verification plan includes static checks, manual test scenarios, and edge case coverage
- [x] Design evolution from fix-04 documented (in-viewport 2D projection replaced with accessible product selection bar to eliminate viewport misalignment)
