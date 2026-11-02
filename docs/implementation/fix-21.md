# Implementation Specification: Preserve Calibrated Dimensions During Rotation and Close Snapshot Acceptance (fix-21)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document ID:** fix-21
**Document Function:** Merge-readiness plan for the fitted-product rotation regression and the unverified snapshot-outline correction
**Version:** 1.0.0
**Date:** November 2, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Ready for Implementation; plan only
**Primary Traceability:** `BRD-M3`, `BRD-M4`, `BRD-M5`, `PRD-F6`, `PRD-F7`, `PRD-F8`, `PRD-F9`, `PRD-F10`, `SDD-C5`, `SDD-C6`, `SDD-C7`, `DSD-UI4`, `QAD-TC7`, `QAD-TC8`, `QAD-TC9`, `QAD-TC10`, `QAD-TC55`, `QAD-TC71`
**Upstream Specifications:** `docs/brd-glassfit.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/qad-glassfit.md`, `docs/implementation/fix-20.md`, `docs/implementation/ms56.md`
**Comparison Base:** `origin/dev` at `794bad7`; reviewed `fix/product-outline` at `5a2fda4`. Refresh both refs before implementation.

---

## 1. Required Outcome and Scope

A user can rotate a perspective-fitted product for visual placement without silently changing its accepted physical width, height, model structure, or calculated quotation. A genuine opening resize or deliberate measurement confirmation still updates those values through the existing metric evaluator. The saved image must show the product and its localized contact shadow without the reported faint source-canvas rectangle. The same visual result must reach Save Snapshot, Apply, comparison, and quotation preview.

This document plans the remaining work before merging `fix/product-outline` into `dev`. `FIX21-V1` through `FIX21-V8` below are plan-local acceptance cases, not new QAD identifiers. No application code, tests, dependencies, schema, migration, or customer data are changed by this plan.

---

## 2. Confirmed Findings and Evidence Boundary

| Evidence | Consequence |
|---|---|
| `ProductModelWorkspace.tsx` calls `updateMetricPerspectiveCorners(rotatePerspectiveCorners(...))` from the new fitted-product rotation handler. The update helper evaluates the rotated corners against the paper reference and writes `widthCm`, `heightCm`, and `overlaySize` when a matching eligible metric reference is active. | A placement-only rotation can alter accepted dimensions, rebuild the parametric model, and change the live quotation. The existing rotation unit test checks corner geometry but not measurement or price stability. |
| The workspace also uses perspective corners for fit and measurement, while MS56 requires accepted measurement provenance to match the opening evaluated for model and quotation inputs. | A fix that only freezes the displayed numbers could leave stored corners, provenance, model dimensions, and server validation inconsistent. Separate the measured opening from visual orientation, or use another explicit contract that preserves their parity. |
| `fix-20.md` records a synthetic browser pixel check and passing focused tests, lint, typecheck, and build. Its reported customer image, complete browser matrix, and downloaded-image acceptance are still pending. | The current evidence shows a plausible localized-shadow correction but does not establish that the user-visible snapshot defect is closed. The manual HTML check is not part of the standard test command. |
| The reviewed branch is two commits ahead of `origin/dev`, with `origin/dev` as an ancestor. The prior review found no merge conflict; three local untracked notes (`fix-17.md` through `fix-19.md`) are outside this branch. | Recheck ancestry and the final tracked diff immediately before merge. Do not treat local untracked plans as part of this fix. |

The rotation call path is confirmed by code inspection. The exact price difference depends on the calibrated plane, product, and rotated corner geometry; demonstrate it with a representative eligible calibrated session before implementing the correction. The reported snapshot has not been reproduced or cleared by the synthetic test alone.

---

## 3. Planned Implementation Contract

1. Reproduce the fitted-product rotation in an eligible paper-calibrated session. Record the accepted opening corners, physical dimensions, measurement revision and provenance, model inputs, and quotation before and after a rotation. Repeat in an oblique photo where a projective transform makes the distinction visible. Check manual-dimension and approximate sessions separately so only the eligible metric path is changed.
2. Define an explicit ownership rule for geometry: measurement corners describe the physical opening; a rotation handle changes only the visual pose. Keep the measured opening, its plane and image identity, unrounded dimensions, and accepted provenance stable during visual rotation. If the current shared `perspectiveCorners` state cannot represent both safely, introduce the smallest typed separation compatible with session hydration, placed layers, capture, and server quotation validation. Do not persist a rotated visual quad as if it were a newly measured opening.
3. Route deliberate corner placement or resize through the existing metric evaluator when it is intended to redefine the physical opening. Reject invalid or ineligible measurement geometry under the existing MS54-MS56 rules, while preserving manual dimensions and the approximate preview path. Check that a visual rotation neither triggers a structural rebuild nor changes the price, and that an intentional measurement edit still updates both axes, model, and quote together.
4. Preserve pointer handling on desktop and touch devices: rotation remains smooth, reset and fit retain their existing behavior, a canceled drag releases interaction state, and the rendered product, handles, source canvas, and exported position agree. Keep the existing component styling and controls.
5. Reproduce the reported cabinet snapshot with the same source photo and product when available. Compare the raw transparent model, realism-treated model, perspective warp, room composite before encoding, and downloaded image. Sample alpha and color at the former rectangle, visible installation perimeter, and unused source-canvas margins. Toggle Auto Shadow, perspective fit, and foreground occlusion independently to identify the first stage containing any remaining line. If the original private scene is unavailable, document that limitation and use a representative cabinet scene plus the synthetic fixture; do not claim the original report is reproduced.
6. Correct only the rendering stage shown by pixel evidence if a line remains. Retain localized contact and reveal shading, real cabinet edges, transparent glass, projecting hardware and sill, renderer padding, and the existing source and mask order. Use the shared capture path so live, applied, comparison, quotation preview, and downloaded images agree. Keep editing guides out of the export.
7. Add regression coverage that exercises the actual user paths: a rotation on an eligible calibrated opening preserves dimensions, provenance, model parameters, and calculated price; a deliberate measurement edit changes them consistently; the saved image retains a visible localized shadow and transparent unused margins without a source-frame rectangle. Add a browser-accessible saved-image assertion to the automated test entrypoint or explicitly document its required manual run. A pure rotation-math or mock canvas assertion is insufficient.

Before changing Next.js code, read the relevant installed guide in `node_modules/next/dist/docs/`. Reuse existing visualization, metric, pricing, and UI patterns. No new dependency, database migration, CV change, or public customer-photo fixture is expected.

---

## 4. Agent Delegation Before Implementation

The prior merge review used one visualization-focused reviewer. The following assignments are for a later implementation pass; no implementation agent was started for this plan.

| Agent | Later responsibility | Ownership |
|---|---|---|
| Visualization-focused `frontend-developer` or `worker` | Own the measured-opening versus visual-pose contract, rotation handler, capture correction if pixel evidence requires one, and final integration with `dev`. | `ProductModelWorkspace.tsx` and any narrowly required visualization helper; one owner holds production visualization edits. |
| `qa-expert` | Add meaningful calibrated-rotation and browser image checks, then run the reported-scene and cross-browser acceptance matrix. | Focused unit and browser tests plus recorded acceptance evidence; coordinate test interfaces with the visualization owner. |
| `code-reviewer` | Check dimension and provenance parity, quotation stability, compositing order, alpha, product overflow, occlusion, and final merge diff. | Read-only final review. |

---

## 5. Verification and Acceptance

| Case | Required result |
|---|---|
| FIX21-V1: Calibrated visual rotation | On an eligible oblique paper-calibrated opening, rotating the fitted product changes its visible pose but leaves accepted unrounded width and height, measurement revision and provenance, structural parameters, and calculated quotation unchanged. |
| FIX21-V2: Intentional measurement edit | Deliberately moving or resizing measured opening corners invokes the metric evaluator; valid dimensions, model, and quotation update together, while invalid geometry does not create accepted metric provenance. |
| FIX21-V3: Other dimension modes | Manual dimensions remain authoritative during rotation, and approximate sessions do not gain a calibrated status or fabricated metric values. Restored and secondary product sessions preserve their own measurement identity. |
| FIX21-V4: Reported snapshot | The reported cabinet scene, if available, has no faint source-canvas rectangle in the opened downloaded image at 100% and 400% zoom. The contact shadow, real frame edges, glass, handles, and sill remain visible. Record whether the original scene was available. |
| FIX21-V5: Pixel and format parity | Unused source-canvas margins have alpha zero; localized contact or reveal pixels remain near the installation perimeter. The pre-encode composite and decoded download agree in placement and shadow. Test the actual format emitted by Save Snapshot. |
| FIX21-V6: Placement and masks | Free placement, angled perspective fit, flip, scale, rotation, multiple products, projecting parts, detected and manual masks, and Auto Shadow on/off retain correct geometry and layering. Apply, comparison, quotation preview, and Save Snapshot agree; editor guides are absent from export. |
| FIX21-V7: Browser coverage | Inspect desktop and phone-sized scenes in Chromium and WebKit; exercise the WebGL warp and Canvas 2D fallback where supported. Open the downloaded image in each supported path and record results or a specific environment limitation. |
| FIX21-V8: Merge quality | Refresh `origin/dev`, review the combined tree, run focused rotation, metric, shadow, and snapshot tests, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and relevant QAD-TC7 through QAD-TC10 and QAD-TC71 checks. Separate pre-existing warnings from failures. Reconcile the status of `fix-20.md` and `fix-ui13.md` with measured evidence. |

Keep customer photos and diagnostic images private and temporary. Run the FastAPI health check only if the reproduction starts that service. Do not mark the snapshot defect complete from the synthetic browser check or build gates alone.

---

## 6. Execution Order and Completion Gate

1. Refresh the merge base and capture a calibrated rotation baseline plus the reported snapshot stages.
2. Separate visual pose from accepted measurement, implement the narrow rendering correction only if the stage comparison shows one, and add focused regressions.
3. Execute the acceptance matrix, inspect downloaded images across supported browsers, and resolve findings.
4. Review the final diff, update prior plan status from observed evidence, and make the merge decision.

The branch is merge ready only when rotation preserves accepted measurements and quotation, the original or clearly documented representative snapshot has no canvas outline while retaining localized shadow, and the required quality and browser checks pass.

## Self-Check

- [x] Uses the next numbered `fix-##.md` planning convention and upstream requirement IDs.
- [x] Separates confirmed code-path findings from pending image and pricing reproduction.
- [x] Defines one production owner, independent review, and measurable merge acceptance.
- [x] Adds no runtime implementation, test change, dependency, migration, or customer data.
