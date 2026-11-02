# Implementation Specification: Screen Door Accessory Model Preview Parity (fix-15)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document ID:** fix-15
**Document Function:** Technical plan for keeping selected screen door hardware consistent with the photo-based 3D preview
**Version:** 1.0.0
**Date:** November 1, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Ready for Implementation; plan only
**Primary Traceability:** `PRD-F2`, `PRD-F5`, `PRD-F6`, `PRD-F10`, `PRD-F11`, `SDD-C4`, `SDD-C5`, `SDD-C7`, `DSD-UI4`, `DSD-UI7`, `ERD-E3`, `ERD-E6`, `QAD-TC91.1` through `QAD-TC91.10`, `QAD-TC92.7`, `QAD-TC92.10`
**Upstream Specifications:** `docs/brd-glassfit.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/erd-glassfit.md`, `docs/qad-glassfit.md`, `docs/implementation/ms76.md`, `docs/implementation/ms77.md`

---

## 1. Required Outcome and Scope

For an approved screen door handle slot, each model choice must render its corresponding accessory shape in the fitted workspace preview. The default restores the original uploaded component. Switching among Curved Lever, Pull Bar, and the default must keep selection, rendered geometry, handing, finish, and displayed price in agreement. Apply the same contract to future registered accessories offered by compatible slots, including restored workspace sessions. A new eligible handle must work through its catalog ID and active model asset without a code change or a name-specific shape rule.

This planning pass changes no application code, assets, database records, dependencies, or tests. The supplied screenshots establish the customer-visible symptom and are not instructions to change pricing or styling.

---

## 2. Implementation Contract

1. Trace the active screen door through `ProductModelWorkspace.tsx`, `ProductModelRenderer`, the component model cache, and the selected assembly branch in `parametricProductBuilder.ts`. Confirm the product's model strategy and the selected slot's component ID, approved accessory IDs, and model URLs before changing code.
2. Make the selected registered accessory's active 3D asset available to the renderer during model preparation. Resolve it by approved product ID and asset URL, validate that the loaded scene contains renderable geometry, clone it for each assembly, and pass the resolved model to the builder. Keep async selection changes race safe so an older load cannot replace a newer choice. Reuse the existing Three.js loader and cache patterns.
3. Replace the original slot mesh with the selected accessory mesh in the active assembly path. Preserve the host product's scale, the accessory's real dimensions and orientation, door-face depth, right and left handing, and finish. Confirm that selecting Pull Bar produces a vertical pull bar with its mounting points and selecting Curved Lever produces its own model. Do not infer registered model shape from its display name.
4. Define a visible, deterministic response when an approved asset fails to load or has invalid geometry. A paid choice must not appear successfully applied while the preview still shows another model. Preserve the last valid preview and price state, or revert the selection with a clear error. Keep default hardware available.
5. Retain the existing approved-ID and category checks, quotation validation, price calculation, snapshot serialization, and quotation/PDF labels. Do not change live catalog data, upload new models, or create a database migration for this rendering correction.

Read the relevant installed Next.js 16 guide in `node_modules/next/dist/docs/` before writing Next.js code. Reuse existing UI components and tokens for any loading or error feedback. Add no dependency.

---

## 3. Agent Delegation Before Implementation

The `agent-organizer` reviewed the task breakdown. These are proposed assignments for a later implementation pass; no implementation agent was started for this plan.

| Agent | Later responsibility | Ownership |
|---|---|---|
| `frontend-developer` | Coordinate selector state with preview loading, show pending or failed model status, and keep price and selected state aligned with the committed preview. | `src/features/visualization/components/ProductModelWorkspace.tsx` only. |
| `fullstack-developer` or visualization-focused `worker` | Load and cache registered accessory GLBs, provide typed builder inputs, and correct accessory replacement and placement in the active assembly path. | `src/lib/visualization/modelRenderer.ts`, `componentModelCache.ts`, `parametricProductBuilder.ts`, and `accessoryMeshFactory.ts` if needed. |
| `qa-expert` | Execute the acceptance matrix using the screen door and another eligible host product; add focused tests for model identity and failure behavior where automation adds coverage. | Acceptance evidence and focused test files; route source failures to the owning agent. |
| `code-reviewer` | Review the integrated diff for asset ownership, model disposal, stale async results, fixed versus parametric behavior, pricing parity, and specification traceability. | Read-only final review. |

The lead agent should confirm the active assembly branch and the interface between workspace state and model loading before parallel edits. Assign one owner to any additional shared file.

---

## 4. Verification and Acceptance

| Case | Required result |
|---|---|
| FIX15-V1: Distinct models | On the reported screen door, Default, Curved Lever, and Pull Bar each show the correct and visibly distinct handle geometry. The selected card and fitted preview agree after every switch. |
| FIX15-V2: Default restoration | Returning to Standard Hardware restores the original uploaded handle, removes replacement geometry, and resets the accessory price delta to zero. |
| FIX15-V3: Position and finish | Right and Left Side move the selected model to the correct stile without unintended vertical or depth drift. Every offered hardware finish updates the selected model. |
| FIX15-V4: Asset failure and rapid switching | An unavailable, empty, or failed GLB does not leave a paid selection paired with stale geometry. Rapid switching commits only the latest valid selection, with no duplicate meshes or WebGL resource leak. |
| FIX15-V5: Pricing and handoff | The visible price delta, saved selection, quotation itemization, snapshot, and PDF identify the same accessory, finish, and handing as the preview. |
| FIX15-V6: Eligibility and product regression | Only approved, active, compatible accessory products with usable models appear. Register a new handle in an isolated test catalog, approve it for a door slot, and verify its distinct GLB renders without a code change. A second host product and the default component path retain their existing behavior. Fixed-model products are checked against their supported accessory contract before release. |

Use `QAD-TC91.2` through `QAD-TC91.10` and `QAD-TC92.7`, `QAD-TC92.10` as the release baseline. Verify the fitted photo preview in Brave and at least one other supported browser, including a reload or restored session. Run focused visualization tests, `npm run lint`, `npx tsc --noEmit`, and `npm run build` after implementation. Record any pre-existing failures separately. The FastAPI health check is needed only if that service is used during end-to-end reproduction.

---

## 5. Execution Order and Completion Gate

1. Capture the screen door's current model strategy, slot metadata, accessory IDs, and baseline previews for all three choices.
2. Implement typed accessory asset loading and the active assembly replacement path, then wire selection and load feedback to the preview commit.
3. Verify geometry identity, placement, finish, failure handling, and rapid switching with focused tests and browser inspection.
4. Have `qa-expert` run the acceptance matrix and `code-reviewer` inspect the integrated diff. Resolve findings before treating the bug as fixed.

Implementation is complete only when the selected Pull Bar renders as a pull bar on the reported screen door and every applicable acceptance case above passes. This document alone does not close the defect.

## Self-Check

- [x] Uses the next numbered `fix-##.md` name and the existing implementation-specification metadata format.
- [x] Maps the planned work to existing product, system, UI, data, and QA requirements.
- [x] Keeps defect analysis in the accompanying chat, outside this fix plan.
- [x] Contains no application implementation, schema change, dependency, or test change.
