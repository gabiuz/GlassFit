# Implementation Specification: Restoration of Product Variation Image Layers Post Measurement Confirmation (fix-08)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Technical Specification for Preserving Variation Image Layers Across the Measurement Confirmation Modal to Resolve Incomplete Comparison Preview Defect  
**Version:** 1.0.0  
**Date:** September 20, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Confirmed - Implementation Required  
**Upstream Specifications:** `docs/implementation/ms08.md`, `docs/implementation/fix-07.md`, `docs/implementation/fix-06.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/prd-glassfit.md`, `docs/qad-glassfit.md`  

---

## 1. Problem Context & Empirical Defect Analysis

Following the deployment of Milestone 08 (Pre-Comparison Measurement Confirmation Modal), a blocking regression occurs when completing product placement in the visualization workspace and advancing to the comparison stage.

### 1.1 Defect Description & Observed Behavior

- **Observed Behavior:** When a user configures a product in the workspace, clicks "Continue to Comparison", reviews or edits dimensions in the Measurement Confirmation Modal, and clicks "Confirm & Continue", the application navigates to `/comparison`. Instead of displaying the interactive variant preview (e.g., White, Black, and Silver aluminum finishes) or the before/after views, the comparison viewport displays a fallback error card:
  > *"This comparison needs complete product variations before it can be previewed."*  
  > `[Return to Edit Placement]`
- **Impact:** 
  - Clients cannot compare aluminum finishes against their uploaded room image in either Side-by-Side or Slider mode.
  - The core client-space visual validation mechanism of the GlassFit system is rendered inaccessible.
  - The user is misled to believe that their product placement was faulty or incomplete, prompting unnecessary round-trips back to the workspace.
- **Previously Working:** In `fix-06`, `createPlacedOverlay()` captured variation layers for all aluminum finishes (`white`, `black`, `silver`) via `captureCurrentProductVariationLayers()`, immediately writing them to `comparisonOverlays` before routing to `/comparison`. The comparison view loaded the rendered layers without issue.

---

### 1.2 Root Cause Analysis

#### 1.2.1 Root Cause A: Active Overlay Synthetic Re-Creation in `handleMeasurementConfirmAll` Discards Layer Imagery

In `ProductModelWorkspace.tsx` at lines 1620-1647, `handleContinueToComparison` properly generates the active overlay including all variation image layers:

```typescript
// ProductModelWorkspace.tsx (L1629-L1634):
const comparisonOverlays = selectedProduct
  ? [
      ...placedOverlays,
      { ...(await createPlacedOverlay()), isActive: true },
    ]
  : placedOverlays;

const entries = buildMeasurementEntries(
  comparisonOverlays,
  structuralDefinition ?? null,
  widthCm,
  heightCm,
  realtimePricing.totalPrice,
  catalogProducts,
  currentConfiguration,
);

setMeasurementEntries(entries);
setIsMeasurementModalOpen(true);
```

At this stage, `await createPlacedOverlay()` populates:
1. `flattenedImageDataUrl`: Composite canvas snapshot with the active product.
2. `variationImageDataUrls`: A complete record containing rendered layer URLs for all finishes: `white`, `black`, and `silver`.
3. `planeTransform`: Perspective calibration matrix and bounding box coordinates.

However, `comparisonOverlays` is **never persisted in component state or a mutable ref**. It is passed solely as a transient argument to `buildMeasurementEntries()`.

When the user confirms measurements in the modal, `handleMeasurementConfirmAll` (lines 1688-1722) attempts to reconstruct `patchedComparisonOverlays` from `confirmedEntries`:

```typescript
// ProductModelWorkspace.tsx (L1688-L1722):
const patchedComparisonOverlays = applyMeasurementOverridesToOverlays(
  confirmedEntries,
  confirmedEntries.map((entry) => {
    const found = patchedOverlays.find((o) => o.overlayId === entry.overlayId);
    if (found) return found;
    const config: ProductConfigurationSnapshot = {
      ...entry.overlayConfiguration,
      widthCm: entry.override.widthOverridden
        ? convertInToCm(entry.override.widthIn)
        : entry.systemWidthCm,
      heightCm: entry.override.heightOverridden
        ? convertInToCm(entry.override.heightIn)
        : entry.systemHeightCm,
      visualParameterValues: {
        ...(entry.overlayConfiguration.visualParameterValues ?? {}),
        ...(entry.override.widthOverridden
          ? { width: Math.round(convertInToCm(entry.override.widthIn) * 10) }
          : {}),
        ...(entry.override.heightOverridden
          ? { height: Math.round(convertInToCm(entry.override.heightIn) * 10) }
          : {}),
      },
    };
    return {
      overlayId: entry.overlayId,
      productId: entry.productId,
      productName: entry.productName,
      templateId: entry.structuralDefinition?.template.templateId ?? "template",
      configuration: config,
      flattenedImageDataUrl: "", // CRITICAL: Dummy empty string replaces canvas snapshot
      isActive: entry.isActiveProduct,
      totalPrice: entry.recalculatedTotalPrice ?? entry.systemTotalPrice,
      // CRITICAL: variationImageDataUrls is completely omitted (evaluates to undefined)
    } as PlacedOverlay;
  }),
);
```

For the active product (`entry.isActiveProduct === true`), `found` is `undefined` because `patchedOverlays` only includes non-active placed overlays. Consequently, the mapping callback fabricates a brand new `PlacedOverlay` object where:
- `variationImageDataUrls` is `undefined`.
- `flattenedImageDataUrl` is reset to empty string `""`.
- `planeTransform` is lost.

#### 1.2.2 Root Cause B: `MeasurementConfirmationEntry` Does Not Carry Image Data URLs

`MeasurementConfirmationEntry` (defined in `src/lib/visualization/types.ts` and assembled in `src/lib/visualization/measurementConfirmation.ts`) intentionally excludes large base64 image strings (`flattenedImageDataUrl` and `variationImageDataUrls`). This architectural decision keeps the modal lightweight and prevents redundant memory overhead during dimensional override recalculations.

Because `MeasurementConfirmationEntry` cannot supply image URLs, synthesizing `PlacedOverlay` objects directly from `confirmedEntries` without referencing the pre-captured overlay set inevitably leads to missing image data.

#### 1.2.3 Root Cause C: `hasCompleteVariationLayers` Completeness Gate Triggers Warning

In `Comparison.tsx` at line 285:

```typescript
// Comparison.tsx (L285):
const variantDataComplete = hasCompleteVariationLayers(comparisonOverlays);
```

The validation function in `multiProductPresentation.ts` (lines 59-65) checks:

```typescript
// multiProductPresentation.ts (L59-L65):
export function hasCompleteVariationLayers(overlays: PlacedOverlay[]) {
  return overlays.every((overlay) =>
    ALUMINUM_COLOR_VARIATIONS.every(
      (variation) => Boolean(overlay.variationImageDataUrls?.[variation.key]),
    ),
  );
}
```

Because the active overlay in `comparisonOverlays` has `variationImageDataUrls === undefined`, `hasCompleteVariationLayers` returns `false`.

Lines 630-642 and lines 706-745 in `Comparison.tsx` evaluate `variantDataComplete`:

```tsx
// Comparison.tsx (L630-L642):
{comparisonOverlays.length > 0 ? (
  variantDataComplete ? (
    <ProductVariantScene
      backgroundImage={beforeImage}
      layerImageUrls={leftLayerImageUrls}
      overlays={comparisonOverlays}
    />
  ) : (
    <IncompleteVariationPrompt
      editPlacementHref={editPlacementHref}
      onEditPlacement={handleEditPlacement}
    />
  )
) : (
  <AfterState src={leftVariantImage} />
)}
```

When `variantDataComplete` is `false`, `IncompleteVariationPrompt` is rendered, displaying:
> *"This comparison needs complete product variations before it can be previewed."*

#### 1.2.4 Root Cause D: `sessionStorage` Lightweight Serialization Drops Variation URLs on Page Reload

In `visualizationSession.tsx` (lines 425-440), when persisting session state to browser `sessionStorage`, `variationImageDataUrls` is stripped to avoid exceeding the 5MB quota limit:

```typescript
placedOverlays: state.placedOverlays.map((overlay) => ({
  ...overlay,
  flattenedImageDataUrl:
    overlay.flattenedImageDataUrl.length > 200000
      ? ""
      : overlay.flattenedImageDataUrl,
  variationImageDataUrls: undefined,
})),
comparisonOverlays: state.comparisonOverlays.map((overlay) => ({
  ...overlay,
  flattenedImageDataUrl:
    overlay.flattenedImageDataUrl.length > 200000
      ? ""
      : overlay.flattenedImageDataUrl,
  variationImageDataUrls: undefined,
})),
```

If a user reloads `/comparison` in the browser, `comparisonOverlays` is restored from `sessionStorage` where `variationImageDataUrls` is `undefined`. Even if in-memory navigation was previously intact, a browser refresh triggers `hasCompleteVariationLayers === false`. The comparison view currently lacks a fallback strategy for single-finish or flattened preview when variation layers are pruned by storage quotas.

---

### 1.3 Reproduction Workflow

1. Navigate to `/catalog` and select any window or door product.
2. Upload a space photo and proceed to `/visualize/[productId]/workspace`.
3. Position the product and adjust parameters.
4. Click **"Continue to Comparison"**.
   - `handleContinueToComparison` executes: calls `createPlacedOverlay()` which captures variation layers.
   - `buildMeasurementEntries` builds entries and opens `MeasurementConfirmationModal`.
5. In the modal, click **"Confirm & Continue"**.
   - `handleMeasurementConfirmAll` reconstructs the active overlay with `flattenedImageDataUrl: ""` and `variationImageDataUrls: undefined`.
   - `onComparisonOverlaysChange` writes the stripped overlays to the session context.
   - User is routed to `/comparison`.
6. On `/comparison`, `hasCompleteVariationLayers` evaluates to `false`.
7. The prompt *"This comparison needs complete product variations before it can be previewed."* appears.

---

## 2. Traceability & Specification Mapping

| Traceability Code | Specification Reference | Architectural Function |
|---|---|---|
| PRD-F10 | Quotation Measurement Modal & Parametric BOM Engine | Governs the measurement confirmation gate between workspace placement and comparison |
| PRD-F15 | Before-and-After Comparison Tool | Defines side-by-side and interactive slider viewports for finish variation analysis |
| PRD-F16 | Multi-Product Overlay Management | Governs overlay composition, transform integrity, and variation layer pipelines |
| SDD-C3 | Visualization Session Context State Machine | Manages `placedOverlays` and `comparisonOverlays` context lifecycle |
| SDD-C4 | Parametric 3D Assembly Engine | Renders 3D models and generates color variation layer snapshots |
| SDD-C5 | Photo-Based Visualization Canvas | Captures composited snapshots and isolated product variation layers |
| DSD-UI12 | Comparison Viewport & Variant Selection | Defines comparison page state handling, finish toggles, and fallback prompts |
| QAD-TC22 | Measurement Confirmation Modal Flow | Validates dimensional verification and transition to comparison |
| QAD-TC-VIZ-08 | Product Variation Layer Retention Test | Verifies that confirmed products retain all variation image layers upon reaching comparison |
| BAN-PUNCT-01 | Zero em-dashes in documentation | Standard hyphens, colons, or parentheses used exclusively across specification |
| BAN-SPEC-02 | Strict upstream specification linking | Direct traceability to PRD, SDD, DSD, and QAD requirements |
| BAN-TYPE-05 | Zero `any` in TypeScript | Strict type safety across overlay snapshots and measurement confirmations |
| BAN-UI-09 | Strict UI consistency | Preserves established Tailwind styling patterns and existing component hierarchy |

---

## 3. Architectural Scope & Boundaries

### 3.1 In Scope

| Target File | Modification Rationale |
|---|---|
| `src/features/visualization/components/ProductModelWorkspace.tsx` | Preserve the complete pre-confirmation overlay set (including `variationImageDataUrls`, `flattenedImageDataUrl`, and `planeTransform`) across modal display. Update `handleMeasurementConfirmAll` to apply measurement overrides to the genuine pre-captured overlay rather than fabricating an incomplete placeholder. |
| `src/features/comparison/components/Comparison.tsx` | Provide graceful fallback presentation when full variation layers are unavailable (such as after page refresh from quota-limited `sessionStorage`), ensuring Before/After mode and primary finish views remain functional. |

### 3.2 Out of Scope

| System Component | Rationale |
|---|---|
| `src/lib/visualization/measurementConfirmation.ts` | The pure utility functions `buildMeasurementEntries` and `applyMeasurementOverridesToOverlays` correctly manage dimension logic. They should remain decoupled from heavy image base64 payloads. |
| `src/features/visualization/components/MeasurementConfirmationModal.tsx` | Modal UI and interaction behavior operate correctly. |
| `src/features/quotation/components/ProductSummary.tsx` | Quotation presentation consumes overlay configurations and pricing, which are unaffected by image layer preservation. |
| `fastapi-service/` | Python CV microservice is uninvolved in post-placement modal or comparison state handling. |
| `supabase/migrations/` | Persistence schemas are unchanged; this is client-space session and visualization state. |

---

## 4. Technical Implementation Specification

### 4.1 Preserve Pre-Confirmation Overlay Set in `ProductModelWorkspace.tsx`

To prevent losing the active overlay's image data while the user interacts with the Measurement Confirmation Modal, `ProductModelWorkspace.tsx` must maintain a reference to the fully resolved comparison overlay array generated in `handleContinueToComparison`.

#### Proposed Modification: Add `pendingComparisonOverlaysRef`

```typescript
// Add ref to hold the pre-captured overlay set during modal confirmation:
const pendingComparisonOverlaysRef = useRef<PlacedOverlay[]>([]);
```

In `handleContinueToComparison`, store the prepared comparison overlays in the ref:

```typescript
// ProductModelWorkspace.tsx (L1629-L1647):
const comparisonOverlays = selectedProduct
  ? [
      ...placedOverlays,
      { ...(await createPlacedOverlay()), isActive: true },
    ]
  : placedOverlays;

// Stash complete overlay set with variationImageDataUrls and flattenedImageDataUrl
pendingComparisonOverlaysRef.current = comparisonOverlays;

const entries = buildMeasurementEntries(
  comparisonOverlays,
  structuralDefinition ?? null,
  widthCm,
  heightCm,
  realtimePricing.totalPrice,
  catalogProducts,
  currentConfiguration,
);

setMeasurementEntries(entries);
setIsMeasurementModalOpen(true);
```

---

### 4.2 Update `handleMeasurementConfirmAll` to Retain Image Layers

Instead of building a partial placeholder object from `confirmedEntries.map(...)`, `handleMeasurementConfirmAll` must use the stored `pendingComparisonOverlaysRef.current` as the base overlay array.

`applyMeasurementOverridesToOverlays(confirmedEntries, currentOverlays)` is already designed to preserve existing overlay fields (`variationImageDataUrls`, `flattenedImageDataUrl`, `planeTransform`, etc.) while updating only `configuration` dimensions and prices.

#### Current Flawed Logic (Lines 1688-1722):

```typescript
// BEFORE:
const patchedComparisonOverlays = applyMeasurementOverridesToOverlays(
  confirmedEntries,
  confirmedEntries.map((entry) => {
    const found = patchedOverlays.find((o) => o.overlayId === entry.overlayId);
    if (found) return found;
    // Missing variationImageDataUrls and flattenedImageDataUrl
    return {
      overlayId: entry.overlayId,
      productId: entry.productId,
      productName: entry.productName,
      templateId: entry.structuralDefinition?.template.templateId ?? "template",
      configuration: config,
      flattenedImageDataUrl: "",
      isActive: entry.isActiveProduct,
      totalPrice: entry.recalculatedTotalPrice ?? entry.systemTotalPrice,
    } as PlacedOverlay;
  }),
);
```

#### Corrected Logic:

```typescript
// AFTER:
// Use pre-captured overlays that contain genuine variationImageDataUrls and flattenedImageDataUrl
const baseOverlays = pendingComparisonOverlaysRef.current.length > 0
  ? pendingComparisonOverlaysRef.current
  : (selectedProduct ? [...placedOverlays] : placedOverlays);

// Apply measurement overrides directly onto the intact overlays
const patchedComparisonOverlays = applyMeasurementOverridesToOverlays(
  confirmedEntries,
  baseOverlays,
);

// Synchronize canonical placed overlays list
const activeComparisonOverlay = patchedComparisonOverlays.find((o) => o.isActive);
const completePlacedOverlays = activeComparisonOverlay
  ? [
      ...patchedOverlays.filter((o) => o.overlayId !== activeComparisonOverlay.overlayId),
      activeComparisonOverlay,
    ]
  : patchedOverlays;

// Clear the pending ref
pendingComparisonOverlaysRef.current = [];

onPlacedOverlaysChange?.(completePlacedOverlays);
onComparisonOverlaysChange?.(patchedComparisonOverlays);
router.push("/comparison");
```

---

### 4.3 Dimension Overrides and Visual Consistency

When the user enters custom width and height values in the modal:
1. `applyMeasurementOverridesToOverlays` updates `configuration.widthCm`, `configuration.heightCm`, and `visualParameterValues`.
2. Pricing is updated to `recalculatedTotalPrice`.
3. The visual canvas snapshot captured in `createPlacedOverlay()` reflects the visual placement agreed upon in the workspace. Since real-world manual dimension adjustments (e.g., specifying 215 cm instead of estimated 210 cm) do not alter the perspective room alignment, the captured variation layers remain visually accurate and valid for finish comparison.
4. If the user desires a complete re-alignment or repositioning, clicking "Return to Edit Placement" allows canvas re-adjustment.

---

### 4.4 Graceful Degradation in `Comparison.tsx` for Resumed Sessions

To make the comparison page resilient against browser reloads where `sessionStorage` has stripped `variationImageDataUrls` to conserve storage quota:

1. **Before and After Mode**: Before/After comparison (`compareMode === "left"`) requires only `beforeImage` and `afterImage` (`flattenedImageDataUrl`). It does not require multi-finish variation layers. `Comparison.tsx` should always allow Before/After mode to display even if `variantDataComplete` is `false`.
2. **Product Variant Mode**: If `variantDataComplete` is `false`:
   - If `variationSnapshots` exists (single-product legacy fallback), render using `variationSnapshots`.
   - If overlays have at least `flattenedImageDataUrl`, allow preview of the currently configured finish rather than blocking the entire viewport.
   - Display `IncompleteVariationPrompt` only when switching to an alternate finish that lacks rendered image data.

---

## 5. Verification Plan

### 5.1 Automated & Static Verification

Execute static checks to guarantee type safety, lint conformance, and test suite health:

```powershell
# Typecheck
npx tsc --noEmit

# Lint
npm run lint

# MS-08 Measurement Confirmation Unit Tests
npm run test:ms08

# Multi-Product Visualization Tests
npx tsx --test tests/unit/multiProductVisualization.test.ts
```

### 5.2 Unit Test Expansion

Add a targeted unit test in `tests/unit/multiProductVisualization.test.ts` or `tests/unit/measurementConfirmation.test.ts` verifying that `applyMeasurementOverridesToOverlays` preserves `variationImageDataUrls` and `flattenedImageDataUrl`:

```typescript
test("applyMeasurementOverridesToOverlays preserves variationImageDataUrls and flattenedImageDataUrl", () => {
  const mockOverlay: PlacedOverlay = {
    overlayId: "overlay-1",
    productId: "prod-1",
    productName: "Sliding Window",
    templateId: "sliding-window",
    configuration: {
      widthCm: 200,
      heightCm: 150,
      aluminumFinish: "white",
    },
    flattenedImageDataUrl: "data:image/png;base64,mockFlattened",
    variationImageDataUrls: {
      white: "data:image/png;base64,mockWhite",
      black: "data:image/png;base64,mockBlack",
      silver: "data:image/png;base64,mockSilver",
    },
    isActive: true,
    totalPrice: 15000,
  };

  const mockEntry: MeasurementConfirmationEntry = {
    overlayId: "overlay-1",
    productId: "prod-1",
    productName: "Sliding Window",
    aluminumFinish: "white",
    previewGlbUrl: null,
    systemWidthCm: 200,
    systemHeightCm: 150,
    systemTotalPrice: 15000,
    structuralDefinition: null,
    overlayConfiguration: mockOverlay.configuration,
    isActiveProduct: true,
    override: {
      widthIn: 85,
      heightIn: 60,
      widthOverridden: true,
      heightOverridden: false,
      acknowledged: true,
    },
    recalculatedTotalPrice: 16500,
  };

  const result = applyMeasurementOverridesToOverlays([mockEntry], [mockOverlay]);
  assert.equal(result.length, 1);
  assert.equal(result[0].flattenedImageDataUrl, "data:image/png;base64,mockFlattened");
  assert.equal(result[0].variationImageDataUrls?.white, "data:image/png;base64,mockWhite");
  assert.equal(result[0].variationImageDataUrls?.black, "data:image/png;base64,mockBlack");
  assert.equal(result[0].variationImageDataUrls?.silver, "data:image/png;base64,mockSilver");
  assert.equal(hasCompleteVariationLayers(result), true);
});
```

### 5.3 Manual End-to-End Verification Scenarios

1. **Scenario 1: Single Product Workspace to Comparison Flow**
   - Upload room photo, select a Sliding Window, position in workspace.
   - Click "Continue to Comparison".
   - Confirm measurements in modal without overrides.
   - **Expected Result:** `/comparison` renders immediately without the *"needs complete product variations"* prompt. Both Side-by-Side and Slider modes work for White, Black, and Silver finishes.

2. **Scenario 2: Single Product with Measurement Override**
   - In the modal, override width from system estimate to a custom value (e.g., 80 inches).
   - Check the acknowledgement box and confirm.
   - **Expected Result:** `/comparison` renders all finishes with the updated pricing reflected. No fallback warning prompt appears.

3. **Scenario 3: Multi-Product Placement Flow**
   - Place Product 1 (Window). From comparison, click "Add Product" and place Product 2 (Door).
   - Click "Continue to Comparison". Review both pages in the Measurement Modal and confirm.
   - **Expected Result:** `/comparison` loads with multi-product selector tabs. Toggling between Product 1 and Product 2 renders variant layer previews seamlessly for both items.

4. **Scenario 4: Browser Reload Resilience**
   - While viewing `/comparison`, reload the page (F5).
   - **Expected Result:** Before/After mode continues to display cleanly. If variant layers are purged by quota, user is shown an intuitive notification or fallback rather than a broken layout.

---

## 6. Risk Assessment & Mitigation

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| Retaining large base64 strings in `pendingComparisonOverlaysRef` causes memory leaks | Low | Low | The ref is cleared immediately in `handleMeasurementConfirmAll` and reset in `handleMeasurementModalCancel`. Only one active set is retained in memory during the modal lifecycle. |
| Discarding modal cancellation leaves stale data in ref | Low | Low | Wire `pendingComparisonOverlaysRef.current = []` into `handleMeasurementModalCancel` to cleanly release memory when the user cancels. |
| User edits placement after modal cancellation and re-triggers comparison | Low | Low | `handleContinueToComparison` re-executes `createPlacedOverlay()`, naturally refreshing `pendingComparisonOverlaysRef.current` with fresh canvas imagery. |
| Browser quota limit causes `sessionStorage` failure on large multi-product sessions | Medium | Medium | Maintain the lightweight serialization strategy implemented in `fix-07`, and enhance `Comparison.tsx` to handle pruned variant layers gracefully in Before/After mode. |

---

## Self-Check & Quality Checklist

- [x] Document metadata aligns with GlassFit master documentation index (`docs/index.md`)
- [x] Problem description traces directly to post-MS08 regression with exact line numbers
- [x] Primary operating directives mapped to PRD-F10, PRD-F15, PRD-F16, SDD-C3, SDD-C4, SDD-C5, DSD-UI12, QAD-TC22, and QAD-TC-VIZ-08
- [x] Zero em-dashes present across the entire document (strictly enforced by BAN-PUNCT-01)
- [x] Zero `any` types introduced in specification code samples (strictly enforced by BAN-TYPE-05)
- [x] Architectural boundaries respected: specification document only, no application code modified
- [x] Verification plan includes static checks, unit test expansion, and manual end-to-end scenarios
- [x] Risk table addresses memory lifecycle, modal cancellation, and storage quota resilience
