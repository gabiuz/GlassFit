# Implementation Specification: Snapshot Product Outline Artifact (fix-ui13)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document Function:** Implementation-ready plan for the reported saved-snapshot visual defect
**Version:** 1.0.0
**Date:** November 2, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Implementation in progress; reported snapshot acceptance pending
**Upstream Specifications:** `docs/brd-glassfit.md` (BRD-M4), `docs/prd-glassfit.md` (PRD-F6, PRD-F7, PRD-F8, PRD-F9), `docs/sdd-glassfit.md` (SDD-C5, SDD-C6), `docs/dsd-glassfit.md` (DSD-UI4), `docs/qad-glassfit.md` (QAD-TC7, QAD-TC8, QAD-TC9)
**Implementation State:** The `fix/product-outline` branch first changed canvas-edge gradients to `source-atop`, which removed transparent-edge painting but also suppressed the visible contact shadow for padded planar models. `fix-20` now places shading at the renderer's installation bounds. The reported saved JPEG and full browser acceptance matrix remain unverified.

---

## 1. Authorized Requirement and Evidence Boundary

Remove the unintended thin rectangular outline surrounding the 3D product in images saved with **Save Snapshot** from the visualization workspace. Preserve the cabinet's real frame edges, contact shadow, photo alignment, perspective fit, and object-aware occlusion. The exported image should look like the intended product and room composite, without editor selection guides or a visible source-canvas boundary.

The supplied `glassfit-visualization-1793613972774.jpg` is the symptom evidence. This 1148 by 861 pixel JPEG shows a faint straight-edged rectangle outside the cabinet, most visible along the upper and left sides. This single image does not show the live workspace, identify the catalog product, or prove that an editing control is baked into the download. The export code uses an offscreen compositor rather than a screenshot of the DOM. The room and cabinet are evidence of the defect, not instructions to change product data. This request authorizes only this plan, with no application-code or image edits.

---

## 2. Evidence and Reproduction

| Surface | Current source evidence and uncertainty | Reproduce before editing |
|---|---|---|
| Save Snapshot | `ProductModelWorkspace.tsx` calls `captureCurrentSnapshot()` from `handleSaveSnapshot()`. That routine calls `captureWorkspaceCanvas()`, then encodes the room composite as JPEG. **Apply** and **Continue to Comparison** call the same capture routine. | Reopen the reported cabinet placement, or recreate it with the same product and room image. Download a baseline JPEG, then compare it at 100% and 400% zoom with the live editor and the applied preview. Record whether the line appears in all three surfaces and whether its position changes when the product is moved or resized. Confirm the current checkout is the revision serving the reported workspace. |
| Editor guides | The cyan selection effect comes from `getModelEffectStyle()` and the editing handles are rendered in separate DOM layers. `getExportModelFilter()` intentionally omits the cyan guide shadows. `captureWorkspaceCanvas()` draws the source canvas and images directly; it does not render the control DOM. | Capture once while the product is selected and once after leaving edit mode. Inspect the downloaded pixels for cyan, gray, or black lines. Do not remove the useful editing guide unless the actual export source proves it is involved. |
| Contact shadow on transparent frame | `ProductModelWorkspace.tsx` calls `applyContactOcclusionAndReveals()` on the entire model display canvas when perspective fit, auto realism, auto shadow, and effective lighting are active. `contactShadow.ts` paints top, bottom, left, and right gradients from canvas coordinates, regardless of the product's alpha bounds. Those strokes can make an otherwise transparent rectangular render frame visible when the canvas is warped and composited onto the room photo. The image is consistent with this path, but the original workspace state has not been inspected. | Save the same scene with only **Auto Shadow** toggled, then with perspective fit toggled or reset, keeping product placement and photo fixed. Compare model canvas edge alpha before and after `applyContactOcclusionAndReveals()`. Check whether the line follows the canvas edge and disappears with this effect disabled. Record the rectangle bounds against the projected canvas extent. |
| Fitted product render | For perspective-fit placement, `drawSnapshotOverlay()` passes the rendered model canvas and `planarFitRect` to `drawPerspectiveWarpedImage()` in `perspectiveTransform.ts`. The warp maps the fit rectangle to the selected opening but projects and blits the full source canvas, including any overflow around the model. The WebGL shader fades at source texture edges. A faint source-edge alpha or filter shadow could therefore appear as a rectangular boundary. This is a lead, not a proven cause. | Inspect the raw Three.js canvas alpha and RGB at all four edges before compositing, then the filtered offscreen canvas, warped layer, pre-encode composite, and saved JPEG. Compare line coordinates with the projected source extent and fit rectangle. Repeat with perspective fit on and off, shadow on and off, and a second 3D product. |
| Occlusion and encoding | `captureWorkspaceCanvas()` draws foreground masks after the product and JPEG encoding follows compositing. A mask edge, JPEG ringing, or background mismatch could be mistaken for a model boundary. | Save with each detected object mask enabled and disabled, then with the manual mask disabled. Compare the pre-encode bitmap and downloaded JPEG. If the line appears only after JPEG encoding, test encoder quality and edge colors before altering geometry. Check the same capture through comparison and quotation preview if those flows use the generated image. |

Use a local diagnostic or temporary browser inspection during the later implementation pass; do not persist room photos or customer data in test fixtures. Any diagnostic logging or temporary images must be removed before the fix is complete.

---

## 3. Traceability

| Requirement | Relationship |
|---|---|
| BRD-M4; PRD-F6; SDD-C5; DSD-UI4 | The product must remain visually credible and correctly aligned while the workspace keeps its interactive controls. |
| PRD-F7; QAD-TC7 | Realism and contact shadow must still ground the visible product after the unintended canvas-edge shadow is removed. |
| PRD-F8; QAD-TC8 | Foreground furniture and manual masks must still layer over the product correctly after the snapshot fix. |
| PRD-F9; SDD-C6; QAD-TC9 | The final image must composite the room, 3D product, shadows, and masks without an unintended rendering boundary. QAD-TC9 protects the snapshot flow; the artifact-specific checks below extend its visual acceptance. |
| FIX-UI13-V1 through FIX-UI13-V5 | Plan-local acceptance cases, not new QAD catalog IDs. |

---

## 4. Planned Implementation Contract

### 4.1 Isolate the first stage that contains the line

**Primary investigation files:** `src/features/visualization/components/ProductModelWorkspace.tsx`, `src/lib/visualization/contactShadow.ts`, `src/lib/visualization/perspectiveTransform.ts`, and `src/lib/visualization/modelRenderer.ts`.

Compare the original transparent model pixels with the filter output, perspective-warp output, full composite, and JPEG. Record the line's color, alpha before JPEG, pixel width, and bounds. Use the difference to choose the narrowest correction:

1. If the raw Three.js canvas already has a rectangular edge, identify the responsible render target, material, clear state, or model asset. Clear or exclude only unintended pixels, while retaining real frame geometry and protruding components.
2. If the edge first appears after `applyContactOcclusionAndReveals()`, make the contact and reveal shadow follow the actual installation perimeter or visible model alpha instead of the full transparent render-frame boundary. Preserve a localized grounding shadow, transparency outside the product, and protruding sills or hardware. Update the current unit assertions that expect four full-canvas edge rectangles; those assertions encode the suspect behavior.
3. If the edge first appears during filtering or perspective warping, correct source-bound sampling or alpha handling in the affected stage and in its Canvas 2D fallback. Keep the cyan guide effect in the editor and absent from export. Preserve legitimate product overflow outside `planarFitRect`; do not crop blindly to the installation rectangle or erode real cabinet edges.
4. If the edge appears only when occlusion masks are applied or in the encoded JPEG, correct that stage's edge or color handling. Keep the chosen mask geometry, room photo, and export dimensions intact.

### 4.2 Preserve the shared capture contract

`captureCurrentSnapshot()` serves the local download and the applied/comparison flows. Fix the common rendering stage when the defect is common to all of them; do not hide a bad download with an image-viewer CSS overlay. Keep product placement, flip, rotation, perspective corners, lighting, shadows, multiple placed overlays, and mask order synchronized between editor and saved output. A transparent product-only capture should retain transparent pixels outside the visible model. The room composite should remain an image at the current export size and existing file format unless evidence proves the encoder is the cause.

### 4.3 Scope boundary

This is a rendering-artifact fix. Do not change quotation amounts, product dimensions, selection-control behavior, CV detection, Supabase schema, R2 policy, or the design system. Add no dependency. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`, as required by this repository.

---

## 5. Agent Delegation Before Implementation

The `agent-organizer` reviewed the task and recommended one frontend owner for the capture and warp investigation, followed by a read-only QA pass. No implementation agent was started for this plan-only request.

| Agent | Later responsibility | Ownership |
|---|---|---|
| `frontend-developer` | Reproduce the artifact, isolate its first appearance, and implement the smallest correction supported by pixel evidence. | Own `ProductModelWorkspace.tsx` and the relevant focused test; take ownership of `contactShadow.ts`, `perspectiveTransform.ts`, or `modelRenderer.ts` only if the diagnostic identifies that stage. |
| `qa-expert` | Compare before and after exports and run the artifact and flow acceptance matrix on supported desktop and mobile browsers. | Read-only verification; report failures to the frontend owner. |
| `code-reviewer` | Review the final diff for altered alpha, lost product overflow, occlusion regressions, and unwanted changes outside the capture path. | Read-only final review. |

---

## 6. Verification and Acceptance Matrix

| Case | Required result |
|---|---|
| FIX-UI13-V1: Reported capture | Recreate the reported cabinet scene and download a snapshot. At 100% and 400% zoom, no faint straight-edged rectangle surrounds the cabinet. Real cabinet edges, handles, shelves, and contact shadow remain visible. |
| FIX-UI13-V2: Capture stages | The corrected stage has transparent alpha outside the intended product or localized shadow, including at all four unused render-frame edges. The pre-encode composite and downloaded JPEG agree on placement and visible content. Record before and after pixel samples at the former line and adjacent room background. |
| FIX-UI13-V3: Placement variants | Free placement and perspective fit, including an angled quadrilateral, show no source-canvas border. Flip, rotate, scale, a second product, a projecting part, and multiple placed overlays render without clipping or shifting. Editor guides remain usable while editing and absent from the saved image. |
| FIX-UI13-V4: Occlusion and downstream | With sofa/chair/television masks and a manual mask individually on and off, foreground objects cover the correct product regions and no new mask edge appears. Applied preview, comparison, and any quotation image using the same capture remain aligned with the local download. |
| FIX-UI13-V5: Browser and quality gate | Repeat the reported scene in Chromium and a WebKit browser at desktop and phone sizes; test the WebGL warp and Canvas 2D fallback where available. Run focused existing perspective and visualization tests, then `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Record unrelated pre-existing failures separately. Run the FastAPI health check only if reproduction starts that service. |

An automated alpha or pixel regression check is useful only if it exercises the actual stage that caused the border; a test that merely mirrors a helper's implementation would not protect the user-visible export. Visual acceptance requires opening the downloaded image, not only inspecting the live canvas.

---

## 7. Implementation Sequence and Open Decision

1. Confirm the reported workspace and current checkout match, then capture the baseline saved image and record the rectangle's bounds and color.
2. Compare raw model, model after contact and reveal shading, filtered model, warped layer, masked composite, and JPEG to find the first stage containing the artifact. Toggle perspective, shadows, and occlusion separately to distinguish causes.
3. Apply the stage-specific correction from Section 4 with one file owner, preserving the existing fit and mask contracts.
4. Run Section 6 acceptance, review the diff, and remove temporary diagnostic output.

The leading hypothesis is the four full-canvas edge gradients in `contactShadow.ts`, applied to the transparent model canvas before perspective warping. The open decision is whether the reported rectangle actually enters at that stage. Resolve it with an Auto Shadow toggle and intermediate alpha captures before implementation.

## Self-Check

- [x] `fix-ui13.md` follows the `docs/implementation/fix-ui*.md` naming, metadata, traceability, delegation, and acceptance conventions.
- [x] The user request is distinguished from screenshot content and unverified root-cause hypotheses.
- [x] The plan preserves real product geometry, editor controls, occlusion, and shared snapshot consumers.
- [x] This planning pass changes no application code, dependencies, schema, or data.
