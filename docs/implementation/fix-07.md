# Implementation Specification: Multi-Product Session Truncation and Duplicate Overlay Oversized Spawn (fix-07)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Technical Specification for Three-Product Quotation Truncation and Same-Type Duplicate Overlay Spawn Size Defects  
**Version:** 1.0.0  
**Date:** September 20, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Confirmed - Implementation Required  
**Upstream Specifications:** `docs/implementation/fix-06.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/prd-glassfit.md`, `docs/qad-glassfit.md`  

---

## 1. Problem Context & Empirical Defect Analysis

During end-to-end testing of the multi-product visualization workflow (placing 2 windows + 1 door), two critical defects were identified:

### 1.1 Defect 1: Quotation Page and PDF Truncate to 2 Products When 3 Are Placed

- **Observed Behavior:** When the user places 3 products (e.g., 2 windows and 1 door) through the workspace, the Comparison page correctly shows all 3. However, upon navigating to `/quotation`, the Product Summary renders only 2 PriceCard rows. The PDF generated via BookingFlow similarly contains only 2 itemized entries. The third product is silently dropped from both the quotation display and the PDF document.
- **Impact:** The client receives an incomplete cost estimate. The third product's material, labor, and hardware costs are omitted from the grand total. This produces incorrect financial data and erodes trust in the quotation system.
- **Previously Working:** The behavior was correct for 1-product and 2-product sessions. The defect manifests exclusively with 3 or more products.

#### 1.1.1 Root Cause A: `transitionSessionState` Unconditionally Resets `comparisonOverlays`

The function `transitionSessionState` at line 132 of `visualizationSession.tsx` always returns `comparisonOverlays: []`, regardless of the transition mode:

```typescript
// Current behavior (visualizationSession.tsx, L124-L134):
return {
  ...current,
  selectedProductId: nextProductId,
  placedOverlays: updatedPlacedOverlays,
  structuralDefinition: isSameProduct ? current.structuralDefinition : null,
  productConfiguration: nextConfiguration ?? null,
  variationSnapshots: [],
  activeOverlay: null,
  comparisonOverlays: [],   // always wiped on every product transition
  finalSnapshotDataUrl: null,
};
```

Every call to `transitionWorkspaceProduct()` in `ProductAwareWorkspacePage.tsx` (L93) unconditionally destroys any previously accumulated `comparisonOverlays`. For a single product this is benign. In a 3-product flow, when the user adds the third product, this reset fires a second time, discarding the 2-item `comparisonOverlays` that was written after the second product was confirmed.

#### 1.1.2 Root Cause B: `selectWorkspaceProduct` Also Resets `comparisonOverlays`

The `selectWorkspaceProduct` function at line 186 of `visualizationSession.tsx` applies the same unconditional reset:

```typescript
// visualizationSession.tsx, L175-L188:
const nextState: VisualizationSessionState = {
  ...current,
  selectedProductId: productId,
  workspaceBackgroundDataUrl: workspaceBackgroundDataUrl ?? current.workspaceBackgroundDataUrl,
  structuralDefinition: isCurrentProduct ? current.structuralDefinition : null,
  productConfiguration: productConfiguration ?? null,
  variationSnapshots: [],
  activeOverlay: null,
  comparisonOverlays: [],   // also wiped on any product selection
  finalSnapshotDataUrl: null,
};
```

This function is called from `handleEditPlacement` in `Comparison.tsx` (L338) whenever the user re-enters the workspace to edit a product's placement. Every edit re-entry destroys the accumulated comparison overlay set.

#### 1.1.3 Root Cause C: Active Overlay Is Excluded from `patchedOverlays` in `handleMeasurementConfirmAll`

In `ProductModelWorkspace.tsx` at L1683-L1724, `handleMeasurementConfirmAll` builds two separate arrays:

- `patchedOverlays` from `confirmedEntries.filter((e) => !e.isActiveProduct)` - the N-1 previously placed overlays.
- `patchedComparisonOverlays` from all confirmed entries - includes the new (active) overlay.

Only `patchedOverlays` is written to `placedOverlays` (via `onPlacedOverlaysChange`). The active third overlay is stored only in `comparisonOverlays`. This means `placedOverlays` never contains all N products at the point of writing. When `comparisonOverlays` is subsequently reset by the session transition (Root Cause A), the third overlay has no fallback in `placedOverlays` and is lost entirely.

The quotation page reads via:

```typescript
// ProductSummary.tsx, L39-L44:
const overlays =
  placedOverlays && placedOverlays.length > 0
    ? placedOverlays
    : comparisonOverlays && comparisonOverlays.length > 0
      ? comparisonOverlays
      : [];
```

When `placedOverlays` has 2 items and `comparisonOverlays` is `[]`, the quotation renders 2 products.

#### 1.1.4 Root Cause D: sessionStorage Quota Fallback Swallows Errors Silently

The `writeStoredVisualizationSession` function at L403-L450 of `visualizationSession.tsx` handles `sessionStorage` quota exceeded errors with a lightweight fallback serializer. If the fallback write also fails (3 products with base64 `flattenedImageDataUrl` values easily exceed browser quota), the inner catch block exits silently without logging:

```typescript
} catch {
  // Session persistence is a convenience; visualization still works in memory.
}
```

This means the storage retains the previous 2-overlay state from before step 4 in the reproduction sequence. On navigation to `/quotation`, the page hydrates from stale storage and shows only 2 products.

#### 1.1.5 Reproduction Sequence

1. Upload room image. Select Window Product A, configure and place.
2. Continue to Comparison. Click "Add Product" for Window Product B.
   - `transitionWorkspaceProduct({mode: "add"})` fires: `comparisonOverlays` reset to `[]`, `placedOverlays` accumulates overlay A.
3. Configure Product B, place, continue to Comparison.
   - `handleMeasurementConfirmAll` writes `setComparisonOverlays([A, B])`. `placedOverlays` = `[A]` (B is active, not appended to placed).
4. Click "Add Product" for Door Product C.
   - `transitionWorkspaceProduct({mode: "add"})` fires again: `comparisonOverlays` reset to `[]`. `placedOverlays` = `[A, B]`.
5. Configure Product C, place, continue to Comparison.
   - `handleMeasurementConfirmAll` fires. `patchedOverlays` = `[A, B]` (C excluded as active). `patchedComparisonOverlays` = `[A, B, C]`.
   - `setPlacedOverlays([A, B])` and `setComparisonOverlays([A, B, C])` called.
   - If quota exceeded writing `[A, B, C]`: storage retains `comparisonOverlays: []` from step 4 reset. `placedOverlays` = `[A, B]`.
6. Navigate to `/quotation`. Page hydrates from sessionStorage.
   - `placedOverlays` = `[A, B]`. `comparisonOverlays` = `[]`. Quotation shows 2 products.

---

### 1.2 Defect 2: Same-Type Duplicate Overlay Spawns Oversized

- **Observed Behavior:** When the user places a window product and then clicks "Add Product" to add another window of the same type, the newly spawned overlay appears significantly larger than the default spawn size. The user can resize it manually, but it does not start at the expected normal scale.
- **Impact:** The user must manually resize every same-type duplicate overlay before placing it. This is unexpected, disrupts the flow, and may cause users to believe the system is broken or that their room image is distorting the overlay.
- **Previously Working:** The first window always spawns at the correct default size. The defect occurs exclusively on the second (and subsequent) placements of the same product type within the same workspace session.

#### 1.2.1 Root Cause: `createDuplicateConfiguration` Carries `zoomLevel` Without Reset

When the user selects the same product type via the Add Product modal, `handleSelectProduct` at L1086-L1088 of `ProductModelWorkspace.tsx` detects `product.id === currentProductId` and calls:

```typescript
applyProductConfiguration(createDuplicateConfiguration(currentConfiguration));
```

The `createDuplicateConfiguration` function at `multiProductPresentation.ts` L176-L184 correctly resets position and perspective corners but **does not reset `zoomLevel`**:

```typescript
// Current behavior (multiProductPresentation.ts, L176-L184):
export function createDuplicateConfiguration(
  configuration: ProductConfigurationSnapshot,
): ProductConfigurationSnapshot {
  return {
    ...configuration,    // zoomLevel is preserved as-is from the first window
    positionX: 0,
    positionY: 0,
    perspectiveFitCorners: null,
  };
}
```

`currentConfiguration` is a `useMemo` that includes `zoomLevel` from the live `zoomLevel` state (line 888 of `ProductModelWorkspace.tsx`). If the user zoomed the first window to 35% (which is common when adjusting overlay size to match the wall opening), `currentConfiguration.zoomLevel = 35`.

`applyProductConfiguration` at L1018-L1021 then computes overlay size using this carried `zoomLevel`:

```typescript
const baseSize = getOverlaySizeFromDimensions(nextWidth, nextHeight);
const nextZoom = configuration.zoomLevel ?? DEFAULT_SCENE_ZOOM;  // 35 instead of 10
const scale = 1 + nextZoom / 100;
setOverlaySize({
  width: Math.round(baseSize.width * scale),   // 1.35x instead of 1.10x
  height: Math.round(baseSize.height * scale),
});
```

The default spawn uses `DEFAULT_SCENE_ZOOM = 10` which produces a scale of `1.10`. A carried zoom of 35 produces `1.35`, making the new overlay 23% wider and 23% taller than the normal spawn size.

#### 1.2.2 Size Calculation Comparison

| Scenario | zoomLevel | scale | Spawn Width (px) | Spawn Height (px) |
|---|---|---|---|---|
| First window (default) | 10 | 1.10 | 594 | 424 |
| Second window (user zoomed first to 35%) | 35 | 1.35 | 729 | 520 |
| Difference | +25 | +0.25 | +135 (+23%) | +96 (+23%) |

---

## 2. Traceability & Specification Mapping

| Traceability Code | Specification Reference | Architectural Function |
|---|---|---|
| PRD-F4 | Multi-Product Visualization Session Management | Governs session state lifecycle across workspace, comparison, and quotation stages |
| PRD-F5 | Quotation Generation & PDF Export | Requires all placed products to appear in the itemized quotation and generated PDF |
| SDD-C3 | Visualization Session Context State Machine | Defines session state transitions and persistence via sessionStorage |
| SDD-C4 | Parametric 3D Assembly Engine | Governs overlay spawn configuration including initial size and zoom |
| DSD-UI12 | Comparison Viewport & Variant Selection | Defines multi-product comparison data flow into the quotation page |
| QAD-TC-VIZ-07 | Multi-Product Quotation Correctness Test | Validates that N placed products produce N quotation rows |
| QAD-TC-VIZ-03 | Overlay Spawn Size Consistency Test | Validates that duplicate same-type overlays spawn at default scale |
| BAN-PUNCT-01 | Zero em-dashes in documentation | Hyphens, colons, and parentheses used exclusively |
| BAN-SPEC-02 | Spec-linked commits and tasks | Direct traceability to PRD-F4, PRD-F5, SDD-C3, SDD-C4, and QAD identifiers |
| BAN-TYPE-05 | Zero `any` in TypeScript | Strict typing across session state and configuration snapshot interfaces |
| BAN-UI-09 | Strict UI consistency | No new UI components introduced; fixes are data and state layer only |

---

## 3. Architectural Scope & Boundaries

### 3.1 In Scope

| Target File | Modification Rationale |
|---|---|
| `src/lib/visualization/visualizationSession.tsx` | Fix `transitionSessionState` to preserve `comparisonOverlays` when `mode === "add"`. Fix `selectWorkspaceProduct` to preserve `comparisonOverlays`. Harden quota fallback to log a warning and write a minimum viable state (configuration data, no base64 payloads) rather than silently discarding. |
| `src/features/visualization/components/ProductModelWorkspace.tsx` | Fix `handleMeasurementConfirmAll` to include the active (newly confirmed) overlay in `patchedOverlays` so `placedOverlays` is always the complete N-item canonical set at write time. |
| `src/lib/visualization/multiProductPresentation.ts` | Fix `createDuplicateConfiguration` to reset `zoomLevel` to `DEFAULT_SCENE_ZOOM` alongside `positionX`, `positionY`, and `perspectiveFitCorners`. Extract `DEFAULT_SCENE_ZOOM` as an exported constant to eliminate the magic number dependency. |

### 3.2 Out of Scope

| System Component | Rationale |
|---|---|
| `src/features/quotation/components/ProductSummary.tsx` | The overlay resolution logic (`placedOverlays` then `comparisonOverlays` fallback) is architecturally correct. The fix is in the session state layer, not the consumer. |
| `src/features/booking/components/BookingFlow.tsx` | Same rationale as `ProductSummary.tsx`; consumer logic is correct. |
| `src/features/comparison/components/Comparison.tsx` | The `handleProceedToQuotation` flow is correct. The defect is in the upstream session state, not the comparison transition. |
| `fastapi-service/` | Space image analysis and segmentation are unaffected by session state or overlay size defects. |
| `supabase/migrations/` | No database schema changes required. |

---

## 4. Technical Implementation

### 4.1 Fix `transitionSessionState`: Preserve `comparisonOverlays` on `mode === "add"`

`comparisonOverlays` should only be cleared when a fundamentally new session begins (new image upload) or when a product is fully replaced (`mode === "change"`). When adding a product to an existing multi-product scene (`mode === "add"`), the existing comparison overlays represent confirmed, placed products and must be preserved.

```typescript
// BEFORE (visualizationSession.tsx, L124-L134):
return {
  ...current,
  selectedProductId: nextProductId,
  placedOverlays: updatedPlacedOverlays,
  structuralDefinition: isSameProduct ? current.structuralDefinition : null,
  productConfiguration: nextConfiguration ?? null,
  variationSnapshots: [],
  activeOverlay: null,
  comparisonOverlays: [],
  finalSnapshotDataUrl: null,
};
```

```typescript
// AFTER:
return {
  ...current,
  selectedProductId: nextProductId,
  placedOverlays: updatedPlacedOverlays,
  structuralDefinition: isSameProduct ? current.structuralDefinition : null,
  productConfiguration: nextConfiguration ?? null,
  variationSnapshots: [],
  activeOverlay: null,
  comparisonOverlays: mode === "add" ? current.comparisonOverlays : [],
  finalSnapshotDataUrl: null,
};
```

The `mode` field from `TransitionWorkspaceProductOptions` is already destructured at the top of the function (L70-L77) and is available at this return site.

### 4.2 Fix `selectWorkspaceProduct`: Preserve `comparisonOverlays`

`selectWorkspaceProduct` is called from `handleEditPlacement` in `Comparison.tsx` when the user returns to the workspace to edit a product. At that point, `handleEditPlacement` already sets `placedOverlays` to the filtered pre-edit list. The `comparisonOverlays` context must be preserved so that `handleMeasurementConfirmAll` can re-write it after the edit completes.

```typescript
// BEFORE (visualizationSession.tsx, L175-L188):
const nextState: VisualizationSessionState = {
  ...current,
  selectedProductId: productId,
  workspaceBackgroundDataUrl: workspaceBackgroundDataUrl ?? current.workspaceBackgroundDataUrl,
  structuralDefinition: isCurrentProduct ? current.structuralDefinition : null,
  productConfiguration: productConfiguration ?? null,
  variationSnapshots: [],
  activeOverlay: null,
  comparisonOverlays: [],
  finalSnapshotDataUrl: null,
};
```

```typescript
// AFTER:
const nextState: VisualizationSessionState = {
  ...current,
  selectedProductId: productId,
  workspaceBackgroundDataUrl: workspaceBackgroundDataUrl ?? current.workspaceBackgroundDataUrl,
  structuralDefinition: isCurrentProduct ? current.structuralDefinition : null,
  productConfiguration: productConfiguration ?? null,
  variationSnapshots: [],
  activeOverlay: null,
  comparisonOverlays: current.comparisonOverlays,
  finalSnapshotDataUrl: null,
};
```

`comparisonOverlays` must only be reset in `setPreparedSpaceImage` (new image upload), which already does so at L154-L158 and is the correct reset boundary.

### 4.3 Fix `handleMeasurementConfirmAll`: Include Active Overlay in `patchedOverlays`

The active (newly confirmed) overlay must be appended to `patchedOverlays` so that `placedOverlays` always contains the complete set of all N confirmed products. Currently it exists only in `patchedComparisonOverlays`, leaving it vulnerable to session reset.

```typescript
// BEFORE (ProductModelWorkspace.tsx, L1683-L1725 conceptual):
const patchedOverlays = applyMeasurementOverridesToOverlays(
  confirmedEntries.filter((e) => !e.isActiveProduct),
  placedOverlays,
);
const patchedComparisonOverlays = applyMeasurementOverridesToOverlays(
  confirmedEntries,
  [...],
);

onPlacedOverlaysChange?.(patchedOverlays);           // [A, B] - C is missing
onComparisonOverlaysChange?.(patchedComparisonOverlays); // [A, B, C]
```

```typescript
// AFTER:
const patchedOverlays = applyMeasurementOverridesToOverlays(
  confirmedEntries.filter((e) => !e.isActiveProduct),
  placedOverlays,
);
const patchedComparisonOverlays = applyMeasurementOverridesToOverlays(
  confirmedEntries,
  [...],
);

// Append the active overlay to placedOverlays so the canonical list is always complete
const activeComparisonOverlay = patchedComparisonOverlays.find((o) => o.isActive);
const completePlacedOverlays = activeComparisonOverlay
  ? [...patchedOverlays, activeComparisonOverlay]
  : patchedOverlays;

onPlacedOverlaysChange?.(completePlacedOverlays);        // [A, B, C]
onComparisonOverlaysChange?.(patchedComparisonOverlays); // [A, B, C]
```

### 4.4 Harden `writeStoredVisualizationSession` Quota Fallback

When both the primary write and the lightweight fallback write fail due to quota, log a console warning and attempt a final minimal write containing only non-base64 data (configuration snapshots, product IDs, and session identifiers with no image payloads).

```typescript
// BEFORE (visualizationSession.tsx, L443-L450):
} catch {
  // Session persistence is a convenience; visualization still works in memory.
}
```

```typescript
// AFTER:
} catch {
  console.warn(
    "[GlassFit] sessionStorage quota exceeded even for lightweight session. " +
    "Attempting minimal config-only write.",
  );
  try {
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        selectedProductId: state.selectedProductId,
        spaceImageSession: state.spaceImageSession
          ? {
              ...state.spaceImageSession,
              workspaceImage: { ...state.spaceImageSession.workspaceImage, url: "" },
            }
          : null,
        workspaceBackgroundDataUrl: null,
        structuralDefinition: state.structuralDefinition,
        productConfiguration: state.productConfiguration,
        variationSnapshots: [],
        placedOverlays: state.placedOverlays.map((overlay) => ({
          ...overlay,
          flattenedImageDataUrl: "",
          variationImageDataUrls: undefined,
        })),
        comparisonOverlays: state.comparisonOverlays.map((overlay) => ({
          ...overlay,
          flattenedImageDataUrl: "",
          variationImageDataUrls: undefined,
        })),
        finalSnapshotDataUrl: null,
      }),
    );
  } catch {
    // Minimal write also failed. In-memory session remains valid for the current page.
  }
}
```

### 4.5 Fix `createDuplicateConfiguration`: Reset `zoomLevel` to Default

Extract `DEFAULT_SCENE_ZOOM` from `ProductModelWorkspace.tsx` into `multiProductPresentation.ts` as an exported constant so it can be referenced without creating a cross-layer import cycle. Then apply it as a reset in `createDuplicateConfiguration`.

```typescript
// BEFORE (multiProductPresentation.ts, L176-L184):
export function createDuplicateConfiguration(
  configuration: ProductConfigurationSnapshot,
): ProductConfigurationSnapshot {
  return {
    ...configuration,
    positionX: 0,
    positionY: 0,
    perspectiveFitCorners: null,
  };
}
```

```typescript
// AFTER (multiProductPresentation.ts):
export const DEFAULT_SCENE_ZOOM = 10;

export function createDuplicateConfiguration(
  configuration: ProductConfigurationSnapshot,
): ProductConfigurationSnapshot {
  return {
    ...configuration,
    positionX: 0,
    positionY: 0,
    zoomLevel: DEFAULT_SCENE_ZOOM,
    perspectiveFitCorners: null,
  };
}
```

In `ProductModelWorkspace.tsx`, replace the local `const DEFAULT_SCENE_ZOOM = 10` declaration (L139) with an import from `multiProductPresentation.ts` to ensure a single source of truth:

```typescript
// BEFORE (ProductModelWorkspace.tsx, L139):
const DEFAULT_SCENE_ZOOM = 10;
```

```typescript
// AFTER:
import { DEFAULT_SCENE_ZOOM, ... } from "@/lib/visualization/multiProductPresentation";
// Remove local const DEFAULT_SCENE_ZOOM = 10
```

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

#### Defect 1: Quotation Truncation

1. **Test Scenario 1: 3-Product Quotation Completeness**
   - Upload a room photo. Place Window Product A. Add Window Product B. Add Door Product C. Proceed through comparison to `/quotation`.
   - **Expected Result:** Product Summary shows 3 PriceCard rows. Grand total reflects the sum of all 3 products. PDF (via "Send Booking") includes 3 itemized entries.

2. **Test Scenario 2: 2-Product Baseline Unchanged**
   - Place Window Product A and Window Product B. Proceed to quotation.
   - **Expected Result:** 2 PriceCard rows, unchanged from prior behavior.

3. **Test Scenario 3: Edit and Re-Confirm Does Not Drop Products**
   - Place 3 products. On the Comparison page, click "Edit Placement" on product B. Re-confirm and return to Comparison. Proceed to quotation.
   - **Expected Result:** All 3 products still appear in the quotation.

4. **Test Scenario 4: sessionStorage Quota Resilience**
   - Open browser DevTools, throttle sessionStorage to 50KB via a quota override, then place 3 products and proceed to quotation.
   - **Expected Result:** A `console.warn` message appears in DevTools; the quotation page still shows all 3 products from in-memory state rather than regressing to 0 or 2.

#### Defect 2: Duplicate Overlay Spawn Size

5. **Test Scenario 5: Same-Type Second Window Spawns at Default Size**
   - Place a window product. Adjust zoom to 35% (or any non-default level). Click "Add Product" and select the same window type.
   - **Expected Result:** The newly spawned overlay appears at the default size (equivalent to 10% zoom scale), not at the user's previous 35% zoom size.

6. **Test Scenario 6: Different-Type Second Product Unaffected**
   - Place a window, then add a door (different product type).
   - **Expected Result:** The door spawns at its own default size. No regression in the cross-type add flow.

7. **Test Scenario 7: First Window Default Spawn Unchanged**
   - Start a fresh session. Place the first window.
   - **Expected Result:** First window spawns at the standard default size, identical to pre-fix behavior.

---

## 6. Risk Assessment & Mitigation

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| Preserving `comparisonOverlays` in `transitionSessionState` causes stale overlay data to persist after a product type change (`mode === "change"`) | Medium | Low | The `mode === "change"` branch still resets `comparisonOverlays: []`. Only `"add"` preserves the existing array. The change is mode-guarded. |
| Including active overlay in `patchedOverlays` creates a duplicate if the overlay is also already in `placedOverlays` | Low | Very Low | `handleMeasurementConfirmAll` filters by `!e.isActiveProduct` for the existing overlays and only appends `activeComparisonOverlay` if it exists and `isActive === true`. The overlay ID is unique (UUID), preventing duplicates. |
| Extracting `DEFAULT_SCENE_ZOOM` to `multiProductPresentation.ts` creates a circular import | Low | Very Low | `multiProductPresentation.ts` is a pure utility module with no imports from `ProductModelWorkspace.tsx`. Moving the constant there eliminates the dependency direction issue. |
| Resetting `zoomLevel` in duplicate configuration breaks cases where the user intentionally wants the new overlay at the same zoom | None | None | By definition, a freshly spawned overlay should start at the default size. The user adjusts zoom after placement, not before. This is consistent with how the first window behaves. |

---

## Self-Check & Quality Checklist

- [x] Document metadata aligns with GlassFit master documentation index (`docs/index.md`)
- [x] Both defects traced to exact file paths and line numbers with before-and-after code
- [x] Primary operating directives mapped to PRD-F4, PRD-F5, SDD-C3, SDD-C4, QAD-TC-VIZ-07, and QAD-TC-VIZ-03
- [x] Zero em-dashes present in text or code comments (enforced by BAN-PUNCT-01)
- [x] No `any` types introduced in any proposed code change (enforced by BAN-TYPE-05)
- [x] No new UI components or foreign styles introduced (enforced by BAN-UI-09)
- [x] Verification plan covers 3-product baseline, edit-and-return flow, quota resilience, same-type spawn, different-type spawn, and first-window regression
- [x] Risk table covers all proposed state changes with mitigations
