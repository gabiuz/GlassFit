# Implementation Specification: Bounded 24-Finish Comparison Rendering and Binary Asset Persistence (fix10)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document Function:** Technical specification for removing the rendering-time and session-storage limits introduced by eager 24-finish comparison snapshots
**Version:** 1.0.0
**Date:** September 22, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Confirmed - Implementation Required
**Upstream Specifications:** `docs/implementation/ms12.md`, `docs/implementation/fix-08.md`, `docs/implementation/fix-09.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/qad-glassfit.md`

---

## 1. Decision Summary

The Product Variant comparison page must continue exposing all 24 R.R.D. aluminum finishes, but it must no longer require 24 full-resolution base64 images per product to exist in React state and `sessionStorage` before comparison is usable.

The implementation must adopt the following architecture:

1. Keep the complete 24-finish catalog as lightweight metadata.
2. Store rendered variation layers as binary `Blob` records in a session-scoped IndexedDB cache rather than embedding base64 payloads in `VisualizationSessionState`.
3. Persist only typed asset references and render recipes in `sessionStorage`.
4. Generate the currently required Panel A and Panel B assets first, then generate or retrieve other finishes through a single-concurrency prioritized render queue.
5. Reuse one loaded Three.js model while changing presentation materials between finish captures.
6. Replace the 48 miniature full-scene preview renders with lightweight finish swatches and text labels.
7. Compose only the selected quotation image when proceeding, not one full-scene snapshot for every catalog finish.
8. Preserve the last ready panel image while a newly selected finish is generated.
9. Treat an uncached finish as a normal pending state, not as incomplete or corrupt comparison data.
10. Retain a deterministic in-memory fallback when IndexedDB is unavailable.

This specification supersedes the eager image-generation and all-24-image completeness requirements in Sections 10.2, 10.3, and 15 of `docs/implementation/ms12.md`. It does not supersede the requirement that all 24 finishes remain visible and selectable.

---

## 2. Problem Context and Empirical Defect Analysis

### 2.1 Observed Behavior

After the comparison catalog expanded from 8 to 24 finishes, users can encounter one or more of the following symptoms:

1. "Continue to Comparison" remains in its preparation state for an excessive period.
2. The browser becomes temporarily unresponsive while variation images are rendered and serialized.
3. `sessionStorage.setItem()` exceeds the browser quota.
4. The lightweight persistence fallback removes `variationImageDataUrls`, so a refresh or route restoration displays the incomplete-variation prompt.
5. Memory usage grows sharply when several products are placed because each product retains 24 full-scene transparent images.
6. The comparison page decodes and renders many duplicate scene layers inside both finish-selector grids.
7. Proceeding to quotation composes snapshots for all 24 finishes even though the user selected only one committed result.

### 2.2 Root Cause 1: Eager O(P x F) Rendering

`captureCurrentProductVariationLayers()` in `ProductModelWorkspace.tsx` iterates over every finish returned by `getVariationFinishes()`. After MS12 v1.2.0, that list contains all 24 catalog entries. For each entry, the current implementation:

1. Creates a new `ProductModelRenderer`.
2. Creates a new WebGL context and canvas.
3. Loads or rebuilds the model.
4. Applies lighting and material presentation.
5. Renders the model.
6. Captures a full-canvas image data URL.
7. Disposes the renderer.

For `P` placed products and `F = 24` finishes, comparison preparation performs up to `P x F` renderer construction, model-load, render, and image-encoding cycles. The work is sequential inside each product capture, so the route transition waits for every finish even when the comparison initially displays only two finishes.

The single-product fallback path in `generateVariationSnapshots()` performs another 24-finish loop. The quotation transition also maps over the complete finish catalog and calls `composeComparisonSnapshot()` for every finish.

### 2.3 Root Cause 2: Base64 Amplification and Duplicate Serialization

Rendered layers are currently stored as base64 data URLs in:

- `PlacedOverlay.variationImageDataUrls`
- `PlacedOverlay.flattenedImageDataUrl`
- `VisualizationSessionState.placedOverlays`
- `VisualizationSessionState.comparisonOverlays`
- `VisualizationSessionState.variationSnapshots`
- `VisualizationSessionState.finalSnapshotDataUrl`

Base64 encoding increases binary payload size by approximately one third before JSON string overhead. The same overlay can also appear in both `placedOverlays` and `comparisonOverlays`, which duplicates every variation string during `JSON.stringify()`.

The effective persisted size grows approximately as:

```text
session bytes = O(product count x finish count x encoded layer bytes x duplicated collections)
```

`writeStoredVisualizationSession()` performs this serialization synchronously on the browser main thread. When the primary write exceeds quota, the lightweight fallback removes all `variationImageDataUrls`. That fallback protects navigation state but makes the restored comparison fail its current all-finishes completeness check.

### 2.4 Root Cause 3: Selector Preview Multiplication

Panel A and Panel B each render 24 `ComparisonPanelCard` entries. Each card can mount a `ProductVariantScene`, which renders the room background plus one image layer per placed product. The page can therefore create 48 miniature scenes in addition to the two main scenes.

For `P` products, the selector grids can mount up to `48 x P` product-layer image elements. This increases image decoding, layout, painting, and memory pressure without materially improving finish selection because the card is too small to communicate subtle material differences reliably.

### 2.5 Required User Experience

1. All 24 finishes remain visible in both Panel A and Panel B selectors.
2. The comparison route becomes interactive after the two initially displayed panel assets are ready.
3. Selecting an uncached finish shows localized progress for that finish without blanking or blocking the page.
4. The existing ready panel image remains visible until the requested finish is ready.
5. A user-requested finish jumps ahead of speculative background work.
6. Refreshing the route restores cached finish assets without storing image payloads in `sessionStorage`.
7. A cache or render failure affects only the requested finish and provides a retry action.
8. Multi-product comparison preserves independent Panel A and Panel B selections by stable `overlayId`.
9. Proceeding to quotation does not wait for unused finishes.
10. Resetting the visualization session releases all session-owned binary assets and object URLs.

---

## 3. Traceability and Acceptance Mapping

| Traceability Code | Authoritative Definition | fix10 Responsibility |
|---|---|---|
| PRD-F6 | Photo-Based Visualization Workspace | Keeps product-layer generation responsive and bounded while preserving placement output |
| PRD-F9 | Canvas compositing and high-resolution snapshot generation | Uses binary canvas capture and creates only assets required by the active workflow |
| PRD-F15 | Before-and-After Comparison Tool | Keeps the comparison route interactive while all 24 Product Variant choices remain available |
| PRD-F16 | Multi-Product Overlay Management | Scales finish assets by stable overlay identity without duplicating payloads in session metadata |
| SDD-C4 | Parametric 3D Assembly and Guardrail Engine | Reuses loaded model geometry while changing presentation materials between finish renders |
| SDD-C5 | Photo-Based Visualization Canvas | Preserves placed transforms, lighting, glass inputs, perspective, occlusion, and render order |
| SDD-C6 | Canvas Compositor and Snapshot Pipeline | Captures variation layers as blobs and composes only the selected quotation output |
| DSD-UI9 | ComparisonSlider | Keeps both main comparison scenes stable while requested finish assets are pending |
| QAD-TC28 | Bounded 24-Finish Comparison Asset Pipeline | Verifies all 24 choices, prioritized lazy generation, refresh restoration, cleanup, and failure recovery |
| QAD-VG3 | Mobile Framerate | Prevents 48 miniature scenes and uncontrolled concurrent WebGL work |
| QAD-VG5 | Canvas Snapshot Integrity | Preserves visual parity between blob-backed layers and the existing data URL output |
| BAN-SPEC-02 | Specification traceability | Links implementation and tests to PRD-F6, PRD-F9, PRD-F15, PRD-F16, SDD-C4, SDD-C5, SDD-C6, DSD-UI9, and QAD-TC28 |
| BAN-TYPE-05 | No TypeScript `any` | Requires typed cache records, render recipes, queue jobs, results, and failure states |
| BAN-UI-09 | UI consistency | Reuses current comparison cards, swatches, progress treatments, typography, and focus styles |

`QAD-TC28` is reserved because the authoritative catalog currently ends at `QAD-TC27`. The implementation phase must add the final test definition to `docs/qad-glassfit.md` without repurposing an existing identifier.

---

## 4. Architecture and Data Contracts

### 4.1 Separate Metadata From Binary Assets

`VisualizationSessionState` must remain a small, synchronously restorable metadata document. Full image bytes must not be serialized into the session JSON.

Add the following explicit types in `src/lib/visualization/types.ts`:

```typescript
export type VariationAssetRef = {
  cacheKey: string;
  mimeType: "image/webp" | "image/png";
  byteLength: number;
  width: number;
  height: number;
  fingerprint: string;
};

export type VariationRenderRecipe = {
  productId: string;
  templateId: string;
  structuralDefinition: ProductStructuralDefinition;
  configuration: ProductConfigurationSnapshot;
  sourceCanvasWidth: number;
  sourceCanvasHeight: number;
  sourceOverlayWidth: number;
  sourceOverlayHeight: number;
  visibleModelBounds: NonNullable<PlacedOverlay["visibleModelBounds"]>;
};

export type VariationAssetStatus =
  | { state: "missing" }
  | { state: "queued"; priority: "visible" | "user" | "idle" }
  | { state: "rendering"; finish: AluminumFinishKey }
  | { state: "ready"; asset: VariationAssetRef; objectUrl: string }
  | { state: "error"; message: string; retryable: boolean };
```

Extend `PlacedOverlay` with:

```typescript
variationAssetRefs?: Partial<Record<AluminumFinishKey, VariationAssetRef>>;
variationRenderRecipe?: VariationRenderRecipe;
```

`VariationAssetStatus` is runtime-only state and must not be written to `sessionStorage`. `objectUrl` values are also runtime-only and must be revoked when replaced or released.

### 4.2 Session Asset Namespace

Add `assetSessionId: string | null` to `VisualizationSessionState`.

Namespace rules:

1. Create one UUID when a valid room image starts a new visualization session.
2. Preserve it through workspace, comparison, quotation, Add Product, Edit Placement, and normal refresh flows.
3. Replace it when `setPreparedSpaceImage()` receives a new room image session.
4. Clear it during `resetVisualizationSession()`.
5. Include it in primary, lightweight, and minimal session payloads.
6. Never derive it from a user ID, product ID, filename, or room-image URL.

Asset keys use this deterministic format:

```text
{assetSessionId}:{overlayId}:{finish}:{fingerprint}
```

### 4.3 Render Fingerprint

The fingerprint must change whenever an input capable of changing rendered pixels changes. Build it from a stable, ordered serialization of:

- Product ID and template ID
- Render-affecting configuration values
- Width, height, panel count, sill, yaw, pitch, rotation, flip, and zoom
- Glass appearance, color, thickness, and type
- Auto-lighting, shadow, and realism flags
- Perspective-fit corners
- Active and manual occlusion inputs
- Source canvas and overlay dimensions
- Finish key
- A constant `VARIATION_RENDER_SCHEMA_VERSION`

Do not include pricing, product description, selector state, or timestamps. The implementation may use the browser-native SubtleCrypto SHA-256 API or a deterministic local hash already present in the repository. No new dependency is permitted.

### 4.4 IndexedDB Binary Store

Create `src/lib/visualization/variationAssetStore.ts` using the native IndexedDB API.

Database contract:

| Field | Value |
|---|---|
| Database | `glassfit-visualization-assets` |
| Object store | `variationLayers` |
| Primary key | `cacheKey` |
| Session index | `assetSessionId` |
| Overlay index | `[assetSessionId, overlayId]` |
| Record body | Metadata fields plus one `Blob` |

Required operations:

```typescript
export interface VariationAssetStore {
  get(ref: VariationAssetRef): Promise<Blob | null>;
  put(record: VariationAssetRecord): Promise<VariationAssetRef>;
  remove(cacheKey: string): Promise<void>;
  removeOverlay(assetSessionId: string, overlayId: string): Promise<void>;
  removeSession(assetSessionId: string): Promise<void>;
  removeExpired(cutoffEpochMs: number): Promise<number>;
}
```

Storage rules:

1. Capture transparent layers with `HTMLCanvasElement.toBlob()` rather than `toDataURL()`.
2. Prefer transparent WebP when the browser successfully encodes and decodes it; otherwise use PNG.
3. Never convert a blob back to base64 for persistence.
4. Store one binary record per unique cache key.
5. Treat identical `put()` calls as idempotent replacements.
6. Delete stale records older than 24 hours during best-effort startup maintenance.
7. Delete the prior namespace after a new image session is established.
8. Delete an overlay namespace after that overlay is permanently removed.
9. Delete the active namespace on explicit visualization reset.
10. Keep cleanup failures non-blocking and report one development warning.

### 4.5 In-Memory Fallback

When IndexedDB is unavailable, blocked, or exceeds quota:

1. Store the blob in a bounded `Map<string, Blob>` for the current page lifetime.
2. Generate an object URL for display.
3. Preserve functional route navigation within the current React runtime.
4. Mark the persisted reference as unavailable after a full refresh.
5. Regenerate the requested finish from its render recipe when possible.
6. Show a retryable localized error only when regeneration also fails.
7. Do not fall back to base64 image persistence in `sessionStorage`.

### 4.6 Cache Budget

Use `navigator.storage.estimate()` when available. The variation cache must enforce both limits:

1. A default per-session target of 64 MiB.
2. At most 20 percent of the browser-reported available quota.

When either limit would be exceeded:

1. Remove least-recently-used idle assets first.
2. Never evict the currently displayed Panel A or Panel B assets.
3. Never evict an asset while quotation composition is reading it.
4. Retain asset metadata only when its binary record still exists.
5. Allow an evicted finish to return to `missing` and regenerate on demand.

The cache budget bounds persisted bytes. It does not reduce the number of visible finish choices.

---

## 5. Rendering Pipeline

### 5.1 Reusable Renderer Session

Extend `ProductModelRenderer` with a typed presentation update that does not reload geometry:

```typescript
updatePresentation(presentation: ModelPresentationOptions): ProductMaterialCapabilities;
```

Required behavior:

1. Load or build the product model once per render recipe.
2. Retain the classified source material roles needed to reapply presentation safely.
3. Update aluminum, glass, and lighting presentation without loading GLB assets again.
4. Render the same camera framing and transform after every material update.
5. Dispose replaced materials and textures owned by the renderer.
6. Dispose the WebGL renderer once when the queue releases the recipe session.
7. Verify fixed and parametric products produce the same material parity as the current implementation.

Repeated presentation updates must not classify an already recolored material as a different semantic role. Preserve an immutable material-role map from the initial model load or clone from a stable source-material set.

### 5.2 Single-Concurrency Priority Queue

Create `src/lib/visualization/variationRenderQueue.ts`.

Queue priorities, from highest to lowest:

1. `user`: a finish explicitly selected in Panel A or Panel B.
2. `visible`: the two finishes required when comparison first opens.
3. `idle`: speculative generation for remaining catalog finishes.

Queue invariants:

1. Run at most one WebGL render job at a time.
2. Deduplicate jobs by cache key.
3. Promote an existing idle job when the user requests the same key.
4. Abort or ignore stale jobs when the overlay fingerprint changes.
5. Yield to the browser between finish captures.
6. Use `requestIdleCallback()` for idle jobs with a `setTimeout()` fallback.
7. Pause idle work while the page is hidden or while a higher-priority job exists.
8. Continue serving cached assets while rendering is paused.
9. Expose typed progress per overlay and finish.
10. Never create 24 concurrent renderers, canvases, or blob encoders.

### 5.3 Initial Comparison Readiness

The workspace transition must no longer wait for the entire finish catalog.

Before navigation, it must persist:

1. The final committed overlay image or its binary asset reference.
2. The complete render recipe.
3. The initially selected Panel A asset.
4. The initially selected Panel B asset when it differs from Panel A.
5. Asset references already available from prior work.

The comparison route is ready when every overlay can render the two currently selected panels. Remaining finishes may be `missing`, `queued`, `rendering`, or `ready`.

### 5.4 On-Demand Finish Selection

When a user selects a finish:

1. Resolve the expected cache key from the overlay recipe and requested finish.
2. Use a ready in-memory object URL when available.
3. Otherwise read the referenced blob from IndexedDB and create an object URL.
4. Otherwise enqueue a `user` render job.
5. Keep the prior ready layer visible in the affected panel.
6. Set the selected button to `aria-busy="true"` and show the existing compact spinner treatment plus "Rendering...".
7. Commit the panel's new finish selection only after the asset becomes ready.
8. On failure, retain the previous selection and show an inline retry action for the requested card.
9. Do not block the other panel, view-mode controls, product selector, or slider.

### 5.5 Speculative Prewarming

After both visible panels are ready, enqueue missing finishes at `idle` priority in catalog order. This improves later selection latency without delaying initial comparison readiness.

Prewarming must stop when:

- The document becomes hidden.
- The user starts another high-priority operation.
- The cache budget is reached.
- The overlay or session is reset.
- The browser reports storage pressure or a write failure.

Prewarming is an optimization. The correctness of finish selection must not depend on all 24 assets being prewarmed.

### 5.6 Quotation Composition

`handleProceedToQuotation()` must stop generating a complete 24-entry `variationSnapshots` array.

Instead:

1. Resolve the finish that will be committed for each overlay according to the existing Panel A commit policy.
2. Ensure only those selected finish assets are ready.
3. Compose one final full-scene quotation snapshot.
4. Persist that final snapshot through the existing final-output path.
5. Store catalog labels and committed finish keys as metadata, not 24 image copies.

If a later quotation UI still requires Panel A and Panel B reference images, compose at most those two scenes. It must not compose unused catalog entries.

---

## 6. Comparison UI Integration

### 6.1 Finish Selector Cards

Keep the current two-column, scrollable Panel A and Panel B selector layout. Remove `ProductVariantScene` from every `ComparisonPanelCard` preview.

Each card must contain only:

- The catalog `previewHex` swatch.
- Finish title.
- Finish label or code.
- Selected state.
- "Selected in Panel A/B" disabled state.
- Pending spinner and "Rendering..." text when that exact finish is requested.
- Inline retry state when its last generation failed.

This change removes up to 48 miniature scene graphs while preserving the established UI structure and design tokens.

### 6.2 Main Scene Stability

Only the two main comparison scenes render room and product images. Their behavior must follow these rules:

1. A pending selection never clears the current `src`.
2. The new object URL replaces the old URL only after image decode succeeds.
3. The replaced URL is revoked after it is no longer rendered.
4. Panel A and Panel B may be pending independently.
5. Slider mode retains a stable layer on both sides while either replacement is pending.
6. Alpha-mask hit testing continues using one stable decoded source per overlay.
7. The selection contour and product selector remain synchronized throughout asset replacement.

### 6.3 Availability Semantics

Replace `hasCompleteVariationLayers()` as the gate for Product Variant mode.

New readiness rules:

| Condition | UI behavior |
|---|---|
| Valid recipe and visible panel assets ready | Render Product Variant mode normally |
| Valid recipe and visible asset pending | Render last ready image with localized progress |
| Valid recipe and requested asset missing | Enqueue generation automatically |
| Legacy complete data URL map | Display immediately and migrate opportunistically |
| No recipe and no usable legacy asset | Show the existing Edit Placement recovery prompt |
| One finish generation failed | Keep previous panel image and show retry on that finish |

An asset map is not considered corrupt merely because fewer than 24 binary records exist.

### 6.4 Accessibility

1. Every finish remains a semantic button.
2. Pending finish buttons expose `aria-busy="true"`.
3. The panel fieldset exposes a polite live region when rendering starts, succeeds, or fails.
4. Focus remains on the selected finish button after generation completes.
5. Progress is communicated through text and status, not color alone.
6. Retry uses the same finish button or an adjacent semantic button with an explicit accessible name.
7. Reduced-motion mode removes spinner rotation only if the existing shared spinner convention already provides a static progress alternative.

---

## 7. Persistence and Lifecycle Rules

### 7.1 `sessionStorage` Payload

`writeStoredVisualizationSession()` must serialize a metadata-only representation directly. It must not attempt a known-oversized primary payload before falling back.

The stored overlay representation may include:

- Overlay identity and ordering
- Product and template identity
- Configuration and pricing metadata
- Transform, source dimensions, and visible bounds
- Render recipe
- `VariationAssetRef` records
- Small remote or relative URLs already owned by the application

It must exclude:

- `blob:` object URLs
- Variation base64 data URLs
- Flattened base64 data URLs larger than the existing small-payload threshold
- Decoded alpha masks
- Canvas, ImageBitmap, ImageData, Three.js, or DOM objects
- Runtime queue and progress state

### 7.2 Atomic Metadata Publication

An asset reference must be added to React state and `sessionStorage` only after its blob transaction completes successfully. This prevents metadata from pointing to a missing record after interruption or quota failure.

Write order:

1. Encode canvas to blob.
2. Write blob record to IndexedDB.
3. Read or validate the resulting `VariationAssetRef`.
4. Publish the reference into overlay state.
5. Persist metadata-only session JSON.

### 7.3 Object URL Ownership

Create a small runtime registry keyed by cache key.

1. Reuse one object URL for repeated reads of the same cache key.
2. Reference-count URLs used by Panel A, Panel B, thumbnails if reintroduced, and quotation composition.
3. Revoke a URL when its count reaches zero.
4. Revoke every remaining URL when the provider unmounts or the session resets.
5. Never persist an object URL because it is invalid after document teardown.

### 7.4 Legacy Session Migration

The first compatible read of a legacy session may contain `variationImageDataUrls`.

Migration behavior:

1. Keep legacy images usable for the current hydration.
2. Convert only currently visible legacy data URLs to blobs immediately.
3. Schedule other legacy entries at idle priority.
4. Publish `variationAssetRefs` only after successful blob writes.
5. Remove migrated base64 variation maps from the next session write.
6. If migration fails, retain current-runtime display and allow recipe-based regeneration.
7. Do not require a one-time blocking migration of all legacy images.

---

## 8. File-Level Implementation Scope

| Target File | Planned Responsibility |
|---|---|
| `src/lib/visualization/types.ts` | Add asset reference, render recipe, asset-session, and runtime status contracts |
| `src/lib/visualization/variationAssetStore.ts` | Add native IndexedDB blob persistence, cleanup, quota handling, and in-memory fallback |
| `src/lib/visualization/variationRenderQueue.ts` | Add deduplicated single-concurrency priority scheduling and cancellation |
| `src/lib/visualization/variationAssetRegistry.ts` | Add object URL ownership, reuse, and revocation |
| `src/lib/visualization/modelRenderer.ts` | Reuse loaded geometry and update presentation materials without repeated model loads |
| `src/lib/visualization/captureSnapshot.ts` | Add blob-first transparent layer capture while preserving current visual composition |
| `src/lib/visualization/visualizationSession.tsx` | Persist metadata only, own asset-session lifecycle, hydrate refs, migrate legacy payloads, and clean up assets |
| `src/lib/visualization/multiProductPresentation.ts` | Replace all-24-image completeness with recipe and requested-asset readiness helpers |
| `src/features/visualization/components/ProductModelWorkspace.tsx` | Create render recipes, prepare only visible finishes, and enqueue background work without blocking navigation |
| `src/features/comparison/components/Comparison.tsx` | Resolve assets on demand, show per-finish progress, remove miniature scenes, and compose only selected quotation output |
| `src/features/quotation/components/VisualizationComparison.tsx` | Read the committed snapshot or selected asset references without requiring 24 snapshots |
| `tests/unit/variationAssetStore.test.ts` | Verify binary persistence, cleanup, quota fallback, and atomic reference publication |
| `tests/unit/variationRenderQueue.test.ts` | Verify priority, deduplication, promotion, cancellation, and one-job concurrency |
| `tests/unit/multiProductVisualization.test.ts` | Verify partial asset maps are valid and selected assets resolve by stable overlay ID |
| `tests/unit/visualizationSession.test.ts` | Verify metadata-only persistence, namespace lifecycle, migration, and reset cleanup |
| `tests/unit/ms12ConfigPropagation.test.ts` | Preserve all 24 metadata entries without requiring 24 embedded images |
| `docs/qad-glassfit.md` | Add `QAD-TC28` during implementation |
| `docs/implementation/ms12.md` | Mark the eager snapshot policy as superseded by fix10 during implementation |

### 8.1 Explicitly Out of Scope

| System Component | Rationale |
|---|---|
| `fastapi-service/` | Finish rendering remains client-side and does not require CV service changes |
| `supabase/migrations/` | Session-scoped browser cache requires no relational schema change |
| Cloudflare R2 variation uploads | Temporary finish layers are private session artifacts and must not become permanent remote objects |
| New third-party storage or queue libraries | IndexedDB, Blob, object URL, SubtleCrypto, and idle scheduling are browser-native |
| Continuous WebXR or camera tracking | Prohibited by BAN-AR-08 and unrelated to comparison assets |
| Pricing formula changes | Finish asset storage and rendering do not change BOM or price calculations |
| Reducing the catalog below 24 finishes | All 24 finishes remain mandatory and selectable |

---

## 9. Implementation Sequence

1. Add failing unit tests for metadata-only session serialization and partial finish readiness.
2. Add the asset and recipe types without changing current runtime behavior.
3. Implement IndexedDB persistence and its bounded in-memory fallback.
4. Implement the object URL registry and lifecycle tests.
5. Add blob-first capture helpers and visual-equivalence tests.
6. Add stable render fingerprint generation.
7. Refactor `ProductModelRenderer` to update presentation on one loaded model.
8. Implement the single-concurrency priority queue.
9. Add render recipe creation to the workspace overlay flow.
10. Change initial comparison preparation to generate only visible Panel A and Panel B assets.
11. Change session persistence to metadata-only writes and remove oversized-first serialization.
12. Add legacy base64 migration.
13. Replace comparison completeness gating with requested-asset readiness.
14. Remove miniature `ProductVariantScene` instances from selector cards.
15. Add localized pending, success, failure, and retry states.
16. Change quotation transition to compose only committed output.
17. Add cleanup for overlay removal, new image, explicit reset, stale sessions, and unmount.
18. Add `QAD-TC28` and revise the superseded MS12 sections.
19. Run automated verification and browser performance profiling.
20. Complete manual mobile, desktop, refresh, storage-pressure, and multi-product QA.

---

## 10. Verification Plan

### 10.1 Automated Static and Regression Checks

```powershell
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Touched-file lint must contain zero errors. Existing unrelated repository-wide lint failures must be recorded separately rather than hidden.

### 10.2 Required Unit Cases

1. The catalog still returns exactly 24 finishes in R.R.D. order.
2. A comparison overlay with a valid recipe and two ready assets is valid even when 22 finishes are uncached.
3. Session serialization contains no variation data URLs or object URLs.
4. Binary records round-trip through IndexedDB without changing bytes or MIME type.
5. An asset reference is not published when its blob transaction fails.
6. Queue concurrency never exceeds one.
7. A user job runs before visible and idle jobs.
8. Requesting an idle key promotes the existing job rather than duplicating it.
9. A changed fingerprint invalidates stale queued and cached output.
10. Reset removes the active namespace and revokes its object URLs.
11. Overlay deletion removes only that overlay's assets.
12. New image preparation replaces the namespace without deleting the newly created session.
13. Cache-budget eviction protects currently displayed assets.
14. IndexedDB failure activates the bounded memory fallback without writing base64 to session storage.
15. Legacy complete data URL maps remain displayable and migrate incrementally.
16. Legacy incomplete maps regenerate from a valid render recipe.
17. Fixed and parametric renderers preserve finish color, glass appearance, glass color, and thickness across presentation updates.
18. Quotation composition requests only committed finish assets.
19. Panel selection commits only after the requested image decodes successfully.
20. A failed finish request retains the prior ready selection.

### 10.3 Reserved QAD Catalog Entry

The implementation must add the following acceptance intent as `QAD-TC28`:

| Test ID | Traceability | Test Objective | Preconditions | Core Steps | Expected Result | Priority |
|---|---|---|---|---|---|---|
| QAD-TC28 | PRD-F6, PRD-F9, PRD-F15, PRD-F16 | Bounded 24-finish comparison rendering and persistence | One or more configured overlays with render recipes | Open comparison, select uncached finishes rapidly, refresh, enter storage-pressure mode, and proceed to quotation | All 24 choices remain available; requested work is prioritized; panels never blank; metadata restores; storage stays bounded; only committed output is composed | P0 |

### 10.4 Manual End-to-End Scenarios

1. **Single-product first open:** Continue from workspace with one product. Comparison becomes interactive after the two visible panel finishes are ready. The other 22 choices remain visible.
2. **Uncached finish:** Select a finish not yet cached. The previous image remains visible, the selected card reports rendering, and the new image replaces it after decode.
3. **Rapid selection:** Select three uncached finishes in quick succession. The final explicit choice wins, duplicate jobs do not run, and no stale result replaces the final choice.
4. **Multi-product session:** Place five products and select different Panel A and Panel B finishes for each. Only the edited overlay changes; all prior selections remain stable.
5. **Refresh restoration:** Refresh after several finishes have been generated. Ready blobs restore from IndexedDB and session metadata without an incomplete-variation prompt.
6. **IndexedDB blocked:** Disable IndexedDB. The current navigation remains functional through memory fallback, and refresh offers deterministic regeneration rather than a blank scene.
7. **Storage pressure:** Simulate insufficient storage. Idle prewarming stops, visible assets remain protected, and finish selection can regenerate after eviction.
8. **Session reset:** Reset visualization and confirm the session namespace, blobs, and object URLs are released.
9. **New room image:** Start another image session and confirm old assets are not used for the new session.
10. **Quotation:** Select final finishes and proceed. Only the committed final scene is composed; navigation does not render the remaining catalog finishes.
11. **Selector density:** Inspect Panel A and Panel B. Both show 24 accessible swatch cards without miniature room-scene image trees.
12. **Slider stability:** Request a new finish in slider mode. Both sides retain valid images, the divider remains draggable, and the replacement occurs without flicker.

### 10.5 Performance Acceptance

Measure with a production build on the same reference device before and after implementation.

| Metric | Required Target |
|---|---|
| Initial comparison blocking work | Only assets required by visible Panel A and Panel B |
| Concurrent variation render jobs | Exactly 1 maximum |
| Miniature full-scene selector previews | 0 |
| Variation image data in `sessionStorage` | 0 bytes |
| Metadata-only session payload | Less than 500 KiB for five products |
| Default per-session binary cache target | At most 64 MiB and at most 20 percent of available quota |
| Main-thread task during idle prewarming | No task longer than 50ms after each explicit yield boundary, excluding browser WebGL driver work documented separately |
| Finish request feedback | Visible within 100ms |
| Cached finish display | Begins within 200ms of selection on the reference device |
| Object URL leaks after reset | 0 retained session-owned URLs |

The implementation report must record actual timings, blob sizes, session JSON size, browser version, device, product count, canvas size, and finish count. Claims without measurements are not sufficient for completion.

---

## 11. Failure Handling

| Failure | Required Behavior |
|---|---|
| Blob encoding returns `null` | Mark the requested finish retryable; retain the prior panel image |
| IndexedDB open is blocked | Use bounded in-memory storage for the current runtime |
| IndexedDB write exceeds quota | Stop idle prewarming, evict eligible idle assets, retry once, then use memory fallback |
| Cached record is missing | Remove the stale reference and regenerate from the recipe |
| Cached blob cannot decode | Delete the corrupt record, revoke its URL, and regenerate once |
| Render recipe is stale | Reject it by fingerprint and require regeneration from current overlay state |
| Model load fails | Show localized retry; do not erase the current ready finish |
| User leaves during render | Abort or ignore the result and dispose renderer resources |
| Session resets during render | Cancel the namespace queue and prevent late asset publication |
| Browser lacks `requestIdleCallback` | Use a bounded `setTimeout` fallback between jobs |
| Browser lacks transparent WebP support | Encode transparent PNG blobs |

No failure path may silently replace a requested finish with another finish while labeling it as the requested value.

---

## 12. Risk Assessment and Mitigation

| Risk | Severity | Likelihood | Mandatory Mitigation |
|---|---|---|---|
| IndexedDB adds asynchronous hydration complexity | High | Medium | Centralize access in one typed store and publish refs only after successful transactions |
| Object URLs leak memory | High | Medium | Use a reference-counted registry and revoke on replacement, reset, and provider teardown |
| Reapplying presentation mutates material classification | High | Medium | Preserve immutable semantic material roles from the first model load and test repeated updates |
| Idle rendering competes with user interaction | High | Medium | Single concurrency, explicit yields, page-visibility pause, and priority promotion |
| Cached output becomes stale after configuration edits | High | Medium | Include every pixel-affecting input and a schema version in the fingerprint |
| Browser storage eviction removes assets between visits | Medium | Medium | Treat cache as reconstructable, verify records on read, and regenerate from recipes |
| In-memory fallback is lost on refresh | Medium | High when IndexedDB is blocked | Persist the render recipe and show deterministic regeneration after refresh |
| Transparent WebP differs visually from PNG | Medium | Low | Add pixel-difference verification and use PNG when quality or alpha integrity fails |
| Render recipes increase metadata size | Medium | Medium | Store one recipe per overlay, avoid duplicated definitions where safe, and enforce the 500 KiB session target |
| Legacy sessions contain oversized data URLs | Medium | Medium | Migrate visible assets first, rewrite metadata without base64, and avoid blocking all-finish conversion |
| Removing miniature previews reduces visual context | Low | Medium | Retain accurate catalog swatches and show the selected result at full size in the main panel |
| Cache cleanup deletes another active tab's assets | High | Low | Namespace per visualization session and delete only confirmed stale or explicitly reset namespaces |

---

## 13. Definition of Done

- [ ] All 24 R.R.D. finishes remain visible and selectable in Panel A and Panel B.
- [ ] Initial comparison readiness depends only on currently visible panel assets.
- [ ] Variation layer bytes are stored as blobs outside `sessionStorage`.
- [ ] `sessionStorage` contains metadata and typed asset references only.
- [ ] A single loaded model can render repeated finish changes without repeated GLB loads.
- [ ] Variation rendering uses one prioritized job at a time.
- [ ] User-requested finishes preempt idle prewarming.
- [ ] Pending selections retain the previous ready panel image.
- [ ] Failed selections provide a localized retry without corrupting selection state.
- [ ] Selector cards no longer mount miniature full-scene previews.
- [ ] Partial asset availability is treated as valid expected state.
- [ ] Legacy base64 sessions migrate incrementally.
- [ ] IndexedDB failure has a bounded memory fallback.
- [ ] New-image, overlay-delete, reset, expiry, and unmount cleanup are implemented.
- [ ] Quotation composition renders only committed output.
- [ ] `QAD-TC28` is added to the authoritative QAD catalog.
- [ ] MS12 eager snapshot requirements are marked as superseded.
- [ ] Touched-file lint, typecheck, unit tests, and production build pass.
- [ ] Manual accessibility, refresh, storage-pressure, mobile, desktop, and multi-product scenarios pass.
- [ ] Performance evidence demonstrates bounded session size and improved first-interactive time.

---

## Self-Check and Quality Checklist

- [x] The limitation is traced to eager 24-finish rendering, base64 amplification, duplicated session collections, and selector preview multiplication.
- [x] The plan preserves the user-approved requirement to expose all 24 finishes.
- [x] The plan addresses both rendering time and session-storage size.
- [x] The plan uses browser-native APIs and introduces no dependency.
- [x] The plan preserves fixed and parametric renderer parity.
- [x] The plan preserves stable per-overlay, per-panel selection state.
- [x] The plan defines deterministic persistence, migration, cleanup, failure, and retry behavior.
- [x] The plan maps to PRD-F6, PRD-F9, PRD-F15, PRD-F16, SDD-C4, SDD-C5, SDD-C6, DSD-UI9, QAD-TC28, QAD-VG3, and QAD-VG5.
- [x] No TypeScript `any`, raw database mutation, new dependency, backend variation upload, or foreign UI style is proposed.
- [x] No em dash characters are present.
- [x] Implementation has not started; every Definition of Done item remains unchecked.
