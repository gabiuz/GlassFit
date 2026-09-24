# Implementation Plan: MS-02 Drag Selection Refactor

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Implementation Planning Specification for Drag-Based Initial Perspective Selection  
**Version:** 1.0.0  
**Date:** September 24, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Proposed (Planning Only)  
**Upstream Specifications:** `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/qad-glassfit.md`, `docs/implementation/ms02.md`, `docs/implementation/fix-ms02.md`, `docs/implementation/fix-ms04.md`, `docs/implementation/fix-05.md`, `docs/implementation/ms07.md`

---

## 1. Objective

Refactor only the initial point-creation interaction in `PerspectivePlanePicker`. A user with no existing fitted corners will press and drag over the room photo, see a live freeform rectangular selection, and release to create four ordered corner handles. The user will then refine those handles independently and confirm the resulting quadrilateral through the existing workflow.

The rectangle is an input convenience, not a new perspective model. After a successful pointer release, the picker and every downstream system must continue to use `QuadrilateralCorners` in this order:

1. Top-left
2. Top-right
3. Bottom-right
4. Bottom-left

The following contracts are explicitly unchanged:

- `Point2D` and `QuadrilateralCorners`
- `ProductConfigurationSnapshot.perspectiveFitCorners`
- normalized corner persistence
- `normalizeCorners` and `denormalizeCorners`
- quadrilateral validation
- homography calculation and CSS `matrix3d()` generation
- live perspective rendering
- dimension and initial yaw/pitch estimation on confirmation
- snapshot and variation-layer perspective compositing
- automatic and manual occlusion ordering
- Apply Changes, placed overlay editing, Edit Corners, Free Placement, and workspace resizing
- backend services and database schema

This plan is the only artifact created for this task. No implementation is included.

## 2. Current Implementation

### 2.1 Governing specifications

The feature traces to PRD-F6 and PRD-F18 through SDD-C5 and SDD-C6. The implemented behavior is primarily documented by:

- `docs/implementation/ms02.md`: original four-point picker, normalized storage, homography rendering, persistence, and snapshot design
- `docs/implementation/fix-ms02.md`: post-implementation rendering and configurability corrections
- `docs/implementation/fix-ms04.md`: perspective-mode transform controls and yaw/pitch estimation
- `docs/implementation/fix-05.md`: corner-handle pickup offset and pointer drag stability
- `docs/implementation/ms07.md`: reuse of the same picker for door openings through `openingType`

The active code is newer than some examples in those documents. This plan follows the repository implementation where the two differ.

### 2.2 Picker flow

`src/features/visualization/components/PerspectivePlanePicker.tsx` currently owns temporary picker state in source-image pixel space.

| Concern | Current implementation |
|---|---|
| Initial state | `points` is initialized by denormalizing `initialCorners` when four existing normalized corners are supplied; otherwise it starts as an empty array. |
| New point creation | `handleSvgClick` appends one point per click until four points exist. The expected semantic order is communicated through `CORNER_NAMES`. |
| Coordinate conversion | `getCanvasCoordinates` maps client coordinates through the SVG bounding rectangle into the `canvasWidth` by `canvasHeight` coordinate system and clamps both axes to the image bounds. |
| Preview | Two or three points render as a dashed polyline. Four points render as a filled polygon. |
| Refinement | Once four points exist, each numbered SVG handle becomes draggable. `activeDragIndex` selects the corner, `dragOffsetRef` preserves the pickup offset, and pointer coordinates are clamped to the image bounds. |
| Pointer termination | `pointerup` and `pointercancel` clear the active handle drag and attempt to release pointer capture. |
| Validation | Four points are cast to `QuadrilateralCorners` and passed to `isValidQuadrilateral`. Invalid, concave, crossed, or degenerate quadrilaterals disable confirmation. |
| Confirmation | `handleConfirm` normalizes the pixel-space quadrilateral with `normalizeCorners` and calls `onConfirm`. |
| Reset Points | `handleReset` clears local points, the handle drag offset, and the active drag index. It does not mutate workspace state until confirmation. |
| Cancel | The close button, Cancel button, and Escape key call `onCancel`. Since picker state is local, cancel discards unconfirmed changes and preserves the parent workspace configuration. |
| Existing corners | An invocation with `initialCorners` immediately has four points, renders the polygon and handles, and enables refinement without re-entry. |

The picker uses the room image's source dimensions for its SVG `viewBox`. The visible picker is responsive, but all temporary corner values remain in stable source-image pixel coordinates until confirmation.

### 2.3 Workspace integration

`src/features/visualization/components/ProductModelWorkspace.tsx` owns the confirmed normalized `perspectiveCorners` state. The state is initialized from `initialConfiguration?.perspectiveFitCorners`.

The picker is mounted only while `showPerspectivePicker` is true. Its props are:

- the room image URL
- the source image width and height
- the current normalized `perspectiveCorners` as `initialCorners`
- an `openingType` derived from the active window or door product
- confirmation and cancellation callbacks

On confirmation, the workspace currently:

1. Denormalizes the confirmed corners for the displayed workspace size.
2. Denormalizes them for the source photo size.
3. Estimates width and height from the quadrilateral, depth data, and scale signals.
4. Estimates initial yaw and pitch from opposite-edge foreshortening.
5. Stores the normalized corners in `perspectiveCorners`.
6. Resets free-placement rotation, rebuilds the model revision, and closes the picker.

The refactor must preserve this callback and its payload exactly.

### 2.4 Live product rendering and controls

When `perspectiveCorners` exists, the active product is rendered with `homographyToCssMatrix3d(denormalizeCorners(...))`. The configured product remains editable through:

- four corner scaling controls
- four edge width or height controls
- one center movement control
- Edit Corners
- Free Place
- Flip
- the workspace-level Reset and Remove actions

The workspace-level perspective controls manipulate normalized corners directly. They are separate from the four independent corner handles inside `PerspectivePlanePicker`.

### 2.5 Configuration and edit flow

`currentConfiguration` includes `perspectiveFitCorners: perspectiveCorners`. The configuration is propagated through `onConfigurationChange` to `ProductAwareWorkspacePage` and the visualization session.

Within the inspected active flow:

- the current configuration is retained in the visualization context and serialized to session storage;
- placing an overlay copies the configuration into `PlacedOverlay.configuration`;
- editing a placed overlay calls `applyProductConfiguration`, which restores `configuration.perspectiveFitCorners` into workspace state;
- Edit Corners reopens the picker with those normalized values as `initialCorners`;
- session serialization preserves `perspectiveFitCorners` because storage sanitization removes only oversized image artifacts and the manual raster mask;
- variation render fingerprints include `perspectiveFitCorners`, so a corner change invalidates the correct cached render.

No migration or persisted payload change is required. Existing saved configurations already have the desired four-corner shape.

### 2.6 Perspective transform and snapshot paths

`src/lib/visualization/perspectiveTransform.ts` already provides the required stable math contract:

- `normalizeCorners`
- `denormalizeCorners`
- `isValidQuadrilateral`
- `computeHomographyMatrix`
- `homographyToCssMatrix3d`
- `drawPerspectiveWarpedImage`
- `estimateDimensionsFromCorners`
- `scaleCornersAlongAxis`

The active snapshot path in `ProductModelWorkspace.tsx` passes normalized `perspectiveCorners` into `captureWorkspaceSnapshot`. `drawSnapshotOverlay` denormalizes them to the output canvas and calls `drawPerspectiveWarpedImage`. The warper uses WebGL projective mapping when available and a subdivided Canvas 2D fallback otherwise.

Placed overlay and product-variation rendering also preserve the same configuration. `VariationLayerRenderer` denormalizes `configuration.perspectiveFitCorners` and uses `drawPerspectiveWarpedImage`. Foreground occlusion is composited after the product layer, so the interaction refactor does not change occlusion behavior.

### 2.7 Existing test coverage

The repository uses Node's test runner through `tsx`; it does not currently include a DOM component-testing library.

`tests/unit/perspectiveTransform.test.ts` covers:

- homography identity and target projection
- degenerate homography rejection
- CSS `matrix3d()` generation
- convex, crossed, concave, and collinear quadrilateral validation
- normalization and denormalization round trips
- dimension estimation
- perspective-axis scaling
- perspective handle coordinate derivation
- yaw and pitch estimation
- window and door quadrilateral math

Related suites cover configuration transitions, session serialization, multi-product behavior, measurement configuration propagation, manual occlusion integration, and layer ordering. There is no automated component-level pointer test for `PerspectivePlanePicker`, and there is no browser test runner configured in `package.json`.

## 3. Current Data Flow

| Stage | Producer | Data | Consumer | Behavior to preserve |
|---|---|---|---|---|
| 1. Picker entry | Workspace toolbar or Edit Corners | `initialCorners?: QuadrilateralCorners` in normalized coordinates | `PerspectivePlanePicker` | New fit starts empty; edit starts with four restored handles. |
| 2. Picker editing | Picker local state | `Point2D[]` in source-image pixel coordinates | SVG preview and validation | Only the initial creation gesture changes. |
| 3. Confirm | `normalizeCorners` | ordered normalized `QuadrilateralCorners` | picker `onConfirm` | Payload shape and order remain identical. |
| 4. Workspace fit | confirmation callback | normalized corners | dimensions, yaw/pitch, `perspectiveCorners` | Existing estimation remains unchanged. |
| 5. Live rendering | `perspectiveCorners` | denormalized display-space corners | `homographyToCssMatrix3d` | Product continues to fill the fitted quadrilateral. |
| 6. Current configuration | workspace memo | `perspectiveFitCorners` | visualization session and callbacks | Existing compatibility remains intact. |
| 7. Apply or place | workspace snapshot and placed overlay creation | configuration plus flattened product layer | session, comparison, quotation flow | Existing Apply Changes behavior remains intact. |
| 8. Restore or edit | stored or placed configuration | `configuration.perspectiveFitCorners` | `applyProductConfiguration`, then picker `initialCorners` | Existing corners bypass initial selection. |
| 9. Snapshot | capture pipeline | normalized corners | `drawSnapshotOverlay` and `drawPerspectiveWarpedImage` | Output pixels and occlusion order remain unchanged. |

## 4. Proposed Interaction

### 4.1 Awaiting selection

This state exists when there are no committed picker points and no active selection draft.

- Show: `Click and drag over the window opening.` with the noun adjusted through the existing `openingType` logic for doors.
- Use a crosshair cursor over the SVG.
- Accept only a primary pointer gesture.
- Do not create any corner on a click.

### 4.2 Pointer down

On a valid `pointerdown` on the SVG background:

1. Prevent the browser's default drag or gesture behavior.
2. Convert the pointer into source-image pixel coordinates with the existing `getCanvasCoordinates` function.
3. Record both the canvas-space start point and the client-space start position.
4. Record the active pointer identifier.
5. Capture that pointer on the SVG root.
6. Initialize a live selection draft whose start and current point are equal.

Pointer capture is appropriate because the selection owns the gesture from press through release. Capturing on the SVG root keeps updates stable when the pointer leaves the image or when a touch contact moves quickly.

### 4.3 Pointer move

While the captured selection pointer moves:

1. Convert the current client position with `getCanvasCoordinates`.
2. Clamp the point to the source-image bounds through the existing conversion function.
3. Update the selection draft.
4. Derive `left`, `right`, `top`, and `bottom` with `Math.min` and `Math.max`.
5. Render one SVG `<rect>` with the established teal stroke and translucent fill.

Suggested helper text: `Drag to roughly select the window area.` The rectangle remains freeform and has no aspect-ratio constraint.

### 4.4 Pointer release

On `pointerup` for the active selection pointer:

1. Obtain the final clamped canvas coordinate.
2. Compare client-space horizontal and vertical movement against an 8 CSS pixel minimum on each axis.
3. If either dimension is below the threshold, discard the draft, release capture, and return to awaiting selection without creating corners.
4. Otherwise normalize the drag direction into bounds.
5. Create a `QuadrilateralCorners` tuple in this exact order: top-left, top-right, bottom-right, bottom-left.
6. Store those four pixel-space corners in the existing `points` state.
7. Clear the transient selection session and release pointer capture.

Using CSS client pixels for the threshold makes the click protection consistent across source image resolutions and responsive display sizes. Requiring 8 pixels on both axes prevents zero-height or zero-width planes without imposing a large arbitrary opening size.

### 4.5 Refinement and confirmation

As soon as four points are created:

- render the existing filled quadrilateral;
- render the existing four independently draggable numbered handles;
- keep the current pickup-offset behavior;
- keep `isValidQuadrilateral` validation;
- show: `Adjust the corners to match the window perspective.`;
- keep Confirm disabled for an invalid quadrilateral;
- normalize only when Confirm Fit is selected.

A rectangular starting shape can therefore become a trapezoid or another valid convex quadrilateral before confirmation.

### 4.6 Cancellation

- `pointercancel` during initial selection clears the draft and returns to awaiting selection. It must not create corners.
- `pointercancel` during handle refinement ends the active handle drag using the current point, matching existing behavior.
- Cancel, Close, and Escape continue to close the modal without committing local picker changes.

## 5. Proposed State Model

Do not add a three-value enum. The logical interaction mode can be derived from existing committed points plus one transient selection draft:

| Derived state | Condition | Meaning |
|---|---|---|
| Awaiting Selection | `points.length === 0` and no draft | Ready for the first press. |
| Selecting | `points.length === 0` and a draft exists | Render the live rectangle and track the captured pointer. |
| Refining | `points.length === 4` | Render the existing polygon and corner handles. |

Proposed state and references:

- Keep `points` as the committed pixel-space points. It remains the single input to validation and confirmation.
- Keep `activeDragIndex` for existing corner refinement.
- Keep `dragOffsetRef` for the existing no-jump handle behavior.
- Add a small `selectionDraft` state with `start` and `current` canvas points for rendering.
- Add an active selection session ref containing the pointer ID and client-space start coordinates. This avoids rerenders for pointer identity and keeps the threshold independent of source-image scaling.

The selection session and corner drag must be mutually exclusive. Selection handlers run only while no committed corners exist. Handle handlers run only after four committed corners exist.

Reset must clear:

- `points`
- `selectionDraft`
- the active selection session ref
- `activeDragIndex`
- `dragOffsetRef`
- any pointer capture still held by the SVG, when safely releasable

This extends the existing `handleReset` rather than introducing a separate reset pathway.

## 6. Coordinate Handling

### 6.1 Coordinate spaces

Three coordinate spaces remain distinct:

| Space | Use |
|---|---|
| Client CSS pixels | Pointer movement threshold and pointer event positions. |
| Picker source-image pixels | Live rectangle, generated corners, handle dragging, polygon validation. |
| Normalized 0 to 1 coordinates | Confirmation payload, workspace state, session persistence, placed overlay configuration. |

`getCanvasCoordinates` remains the only client-to-picker conversion. It uses the current responsive SVG bounds, scales into the source image dimensions, and clamps to the image.

### 6.2 Direction-independent bounds

For any canvas-space start and current points:

- `left = min(start.x, current.x)`
- `right = max(start.x, current.x)`
- `top = min(start.y, current.y)`
- `bottom = max(start.y, current.y)`

The resulting tuple is always:

1. `{ x: left, y: top }`
2. `{ x: right, y: top }`
3. `{ x: right, y: bottom }`
4. `{ x: left, y: bottom }`

This produces identical ordering for all four drag directions.

### 6.3 Normalization timing

Do not normalize during the initial drag. Keep the generated corners in the same pixel space used by current handle refinement. Continue to call `normalizeCorners` only from `handleConfirm`. This preserves cancel semantics, validation behavior, responsive restoration, and the existing workspace callback.

## 7. Existing Configuration Compatibility

If `initialCorners` contains four normalized corners, the picker will continue to denormalize them during initialization. Because `points.length` will immediately be four:

- no drag selection starts;
- the existing polygon and four handles render immediately;
- the helper text starts in refining mode;
- the user can adjust or confirm without redrawing;
- Reset Points clears the local four points and enters awaiting selection so a replacement rectangle can be drawn;
- Cancel after a local reset still preserves the original parent configuration because only Confirm commits changes.

No version discriminator, migration, fallback conversion, or compatibility branch is needed. Existing corner arrays already match the post-release representation produced by the new gesture.

## 8. Files to Modify

### 8.1 Required changes

| Path | Why | Proposed change |
|---|---|---|
| `src/features/visualization/components/PerspectivePlanePicker.tsx` | Owns initial point creation and refinement. | Replace click-to-add behavior with the initial pointer drag session, live SVG rectangle, threshold rejection, mode-specific copy, and expanded Reset Points cleanup. Preserve the existing props and confirmation payload. |
| `src/lib/visualization/perspectiveSelection.ts` | Keeps rectangle-bound normalization and corner ordering pure and directly testable without adding a DOM test dependency. | Add a small typed helper that converts two `Point2D` values into ordered `QuadrilateralCorners`. If implementation review finds the inline logic clearer, omit this file and test an exported pure helper instead. Do not place this interaction helper in `perspectiveTransform.ts`. |
| `tests/unit/perspectiveSelection.test.ts` | Adds behavior-focused coverage for the new geometry contract. | Test all four drag directions, exact ordering, freeform proportions, and boundary values. Keep pointer lifecycle scenarios in the manual/browser matrix because the repository has no DOM test harness. |
| `package.json` | The current `npm test` command enumerates test files explicitly. | Add the new test file to the existing test command. Do not add a dependency or change the test framework. |
| `docs/implementation/ms02.md` | Its interaction sections currently specify four sequential clicks. | Update only the problem approach, picker interaction, reset, risk, and acceptance wording that describes initial point creation. Preserve all four-point math, normalization, persistence, rendering, and snapshot sections. |

### 8.2 Possible changes, only if implementation proves necessary

| Path | Condition | Constraint |
|---|---|---|
| `docs/implementation/ms07.md` | Only if maintainers treat implemented milestone documents as current interaction guides and want the door-specific click copy reconciled. | Change only the shared picker interaction wording. Do not change door rendering or persistence behavior. |
| Existing browser or end-to-end test location | Only if a browser runner already exists outside the inspected package configuration when implementation begins. | Add component pointer scenarios there without introducing a new library. |

### 8.3 Inspected but intentionally unchanged

| Path | Reason it remains unchanged |
|---|---|
| `src/features/visualization/components/ProductModelWorkspace.tsx` | Its picker contract, confirm logic, rendering, controls, Apply Changes flow, Edit Corners flow, Free Placement behavior, and snapshot inputs already consume the desired ordered normalized corners. |
| `src/lib/visualization/perspectiveTransform.ts` | Homography, validation, normalization, denormalization, CSS transform, scaling, and snapshot warping are correct and independent of how the initial corners are created. |
| `src/lib/visualization/types.ts` | `Point2D`, `QuadrilateralCorners`, `PerspectiveOpeningType`, and `perspectiveFitCorners` already express the required contract. |
| `src/lib/visualization/variationLayerRenderer.ts` | It already consumes saved corners for perspective output. |
| `src/lib/visualization/visualizationSession.tsx` | It already serializes configuration corner data without conversion. |
| `src/lib/visualization/multiProductPresentation.ts` | Duplicate and placed-overlay behavior is intentionally unchanged. |
| `src/features/visualization/components/ManualOcclusionPointPicker.tsx` | It supplies a pointer-capture convention for reference but has a different polygon-creation workflow. |
| `fastapi-service/` | The interaction is entirely client-side. |
| `supabase/migrations/` | No schema or stored shape changes. |

## 9. Detailed Implementation Steps

1. Add a typed, dependency-free rectangle-to-corners helper in `perspectiveSelection.ts` that accepts two canvas-space points and returns `[topLeft, topRight, bottomRight, bottomLeft]` using normalized bounds.
2. Add `MIN_SELECTION_SIZE_CSS_PX = 8` inside the picker. Keep the threshold presentation-specific and out of the perspective math module.
3. Remove `handleSvgClick` and the sequential click-placement path. Retain `CORNER_NAMES` for handle labels and accessibility text.
4. Add the transient selection draft state and active pointer session ref described in Section 5.
5. Add a root SVG `pointerdown` handler that starts selection only when there are no committed points, no active handle drag, and the event is the primary pointer.
6. Capture the selection pointer on the SVG root. Preserve `touchAction: "none"` so touch dragging does not scroll the page.
7. Extend the root SVG `pointermove` handler to branch between initial selection updates and existing corner-handle movement. Ignore unrelated pointer IDs.
8. Split pointer completion into explicit `pointerup` and `pointercancel` semantics. `pointerup` may commit a valid-size rectangle; `pointercancel` only clears transient selection state.
9. Measure the minimum selection in client CSS pixels. Reject if either width or height is under 8 pixels, clear the draft, and remain in awaiting selection.
10. For an accepted release, convert the final two canvas points with the pure helper and store the resulting four points in `points`.
11. Render the live draft as a single SVG rectangle below the handles and above the room photo, reusing the current teal stroke and translucent fill.
12. Keep the existing filled polygon, handle markers, drag offset, invalid-state colors, and confirmation logic for refining mode.
13. Replace click-sequence copy with derived awaiting, selecting, invalid-refining, and valid-refining copy. Preserve `openingType` substitution for window and door flows.
14. Extend `handleReset` to release any held selection pointer when possible and clear both temporary selection and committed local points. Keep the label `Reset Points` unless UX review requests a copy-only change.
15. Verify that Cancel, Close, and Escape do not call `onConfirm` and therefore do not mutate workspace corners.
16. Add the focused unit suite and register it in `npm test` without changing dependencies.
17. Update only the interaction-specific portions of `docs/implementation/ms02.md` after the implementation is authorized and complete.
18. Run the targeted test, full test suite, lint, typecheck, and production build.
19. Perform the manual pointer and end-to-end regression matrix in Section 10 on desktop mouse and a touch-sized viewport.

## 10. Testing Plan

### 10.1 Automated tests to add

Add `tests/unit/perspectiveSelection.test.ts` with PRD-F6, SDD-C5, and QAD-TC6 traceability.

| Scenario | Automated assertion |
|---|---|
| Top-left to bottom-right | Helper returns exact TL, TR, BR, BL order. |
| Bottom-right to top-left | Same normalized tuple as the forward drag. |
| Top-right to bottom-left | Same normalized tuple and no crossed edges. |
| Bottom-left to top-right | Same normalized tuple and no crossed edges. |
| Freeform rectangle | Width and height are independent; no 1:1 constraint is applied. |
| Boundary coordinates | Zero and full canvas coordinates remain valid inputs. |
| Generated geometry | Result passes `isValidQuadrilateral` for nonzero bounds. |
| Normalize round trip | Generated corners normalize and denormalize without order or value drift. |

Extend an existing session or multi-product configuration fixture with non-null `perspectiveFitCorners` and assert that serialization and restoration preserve all four values unchanged. This closes a current explicit coverage gap without changing persistence code.

Keep the existing `perspectiveTransform.test.ts` cases unchanged except for any import needed to validate interoperability. They are regression coverage for homography, CSS transforms, validation, and normalized coordinates, not the home for pointer interaction logic.

### 10.2 Component and manual browser behavior matrix

The current repository has no React DOM testing library or configured browser runner. Do not add a dependency solely for this refactor. Validate the following through the existing application in a desktop browser and a responsive touch viewport. If an approved browser harness is present at implementation time, automate these scenarios there.

| # | Scenario | Expected result |
|---|---|---|
| 1 | Drag top-left to bottom-right | A live freeform rectangle appears; release creates ordered handles. |
| 2 | Drag bottom-right to top-left | Bounds normalize and handles appear in semantic corner order. |
| 3 | Drag top-right to bottom-left | Bounds normalize with no bowtie. |
| 4 | Drag bottom-left to top-right | Bounds normalize with no bowtie. |
| 5 | Release after a valid drag | Picker immediately enters refinement mode. |
| 6 | Click without movement | No points are created; awaiting selection remains active. |
| 7 | Drag under 8 CSS pixels on either axis | No quadrilateral is created. |
| 8 | Drag beyond the SVG edge | Pointer capture keeps the gesture stable; coordinates clamp to image bounds. |
| 9 | Trigger `pointercancel` | Draft clears and no stuck selection remains. |
| 10 | Drag each generated handle | Each handle moves independently with no initial jump. |
| 11 | Move one corner into a trapezoid | Polygon updates and remains confirmable when convex. |
| 12 | Move a corner into an invalid shape | Existing invalid warning appears and Confirm is disabled. |
| 13 | Confirm refined corners | `onConfirm` receives normalized corners in TL, TR, BR, BL order. |
| 14 | Reset Points after release | Four points and draft clear; drag selection is available again. |
| 15 | Reset Points after opening existing corners | Existing local handles clear and replacement drag selection starts. |
| 16 | Cancel after reset or refinement | Modal closes and the parent workspace retains its pre-open corners. |
| 17 | Open with `initialCorners` | Drag selection is bypassed and four handles render immediately. |
| 18 | Edit a placed perspective product | Saved corners restore; Edit Corners opens directly in refinement mode. |
| 19 | Apply Changes | Live fit and resulting flattened output use the confirmed corners. |
| 20 | Capture or download snapshot | Perspective warp and occlusion layering match the live fit. |
| 21 | Switch to Free Place | Corners clear through existing workspace behavior and free placement remains interactive. |
| 22 | Resize the workspace | Normalized corners retain their proportional positions. |
| 23 | Use a door product | Shared picker copy uses `door`; behavior and output match the window flow. |
| 24 | Use touch input | One primary pointer controls selection; scrolling and multi-touch do not create extra corners. |

### 10.3 Verification commands

After implementation authorization:

1. `npx tsx --test tests/unit/perspectiveSelection.test.ts`
2. `npm run test`
3. `npm run lint`
4. `npx tsc --noEmit`
5. `npm run build`

The FastAPI health check is not required for this isolated client-only change unless the full workspace smoke test is run against the local CV service. No backend code is affected.

## 11. Edge Cases

| Edge case | Planned handling |
|---|---|
| Reverse-direction dragging | Normalize both axes before generating the ordered tuple. |
| Tiny selection | Require at least 8 client CSS pixels of width and height. Discard smaller drafts. |
| Pointer leaves the SVG | Capture the initiating pointer on the SVG root and clamp converted coordinates. |
| Pointer cancellation | Clear the selection session and live draft without creating corners. |
| Pointer release is missed | Pointer capture plus `pointercancel` cleanup prevents a stuck state. Reset also clears stale state defensively. |
| Secondary mouse button | Ignore non-primary selection starts. |
| Multi-touch | Track one primary pointer ID and ignore other pointers until completion. |
| Workspace or viewport resizing | Convert every event through the current SVG bounds; keep saved data normalized after confirmation. |
| Existing saved corners | Initialize four points and enter refinement immediately. |
| Reset during selection | Clear draft, session ref, capture, and committed points; return to awaiting selection. |
| Reset after selection | Clear four local points and return to awaiting selection. |
| Cancel after local reset | Preserve the already confirmed parent corners because Reset Points is local until confirm. |
| Invalid manual refinement | Preserve current convexity validation, warning styling, and disabled Confirm button. |
| Zero-width or zero-height drag | Rejected by the per-axis minimum threshold. |
| Touch and pen input | Use Pointer Events and `touchAction: "none"`; avoid mouse-only handlers. |
| Opening type | Reuse the current window or door noun selection. |

## 12. Risks and Regression Areas

| Risk | Impact | Mitigation |
|---|---|---|
| A synthetic click after pointer release reintroduces a point | Unexpected extra state | Remove the SVG click-placement handler completely. |
| Selection and handle drag handlers conflict | Stuck or incorrect drag | Branch by committed point count and active pointer session; the modes are mutually exclusive. |
| Threshold is evaluated in source pixels | Different behavior across devices and images | Evaluate in client CSS pixels, then generate corners in canvas pixels. |
| Pointer capture is released from the wrong element | Drag may remain active | Capture and release the initial selection on the SVG root that owns its handlers. Preserve the existing handle-drag path unless a verified defect requires adjustment. |
| Reset unintentionally commits cleared corners | Existing fit could be lost on cancel | Keep Reset Points local and commit only through Confirm. |
| Existing configurations are forced through selection | Edit flow regression | Derive refinement directly from four initialized points. |
| Corner ordering changes | Broken homography or crossed snapshot | Centralize bounds-to-corners ordering in a pure typed helper and test all four directions. |
| Perspective math is edited unnecessarily | Rendering regression | Do not modify `perspectiveTransform.ts`. |
| Snapshot output diverges from live view | QAD-TC9 regression | Keep the confirmation payload and all snapshot functions unchanged; smoke-test both live and exported output. |
| Occlusion order changes | Product paints above foreground objects | Do not touch the product, occlusion, or controls layer structure. |
| Workspace Reset semantics are conflated with picker Reset Points | Broader placement behavior changes | Change only picker Reset Points. Leave the workspace toolbar Reset as the existing full placement reset. |
| Free Placement stops clearing perspective mode | User cannot leave fitted mode | Leave the existing `setPerspectiveCorners(null)` path unchanged and regression-test it. |
| New test is silently skipped | False confidence | Add the test file to the explicit `npm test` file list. |

## 13. Documentation Updates

Update `docs/implementation/ms02.md` only after implementation is authorized. Limit edits to interaction-specific statements:

1. In the problem approach, replace the four sequential click description with approximate rectangle drag followed by four-corner refinement.
2. In Section 4.3, replace Point Placement, preview, instruction, and Reset action details with the three logical states.
3. State that the generated rectangle is immediately converted to `QuadrilateralCorners` in TL, TR, BR, BL order.
4. State that the rectangle is freeform and is not constrained to a square.
5. Document pointer capture, pointer cancellation, and the small-drag threshold.
6. Update the definition of done that currently says four-point click placement.
7. Update the wrong-click-order risk because automatic ordering removes that initial-entry risk. Preserve the risk of an invalid shape after manual handle refinement.
8. Preserve all homography, `matrix3d`, normalization, persistence, workspace integration, snapshot compositing, occlusion, and backend/schema boundary sections.

Do not rewrite the historical fix documents. They remain useful records of previously corrected behavior.

## 14. Definition of Done

Implementation is complete only when all of the following are true:

1. A new fit starts in drag-selection mode, not sequential click mode.
2. A live, unconstrained rectangle follows the pointer in all four drag directions.
3. Valid release creates exactly four pixel-space corners in TL, TR, BR, BL order.
4. A click or a drag smaller than 8 CSS pixels on either axis creates no corners.
5. Pointer capture keeps selection stable outside the SVG, and cancellation leaves no stuck state.
6. Release immediately exposes the existing four independently draggable handles.
7. One corner can be refined into a valid trapezoid without moving the other three.
8. Existing quadrilateral validation and normalized confirmation remain active.
9. Reset Points clears corners and temporary selection and returns to drag selection.
10. Existing `initialCorners` bypass drag selection and open directly in refinement mode.
11. Cancel, Close, and Escape preserve their current non-committing behavior.
12. Existing perspective configurations round-trip through session and placed overlay editing unchanged.
13. Live CSS homography rendering is unchanged.
14. Snapshot and variation rendering are unchanged.
15. Apply Changes, Edit Corners, Free Placement, workspace resizing, and occlusion remain functional.
16. Window and door picker flows both remain functional through `openingType`.
17. No backend, database, type-contract, or dependency change is introduced.
18. Focused tests, full tests, lint, typecheck, and production build pass.
19. The interaction-specific MS-02 documentation is updated without deleting valid four-point math or persistence content.

## 15. Implementation Checklist

- [ ] Add the pure rectangle-to-corners helper.
- [ ] Add initial drag-selection state and pointer session tracking.
- [ ] Remove sequential click placement.
- [ ] Normalize drag bounds in all four directions.
- [ ] Render the live freeform selection rectangle.
- [ ] Convert accepted bounds to ordered `QuadrilateralCorners`.
- [ ] Enforce the 8 CSS pixel per-axis minimum.
- [ ] Capture and release the initial selection pointer on the SVG root.
- [ ] Handle `pointercancel` without committing corners.
- [ ] Preserve existing corner refinement and pickup offset.
- [ ] Preserve convexity validation and normalized confirmation.
- [ ] Preserve `initialCorners` direct-refinement behavior.
- [ ] Update Reset Points to clear committed and temporary picker state.
- [ ] Preserve Cancel, Close, and Escape semantics.
- [ ] Preserve the workspace-level Reset behavior.
- [ ] Preserve Apply Changes, Edit Corners, and Free Placement.
- [ ] Add four-direction and ordering unit tests.
- [ ] Add configuration serialization and restoration regression coverage.
- [ ] Register the new test in `npm test`.
- [ ] Complete the desktop and touch pointer regression matrix.
- [ ] Verify live perspective rendering and snapshot output.
- [ ] Verify automatic and manual occlusion layering.
- [ ] Update only the interaction-specific sections of MS-02.
- [ ] Run `npm run test`.
- [ ] Run `npm run lint`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.

Implementation must not begin until explicitly authorized.

---

## Self-Check

- [x] Document metadata follows the GlassFit implementation specification convention
- [x] Objective and proposed scope trace to PRD-F6, PRD-F18, SDD-C5, SDD-C6, DSD-UI6, QAD-TC6, and QAD-TC9
- [x] Current implementation findings reference the active picker, workspace, transform, persistence, and snapshot paths
- [x] Architectural boundaries exclude backend changes, database migrations, new dependencies, and persisted format changes
- [x] Proposed behavior preserves `Point2D`, `QuadrilateralCorners`, normalized coordinates, homography, CSS transforms, and snapshot warping
- [x] Existing saved configurations, Edit Corners, Apply Changes, Free Placement, workspace resizing, and occlusion behavior are covered
- [x] Detailed implementation steps are specific enough for a later implementation task
- [x] Testing includes all four drag directions, minimum movement, pointer capture, pointer cancellation, reset, restoration, rendering, and snapshot regressions
- [x] Definition of done includes tests, lint, typecheck, build, documentation, and compatibility checks
- [x] No em-dashes, prohibited box diagrams, `any` types, or unapproved dependencies are specified
- [x] This document contains planning only and does not authorize implementation
