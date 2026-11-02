# Implementation Specification: Preserve Contact Shadow Without Snapshot Canvas Outline (fix-17)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document ID:** fix-17
**Document Function:** Technical plan for correcting the snapshot-outline fix without losing product grounding and reveal shadows
**Version:** 1.0.0
**Date:** November 2, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Implementation in progress; reported snapshot and cross-browser acceptance pending
**Primary Traceability:** `BRD-M4`, `PRD-F6`, `PRD-F7`, `PRD-F8`, `PRD-F9`, `SDD-C5`, `SDD-C6`, `DSD-UI4`, `QAD-TC7`, `QAD-TC8`, `QAD-TC9`
**Upstream Specifications:** `docs/brd-glassfit.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/qad-glassfit.md`, `docs/implementation/fix-ui13.md`
**Comparison Base:** `origin/dev` at `794bad7`; reviewed `fix/product-outline` at `04f8052`. Recheck both refs before implementation.

---

## 1. Required Outcome and Scope

Saved snapshots must show the fitted product with a localized contact and reveal shadow, without a straight-edged rectangle from the transparent model canvas. The live editor, applied preview, comparison image, and downloaded image must agree on product placement and shading. Preserve real product edges, protruding sills and hardware, perspective fit, glass transparency, and foreground occlusion.

This document records the correction on the current `fix/product-outline` branch. `FIX17-V1` through `FIX17-V7` below are plan-local acceptance cases, not new QAD identifiers. The branch now positions contact and reveal shading from the normalized installation rectangle, with the same rendered canvas consumed by live display and shared snapshot capture. The reproducible browser pixel check in Brave passed for transparent margins, visible contact shading, transparent glass, projecting hardware, Auto Shadow off, an angled perspective warp, and JPEG encode/decode. Focused tests, lint, typecheck, and production build passed; lint reported 19 pre-existing warnings. The reported customer image and complete browser matrix have not been reproduced, so release acceptance remains pending.

---

## 2. Confirmed Regression and Evidence Boundary

| Evidence | Consequence |
|---|---|
| `src/lib/visualization/contactShadow.ts` changed the perimeter and reveal gradient operations from `source-over` to `source-atop`, but still paints strips against the full source canvas edges. | The gradient cannot create the former rectangular canvas-edge artifact, but it also cannot shade transparent pixels near a product inset from those edges. |
| `src/lib/visualization/modelRenderer.ts` reserves at least 4% source-frame padding on every side of a planar fitted product. `ProductModelWorkspace.tsx` clears the 2D target before drawing the model and applying the gradients. | For the normal planar render, the 3-pixel edge strips and short reveal strips miss the visible installation perimeter. Contact and reveal shading can disappear, violating `PRD-F7` and `QAD-TC7`. The 4% padding is intentional room for protruding geometry and must remain. |
| The changed `sceneAdaptivePhotorealism.test.ts` checks edge rectangles and the composite-operation string in a mock context. | Those assertions do not establish whether a visible shadow survives or whether unused source-frame pixels remain transparent in an actual canvas. |
| `docs/implementation/fix-ui13.md` still says implementation has not started although the branch contains a snapshot-outline code change. | The plan status and code history disagree; implementation completion must reconcile this record. |

The missing shadow follows from the canvas operations and planar padding. Whether the reported saved JPEG is free of the rectangle is still a browser-image verification task; the original room scene and intermediate pixel samples have not been recorded. Do not claim the user-visible defect is closed from static review alone.

---

## 3. Planned Implementation Contract

1. Reproduce the reported Save Snapshot scene on the current branch and the intended integration base. Capture the raw transparent model, model after realism effects, perspective-warp result, pre-encode room composite, and downloaded image. Record alpha and color samples at the source canvas edges, visible installation perimeter, and former rectangle. Toggle Auto Shadow and perspective fit independently to confirm the first stage that creates or removes each effect.
2. Define the shadow geometry from the visible installation perimeter, using the renderer's `planarFitRect` or measured visible model bounds as appropriate. Account for device pixels, scaled 2D canvases, angled fit, and parts that project outside the host frame. Keep a typed distinction between installation bounds and the full render canvas. Do not trim the source to a blind rectangle or remove the renderer's padding.
3. Render contact grounding and aperture reveal into a correctly positioned effect layer or equivalent localized stage. The contact shadow must remain visible beside or beneath the frame where the design requires it; shading of the model itself must remain aligned with the frame. Keep unused source-frame margins transparent and prevent a four-sided canvas boundary. Choose compositing operations deliberately for each effect rather than applying one operation to all full-canvas strips.
4. Use the same corrected source and ordering for the live workspace and shared `captureCurrentSnapshot()` path. Preserve the export filter that excludes cyan editing guides. Keep free placement, perspective fit, flip, rotation, scale, multiple placed products, mask order, current image size, and file format consistent across Save Snapshot, Apply, comparison, and quotation preview consumers.
5. Replace the mock-only shadow assertions with a focused pixel-level regression using an actual 2D canvas or browser rendering stage: a visibly inset opaque frame on transparent pixels must retain a localized shadow while all unused frame edges remain transparent. Include transparent glass, a projecting sill or handle, an angled quadrilateral, and Auto Shadow off. Add a saved-image check at the stage that caused the reported line; source-text or operation-string assertions alone are insufficient.
6. Integrate the correction with the latest `origin/dev`, which has touched `ProductModelWorkspace.tsx` since this branch diverged. Resolve semantic overlap, run checks on the combined tree, and review the final diff. Update `fix-ui13.md` to reflect the actual implementation and its verification status; do not mark the defect complete until the browser acceptance below passes.

Before changing Next.js code, read the relevant installed guide in `node_modules/next/dist/docs/`. Reuse the current visualization architecture, UI components, and design tokens. Add no dependency, database migration, CV change, or customer data fixture.

---

## 4. Agent Delegation Before Implementation

The prior `agent-organizer` review recommended one visualization owner with independent read-only review. These are assignments for a later implementation pass; no implementation agent was started for this plan.

| Agent | Later responsibility | Ownership |
|---|---|---|
| `frontend-developer` or visualization-focused `worker` | Reproduce the image stages, implement the localized shadow and shared capture correction, and integrate the latest `dev` workspace changes. | `src/features/visualization/components/ProductModelWorkspace.tsx`, `src/lib/visualization/contactShadow.ts`, and `src/lib/visualization/modelRenderer.ts` or `perspectiveTransform.ts` only if evidence identifies a necessary interface change. One owner holds all production visualization edits. |
| `qa-expert` | Add pixel-level regression coverage and compare live, applied, and downloaded output across browsers and placement modes. | Focused visualization tests and acceptance evidence; report source defects to the visualization owner. |
| `code-reviewer` | Check final compositing order, alpha, product overflow, placement, occlusion, test fidelity, and integration with `dev`. | Read-only final review. |

---

## 5. Verification and Acceptance

| Case | Required result |
|---|---|
| FIX17-V1: Reported snapshot | The reported cabinet placement has no faint source-canvas rectangle in the downloaded image at 100% and 400% zoom. Actual cabinet edges, handles, glass, and contact shadow remain visible. |
| FIX17-V2: Pixel boundary | Before warping, unused model-canvas edges retain alpha zero. A measurable localized contact or reveal effect exists at the installation perimeter. The pre-encode composite and downloaded image show the same intended edge and shadow positions. |
| FIX17-V3: Placement variants | Free placement and perspective fit, including an angled quadrilateral, render without clipping, offset shadows, or a source-frame border. Flip, scale, rotation, a second product, and projecting parts retain their visible geometry. |
| FIX17-V4: Realism controls | Auto Shadow off removes the intended shadow without changing product pixels or placement. Auto Shadow on restores localized grounding without shading the full transparent canvas. Glass appearance and lighting controls retain their existing behavior. |
| FIX17-V5: Occlusion and handoff | Detected foreground masks and a manual mask each cover the correct product region. Save Snapshot, Apply, comparison, and any quotation preview using the shared capture remain visually aligned. Editor guides stay usable and are absent from export. |
| FIX17-V6: Browser and fallback | Confirm desktop and phone-sized scenes in Chromium and WebKit. Exercise WebGL perspective warp and Canvas 2D fallback where available, opening the downloaded image in each supported path. |
| FIX17-V7: Integration and quality | The latest `origin/dev` changes and this correction combine cleanly. Focused visualization tests, `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass on the integrated tree. Record unrelated pre-existing warnings separately and reconcile `fix-ui13.md` status. |

Use `QAD-TC7` through `QAD-TC9` as the existing release baseline. Keep diagnostic images local and temporary; remove customer photos and debug logging before completion. Run the FastAPI health check only if reproduction starts that service.

---

## 6. Execution Order and Completion Gate

1. Refresh `origin/dev`, reproduce the snapshot and shadow on the intended merged code, and collect stage-specific pixel evidence.
2. Implement localized shading at the installation perimeter with one production-code owner; retain transparent render margins and product overflow.
3. Add meaningful pixel regression coverage, execute the full acceptance matrix, and inspect downloaded images in both browser engines.
4. Review the integrated diff, resolve findings, and reconcile the older `fix-ui13.md` status with measured results.

Implementation is complete only when the downloaded image has no rectangular canvas outline **and** a visible localized contact shadow remains. Passing unit, lint, typecheck, and build gates alone does not close this defect.

## Self-Check

- [x] Uses the next numbered `fix-##.md` implementation-plan convention and upstream requirement IDs.
- [x] Separates the confirmed shadow regression from unverified saved-image appearance.
- [x] Defines one production-code owner, browser and pixel acceptance, and latest-`dev` integration.
- [x] Adds no runtime implementation, dependency, schema change, or private image.
