# Implementation Specification: Prevent Grouped Finishes from Reapplying Per-Part Raw Material Appearance (fix-20)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document ID:** fix-20
**Document Function:** Pre-merge fix plan for keeping grouped visual finishes separate from per-part fabrication selections
**Version:** 1.0.0
**Date:** November 3, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Implemented on `fix/mats-by-part`; browser acceptance and merge review pending
**Primary Traceability:** `BRD-M4`, `PRD-F6`, `PRD-F7`, `PRD-F10`, `SDD-C5`, `SDD-C7`, `DSD-UI4`, `ERD-E11`, `QAD-TC81`, `QAD-TC82`
**Upstream Specifications:** `docs/brd-glassfit.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/erd-glassfit.md`, `docs/qad-glassfit.md`, `docs/implementation/ms66.md`, `docs/implementation/fix-12.md`, `docs/implementation/fix-19.md`
**Comparison Base:** `dev` at `ac21d04`; reviewed `fix/mats-by-part` at `f119d7d`. Refresh both refs before implementation.

---

## 1. Required Outcome and Scope

In `/visualize/[productId]/workspace`, a per-part raw material selection must continue to control its fabrication specification, selected material ID, BOM, quotation, and saved configuration without changing 3D appearance. A later grouped finish choice may intentionally change the appearance of its own affected components, but must not turn earlier per-part choices outside that group into renderer PBR overrides. The same rule must hold immediately, after a dimension-triggered rebuild, and after a placed configuration is restored.

This plan closes the interaction gap left by `fix-19` before merging `fix/mats-by-part` into `dev`. It covers the boundary among `selectedMaterials`, grouped visual selections, and renderer input. It also calls for explicit review of the observed dedicated Aluminum Finish behavior, which resets a frame-part material selection, before deciding whether that existing synchronization matches the product contract. `FIX20-V1` through `FIX20-V8` below are plan-local acceptance cases, not new QAD identifiers. This document changes no runtime code, tests, dependencies, schema, migrations, or customer data.

---

## 2. Confirmed Findings and Evidence Boundary

| Evidence | Consequence |
|---|---|
| `handleSelectPartMaterial` in `ProductModelWorkspace.tsx` now updates `selectedMaterials` without calling `updateCustomMaterials`. The renderer rebuild receives the separate `visualMaterialOverrides` map. | A direct per-part choice is isolated from visual material application in the paths covered by `fix-19`. |
| `handleSelectMaterialOption` passes the complete `selectedMaterials` map to `applyGroupSelection`, then stores the complete returned map in `visualMaterialOverrides` and passes it to `updateCustomMaterials`. `applyGroupSelection` clones the incoming map and changes only keys affected by the chosen group. | Per-part choices outside the group survive in the returned map and can become visual overrides. A glass-part choice followed by a framing-group choice can apply that glass raw material's PBR properties to the glass mesh. |
| `modelRenderer.ts` applies raw material PBR properties for every mapped key supplied to `updateCustomMaterials`; `loadModel()` reapplies the visual map when `hasExplicitOverrides` is true. | The leak can affect the immediate preview and persist through a rebuild. Clearing only the live renderer call is insufficient. |
| The new `QAD-TC82` assertion checks source text around the direct per-part handler and the separate rebuild input. It does not execute a per-part choice followed by a grouped choice. | Passing focused tests cannot establish that this action order is safe. Add behavior-level and rendered-appearance evidence. |
| In the local Sliding Window browser review, selecting **SW Frame Left** `1-3/4" x 4" Aluminum Tube` changed its specification and the displayed live price by ₱120. A glass-part selection remained selected after a width change. The grouped panel exposed only standard choices for this catalog entry. | Direct selection and rebuild have partial browser evidence; the grouped interaction still needs a product or controlled fixture with at least two grouped options. The price example is catalog and dimension dependent, not a universal acceptance constant. |
| In the same review, changing dedicated Aluminum Finish to Black visibly changed the frame and returned the earlier **SW Frame Left** material choice to its default. The current dedicated-finish handler explicitly synchronizes framing entries in `selectedMaterials`. | Establish whether this is intended specification synchronization under `MS66` and `fix-12` before changing it. Record its price, selected ID, and saved-value effects; do not silently redefine dedicated-control behavior as part of the grouped-finish correction. |
| `fix-19.md` still reports `Ready for Implementation; plan only` although the branch contains its runtime and test changes. | Reconcile the prior plan's status and evidence when this fix is implemented. Do not mark browser acceptance complete from source assertions alone. |

The grouped-finish leak follows from the confirmed data flow. Its visible shader effect has not been reproduced in the current local catalog because no alternate grouped choice was available. The implementation pass must demonstrate the sequence with a configured product or deterministic fixture and record before-and-after material properties.

---

## 3. Planned Implementation Contract

1. Capture a baseline with a product that offers both a non-default per-part glass material and an alternate grouped framing finish. Record the part material IDs, specifications, live and calculated price, active presentation controls, frame and glass shader properties, and current `visualMaterialOverrides` before and after each action. Repeat the inverse order and a framing-part choice followed by a glazing-group choice.
2. Define a typed ownership rule for renderer overrides: `selectedMaterials` remains the complete fabrication and pricing map, while grouped visual overrides contain only component keys intentionally affected by grouped appearance actions. Derive the grouped override from the selected group's affected keys and chosen option, not from a copy of all current per-part selections. Preserve deliberate grouped selections across later per-part edits, rebuilds, and restoration according to the existing persistence contract.
3. Apply the same scoped visual map to immediate `updateCustomMaterials` calls and `loadModel()` rebuild input. Verify that `hasExplicitOverrides` cannot cause the full fabrication map to be reapplied through another path. Preserve dedicated appearance controls, existing presentation precedence, and product isolation for multiple placed products.
4. Determine the intended contract for dedicated Aluminum Finish and other appearance controls that synchronize raw material IDs. If current specs require those controls to alter fabrication selections, document that behavior and protect it with a test. If they are presentation-only, plan and implement the smallest separately traceable correction with explicit pricing and persistence acceptance. Do not conflate this decision with the grouped-finish leak or silently discard a user's per-part specification.
5. Add a behavior-level regression that performs the real selection sequence and inspects the renderer's applied material properties, then repeats after dimension rebuild and configuration restore. Cover both framing and glazing, default/reset behavior, grouped selection changes, and appearance-control precedence. Keep the existing option eligibility, BOM, quotation, and `selected_materials` storage tests passing. Source-pattern assertions may remain as supplementary checks only.
6. Reconcile `fix-19.md` and any affected `MS66` or `fix-12` acceptance wording with the measured implementation state. Keep documentation status separate from user-visible acceptance until the browser matrix passes.

Before changing Next.js code, read the relevant installed guide in `node_modules/next/dist/docs/`. Reuse current visualization services, Three.js materials, components, and design tokens. No new library, database migration, CV change, or pricing formula change is expected.

---

## 4. Agent Delegation Before Implementation

The pre-merge review and this plan are read-only. No implementation agent was started for `fix-20`.

| Agent | Later responsibility | Ownership |
|---|---|---|
| Visualization-focused `frontend-developer` | Own the selection-to-renderer boundary, scoped grouped visual map, and rebuild and restore behavior. | `ProductModelWorkspace.tsx` and only narrowly required visualization helpers. One owner holds production visualization edits. |
| `qa-expert` | Build a configured action-order fixture, add rendered behavior regressions, and record browser appearance, pricing, and persistence evidence. | Focused tests and acceptance evidence. |
| `spec-architect` | Resolve dedicated appearance-control synchronization and reconcile `fix-19`, `MS66`, and `fix-12` wording with verified behavior. | Specification and status wording only. |
| `code-reviewer` | Check scope of visual overrides, material ownership, pricing and storage parity, and final `dev` integration. | Read-only final review. |

---

## 5. Verification and Acceptance

| Case | Required result |
|---|---|
| FIX20-V1: Glass then framing group | Select a non-default glass-part raw material, then a non-default framing-group finish. The framing changes appearance as intended; glass color, tint, metalness, roughness, transmission, opacity, texture, and other applicable visual properties remain governed by active glass appearance controls. The glass ID, specification, and price contribution remain selected. |
| FIX20-V2: Framing then glazing group | Select a non-default frame-part raw material, then a non-default glazing-group finish. The glazing changes appearance as intended; the frame's preview remains governed by its active aluminum appearance controls. The frame ID, specification, and price contribution remain selected. |
| FIX20-V3: Order and reset | Repeat each sequence in reverse order, change the grouped choice twice, return a per-part choice to Base, and use Reset Defaults. Only intended visual targets change; selection counts, labels, IDs, and prices match the current specification state. |
| FIX20-V4: Rebuild and restore | Dimension changes, edited placed products, and restored configurations retain intended part specifications, grouped appearance, quotation values, and selected IDs without applying unrelated per-part PBR properties. |
| FIX20-V5: Dedicated controls | Aluminum Finish, Glass Type, Advanced Glass Appearance, Glass Color, and Glass Thickness visibly affect their intended meshes. Record and resolve whether changing Aluminum Finish should also reset a frame-part material ID and price under the existing specification contract. |
| FIX20-V6: Output parity | Live canvas, Apply Changes, Save Snapshot, and comparison use the same frame and glass presentation. Multiple products, placement, perspective fit, occlusion, and exported guide exclusion remain correct. |
| FIX20-V7: Pricing and storage guard | BOM, live price, quotation, and saved `selected_materials` reflect fabrication choices and any documented dedicated-control synchronization. No pricing formula, material eligibility, or schema changes are introduced by the grouped visual fix. |
| FIX20-V8: Merge quality | Run `npm run test:ms66`, `npm run test:fix12`, relevant renderer and pricing regressions, `npm run lint`, `npx tsc --noEmit`, and `npm run build` on the combined tree. Verify `QAD-TC81` and `QAD-TC82`, record browser evidence, reconcile `fix-19` status, and review the final diff against refreshed `dev`. |

---

## 6. Execution Order and Completion Gate

1. Refresh the branch comparison and reproduce both cross-group action orders with a catalog configuration that exposes alternate grouped choices.
2. Establish the visual-override ownership rule and the separate dedicated-control specification contract.
3. Implement the scoped grouped map and add rendered behavior regressions for live, rebuild, and restore paths.
4. Complete browser and output acceptance, run quality gates, reconcile prior plan status, and review the final diff before merge.

The branch is merge ready only when grouped choices restyle their intended parts without importing unrelated per-part raw material appearance, specification and pricing behavior is explicit and preserved, and the required browser and quality evidence passes.

## Implementation evidence (November 3, 2026)

The grouped selector now builds a renderer override map from the chosen group's affected component keys. The complete `selectedMaterials` map remains the fabrication and pricing source. The scoped visual map is stored separately in `ProductConfigurationSnapshot`, restored for placed products, and supplied to model rebuilds. Comparison rendering retains non-framing grouped overrides while its explicit aluminum finish controls the frame. Dedicated Aluminum Finish synchronization remains as specified in `fix-12`: a matching finish can update framing material IDs and price.

`npm run test:ms66` passes 12 tests, including rendered Three.js material assertions for both cross-group action orders. `npm run test:fix12` passes 8 tests. `npx tsc --noEmit` and `npm run build` pass. The cross-group browser sequences, saved snapshot appearance, and final `dev` merge review are not yet evidenced.

`npm run lint` exits successfully with 19 existing warnings. Focused renderer and pricing regressions pass 47 tests. The CV health endpoint returns `{"status":"ok"}`.

### Brave workspace check

In the local Sliding Window workspace on November 3, 2026, changing **SW Glass Left** from Standard Float Glass Sheet to Jalousie Louver Glass Blade changed the displayed specification and price from ₱19,763.00 to ₱16,515.23 while the visible glass preview remained stable. Changing width from 242 cm to 243 cm retained that part choice and updated the price to ₱16,549.50. Width and the glass part were returned to their initial values, restoring ₱19,763.00 and the prior count of 3 customized parts. This catalog configuration exposed no alternate grouped framing or glazing choice, so the cross-group browser sequence, grouped restore, and output parity remain unverified. The focused Three.js tests cover both action orders on configured material fixtures; they do not replace this browser acceptance.

## Self-Check

- [x] Uses the next numbered `fix-##.md` convention and upstream requirement IDs.
- [x] Separates confirmed code-path findings from browser paths that remain unverified.
- [x] Covers both action orders, rebuild, restore, dedicated controls, pricing, and output parity.
- [x] Defines agent ownership and measurable merge acceptance.
- [x] Adds no runtime implementation, test change, dependency, migration, or customer data.
