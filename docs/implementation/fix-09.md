# Implementation Specification: Alpha-Aware Comparison Model Selection Highlight (fix-08)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document Function:** Technical specification for selecting and highlighting rendered product models inside Product Variant comparison previews
**Version:** 2.1.0
**Date:** September 19, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Implemented - Targeted Verification Complete, Manual QA Pending
**Upstream Specifications:** `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/qad-glassfit.md`, `docs/implementation/fix-06.md`

---

## 1. Decision Summary

Product Variant comparison previews must once again allow users to select a placed product directly from the rendered room scene. The selected product must receive an aligned visual highlight, and selection must remain synchronized with the existing "Choose a product to compare" button group.

This revision intentionally supersedes only the viewport-selection removal decision in Section 4.2 of `docs/implementation/fix-06.md`. It does not supersede the per-product, per-panel variation state introduced by `fix-06`. The following `fix-06` requirements remain mandatory:

1. Product Variant selections remain keyed by stable `overlayId`.
2. Every overlay retains independent `left` and `right` finish values.
3. Selecting another product changes only the active editing target.
4. Panel A and Panel B continue rendering every overlay with that overlay's saved finish.
5. Incomplete variation data continues to show the existing actionable regeneration prompt.

The removed rectangular projection approach must not be restored. Viewport selection will instead use the alpha channel of the exact transparent product-layer images already rendered by `ProductVariantScene`.

---

## 2. Problem Statement

The current comparison page provides an accessible product selector button group above the previews, but the rendered products themselves are not interactive. Users naturally attempt to click or tap the model they can see, particularly when several products are present. The selector button group also provides limited spatial feedback because users must match a product name and ordinal to a model in the room photograph.

The earlier viewport implementation used rectangles derived from stored placement dimensions. Those rectangles could drift because the preview uses `object-contain`, responsive containers, padding, and source images captured at different display sizes. A replacement must derive interaction from the rendered pixels rather than reconstructing placement geometry.

### 2.1 Required User Experience

1. Clicking or tapping a visible product in either comparison preview selects that product for variant editing.
2. The selected product receives a cyan contour glow that follows the non-transparent model silhouette rather than a rectangular box.
3. Unselected products receive a subtle neutral contour so that direct interaction is discoverable without obscuring the room photograph.
4. The selected model displays a compact "Editing {productName}" label positioned above its visible pixel bounds.
5. The existing product selector buttons remain visible, keyboard accessible, and synchronized with viewport selection.
6. Overlapping products resolve deterministically to the topmost visible product at the clicked pixel.
7. Resize, letterboxing, pillarboxing, slider clipping, rotation, and perspective-distorted layer content must not cause selection drift.
8. Reduced-motion preferences must disable decorative entrance movement while preserving the static selection contour and text label.

---

## 3. Traceability and Acceptance Mapping

| Traceability Code | Authoritative Definition | fix-08 Responsibility |
|---|---|---|
| PRD-F15 | Before-and-After Comparison Tool | Extends the comparison route with direct selection inside Product Variant previews while preserving slider behavior |
| PRD-F16 | Multi-Product Overlay Management | Selects one placed overlay by stable `overlayId` without changing other overlays or their saved finishes |
| SDD-C5 | Photo-Based Visualization Canvas | Reuses transparent product layers as deterministic visual and interaction masks |
| SDD-C6 | Canvas Compositor and Snapshot Pipeline | Preserves the existing full-canvas transparent layer contract and render ordering |
| DSD-UI9 | ComparisonSlider | Keeps selection highlighting aligned in side-by-side and clipped slider presentations |
| QAD-TC27 | Comparison Product Variant Direct Selection | Verifies alpha-aware selection, overlap ordering, selector synchronization, accessibility fallback, and responsive alignment |
| QAD-VG3 | Mobile Framerate | Prevents continuous pixel reads or animation loops that would degrade interaction performance |
| QAD-VG4 | Web Accessibility | Preserves keyboard controls, focus indication, non-color selection cues, and reduced-motion behavior |
| BAN-SPEC-02 | Specification traceability | Links the implementation and tests to PRD-F15, PRD-F16, SDD-C5, SDD-C6, DSD-UI9, and QAD-TC27 |
| BAN-TYPE-05 | No TypeScript `any` | Requires explicit hit-mask, geometry, cache, and component prop types |
| BAN-UI-09 | UI consistency | Reuses the current comparison layout, selector buttons, colors, radii, and typography |

`QAD-TC27` is assigned because implementation specifications and tests already use `QAD-TC20` through `QAD-TC26`. Existing QAD identifiers are not repurposed.

---

## 4. Architecture and Interaction Model

### 4.1 Core Design: Alpha-Aware Hit Testing

Each `PlacedOverlay` already contains a transparent full-scene product layer in `flattenedImageDataUrl` and finish-specific transparent layers in `variationImageDataUrls`. The transparent pixels identify empty room space; non-transparent pixels identify the rendered product, including its final rotation, scale, perspective, and occlusion.

The implementation must decode one stable layer per overlay into a bounded alpha mask. A pointer coordinate inside a preview is converted to the mask's coordinate system using the same `object-contain` calculation used by the rendered image. Selection is resolved by testing the corresponding alpha value.

This design must not use:

- `sourceCanvasWidth`, `sourceCanvasHeight`, `sourceOverlayWidth`, or `sourceOverlayHeight` to project a hit rectangle.
- `visibleModelBounds` as the source of truth for pointer selection.
- `ResizeObserver` to reconstruct old workspace placement coordinates.
- Invisible per-product rectangle buttons over the scene.
- DOM pixel probing on every animation frame.

### 4.2 Stable Hit-Mask Source

Select the hit-mask image for each overlay in this exact order:

1. `overlay.flattenedImageDataUrl` when it is non-empty.
2. The finish-specific layer matching `normalizeAluminumFinish(overlay.configuration.aluminumFinish)`.
3. The first non-empty finish layer in `ALUMINUM_COLOR_VARIATIONS` order.
4. No mask when none of the above exists.

The source is chosen once per overlay input change. Finish changes in Panel A or Panel B must not rebuild a mask when the stable source remains unchanged because finish variants share the same placement geometry.

### 4.3 Mask Decode and Memory Bound

Create a pure helper module at `src/lib/visualization/overlayHitTesting.ts`. Browser-only image decoding remains in the component or a client hook, while geometry and hit-resolution logic remain pure and unit-testable.

Each decoded mask must use the following shape:

```typescript
export type OverlayAlphaMask = {
  overlayId: string;
  width: number;
  height: number;
  alpha: Uint8Array;
  opaqueBounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } | null;
};
```

Decode rules:

1. Load the stable image source with `Image.decode()` after attaching `load` and `error` handling.
2. Preserve the natural aspect ratio.
3. Downsample so the longest mask dimension is at most 1024 pixels. Never upscale a smaller source.
4. Draw into an offscreen HTML canvas and call `getImageData()` once.
5. Copy only every fourth alpha byte into `Uint8Array`; do not retain the RGBA `ImageData` object.
6. Compute `opaqueBounds` during the same alpha pass using `ALPHA_THRESHOLD = 24`.
7. Cache by `overlayId` plus the exact stable source string.
8. Release replaced mask entries when overlays or their stable sources change.
9. Ignore late decode results after the owning effect is cleaned up.

Mask decoding occurs once at the `Comparison` component level when Product Variant mode has complete comparison data. The resulting cache is shared by both side-by-side scenes or by the slider interaction surface. It must not run for Before-and-After mode or independently inside the small finish preview cards.

### 4.4 Object-Contain Coordinate Conversion

Add a pure `calculateContainTransform` helper:

```typescript
export type ContainTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
  renderedWidth: number;
  renderedHeight: number;
};
```

For container size `(containerWidth, containerHeight)` and mask size `(imageWidth, imageHeight)`:

```text
scale = min(containerWidth / imageWidth, containerHeight / imageHeight)
renderedWidth = imageWidth * scale
renderedHeight = imageHeight * scale
offsetX = (containerWidth - renderedWidth) / 2
offsetY = (containerHeight - renderedHeight) / 2
```

Convert a viewport-local point `(x, y)` to mask coordinates only when it lies inside the rendered image rectangle:

```text
maskX = (x - offsetX) / scale
maskY = (y - offsetY) / scale
```

Return no hit for zero or negative dimensions, non-finite values, or points inside letterbox or pillarbox space.

### 4.5 Hit Resolution

Export a pure `findTopmostOverlayAtPoint` helper with explicit inputs for pointer coordinates, container dimensions, ordered overlay IDs, mask collection, alpha threshold, and CSS-pixel hit slop.

Hit rules:

1. Evaluate overlays in reverse render order so the last rendered overlay wins.
2. A direct mask pixel with alpha greater than or equal to 24 is a hit.
3. If the direct pixel is transparent, search within a circular `HIT_SLOP_CSS_PX = 10` radius converted to mask pixels through the contain scale.
4. Stop at the first qualifying overlay.
5. Return `null` when no overlay qualifies.
6. Run hit resolution only for click, tap completion, or a requestAnimationFrame-throttled hover update. Never run it in a continuous timer.

The 10px hit slop improves selection of thin rails and frames without producing the oversized rectangular targets that caused the previous defect.

### 4.6 Deterministic Failure Behavior

If an image fails to decode, `getImageData()` fails, or canvas access is unavailable:

1. Record that overlay's mask as unavailable for the current source.
2. Do not guess using stored placement dimensions.
3. Keep the existing selector button group fully operational.
4. Continue rendering selection contours and labels when the image itself can render.
5. Do not show a blocking error because direct scene selection is an enhancement with an equivalent visible control.
6. Emit one development-only `console.warn` per failed source. Production UI must remain quiet.

---

## 5. Component Contract and Render Integration

### 5.1 Scene and Interaction Contracts

Keep scene rendering separate from pointer interaction. Extend `ProductVariantScene` with selection-rendering props and add a sibling `ProductVariantInteractionLayer` subcomponent in `Comparison.tsx`:

```typescript
type OverlayAlphaMaskMap = Readonly<Record<string, OverlayAlphaMask>>;

type ProductVariantSceneProps = {
  backgroundImage: string;
  layerImageUrls: string[];
  overlays: PlacedOverlay[];
  selectedOverlayId: string;
  alphaMasks: OverlayAlphaMaskMap;
  selectionFeedback: "full" | "none";
};

type ProductVariantInteractionLayerProps = {
  overlays: PlacedOverlay[];
  alphaMasks: OverlayAlphaMaskMap;
  onSelectOverlay: (overlayId: string) => void;
};
```

Contract rules:

1. `layerImageUrls[index]` must continue matching `overlays[index]`.
2. `selectionFeedback="full"` renders selected and idle contours plus the editing label, but does not attach pointer handlers.
3. `selectionFeedback="none"` renders plain product layers without contours or labels.
4. `ProductVariantInteractionLayer` owns all hover, pointer-down, pointer-up, movement-threshold, and hit-resolution behavior.
5. The `Comparison` component owns one alpha-mask cache and passes it to every main scene and interaction layer.
6. Main side-by-side and slider scenes use `selectionFeedback="full"`.
7. Finish preview card scenes use `selectionFeedback="none"`, receive an empty mask map, and never render `ProductVariantInteractionLayer`.

### 5.2 Layer Rendering and Selection Contour

Keep the existing background and product image structure. Apply state classes to each product image according to its `overlayId`:

| State | Visual Treatment |
|---|---|
| Selected | Static cyan silhouette glow using two `drop-shadow()` filters, plus a short selection-entry emphasis |
| Unselected | Subtle white silhouette contour at low opacity |

The contour must be created from the transparent image's alpha silhouette. Do not add rectangular borders or backdrop fills.

Add named CSS classes to `src/app/globals.css` rather than inserting a `<style>` element inside each scene instance. The silhouette filters change immediately; only opacity transitions so selection remains responsive and avoids animated paint-heavy filters:

```css
.comparison-overlay-layer {
  transition: opacity 180ms var(--ease-out);
}

.comparison-overlay-layer[data-selection-state="selected"] {
  filter:
    drop-shadow(0 0 2px rgba(255, 255, 255, 0.95))
    drop-shadow(0 0 7px rgba(7, 182, 211, 0.9));
  opacity: 1;
}

.comparison-overlay-layer[data-selection-state="idle"] {
  filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.55));
  opacity: 0.96;
}

@media (prefers-reduced-motion: reduce) {
  .comparison-overlay-layer {
    transition-duration: 100ms;
  }
}
```

The implementer may adjust shadow opacity by up to 0.1 after browser visual verification, but must not change the cyan token (`#07b6d3`), introduce continuous animation, or add a rectangular overlay.

### 5.3 Pointer Interaction Surface

For main previews only, render `ProductVariantInteractionLayer` as one absolute interaction surface over the scene. It must:

- Cover the same content box as the `object-contain` images.
- Use the decoded masks to resolve hover and click/tap selection.
- Use `cursor-pointer` only while a mask hit is active; otherwise use the preview's normal cursor.
- Clear hover state on pointer leave.
- Ignore non-primary mouse buttons.
- Use a movement threshold of 6 CSS pixels between pointer down and pointer up before treating the gesture as a selection tap.
- Call the existing `handleSelectComparisonOverlay(overlayId)` callback so viewport and selector-button paths share one state mutation.

The interaction surface is a pointer convenience layer, not a replacement for the product selector buttons. It must use `aria-hidden="true"`, have no `tabIndex`, and expose no duplicate accessibility-tree controls. Keyboard and assistive-technology users operate the existing semantic selector buttons.

### 5.4 Selection Label Placement

Use the selected mask's `opaqueBounds` and its contain transform to place a pointer-events-none label above the selected silhouette:

```text
labelX = offsetX + ((bounds.left + bounds.right) / 2) * scale
labelY = offsetY + bounds.top * scale - 10px
```

Clamp the label center to 12px from the scene's left and right edges. If the calculated top would be clipped, render the label 10px below the silhouette's top bound instead. The label remains horizontal because rotation is already represented inside the captured layer pixels.

Label requirements:

- Text: `Editing {productName}`.
- Style: existing dark GlassFit surface (`#0f1422`), white text, cyan status dot, `rounded-full`, and existing shadow conventions.
- Motion: one 200ms fade only; no pulsing dot.
- Accessibility: `aria-hidden="true"` because the selector group and live region expose the same state semantically.

### 5.5 Accessible State Synchronization

Preserve the current selector group and `aria-pressed` behavior. Add a visually hidden live region adjacent to the group:

```tsx
<p className="sr-only" aria-live="polite" aria-atomic="true">
  Editing {selectedComparisonOverlay.productName} {selectedProductOrdinal}
</p>
```

Selection requirements:

1. Viewport selection updates the matching button to `aria-pressed="true"`.
2. Button selection updates both main-preview highlights.
3. Focus remains where the user initiated the action. A viewport click must not move focus to a selector button.
4. Product names with duplicates retain the existing one-based ordinal suffix.
5. Selection must never mutate `productVariantSelections` except through a later finish-card action.

---

## 6. View-Mode Behavior

### 6.1 Side-by-Side Mode

Both main `ProductVariantScene` instances receive the same `selectedOverlayId`, shared alpha masks, and `selectionFeedback="full"`. Each panel wrapper renders its own `ProductVariantInteractionLayer` using the same selection callback. Each panel uses its own displayed finish layers, while hit masks use the stable per-overlay sources defined in Section 4.2.

Expected behavior:

- Clicking a product in either panel selects the same logical overlay.
- Both panels immediately highlight that overlay.
- Panel A and Panel B finish values remain unchanged.
- Finish preview cards use `selectionFeedback="none"` and do not show contours or editing labels.

### 6.2 Slider Mode

The two clipped `ProductVariantScene` instances render with `selectionFeedback="full"` but no per-scene interaction layer. Add one shared `ProductVariantInteractionLayer` above both scene layers and below the existing slider divider (`z-40`). The shared surface uses the same alpha-mask cache because placement geometry is identical across finish variants.

Expected behavior:

- Clicking or tapping a product on either visible side selects that overlay.
- Both clipped scenes render the selected contour, producing one visually continuous highlight across the divider.
- Pointer events on the divider and handle take precedence and continue controlling only `sliderPosition`.
- Dragging the divider must not select a product.
- Clicking letterbox or transparent room space must not move the divider or change selection.

### 6.3 Before-and-After Mode

Do not create masks, render product-selection contours, show editing labels, or attach the selection surface in Before-and-After mode.

### 6.4 Incomplete Variation Data

Preserve `IncompleteVariationPrompt`. Do not create masks or interaction surfaces while `variantDataComplete` is false.

---

## 7. State and Data Invariants

1. `selectedComparisonOverlayId` remains the only active-product selection state.
2. `productVariantSelections` remains the only per-overlay, per-panel finish state.
3. Hit masks are derived client-only cache data and must not be added to `VisualizationSessionState` or session storage.
4. A hit mask must never be serialized, uploaded, or written to Supabase.
5. Overlay selection must use stable `overlayId`, never array index or product name.
6. Render order remains the `comparisonOverlays` array order; reverse order is used only during hit resolution.
7. Selecting an overlay must not reorder overlays.
8. No database, FastAPI, R2, pricing, quotation, or session schema changes are permitted.

---

## 8. File-Level Implementation Scope

| File | Required Change |
|---|---|
| `src/features/comparison/components/Comparison.tsx` | Extend `ProductVariantScene`, add `ProductVariantInteractionLayer`, load and cache masks once for main Product Variant previews, render silhouette states and editing labels, synchronize both view modes, and add the live-region announcement |
| `src/lib/visualization/overlayHitTesting.ts` | Add pure types and helpers for stable mask source selection, contain transforms, coordinate conversion, opaque bounds, alpha sampling, hit slop, and topmost-overlay resolution |
| `src/app/globals.css` | Add comparison overlay contour classes, one-shot selection animation, and mandatory reduced-motion overrides |
| `tests/unit/multiProductVisualization.test.ts` | Add deterministic unit coverage for source selection, contain geometry, alpha threshold, hit slop, overlap order, invalid dimensions, and no-hit behavior |
| `docs/qad-glassfit.md` | Add the `QAD-TC27` catalog entry from Section 10.3 |

### 8.1 Explicitly Out of Scope

| Component | Reason |
|---|---|
| `src/lib/visualization/types.ts` | Existing `PlacedOverlay` fields already provide all required layer sources and stable identity |
| `src/lib/visualization/multiProductPresentation.ts` | Per-overlay finish selection and layer URL resolution remain unchanged except for optional import reuse by the hit-testing helper |
| `src/lib/visualization/visualizationSession.tsx` | Hit masks are ephemeral derived UI data and must not enter persisted session state |
| `src/features/visualization/components/ProductModelWorkspace.tsx` | Existing transparent variation-layer capture is the source contract; no new workspace capture is required |
| `fastapi-service/` | No CV or segmentation behavior is involved |
| `supabase/migrations/` | No persistence change is required |
| `package.json` | No new dependency or test script is required because the existing multi-product test file is already in `npm test` |

---

## 9. Implementation Sequence

1. Add pure contain-transform and hit-resolution types and functions to `overlayHitTesting.ts`.
2. Add unit tests for all pure geometry and alpha-resolution cases.
3. Add client-side stable-source decoding and bounded alpha-mask caching to the comparison feature.
4. Extend `ProductVariantScene` with selection state, contour classes, and label placement without adding pointer handlers.
5. Add `ProductVariantInteractionLayer` and wire one instance into each side-by-side panel.
6. Add one shared slider-mode interaction layer without changing divider drag behavior.
7. Mark finish preview card scenes as `selectionFeedback="none"`.
8. Add the selector live region and verify `aria-pressed` synchronization.
9. Add CSS selection states and the reduced-motion override.
10. Add `QAD-TC27` to the QAD test catalog.
11. Run static, unit, production-build, manual interaction, accessibility, and performance verification.

---

## 10. Verification Plan

### 10.1 Automated Static and Regression Checks

```powershell
npm run lint
npx tsc --noEmit
npm test
npm run build
```

All four commands must exit with code 0.

### 10.2 Required Unit Cases

Add the following cases to `tests/unit/multiProductVisualization.test.ts`:

| Test ID | Input | Expected Result |
|---|---|---|
| FIX08-UT1 | Equal container and image aspect ratios | Scale and offsets map corners exactly |
| FIX08-UT2 | Wide container with portrait image | Horizontal pillarbox points return no hit |
| FIX08-UT3 | Tall container with landscape image | Vertical letterbox points return no hit |
| FIX08-UT4 | Alpha 23 and alpha 24 pixels | Alpha 23 misses; alpha 24 hits |
| FIX08-UT5 | Transparent direct pixel with opaque neighbor inside 10px slop | Overlay is selected |
| FIX08-UT6 | Two opaque overlapping masks | Last rendered overlay is selected |
| FIX08-UT7 | Top overlay transparent and lower overlay opaque | Lower visible overlay is selected |
| FIX08-UT8 | Zero, negative, or non-finite dimensions | Returns `null` without throwing |
| FIX08-UT9 | Point outside contained image rectangle | Returns `null` |
| FIX08-UT10 | Empty stable source followed by committed variation source | Deterministic variation source is selected |
| FIX08-UT11 | All mask sources empty | Source resolver returns `null` |
| FIX08-UT12 | Selected overlay resolution | Does not mutate overlay order or variant selection records |

### 10.3 Reserved QAD Catalog Entry

Add this row to `docs/qad-glassfit.md` during implementation:

| Test ID | Traces to PRD | Test Scenario Description | Preconditions | Execution Steps | Expected Result | Severity |
|---|---|---|---|---|---|---|
| QAD-TC27 | PRD-F15, PRD-F16 | Alpha-aware direct model selection in Product Variant comparison | Two or more complete placed overlays in Product Variant mode | 1. Select overlapping products from both side-by-side panels<br>2. Select a product from slider mode away from the divider<br>3. Select each product using the keyboard-accessible button group<br>4. Resize through mobile and desktop breakpoints<br>5. Enable reduced motion | Topmost visible product is selected without coordinate drift; both panels and selector buttons remain synchronized; saved left/right finishes remain unchanged; divider drag remains isolated; reduced motion removes decorative movement | P1 |

### 10.4 Manual Interaction Scenarios

1. **Direct selection in Panel A:** Click opaque model pixels. The correct product becomes active and both main panels highlight it.
2. **Direct selection in Panel B:** Repeat using a different finish. Selection resolves to the same `overlayId` despite color differences.
3. **Transparent-space click:** Click inside a model's former rectangular bounds but outside its visible pixels. Selection does not change unless within the 10px hit slop.
4. **Overlapping products:** Click a pixel where both products are visible. The later rendered overlay wins. Click a pixel transparent in the top layer but opaque in the lower layer. The lower overlay wins.
5. **Responsive alignment:** Repeat at 320px, 768px, 1280px, and 1440px viewport widths. No highlight or hit area drift is allowed.
6. **Slider mode:** Select products on both sides of the divider. Drag the handle through the same products. Dragging changes only slider position.
7. **Touch input:** Tap thin frame sections and verify hit slop without selecting neighboring models unexpectedly.
8. **Selector synchronization:** Select through the viewport, then through the product buttons. Highlight, editing label, and `aria-pressed` state stay synchronized.
9. **Variant persistence:** Configure different left and right finishes for two products, switch active products repeatedly, and confirm all four selections remain intact.
10. **Decode failure:** Force one invalid mask source. The selector buttons continue working and the page does not crash.
11. **Reduced motion:** Enable `prefers-reduced-motion: reduce`. Static contours and labels remain, while selection-entry animation is disabled.
12. **Finish preview cards:** Confirm cards remain clickable only for finish selection and contain no nested viewport-selection target.

### 10.5 Accessibility Verification

1. Tab through every product selector button and confirm a visible focus ring.
2. Press Space and Enter on each selector button and confirm `aria-pressed` changes correctly.
3. Confirm the live region announces the newly selected product once.
4. Confirm the pointer interaction surface and visual label do not appear as duplicate controls in the accessibility tree.
5. Run Axe against `/comparison` in both view modes with zero WCAG 2.1 AA violations.

### 10.6 Performance Verification

1. Record mask decoding once when Product Variant mode becomes ready.
2. Confirm finish-card selection does not repeatedly decode unchanged stable sources.
3. Confirm hover hit testing executes at most once per animation frame.
4. Confirm there is no continuous polling, canvas readback, or React state update while the pointer is stationary.
5. Profile a scene with five overlays at a 1440px viewport and verify pointer interaction remains responsive without long tasks greater than 50ms after initial mask preparation.

---

## 11. Risk Assessment and Mitigation

| Risk | Severity | Likelihood | Mandatory Mitigation |
|---|---|---|---|
| Large source images consume excessive memory | High | Medium | Downsample masks to a maximum 1024px dimension, store alpha only, and release stale entries |
| Transparent glass pixels fall below the hit threshold | Medium | Medium | Use alpha threshold 24 and 10px circular hit slop; verify clear-glass products manually |
| Overlapping models select the wrong layer | High | Low | Resolve masks in reverse render order and continue to lower layers only when the upper pixel is transparent |
| Cross-origin or invalid images prevent canvas reads | Medium | Low | Use existing data URLs, catch decode/read failures, and retain the visible selector buttons as the deterministic fallback |
| Slider selection interferes with divider dragging | High | Medium | Keep the divider above the shared interaction surface and apply the 6px tap movement threshold |
| Mask decoding repeats on every finish change | Medium | Medium | Cache by stable overlay ID and stable source, not the currently displayed finish URL |
| Highlight obscures product appearance | Medium | Low | Use alpha-based external drop shadows only; do not tint or cover the product pixels |
| Motion violates accessibility settings | High | Low | Use one-shot animation only and disable it under `prefers-reduced-motion: reduce` |
| Small finish cards create nested interactive controls | High | Low | Render all card previews with `selectionFeedback="none"` and no interaction layer |

---

## 12. Definition of Done

- [x] `ProductVariantScene` supports explicit selected state and full versus none selection feedback.
- [x] `ProductVariantInteractionLayer` owns pointer selection separately from scene rendering.
- [x] Direct selection uses decoded alpha masks, never projected workspace rectangles.
- [x] Selection is correct through responsive `object-contain` letterboxing and pillarboxing.
- [x] Topmost visible-pixel resolution is deterministic for overlapping products.
- [x] Both side-by-side panels and slider mode support direct product selection.
- [x] Slider divider dragging never changes active product selection.
- [x] Selected and idle contours follow the rendered product silhouette.
- [x] Editing label placement derives from decoded opaque bounds and stays within the scene.
- [x] Existing selector buttons remain visible, keyboard accessible, and synchronized.
- [x] Per-overlay Panel A and Panel B finishes survive all selection changes.
- [x] Finish preview cards use `selectionFeedback="none"` and contain no nested selector surface.
- [x] Reduced-motion mode preserves static feedback and removes decorative motion.
- [x] Mask failure falls back to the product selector without crashing or guessing geometry.
- [x] No new dependency, database migration, session field, API, or FastAPI change is introduced.
- [x] `QAD-TC27` is added to the authoritative QAD catalog.
- [x] Touched-file lint, typecheck, all 234 unit tests, and production build pass.
- [ ] Repository-wide lint is clean. The current command reaches pre-existing errors in unrelated application files, `fastapi-service/venv`, and `parse_html.js`; fix-08 files introduce no lint errors.
- [ ] Manual mobile, desktop, touch, overlap, slider, accessibility, and performance scenarios pass.

---

## Self-Check

- [x] The viewport-removal portion of `fix-06` is explicitly superseded while its per-product variant persistence contract is preserved.
- [x] Traceability uses the actual definitions of PRD-F15, PRD-F16, SDD-C5, SDD-C6, and DSD-UI9.
- [x] QAD-TC27 is assigned without overwriting an unrelated existing test.
- [x] The interaction algorithm is deterministic and based on the rendered layer alpha channel.
- [x] Object-contain coordinate conversion, overlap order, hit threshold, hit slop, caching, and failure behavior are specified.
- [x] Side-by-side, slider, Before-and-After, incomplete-data, thumbnail, keyboard, touch, and reduced-motion behavior are specified.
- [x] No `any`, new dependency, session mutation, database migration, or backend change is required.
- [x] No em dash characters are present.
- [x] Application implementation and automated verification are complete; manual device and accessibility QA remain pending.
