# Implementation Specification: Comparison Label, Catalog Filter, and Mobile Admin Layout Fixes (fix-ui9)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document Function:** Implementation-ready plan for five reported frontend defects
**Version:** 1.0.0
**Date:** October 30, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Ready for Implementation
**Upstream Specifications:** `docs/brd-glassfit.md` (BRD-M4), `docs/prd-glassfit.md` (PRD-F1, PRD-F14, PRD-F15, PRD-F16), `docs/sdd-glassfit.md` (SDD-C1, SDD-C5, SDD-C9), `docs/dsd-glassfit.md` (Section 2, DSD-UI1, DSD-UI9, DSD-UI14), `docs/qad-glassfit.md` (QAD-TC1, QAD-TC14, QAD-TC27, QAD-TC28, QAD-TC51, QAD-VG4)
**Implementation State:** Implemented in the current checkout. Browser verification of protected admin pages and physical-device acceptance remain pending.

---

## 1. Authorized Requirements

1. [Issue #203](https://github.com/gabiuz/GlassFit/issues/203): Give the comparison label room around its text and improve contrast against the gray pill. Long variant names must remain readable without covering adjacent controls.
2. [Issue #199](https://github.com/gabiuz/GlassFit/issues/199): Let a customer deselect the active product category, returning the public catalog to its unfiltered category state.
3. [Issue #181](https://github.com/gabiuz/GlassFit/issues/181): Correct the mobile Staff Accounts **Created** date layout so a date is readable as one coherent value.
4. [Issue #179](https://github.com/gabiuz/GlassFit/issues/179): Prevent the admin product status badge and row actions from overlapping on a phone.
5. [Issue #177](https://github.com/gabiuz/GlassFit/issues/177): Make the admin product filter's result and no-match feedback fully visible and understandable on a phone.
6. Follow-up screenshot supplied in this task: Keep the public catalog card's **Visualize** action inside the card with the same right inset as the left inset around **View Product**.

The five linked GitHub issues are the requirement source. Their screenshots show symptoms, not proven root causes or instructions embedded in the images. The supplied Batch Price Adjustment image does not match the GitHub screenshot for #181, which shows Staff Accounts dates; this plan follows #181's linked issue and leaves the materials dialog outside scope. No application code is authorized in this planning pass.

---

## 2. Evidence and Reproduction

| Issue | Screenshot and current source evidence | Reproduce before editing |
|---|---|---|
| #203 | The issue image shows a light-gray **Comparing:** pill close to a cyan neighboring control, with white text that is hard to read. `src/features/comparison/components/Comparison.tsx` renders a gray `#c3c3c3` pill, white `whitespace-nowrap` text, and dynamic product variant names. The image does not prove which parent width caused the left-edge crop. | Open `/comparison` in Before and After and Product Variant modes. Use short and long real variant labels at 320px, 375px, 390px, 430px, tablet, and desktop widths. Record the pill, text, and neighboring control bounds, line wrapping, contrast, and document scroll width. |
| #199 | The issue image shows **Windows** selected under Product Filter. `src/features/product/components/ProductFilter.tsx` always writes the clicked category label, even when that label is already selected. `ProductFilterContext.tsx` already represents no category as `"All"`; the mobile sheet uses a draft copy of the same state. | On `/product`, select a category, click it again, and compare cards, active filter count, and chips. Repeat inside the mobile filter sheet before and after **Show results**, including cancel/reopen and **Clear all**. |
| #181 | The [GitHub issue image](https://github.com/gabiuz/GlassFit/issues/181) shows dates such as **Aug 19, 2026** broken across three lines in the mobile Staff Accounts table. `src/features/admin/staff/StaffContent.tsx` uses a `min-w-[700px]` scrollable table, but its Created cells have no minimum width or no-wrap rule. The exact column-sizing cause still needs measurement. | With an authorized admin account, inspect `/admin/staff` at 320px through 430px, portrait and landscape. Scroll the table to Created; measure the Created column and cell text bounds, row height, table scroll range, and access to the Actions menu. |
| #179 | The [GitHub issue image](https://github.com/gabiuz/GlassFit/issues/179) shows **Published** touching or covering **Edit** while Duplicate and Delete remain on the same row. `src/features/admin/products/ProductsContent.tsx` gives all seven table columns equal flexible width inside a `min-w-[760px]` area, while the Actions cell contains three non-shrinking buttons. This is a strong layout lead, not a measured cause. | On `/admin/products`, inspect Published and Draft rows with ordinary and long product names at mobile widths. Measure status and action rectangles, horizontal scroll reachability, header/row alignment, and whether all actions remain usable by touch and keyboard. |
| #177 | The issue image shows **Showing 0 of 11 products** and a no-match message clipped at the right edge of the mobile product table. The current `ProductsContent.tsx` puts the no-match state inside the `min-w-[760px]` scrolling row area, while the count uses `filtered.length` and the full `products.length`. Its current Reset filters button is absent from the older screenshot, so the deployed image may represent a different revision. | Identify the deployed revision or reproduce on the current checkout. Combine search, type, status, and scope filters until zero rows remain. Check the count and entire no-match message without horizontal panning; test Reset filters and the truly empty catalog separately. Confirm what total the count is intended to describe when a scope tab is active. |

DSD Section 2 defines mobile as 320px through 639px and tablet as 640px through 1023px. Include 639px and 640px in layout checks. Browser emulation can locate geometry problems; final mobile acceptance should use Android Chrome and iOS Safari because browser chrome, font rendering, and touch behavior differ.

---

## 3. Traceability

| Requirement | Relationship |
|---|---|
| BRD-M4 | Supports clear and usable customer and administrative workflows across screen sizes. |
| PRD-F15, PRD-F16; SDD-C5; DSD-UI9; QAD-TC27, QAD-TC28 | Govern the comparison view and protect mode, variant, and multi-product behavior while #203 changes presentation. |
| PRD-F1; SDD-C1; DSD-UI1; QAD-TC1 | Govern the public catalog and category-filter behavior for #199. |
| PRD-F14; SDD-C9; QAD-TC14 | Cover the protected admin surface containing the Staff Accounts date display in #181. The date layout has plan-local acceptance below; QAD-TC14 is not a date-format test. |
| PRD-F14; SDD-C9; DSD-UI14; QAD-TC51 | Govern admin product filters, result counts, no-match and reset states, and row actions for #179 and #177. |
| QAD-VG4 | Provides the existing accessibility gate for contrast, readable feedback, keyboard operation, and visible focus. |
| FIX-UI9-V1 through FIX-UI9-V6 | Plan-local acceptance cases, not new QAD catalog IDs. |

---

## 4. Planned Implementation Contract

### 4.1 Comparison label (#203)

**Primary file:** `src/features/comparison/components/Comparison.tsx`.

After measuring the actual container, give the comparison label a brand-consistent darker background and sufficient separation from adjacent controls. Preserve the meaning and current mode selection. Let long dynamic variant names wrap or otherwise fit within the available width while keeping all text available and readable; avoid clipping or a page-wide horizontal scrollbar. Verify text contrast against the final background to the QAD-VG4 accessibility gate. Keep the existing comparison controls and variant-rendering behavior intact.

### 4.2 Public category deselection (#199)

**Primary file:** `src/features/product/components/ProductFilter.tsx`. Inspect `ProductFilterContext.tsx`, `FilterChips.tsx`, and `MobileBottomSheet.tsx` for state and feedback consistency; edit them only if required by reproduction.

Clicking the active category should set the existing no-category value, `"All"`; selecting a different category should still switch directly. Expose the selected state to assistive technology and retain visible focus. Desktop changes apply immediately; mobile changes stay in the draft state until **Show results** is chosen. Check whether leaving **Doors** requires clearing dependent Door Style selections so hidden selections cannot keep an active chip or produce surprising results. Keep search, price, and independent material filters unchanged when only category is cleared.

### 4.3 Staff Created date (#181)

**Primary file:** `src/features/admin/staff/StaffContent.tsx`.

Reserve enough width for the existing formatted date and keep its month, day, and year together. Preserve table semantics, existing date value and locale, horizontal scrolling where needed, and the usable Actions menu. Avoid widening the entire document or hiding other staff fields to make room. Check a larger font setting and the longest month abbreviation produced by the existing formatter.

### 4.4 Admin product status and actions (#179)

**Primary file:** `src/features/admin/products/ProductsContent.tsx`.

Measure each column's content width, then give the header and rows a shared column sizing contract that reserves separate space for Status and the three actions. Keep the existing admin table styling, order, badges, and action labels. The table may scroll horizontally within its own card on small screens, but no badge, button, or text should cover another control, and the browser document must not gain unintended horizontal overflow. Check that the header remains aligned with row cells after scrolling.

### 4.5 Admin product filter feedback (#177)

**Primary file:** `src/features/admin/products/ProductsContent.tsx`; `src/features/admin/products/productFilters.ts` only if reproduction proves the displayed count or predicate is wrong.

Place zero-result feedback where it fits the visible card width rather than forcing users to pan across the wide row grid to read it. Keep the no-products-at-all state distinct from no matching products. Make the result count legible and clarify its denominator if scope filtering makes the current **Showing 0 of 11 products** wording misleading; first confirm the intended count against QAD-TC51 and DSD-UI14. Keep Reset filters visible and operable in the no-match state, and ensure it restores the documented default search, type, status, and scope selection. Preserve the existing data-filter predicates unless a failing example demonstrates a logic defect.

### 4.6 Scope boundary

The follow-up card action spacing is implemented in `src/features/product/components/ProductCard.tsx` under PRD-F1 and DSD-UI1. The actions remain stacked on narrow phones and share the available row width at larger breakpoints.

These are presentation and filter-state changes. The Batch Price Adjustment dialog, Supabase records, product pricing, staff permissions, comparison rendering pipeline, and database schema are outside scope. Reuse current components and design tokens; add no third-party dependency or global style change. If a screenshot represents an older deployed revision, reproduce against the current checkout before choosing a code change.

---

## 5. Agent Delegation Before Implementation

| Agent | Later responsibility | Ownership and sequence |
|---|---|---|
| `frontend-developer` (comparison) | Reproduce #203, measure pill geometry and contrast, implement the smallest responsive label correction. | Own `Comparison.tsx`. Can work independently of the other tracks. |
| `frontend-developer` (public catalog) | Reproduce #199 on desktop and in the mobile draft sheet, implement category toggle and state feedback. | Own `ProductFilter.tsx`; coordinate any needed changes to `ProductFilterContext.tsx`, `FilterChips.tsx`, or `MobileBottomSheet.tsx`. |
| `frontend-developer` (staff) | Reproduce #181 using the actual GitHub screenshot, correct Created column sizing and date presentation. | Own `StaffContent.tsx`. Can work independently of catalog and comparison. |
| `frontend-developer` (admin products) | Reproduce #179 and #177, correct the shared table geometry and then the no-match/result feedback. | Own `ProductsContent.tsx`; inspect `productFilters.ts` and change it only if data evidence warrants it. Handle both issues sequentially in this file to avoid conflicting edits. |
| `qa-expert` | Prepare and run the viewport, filter, accessibility, and regression matrix; compare screenshots and measured element bounds after integration. | Validate all four tracks together after the frontend changes. |

The initial `agent-organizer` breakdown keeps file ownership separate. Add a read-only `debugger` only if reproduction leaves the failure path unclear. No implementation or QA agents were started for this plan-only request.

---

## 6. Verification and Acceptance Matrix

| Case | Required result |
|---|---|
| FIX-UI9-V1: Comparison label | Both comparison modes remain legible at 320px, 375px, 390px, 430px, 639px, 640px, tablet, and desktop widths. Short and long variant labels fit without covering the adjacent control, clipping meaningful text, or causing document-level overflow. Final text/background contrast meets the existing accessibility gate. |
| FIX-UI9-V2: Public category toggle | On desktop, selecting Windows filters products and clicking Windows again returns to `"All"`. Switching to Doors works; removing Doors does not leave an invisible dependent filter active. Card results, active filter count, chips, selected announcement, and focus agree. |
| FIX-UI9-V3: Mobile draft filter | In the mobile sheet, selecting and deselecting a category changes draft results; **Show results** commits it. Closing without applying preserves the prior active filters. **Clear all** and search, price, and material filters retain their intended behavior. |
| FIX-UI9-V4: Staff dates | Created dates remain together and readable at mobile, landscape, tablet, desktop, and enlarged-text settings. The staff table scrolls within its card, other columns remain available, Actions remains reachable, and no document-level overflow appears. |
| FIX-UI9-V5: Admin rows | Published and Draft badges never touch Edit, Duplicate, or Delete at 320px through desktop widths. Buttons retain separate touch and keyboard targets, correct row identity, visible focus, and aligned headers during horizontal scrolling. |
| FIX-UI9-V6: Admin filter feedback | Search, type, status, and scope combinations produce correct rows and a count with an unambiguous total. When zero rows match, the complete no-match message and Reset filters are visible without horizontal panning; Reset restores defaults. An actually empty catalog shows its separate empty state. |

Use the existing `tests/unit/catalogProductFilters.test.ts` and `tests/unit/adminProductFilters.test.ts` for filter regression coverage; add focused assertions only for behavior that cannot be covered by the current cases. Verify responsive geometry, contrast, and touch or keyboard behavior in browsers because the current unit tests cannot prove them. After implementation, run relevant focused tests, `npm run lint`, `npx tsc --noEmit`, and `npm run build`; record any pre-existing failures separately. The FastAPI health check is only needed if an end-to-end visualization reproduction starts that service.

---

## 7. Readiness and Risks

The source contains credible causes for category deselection and the two admin table symptoms, but screenshots alone cannot confirm layout measurements. #177's image predates current visible Reset filters and scope tabs, so compare the deployed and local revisions before editing. #181's actual GitHub image is essential to avoid treating the unrelated Batch Price Adjustment capture as a staff date requirement. The acceptance cases above turn these uncertainties into explicit reproduction work.

## Self-Check

- [x] Plan-only `fix-ui9.md` follows the existing `docs/implementation/fix-ui*.md` naming and metadata pattern.
- [x] Each linked issue has source evidence, reproduction steps, scoped ownership, traceability, and observable acceptance criteria.
- [x] Issue screenshots are treated as evidence, separate from user instructions and from root-cause hypotheses.
- [x] No application code, dependency, schema, or data is changed by this document.
