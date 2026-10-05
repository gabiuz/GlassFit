# MS-45: Preview-Preserving Material Mapping

**Project:** GlassFit  
**Version:** 2.0.0  
**Date:** October 6, 2026  
**Status:** Implemented; manual admin acceptance pending  
**Traceability:** `PRD-F14`, `SDD-C9`, `DSD-UI10`, `ERD-E6`, `ERD-E17`, `QAD-TC16`, `QAD-TC19`, `QAD-TC60`  
**Visual references:** [material mapping](mockups/ms45-preview-preserving-mapping.svg), [pricing drivers](mockups/ms45-pricing-driver-review.svg)

## Requirement

Administrators need to assign catalog materials to many uploaded components without repeating the Part Inspector dropdown workflow. The 3D model preview must stay visible while they work. Width, Height, Area, and Fixed pricing drivers must remain separately editable because parts using the same material can have different billable dimensions.

This release applies to the Components step of `/admin/products/[productId]/setup`. It does not change catalog CRUD, GLB upload and decomposition, 3D rendering, the pricing engine, database schema, or the `upsertProductComponent` action payload.

## Implemented workflow

1. The existing upload area, summary banner, 60/40 split, 3D viewport, and component table remain in place.
2. The right panel has `Map Materials`, `Pricing Drivers`, and `Part Settings` tabs. The 3D preview remains visible when switching tabs.
3. Selection is shared by the 3D viewport, table checkboxes, and right panel. In Map Materials and Pricing Drivers, each model click toggles one target without requiring Shift. The Map Materials tab also offers `Select N unlinked` for a presentation category.
4. Active catalog materials are searchable by code, description, category, and finish. The current selection's detected category is displayed as a hint. All active categories remain available.
5. The admin chooses a material first, then clicks multiple model parts to target them and applies it once. Selecting a new material clears the prior target selection. The chosen material stays active while targets change. Selected linked parts are explicitly replaced on Apply, with a warning shown before applying. A single selected linked part may also be unlinked.
6. Material assignment changes only `rawMaterialId`. In Pricing Drivers, the admin chooses Width, Height, Area, Fixed, and optionally a span ratio before selecting multiple model parts. The driver draft remains active as targets change and requires a separate Apply action. The panel shows current values, including `Mixed` for differing selections. The table also supports a direct single-row driver edit.
7. Material and driver edits mark changed components `Unsaved`. Existing Save Component Changes and Continue actions persist them. The table and banner show missing, inactive, or unavailable material links with text and color. Missing links remain advisory because free components are allowed.
8. The Part Settings tab retains the remaining inspector controls and read-only material and driver summaries that lead back to the focused tabs.

## State and safety rules

- `MappedFile.suggestedMaterialCategory` is derived from filenames, decomposition node names, and database-loaded component names. It is UI-only and does not change the saved schema.
- `getRawMaterials()` loads active and inactive catalog records so existing inactive links are identifiable. Only active materials may be newly assigned. A failed catalog load is a distinct error with Retry; it is not treated as an empty catalog.
- Material targets are explicit IDs. The assignment handler validates an active material, updates only those IDs in one functional state update, and leaves `dimensionBinding` and `spanRatio` intact. Linked parts require an explicit replacement checkbox.
- Pricing-driver targets are explicit IDs. The handler updates only the supplied driver and/or ratio values and leaves `rawMaterialId` intact. The span ratio is limited to 0 through 10.
- Choosing a different catalog material clears the current target selection. Model clicks explicitly add or remove linked and unlinked targets. The active material and driver draft remain available while the target selection grows.
- The 3D preview remains interactive in assembled and exploded modes. Its selection highlight stays synchronized with the table and right panel.

## Acceptance checks

| ID | Check | Trace |
|---|---|---|
| MS45-AC1 | Choose an active material, then click several model parts without Shift and apply once. Only highlighted parts change; preview and table selection agree. | PRD-F14, DSD-UI10 |
| MS45-AC2 | A selected linked part shows a replacement warning and receives the chosen material on Apply. A single selected linked part can be unlinked. | ERD-E6 |
| MS45-AC3 | Search matches code, description, category, and finish. No match and catalog load error are distinct. Inactive material records remain visible as existing links but are not selectable. | ERD-E17 |
| MS45-AC4 | Assigning a material preserves every target's Width, Height, Area, or Fixed driver and span ratio. | QAD-TC16 |
| MS45-AC5 | Choose a driver before selecting multiple model parts. The driver draft persists while model clicks add targets. Apply changes only those parts, while material IDs remain unchanged. Mixed selections show Mixed and a single table-row driver edit changes only that row. | DSD-UI10 |
| MS45-AC6 | Changed rows show Unsaved, persist through Save or Continue, and remain correct after returning to the Components step. | QAD-TC19 |
| MS45-AC7 | The 3D viewport remains visible and interactive while all three right-panel tabs are used. Existing upload and decomposition flows still work. | DSD-UI10, QAD-TC16 |
| MS45-AC8 | Missing, inactive, and unavailable links are called out without claiming the full quote is zero; free components remain allowed. | PRD-F14 |
| MS45-AC9 | Lint of edited files, TypeScript, and production build pass. Complete authenticated browser acceptance using the scenarios above. | QAD-TC60 |

## Files

- `src/features/admin/products/setup/StructuralComponentsSection.tsx`
- `src/features/admin/products/setup/PartInspectorDrawer.tsx`
- `src/features/admin/products/setup/components/ComponentMappingPanels.tsx`

No new package, migration, server action parameter, or pricing rule was introduced.
