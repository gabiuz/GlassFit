# MS-46: Duplicate Whole Product on a Logic Rule Threshold or Step Loop

**Project:** GlassFit  
**Version:** 3.0.0  
**Date:** October 6, 2026  
**Status:** Ready for implementation  
**Traceability:** `BRD-M2`, `BRD-M4`, `PRD-F5`, `PRD-F6`, `PRD-F10`, `PRD-F14`, `SDD-C4`, `SDD-C5`, `SDD-C7`, `SDD-C9`, `DSD-UI4`, `DSD-UI7`, `DSD-UI10`, `ERD-E5`, `ERD-E7`, `QAD-TC62`

## Required outcome

In **Admin Product Setup > Parameters and Logic Rules**, a manager can select **Duplicate Whole Product** as the THEN action of a threshold (WHEN/THEN) or Step Loop rule. When a customer's configured width or height matches that rule, the workspace offers a choice to split the opening into identical, independently editable instances of the **entire product**. Acceptance creates real product overlays, each with its own complete model image, configuration, BOM, and price. Declining leaves the source unchanged. Duplication is never automatic.

Example: `WHEN width > 3600 mm THEN Duplicate Whole Product along width, maximum 3600 mm per product` offers two 2500 mm Sliding Windows for a 5000 mm opening. Each retains the same height, glass, finish, panel settings, and other configuration.

## Current implementation facts and plan corrections

| Fact | Consequence |
|---|---|
| `RuleActionData` already permits arbitrary strings and `structural_rules.action_data` is JSONB. | A union change alone is insufficient. Add a distinct action contract, UI, client/server validation, and round-trip loading. No migration is needed (`ERD-E7`). |
| Workspace dimensions are stored in cm; structural `visualParameterValues.width/height` are mm. | Compare threshold and cap in the selected parameter's declared unit, and convert once at the workspace boundary. Never compare cm to mm. |
| MS-43 permits null `maximum_value` for dimensions. | Require an explicit positive **Maximum per product** in the action. Read the raw configured dimension before resolver clamping can hide a breach. |
| `modelRenderer` calls `resolveProductStructure`; the workspace guardrail handler is separate and opens only for a hard-coded 2-panel width limit. | Evaluate duplication rules in the workspace even when that guardrail is absent. Preserve the existing guardrail. |
| There is no `commitPlacedOverlay` API. `createPlacedOverlay` captures the active product as a full-canvas image; `onPlacedOverlaysChange` publishes placed layers. | Render, capture, price, and identify every split instance separately, then publish the complete list once. Shallow copying an overlay repeats the unsplit image and price. |
| `QAD-TC60` and `QAD-TC61` already have other meanings. The builder offers `set_visibility`, but its flat resolver path does not execute it. | Use `QAD-TC62`. Preserve existing action behavior without claiming to fix `set_visibility` here. |

## Rule contract and validation

The action is available only for **Parametric** products and `when_then` or `loop` rules. The admin selects a numeric `width` or `height` parameter. The condition parameter and split axis must be the same. For thresholds, the operator is `>` or `>=`, exactly as displayed. For loops, the start is finite and nonnegative and the step is finite and positive. A proposal requires both a matching condition **and** a raw dimension above the per-product maximum. Thus `>` at 3600 mm does not fire at exactly 3600 mm. The same-axis requirement prevents a height breach from unexpectedly splitting width.

Persist the action in the existing JSONB field:

```json
{
  "target_type": "product",
  "action_type": "duplicate_product",
  "split_axis": "width",
  "max_per_instance": 3600
}
```

`max_per_instance` is required, finite, positive, and expressed in the selected parameter's unit, falling back to the template measurement unit only if that parameter has no unit. Display the unit beside the WHEN value and cap. A product action has no `target_key` or quantity `value`. Switching action types must remove incompatible fields. Existing component and parameter actions must load and save unchanged.

Validate in the builder and in `upsertParametersAndRules`: numeric recognized dimension, matching axis, allowed threshold operator and value or valid loop start and step, positive finite cap, and cap at least the parameter minimum. Reject invalid product rules with an explicit message. Auto-save must not silently filter them out. Run server validation **before** the current delete-and-reinsert operation, so an invalid rule cannot erase saved rules. Keep the existing `requirePermission("manage_products")` authorization and authenticated Supabase client.

## Proposal calculation (`SDD-C4`)

Add pure typed proposal selection near `structuralResolver.ts`, called with the current definition and **raw** configuration. Do not mutate the source values or legacy component/parameter rule output. The proposal carries rule ID/name, axis, original mm, cap mm, count, piece mm, and a source configuration/definition fingerprint. Sort matching product rules by priority ascending, then rule ID ascending; present the first valid one. Report a specific nonblocking reason when a matched rule is invalid or infeasible. A loop product action runs after at least one complete step above its start.

For thresholds, calculate `count = ceil(original / cap)`. For Step Loops, calculate `count = 1 + floor((original - start) / step)` after at least one complete step. Then calculate `piece = original / count`. Require `2 <= count <= 10`, finite positive values, piece at or below cap, and piece within the parameter's min/max. Require exact representation at that parameter's step and workspace dimension precision while preserving the total opening size. Do not round, clamp, or make unequal pieces while labeling them identical. If the split piece would immediately satisfy the same duplication rule and still exceed its cap, suppress the proposal as a configuration error.

Re-evaluate after a dimension or product change. An unchanged dismissed proposal must not reopen continuously. On acceptance, recheck the fingerprint to reject stale proposals.

## Admin UI (`DSD-UI10`)

Add **Duplicate Whole Product** to the THEN action selector of Threshold (WHEN/THEN) and Step Loop. Selecting it sets target type to `product`, hides component/parameter target and quantity controls, and shows **Split dimension** (Width/Height) and **Maximum per product** with its unit. Selecting an axis also selects that dimension for WHEN. Provide a readable preview such as `For a 5000 mm opening: 2 products at 2500 mm each`. Disable save for invalid product rules and show the error using established admin styling. Switching a product action between rule modes keeps its axis and cap. Switching to a component action removes product-only fields. Reloading the wizard restores operator, threshold, axis, cap, and priority.

## Workspace choice and placement (`SDD-C5`, `DSD-UI4`, `DSD-UI7`)

Offer **Split into N products** for a valid rule even without the hard-coded 2400 mm guardrail, including height rules. A duplication-only prompt uses product-neutral copy and omits Series 798 span text. Show the full opening, count, piece dimension, and that each result is a separate product. Existing 3-panel and waiver options appear only when their guardrail applies. Dismissal changes neither product nor waiver. Do not call splitting structurally safe until each piece passes the relevant checks.

On acceptance, stage N complete instances of the same product definition. Snapshot all source settings, set the split `widthCm` or `heightCm` and matching `visualParameterValues` on each, preserve the source `quantity`, and assign unique overlay IDs and layer numbers. A source quantity of Q means Q identical openings and produces N separately priced split entries, each with quantity Q; the total represents N × Q manufactured units. Preserve the other dimension, materials, glass, panel settings, orientation, realism, and occlusion. Divide the original opening footprint into N adjacent regions in order. For a perspective-fitted quadrilateral, subdivide the corresponding edge pairs so each piece has its own fitted region. If the regions cannot fit without overlap or canvas overflow, show an actionable error and retain the original.

Render and capture each instance from its own split configuration and region. Each `PlacedOverlay.flattenedImageDataUrl` is a full-canvas cached bitmap: copying the source image or only changing its metadata is invalid. Give each instance its own variation recipe, cache identity, BOM, and price. The workspace may keep one instance active and add N-1 to `placedOverlays`, provided snapshot, comparison, measurement, quotation, and totals include all N **exactly once** and exclude the original unsplit item. Render sequentially/offscreen to preserve the single-active-WebGL requirement.

Prepare all geometry, images, asset references, BOMs, prices, and overlay records before publishing session state. If any stage fails, discard staged assets, keep the original product and placed list, and show a retryable error. Commit once through `onPlacedOverlaysChange` and the established active-product state path. Recheck span, roller load, and aspect warnings for each piece; clear a source structural waiver only when applicable checks pass. Every instance remains separately selectable, editable, and deletable. Later measurement edits to one item must update that item's rule/guardrail result and final quotation price.

## Implementation sequence

1. Define and validate the tagged action in `src/lib/admin/products/parameterMutations.ts`; update `src/features/admin/products/setup/ParametersAndRulesSection.tsx` and rule loading.
2. Add proposal types to `src/lib/visualization/types.ts` and pure selection logic in `src/lib/visualization/structuralResolver.ts` or a focused adjacent module. Keep `modelRenderer` free of placement side effects.
3. Integrate product-rule prompts into `src/features/visualization/components/ProductModelWorkspace.tsx` and adapt `StructuralGuardrailModal.tsx` for duplication-only and combined states. Change `guardrailEngine.ts` only if its type is deliberately extended.
4. Stage per-instance geometry, render/capture, variation assets, pricing, and a single session commit. Update comparison, measurement, snapshot, and quotation adapters where verification reveals a distinct-instance gap.
5. Add focused rule tests and workspace integration tests for acceptance, rollback, and totals. Run `npm run lint`, `npx tsc --noEmit`, and `npm run build`; complete desktop/mobile `QAD-TC62` browser checks. CV health is outside this milestone unless CV integration is changed.

## Acceptance criteria (`QAD-TC62`)

| ID | Required result |
|---|---|
| MS46-AC1 | Admin selects **Duplicate Whole Product** under a threshold or Step Loop rule, saves, reloads, and sees the same operator, threshold, axis, cap, and priority. Invalid rules are rejected without deleting saved rules. |
| MS46-AC1a | A Step Loop with start 3600 mm and step 1400 mm offers two products at 5000 mm, none before the first completed step, and one additional product after each later completed step when equal pieces meet the cap and precision rules. |
| MS46-AC2 | Width `> 3600 mm`, cap `3600 mm`, and input `5000 mm` yield exactly one proposal for two identical 2500 mm products. Input `3600 mm` yields none. `>=` obeys its displayed operator and still requires input above cap. The source dimension is unchanged by evaluation. |
| MS46-AC3 | A valid rule prompts without a Series 798 warning. Decline leaves one unsplit product, its price, and waiver unchanged; changing dimension yields a fresh proposal. |
| MS46-AC4 | Accept creates two adjacent, separately rendered, independently editable 2500 mm products with inherited settings and no 5000 mm item. Distinct IDs, images/assets, BOMs, and prices appear exactly once in snapshot, comparison, measurement, and quotation totals. |
| MS46-AC5 | Height-axis and perspective-fit examples tile the original region without duplicated images or overlap. The nonsplit dimension and other settings are retained. |
| MS46-AC6 | Min/max/step/precision conflicts, more than ten pieces, no canvas space, and repeat-triggering rules give specific reasons. Failed render/price stages leave no partial product or asset residue. |
| MS46-AC7 | Combined span guardrail and product rule show only applicable choices. Accepted pieces receive fresh span/load/aspect checks; existing 3-panel and waiver behavior remains correct. |
| MS46-AC8 | Existing component quantity and parameter-value rules resolve as before. Later measurement edits and separate edit/delete of duplicates preserve per-item prices and totals. |
| MS46-AC9 | Lint, typecheck, build, focused automated tests, and manual desktop/mobile `QAD-TC62` pass. |

## Scope boundary

This action creates complete instances of one parametric product in the current workspace. It does not create a new catalog product, change the template or rule, duplicate only panes/components, or automatically split fixed-model assets. No migration or new dependency is expected.
