# Implementation Specification: Workspace Page Product Selection, Layer Counting, and Placed Overlay Hit Target Correction (fix-04)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Technical Specification for Workspace Product Selection Error, Layer Panel Duplication, and Placed Overlay Click Target Accuracy  
**Version:** 1.0.0  
**Date:** September 18, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Implemented  
**Upstream Specifications:** `docs/implementation/fix-03.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/prd-glassfit.md`, `docs/qad-glassfit.md`  

---

## 1. Problem Context & Empirical Defect Analysis

During end-to-end testing of the client visualization workspace (`/visualize/[productId]/workspace`), three interconnected defects were identified in the multi-product scene composition workflow:

### 1.1 Defect 1: `selectWorkspaceProduct is not defined` ReferenceError

- **Observed Behavior:** When the user clicks "Select Product" or "Add Another" in the Add Product modal (`AddProductModal.tsx`), the UI renders a persistent error banner: `selectWorkspaceProduct is not defined`. The modal does not close, and subsequent clicks continue to accumulate placed overlays despite the error.
- **Impact:** While the placed overlay is successfully created and appended to `placedOverlays` (via `onPlacedOverlaysChange` at line 960 of `ProductModelWorkspace.tsx`), the subsequent call to the parent callback `onProductSelect` (line 975) invokes `selectWorkspaceProduct` on line 91 of `ProductAwareWorkspacePage.tsx`, which is never destructured from `useVisualizationSession()`. The hook returns `transitionWorkspaceProduct` (destructured at line 33), but the callback body references the old `selectWorkspaceProduct` identifier, producing a JavaScript `ReferenceError` that propagates to the `AddProductModal` catch block (line 61 of `AddProductModal.tsx`).

### 1.2 Defect 2: Layer Panel Displays Double the Expected Count

- **Observed Behavior:** The Layers panel header reads "Layers (6)" when only 3 3D model instances are visible on the canvas. The expanded layer list renders 5 "Edit Screen Door N" buttons alongside the "Screen Door Active" badge, totaling 6 entries.
- **Root Cause (Primary):** The Layers panel count formula on line 2009 of `ProductModelWorkspace.tsx` uses `placedOverlays.length + (selectedProduct ? 1 : 0)`, while the layer list on line 2052 iterates over `placedOverlays`. These should use `nonActivePlacedOverlays` (defined on line 512) which filters out the overlay currently being edited. Without this filter, when the user edits a placed overlay (setting `activeOverlayId` to that overlay's ID via `handleEditPlacedOverlay` on line 1235), the overlay appears both as the "Active" badge and as an "Edit" button in the placed list.
- **Root Cause (Secondary):** Because Defect 1 prevents the Add Product modal from closing on success (the `onClose()` call on line 60 of `AddProductModal.tsx` is skipped when the error throws), the user may inadvertently click "Add Another" multiple times. Each click successfully creates and appends a new `PlacedOverlay` before the `ReferenceError` re-fires, accumulating orphan layers.

### 1.3 Defect 3: Placed Overlay Click Target Displaced from 3D Model

- **Observed Behavior:** The interactive click rectangle for editing a placed product overlay is visually displaced from the rendered 3D model on the canvas. The rectangle appears too large, too small, or in a wrong position relative to the actual product image.
- **Root Cause:** The placed overlay click button (lines 2118-2131 of `ProductModelWorkspace.tsx`) uses absolute pixel dimensions from `getOverlaySizeFromConfiguration(overlay.configuration)` and absolute pixel offsets from `overlay.configuration.positionX/positionY`. However:
  1. **No canvas scaling:** The flattened overlay image is rendered at `inset-0 h-full w-full` (filling the entire canvas display area), so it scales with the canvas. But the click button dimensions and position remain at their original capture-time pixel values, creating a proportional mismatch when the canvas is displayed at a different size than the source canvas at capture time (`overlay.sourceCanvasWidth`, `overlay.sourceCanvasHeight`).
  2. **No visible-model-bounds fitting:** The click button covers the full overlay box dimensions, but the actual visible 3D model typically occupies only a fraction of the overlay box (as measured by `visibleModelBounds` stored on each `PlacedOverlay`). The active product's controls use percentage-based `getOutlineControlsStyle(projectedModelBounds)`, but placed overlays ignore `visibleModelBounds` entirely.

---

## 2. Traceability & Specification Mapping

| Traceability Code | Specification Reference | Architectural Function |
|---|---|---|
| PRD-F5 | Parametric 3D Product Assembly Engine | Enables multi-product, cross-category assembly in a shared client scene |
| PRD-F15 | Multi-Product Scene Composition | Allows adding windows, doors, cabinets, and partitions into a single scene |
| PRD-F16 | Scene Layer Management & Editing | Enables switching between placed layers and active product without state loss |
| SDD-C4 | Parametric 3D Assembly Engine | Maintains 3D viewport lifecycle across template changes without context loss |
| SDD-C5 | Visualization Session & State Persistence | Ensures session state resilience in React context across transitions |
| DSD-UI10 | Workspace Viewport Controls & Layer Stack | Interactive layer list displaying all placed products and active instance |
| QAD-TC24 | Cross-Category Multi-Product Placement | Validates concurrent placement of Window + Door + Cabinet in single room |
| BAN-PUNCT-01 | Zero em-dashes in documentation | Hyphens, colons, and parentheses used exclusively |
| BAN-SPEC-02 | Spec-linked commits and tasks | Direct traceability to PRD, SDD, DSD, and QAD |
| BAN-TYPE-05 | Zero `any` in TypeScript | Strict typing across session state, placed overlays, and route props |
| BAN-UI-09 | Strict UI consistency | Reuses established GlassFit Tailwind tokens and presentation components |

---

## 3. Architectural Scope & Boundaries

### 3.1 In Scope

| Target File | Modification Rationale |
|---|---|
| `src/features/visualization/components/ProductAwareWorkspacePage.tsx` | 1. Destructure `selectWorkspaceProduct` from `useVisualizationSession()` to eliminate the `ReferenceError`.<br>2. Alternatively, replace the `selectWorkspaceProduct` call with `transitionWorkspaceProduct` (already destructured) to use the atomic session transition that handles placed overlay deduplication. |
| `src/features/visualization/components/ProductModelWorkspace.tsx` | 1. Replace `placedOverlays` with `nonActivePlacedOverlays` in the Layers panel count (line 2009) and layer list rendering (line 2052).<br>2. Refactor the placed overlay click button (lines 2118-2131) to scale dimensions and position based on the ratio of current canvas display size to `overlay.sourceCanvasWidth/sourceCanvasHeight`, and apply `visibleModelBounds` fitting for accurate click targets. |

### 3.2 Out of Scope

| System Component | Rationale |
|---|---|
| `src/lib/visualization/visualizationSession.tsx` | `selectWorkspaceProduct` and `transitionWorkspaceProduct` are already correctly implemented in the session context; no changes needed. |
| `src/features/visualization/components/AddProductModal.tsx` | The modal's error handling (try/catch on `onSelectProduct`) is correct behavior; the fix targets the upstream callback that throws. |
| `src/lib/visualization/multiProductPresentation.ts` | `getOverlaySizeFromConfiguration` and `getComparisonOverlayFrame` are utility functions used by other subsystems and remain unchanged. |
| `fastapi-service/` | Space image analysis, YOLOv8 segmentation, and lighting detection are unaffected. |
| `supabase/migrations/` | No database schema changes required. |

---

## 4. Technical Implementation

### 4.1 Fix Defect 1: Restore `selectWorkspaceProduct` in `ProductAwareWorkspacePage.tsx`

The component destructures `transitionWorkspaceProduct` from `useVisualizationSession()` at line 33 but references the non-destructured `selectWorkspaceProduct` at line 91. The fix adds `selectWorkspaceProduct` to the destructuring assignment:

```typescript
// BEFORE:
const {
  selectedProductId,
  spaceImageSession,
  workspaceBackgroundDataUrl,
  productConfiguration,
  placedOverlays,
  finalSnapshotDataUrl,
  setStructuralDefinition,
  setProductConfiguration,
  setVariationSnapshots,
  setPlacedOverlays,
  setComparisonOverlays,
  setFinalSnapshotDataUrl,
  transitionWorkspaceProduct,
  resetVisualizationSession,
} = useVisualizationSession();
```

```typescript
// AFTER:
const {
  selectedProductId,
  spaceImageSession,
  workspaceBackgroundDataUrl,
  productConfiguration,
  placedOverlays,
  finalSnapshotDataUrl,
  setStructuralDefinition,
  setProductConfiguration,
  setVariationSnapshots,
  setPlacedOverlays,
  setComparisonOverlays,
  setFinalSnapshotDataUrl,
  selectWorkspaceProduct,
  transitionWorkspaceProduct,
  resetVisualizationSession,
} = useVisualizationSession();
```

This ensures the `selectWorkspaceProduct(nextProductId, ...)` call resolves to the session context function that updates `selectedProductId` and resets transient state. The callback parameter names are also corrected to match the `onProductSelect` prop signature from `ProductModelWorkspace`: the third parameter is `newPlacedOverlay` (a `PlacedOverlay` object, not a background URL string). Since the child component already manages overlay insertion via `onPlacedOverlaysChange`, the parent passes `undefined` as the `workspaceBackgroundDataUrl` argument and forwards only `configuration` to `selectWorkspaceProduct`.

### 4.2 Fix Defect 2: Use Filtered Overlays in Layers Panel

The Layers panel header and layer button list must use `nonActivePlacedOverlays` (which excludes the overlay currently being edited) to avoid double-counting:

```typescript
// BEFORE (line 2009):
Layers ({placedOverlays.length + (selectedProduct ? 1 : 0)})
```

```typescript
// AFTER:
Layers ({nonActivePlacedOverlays.length + (selectedProduct ? 1 : 0)})
```

```typescript
// BEFORE (line 2052):
{placedOverlays.map((overlay, index) => (
```

```typescript
// AFTER:
{nonActivePlacedOverlays.map((overlay, index) => (
```

With this change, when a user edits a placed overlay (which sets `activeOverlayId` to that overlay's `overlayId`), the overlay is filtered out of `nonActivePlacedOverlays` and shown only once as the "Active" badge, not duplicated in both the active badge and the placed overlay list.

### 4.3 Fix Defect 3: Scale Placed Overlay Click Target to Canvas Display Size

The placed overlay click button must scale its dimensions and position by the ratio of current canvas display size to the source canvas size at capture time. Additionally, `visibleModelBounds` should be used when available to tightly fit the click target to the actual visible 3D model region:

```typescript
// BEFORE (lines 2105-2134):
{placedOverlays.map((overlay) => {
  const placedSize = getOverlaySizeFromConfiguration(
    overlay.configuration,
  );

  return (
    <React.Fragment key={overlay.overlayId}>
      <img
        src={overlay.flattenedImageDataUrl}
        alt={`Placed ${overlay.productName}`}
        draggable={false}
        className="absolute inset-0 z-10 h-full w-full pointer-events-none select-none"
      />
      <div className="absolute inset-0 z-[15] flex items-center justify-center pointer-events-none">
        <button
          type="button"
          onClick={() => void handleEditPlacedOverlay(overlay)}
          aria-label={`Edit placed ${overlay.productName}`}
          title={`Edit ${overlay.productName}`}
          className="pointer-events-auto rounded-sm border border-transparent bg-transparent cursor-pointer transition-colors hover:border-[#07b6d3] focus-visible:border-[#07b6d3] focus-visible:outline-none"
          style={{
            width: placedSize.width,
            height: placedSize.height,
            transform: `translate(${overlay.configuration.positionX ?? 0}px, ${overlay.configuration.positionY ?? 0}px) rotate(${overlay.configuration.rotateAngle}deg)`,
          }}
        />
      </div>
    </React.Fragment>
  );
})}
```

```typescript
// AFTER:
{nonActivePlacedOverlays.map((overlay) => {
  // Compute scale factors from source canvas to current display
  const sourceW = overlay.sourceCanvasWidth || canvasDisplaySize.width || 1;
  const sourceH = overlay.sourceCanvasHeight || canvasDisplaySize.height || 1;
  const scaleX = canvasDisplaySize.width / sourceW;
  const scaleY = canvasDisplaySize.height / sourceH;

  // Scale overlay dimensions and position to current canvas display
  const overlayW = overlay.sourceOverlayWidth
    ?? getOverlaySizeFromConfiguration(overlay.configuration).width;
  const overlayH = overlay.sourceOverlayHeight
    ?? getOverlaySizeFromConfiguration(overlay.configuration).height;
  const bounds = overlay.visibleModelBounds
    ?? { left: 0, top: 0, width: 1, height: 1 };

  // Compute the visible model region in current display pixels
  const modelW = overlayW * bounds.width * scaleX;
  const modelH = overlayH * bounds.height * scaleY;

  // Center offset: the visible model center relative to the overlay center
  const localCenterX =
    (bounds.left + bounds.width / 2 - 0.5) * overlayW;
  const localCenterY =
    (bounds.top + bounds.height / 2 - 0.5) * overlayH;
  const rotation = overlay.configuration.rotateAngle;
  const rotRad = (rotation * Math.PI) / 180;
  const rotatedCX =
    localCenterX * Math.cos(rotRad) - localCenterY * Math.sin(rotRad);
  const rotatedCY =
    localCenterX * Math.sin(rotRad) + localCenterY * Math.cos(rotRad);

  const translateX =
    ((overlay.configuration.positionX ?? 0) + rotatedCX) * scaleX;
  const translateY =
    ((overlay.configuration.positionY ?? 0) + rotatedCY) * scaleY;

  return (
    <React.Fragment key={overlay.overlayId}>
      <img
        src={overlay.flattenedImageDataUrl}
        alt={`Placed ${overlay.productName}`}
        draggable={false}
        className="absolute inset-0 z-10 h-full w-full pointer-events-none select-none"
      />
      <div className="absolute inset-0 z-[15] flex items-center justify-center pointer-events-none">
        <button
          type="button"
          onClick={() => void handleEditPlacedOverlay(overlay)}
          aria-label={`Edit placed ${overlay.productName}`}
          title={`Edit ${overlay.productName}`}
          className="pointer-events-auto rounded-sm border border-transparent bg-transparent cursor-pointer transition-colors hover:border-[#07b6d3] focus-visible:border-[#07b6d3] focus-visible:outline-none"
          style={{
            width: modelW,
            height: modelH,
            transform: `translate(${translateX}px, ${translateY}px) rotate(${rotation}deg)`,
          }}
        />
      </div>
    </React.Fragment>
  );
})}
```

Key design decisions in this transformation:
1. **Canvas scaling:** `scaleX` and `scaleY` account for the ratio between the source canvas size (at capture time) and the current display canvas size. The flattened image fills the canvas via `inset-0 w-full h-full` CSS, so its content automatically scales; the click button must scale proportionally.
2. **Visible model bounds fitting:** Instead of covering the full overlay box, the click button is sized to `overlayW * bounds.width` by `overlayH * bounds.height`, matching the tight bounding box of the actual visible 3D geometry (alpha-tested by `getVisibleModelBounds` at capture time).
3. **Rotation-aware center offset:** The visible model region's center offset is rotated by the overlay's rotation angle before applying the position translation, matching the same trigonometric formula used in `getComparisonOverlayFrame` (lines 108-117 of `multiProductPresentation.ts`).
4. **Iteration source change:** The loop iterates over `nonActivePlacedOverlays` instead of `placedOverlays` to avoid rendering a click target for the overlay currently being actively edited (consistent with Defect 2 fix).

---

## 5. Verification Plan

### 5.1 Static Verification

Execute lint, typecheck, and production build to confirm zero regressions:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

### 5.2 Manual End-to-End Verification Scenarios

1. **Test Scenario 1: Add Product No Longer Errors**
   - Navigate to `/visualize/[productId]/workspace` with an uploaded room photo.
   - Click "Add Product". Select "Screen Door" from the catalog.
   - **Expected Result:** The product is added without the `selectWorkspaceProduct is not defined` error. The modal closes. The previously active product appears as a placed overlay layer, and the new Screen Door becomes the active product.

2. **Test Scenario 2: Add Another Same Product**
   - With a Screen Door active, click "Add Product" and select "Add Another" on the Screen Door card.
   - **Expected Result:** The modal closes successfully. The Layers panel increments by exactly 1. No error banner appears.

3. **Test Scenario 3: Layer Count Accuracy After Editing**
   - Place 3 products (any combination of same or different types).
   - Click an "Edit" button on a placed layer in the Layers panel.
   - **Expected Result:** The Layers panel count remains 3 (1 active + 2 placed). The edited product becomes the "Active" badge, and the previously active product appears in the placed list. No duplicate entries.

4. **Test Scenario 4: Placed Overlay Click Target Alignment**
   - Place 2-3 products at different positions on the canvas.
   - Hover over each placed product's rendered 3D model in the canvas.
   - **Expected Result:** The hover highlight (`hover:border-[#07b6d3]`) tightly outlines the visible 3D model geometry at the correct position, regardless of canvas resize, zoom level, or product rotation.

5. **Test Scenario 5: Click Target After Browser Resize**
   - Place a product and resize the browser window (changing canvas display dimensions).
   - **Expected Result:** The click target repositions and resizes proportionally with the canvas, maintaining alignment with the rendered product image.

---

## 6. Risk Assessment & Mitigation

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| `visibleModelBounds` is `undefined` for overlays placed before this fix | Low | Medium | Fallback to `{ left: 0, top: 0, width: 1, height: 1 }` preserves full-overlay click coverage for legacy overlays without model bounds data. |
| `sourceCanvasWidth/sourceCanvasHeight` is `undefined` for older overlays | Low | Medium | Fallback to `canvasDisplaySize` assumes the overlay was captured at the current canvas size, which is correct for non-resized scenarios. |
| Trigonometric rotation offset introduces visual drift at extreme angles | Low | Low | The formula is mathematically equivalent to `getComparisonOverlayFrame` in `multiProductPresentation.ts`, which is already validated in the comparison flow. |

---

## Self-Check & Quality Checklist

- [x] Document metadata aligns with GlassFit master documentation index (`docs/index.md`)
- [x] Primary operating directives map to core specifications (PRD-F5, PRD-F15, PRD-F16, SDD-C4, SDD-C5, DSD-UI10, QAD-TC24)
- [x] Zero em-dashes present in text or code comments (enforced by BAN-PUNCT-01)
- [x] Root causes pinpointed with exact file paths and line numbers (`ProductAwareWorkspacePage.tsx:91`, `ProductModelWorkspace.tsx:2009,2052,2118-2131`)
- [x] Clear distinction between the three defects and their interconnected nature (Defect 1 error prevents modal close, amplifying Defect 2 layer accumulation)
- [x] Concrete before-and-after code provided for all three fixes
- [x] Verification plan includes static checks, manual test scenarios, and edge case coverage
