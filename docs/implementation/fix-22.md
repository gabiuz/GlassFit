# Implementation Specification: Keep Per-Part Raw Material Choices from Changing 3D Appearance (fix-22)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document ID:** fix-22
**Document Function:** Technical fix plan for separating per-part raw material specifications and pricing from 3D material appearance
**Version:** 1.0.0
**Date:** November 3, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Ready for Implementation; plan only
**Primary Traceability:** `BRD-M4`, `PRD-F6`, `PRD-F7`, `SDD-C5`, `DSD-UI4`, `QAD-TC81`, `QAD-TC82`; regression guards for `PRD-F10`, `SDD-C7`, `ERD-E11`
**Upstream Specifications:** `docs/brd-glassfit.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/erd-glassfit.md`, `docs/qad-glassfit.md`, `docs/build-glassfit.md`, `docs/implementation/ms66.md`, `docs/implementation/fix-12.md`

---

## 1. Required Outcome and Scope

In `/visualize/[productId]/workspace`, choosing a raw material for an individual part in **Customize Raw Materials by Part** must not change the 3D product's material appearance. This includes color and glass tint, metalness, roughness, transmission, opacity, texture, and other shader appearance properties. The dedicated Aluminum Finish, Glass Type, Advanced Glass Appearance, Glass Color, and Glass Thickness controls remain responsible for those visual choices. A per-part choice must continue to change the selected raw material, part specification, BOM, and price exactly as it does today.

This is a 3D appearance fix for the per-part picker, including model rebuild and restoration. It does not change material eligibility, part names or dimensions, the selected material ID, price deltas, BOM formulas, quotation values, persistence, or current geometry behavior. The separate grouped `MaterialCustomizerPanel` and dedicated appearance controls retain their intentional visual behavior. `FIX22-V1` through `FIX22-V7` below are plan-local acceptance cases, not new QAD identifiers. This document changes no application code, tests, database schema, dependencies, or customer data.

---

## 2. Confirmed Findings and Evidence Boundary

| Evidence | Consequence |
|---|---|
| The user supplied paired Sliding Window screenshots with **SW Frame Left** at **Standard Base** and at **Standard +₱357**. The selected specification changes from `1-3/4" x 3" Aluminum Tube` to `1-3/4" x 4" Aluminum Tube`, and the user confirmed an unwanted model color change. The user clarified that all 3D material appearance properties should remain stable. | Treat the visible recolor as the reproduction case and the other shader properties as part of the requested invariant. Preserve the specification and price effects of this same choice. |
| In the open Brave workspace, **SW Frame Bottom** alternatives changed the visible price from ₱18,084.49 to ₱18,326.49 or ₱17,648.89. A glass-part alternative changed the specification and price as well. All choices were returned to **Standard Base**, restoring ₱18,084.49. | The existing material and pricing behavior is an explicit regression baseline, not a target for correction. |
| `PartMaterialsPicker.tsx` calls `handleSelectPartMaterial` in `ProductModelWorkspace.tsx`. That handler writes `selectedMaterials`, calls `ProductModelRenderer.updateCustomMaterials(...)`, renders the model, and increments `modelRevision`. | A per-part specification change directly mutates and redraws the 3D materials. |
| `modelRenderer.ts` calls `updateCustomMaterials(...)` again from `loadModel()` when `hasExplicitOverrides` is true. `updateCustomMaterials(...)` applies `applyPBRToMesh(...)` to meshes mapped to selected material IDs. `materialClassifier.ts` copies raw material color and other PBR properties into the mesh materials. | Both the immediate click and rebuild or restore can change the 3D appearance. Both paths need the same separation. |
| `selectedMaterials` feeds the workspace BOM, saved configuration, quotation details, and restoration path. Dedicated appearance controls call `applyWorkspacePresentation()` and `updatePresentation(...)`. | Leave selection, pricing, and storage flows untouched. Resolve 3D material appearance from the active presentation choices. |
| `docs/implementation/ms66.md` `QAD-TC81.3` expects a grouped Powder Coated White choice to recolor the frame. `docs/implementation/fix-12.md` permits an explicit per-part override to apply raw material PBR. | Reconcile the per-part visual override rule while preserving the grouped visual-finish acceptance case and all existing price and specification requirements. |

The user's screenshots and report establish the visual regression case. The code path explains why other shader properties can change as well, although those properties were not measured in the screenshots. The implementation pass should use the same **SW Frame Left** choice to capture a controlled before-and-after appearance comparison, without changing the existing specification or price calculation.

---

## 3. Planned Implementation Contract

1. Clarify the visual acceptance language in `fix-12.md` and `IMP-MS66`: a per-part raw material choice changes fabrication specification and price but does not change 3D material appearance. Keep `QAD-TC81.3` for intentional grouped visual-finish changes. Add a per-part appearance-invariance acceptance case without revising pricing or material-selection requirements.
2. Capture a controlled baseline using the user's **SW Frame Left** example. Record the selected material ID, displayed specification, live price, active appearance controls, and rendered frame and glass material properties before and after choosing **Standard +₱357**. Include color, metalness, roughness, transmission, opacity, and texture where applicable, then return to **Standard Base**.
3. Keep `selectedMaterials` as the authoritative per-part input for specification, BOM, quotation, and persistence. In the live per-part selection path, stop raw material PBR values from overriding the active 3D presentation. Remove or bypass only the per-part visual mutation; do not remove material selection, pricing updates, or grouped and dedicated visual controls. Do not alter picker behavior, BOM, price, or quotation code.
4. Apply the same rule when `loadModel()` rebuilds a model, a saved configuration is restored, or an existing placed product is edited. A non-default per-part selection must not cause a delayed PBR overwrite. Separate the meaning of a pricing/specification override from any visual override instead of treating `hasExplicitOverrides` alone as permission to restyle meshes. Keep the dedicated appearance controls visually effective and scoped to the correct product.
5. Add focused behavior tests for frame and glass material appearance before and after a per-part choice, model rebuild, and restored configuration. Assert that the existing selected IDs, part specifications, option labels, price deltas, calculated quotation, and saved material values are unchanged from the baseline. Keep grouped finish and dedicated appearance-control tests passing. Preserve current geometry, placement, perspective fit, and occlusion behavior.

Before changing Next.js code, read the relevant installed guide in `node_modules/next/dist/docs/`. Reuse the current visualization presentation mapping and Three.js materials. No new library, migration, CV change, pricing change, or UI change is expected.

---

## 4. Agent Delegation Before Implementation

The initial investigation and delegation breakdown were read-only. The following assignments are for a later implementation pass; no implementation agent was started for this plan.

| Agent | Later responsibility | Ownership |
|---|---|---|
| `spec-architect` | Reconcile the per-part PBR override rule in `IMP-MS66` and `fix-12`, keeping their specification and pricing contracts intact. | Visual acceptance wording only. |
| Visualization-focused `frontend-developer` | Own the workspace and renderer boundary for per-part appearance on immediate selection and rebuild/restore. | `ProductModelWorkspace.tsx`, `modelRenderer.ts`, and only narrowly required visualization helpers; one owner holds production visualization edits. |
| `qa-expert` | Add appearance regressions and verify existing specification and price values stay unchanged. | Focused tests and browser evidence using the user's Sliding Window example. |
| `code-reviewer` | Check that the final diff changes only per-part visual behavior and its tests/spec wording, with no pricing or specification regression. | Read-only final review. |

---

## 5. Verification and Acceptance

| Case | Required result |
|---|---|
| FIX22-V1: Frame appearance | In the user's Sliding Window case, change **SW Frame Left** from **Standard Base** to **Standard +₱357**. The frame's color, metalness, roughness, opacity, texture, and other applicable shader properties remain governed by the active appearance controls immediately and after redraw. |
| FIX22-V2: Specification and price guard | The same choice retains its existing material ID, `1-3/4" x 4" Aluminum Tube` specification, option label, BOM calculation, and live price. Returning to **Standard Base** restores the prior material ID, `1-3/4" x 3" Aluminum Tube` specification, and prior price. No pricing or specification source file changes. |
| FIX22-V3: Glass appearance | A per-part glass raw material choice leaves the active glass tint, transmission, opacity, roughness, texture, and other optical preview properties unchanged. Its existing specification and price effects remain intact. |
| FIX22-V4: Rebuild and restore | A dimension-triggered rebuild and restored or edited placed product retain the chosen part material ID and price but do not restyle the model from that raw material. |
| FIX22-V5: Intentional appearance controls | Aluminum Finish, Glass Type, Advanced Glass Appearance, Glass Color, Glass Thickness, and grouped visual-finish choices still change the intended model appearance. |
| FIX22-V6: Visual parity | Live canvas, Apply Changes, Save Snapshot, and comparison show the same presentation materials. The appearance correction does not introduce any change to current geometry, placement, perspective fit, or occlusion behavior. |
| FIX22-V7: Quality gates | Run focused `npm run test:ms66` and `npm run test:fix12`, relevant renderer and pricing regressions, `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Verify `QAD-TC81` and `QAD-TC82` under the clarified appearance contract. |

---

## 6. Execution Order and Completion Gate

1. Clarify the per-part appearance rule in the visual acceptance text while retaining specification and pricing requirements.
2. Capture the user's **SW Frame Left** case with its appearance, specification, and price baseline.
3. Separate per-part specification and pricing selection from 3D material presentation on live, rebuild, and restore paths; add focused regressions.
4. Run the quality gates, compare the before-and-after browser image and material properties, and complete independent review.

The fix is complete only when per-part choices no longer change the 3D product's material appearance, while their existing specification and price behavior and all intentional appearance controls still work.

## Self-Check

- [x] Uses the next numbered `fix-##.md` convention and upstream requirement IDs.
- [x] Uses the user's paired Sliding Window screenshots as the visual reproduction case.
- [x] Covers all 3D material appearance properties, with specification and price as unchanged regression guards.
- [x] Identifies the old visual acceptance conflict and assigns narrow documentation reconciliation before coding.
- [x] Defines agent ownership and measurable appearance acceptance.
- [x] Adds no runtime implementation, test change, dependency, migration, or customer data.
