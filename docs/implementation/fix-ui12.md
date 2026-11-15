# Implementation Specification: Carousel, Batch Pricing, Detail Summary, and Comparison Banner Fixes (fix-ui12)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document Function:** Implementation-ready plan for four reported frontend issues
**Version:** 1.0.0
**Date:** October 30, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Implemented in source (browser acceptance pending)
**Upstream Specifications:** `docs/brd-glassfit.md` (BRD-M4, BRD-M5), `docs/prd-glassfit.md` (PRD-F10, PRD-F15, PRD-F19), `docs/sdd-glassfit.md` (SDD-C6, SDD-C7, SDD-C9), `docs/dsd-glassfit.md` (Section 2, DSD-UI9, DSD-UI10), `docs/qad-glassfit.md` (QAD-TC10, QAD-TC15, QAD-TC27, QAD-TC28)

---

## 1. Authorized Requirements and Evidence Boundary

1. [Issue #198](https://github.com/gabiuz/GlassFit/issues/198): Complete the partially fixed home steps carousel by adding usable previous and next arrows on desktop. Keep the existing mobile arrows and dots.
2. [Issue #182](https://github.com/gabiuz/GlassFit/issues/182): Reduce the visual size of the batch percentage **Apply** action and arrange the category, percentage, Apply, and reset controls coherently within the modal.
3. [Issue #166](https://github.com/gabiuz/GlassFit/issues/166): Keep every label and value in the quotation **Detail Summary** readable inside its available width, including narrow cards and long configuration values.
4. [Issue #163](https://github.com/gabiuz/GlassFit/issues/163): Keep the comparison video banner free of text and make it shorter on mobile and desktop so users reach **Your Visual Preview** and its controls sooner.

All four GitHub issues are open and contain a screenshot but no comments or written acceptance details. The four images attached to this request show the symptoms and guide reproduction. Their sample values, device chrome, and layout are evidence, not instructions to alter pricing or copy. Source inspection below is a lead; runtime geometry and the deployed revision remain to be checked before implementation. This planning pass changes no application code.

---

## 2. Evidence and Reproduction

| Issue | Current source evidence | Reproduce before editing |
|---|---|---|
| #198 | `src/features/home/components/DetailSection.tsx` already defines previous/next handlers and renders arrow buttons in the `lg:hidden` mobile block. The `lg` carousel and its separate footer render dots only. The issue image shows that desktop state. | Open `/` at 1023px, 1024px, 1280px, and a wide desktop size. Confirm arrow visibility, carousel bounds, card scaling, dot state, automatic advance, hover/focus pause, and wraparound from the first and last cards. Check the existing arrows on a phone before changing shared handlers. |
| #182 | `src/features/admin/materials/BatchPriceModal.tsx` places five category chips beside a percentage input, Apply, and reset in one `sm:flex-row` bar. The supplied screenshot shows the controls wrapping unevenly and a visually prominent dark Apply button. The footer's **Update Prices** is a separate commit action. | With an authorized Owner/Manager account, open `/admin/materials` and its batch modal with all categories and a populated material list. Inspect the control bar at 320px, 375px, 390px, 640px, 768px, and desktop, including 200% zoom. Try positive, negative, zero, and cleared percentage input; switch filters, Apply, reset, edit a row, and confirm staged count and final update behavior. Measure control bounds and document or modal overflow. |
| #166 | `src/features/quotation/components/PriceCard.tsx` renders summary labels and values as alternating children of a two-column grid, then changes to six `fit-content(100%)` tracks at `md` with a large horizontal gap. The narrow screenshot shows long values wrapping tightly, with at least one material value appearing cut. The exact failing card width is not established. | On `/quotation`, expand a PriceCard with long category, material, glass finish, dimensions, and add-on values. Test a standalone card and multi-item cards at 320px, 375px, 390px, 639px, 640px, 768px, 1023px, desktop, and 200% zoom. Record card and summary rectangles, computed tracks, clipped text, and page scroll width. Compare displayed values with the underlying quote data. |
| #163 | The supplied screenshot shows **Your Visual Preview** below a text-free video banner. This matches `/comparison`, where `src/app/comparison/page.tsx` renders `src/components/shared/BackgroundNavbar.tsx` above `Comparison.tsx`. `BackgroundNavbar` has a `min-h-60` video area and is also used on `/quotation`, `/send-booking`, `/product-details/[id]`, and `/q/[code]`. | Open `/comparison` on phone, tablet, and desktop, with and without comparison session data. Measure banner height, the vertical distance to **Your Visual Preview** and the first comparison controls, and visible content above the fold. Inspect all other `BackgroundNavbar` routes before resizing the shared component. Check reduced motion and video loading failure with the static background. |

DSD Section 2 sets phone widths at 320px through 639px and tablet widths at 640px through 1023px. Include 639px, 640px, 1023px, and 1024px to catch breakpoint transitions. Compare the current checkout with the revision behind the reported screenshots before labeling a defect reproduced. Browser emulation can establish layout; final phone acceptance should include Android Chrome and iOS Safari. Use approved test data for admin pricing and quotation flows.

---

## 3. Traceability

| Requirement | Relationship |
|---|---|
| BRD-M4; PRD-F15; SDD-C6; DSD-UI9; QAD-TC27, QAD-TC28 | #163 reduces the space before comparison while preserving the existing before-and-after and product-variant interaction. QAD cases cover comparison behavior, so banner size and control visibility need plan-local acceptance. |
| BRD-M4; PRD-F15 | #198 improves discoverability of the public home workflow steps that lead into visualization and comparison. The home steps carousel itself has no specific QAD catalog case, so arrow behavior needs plan-local acceptance. |
| BRD-M5; PRD-F19; SDD-C9; DSD-UI10; QAD-TC15 | #182 changes admin control presentation while preserving category filtering, staged arithmetic, reset, and protected batch update. |
| BRD-M4; PRD-F10; SDD-C7; QAD-TC10 | #166 changes quotation detail presentation while preserving the configuration values and price calculation. |
| FIX-UI12-V1 through FIX-UI12-V5 | Plan-local visual and interaction acceptance cases, not new QAD catalog IDs. |

---

## 4. Agent Delegation Before Implementation

The `agent-organizer` reviewed this breakdown. These are proposed assignments for a later implementation pass. No implementation, design, QA, or review agent has been started in this planning pass.

| Agent | Later responsibility | File ownership and coordination |
|---|---|---|
| `frontend-developer` (home carousel) | Reproduce and finish #198 on desktop, preserving mobile navigation, loop behavior, and automatic advance. | Own `src/features/home/components/DetailSection.tsx`. |
| `frontend-developer` (batch pricing) | Reproduce #182 and refine the control bar's hierarchy and responsive arrangement without changing price calculations. | Own `src/features/admin/materials/BatchPriceModal.tsx`; consult existing modal and button patterns. |
| `frontend-developer` (quotation summary) | Reproduce #166 with long values and correct the label/value layout within actual card widths. | Own `src/features/quotation/components/PriceCard.tsx`; inspect `ProductSummary.tsx` only if supplied data is truncated before reaching the card. |
| `frontend-developer` (comparison banner) | Reproduce #163 across breakpoints and shorten the text-free banner on `/comparison`. | Own `src/app/comparison/page.tsx` and `src/components/shared/BackgroundNavbar.tsx` as needed. Review all five consumers before altering the shared component. |
| `ui-designer` | Give read-only guidance on arrow placement, modal hierarchy, summary wrapping, and compact banner proportions using existing GlassFit tokens and components. | Advise the frontend owners before presentation edits; no new palette or library. |
| `qa-expert` | Capture before and after viewport measurements, verify keyboard and touch paths, and run the acceptance matrix. | Read-only acceptance owner; route failures to the file owner. |
| `code-reviewer` | Check the integrated diff for shared-component regressions, accessibility, data invariants, and specification traceability. | Read-only final review after integration. |

The four frontend owners have separate primary files. Assign one owner to any additional shared file before editing. Read the relevant `node_modules/next/dist/docs/` guide before writing Next.js code, as required by this repository.

---

## 5. Planned Implementation Contract

### 5.1 Desktop carousel arrows (#198)

Add desktop previous and next controls to the home steps carousel using the existing `goPrevious` and `goNext` handlers and icon language. Place them where they remain visible alongside the scaled track and do not cover card text or dots. Make each control keyboard accessible with a clear name and visible focus, and give it a comfortably sized target. Keep manual navigation synchronized with the active dot and automatic advance reset. Preserve looping, desktop hover/focus pause, reduced-motion behavior, and the existing mobile controls. Do not introduce a second carousel state or change the eight step descriptions.

### 5.2 Batch price control layout (#182)

Make category selection and percentage actions distinct, readable groups within the existing modal. Reduce the Apply control's visual weight and size to match adjacent compact controls while keeping its label and target usable. Allow category chips to wrap or occupy their own row when the modal is narrow; keep percentage input, Apply, and reset in a predictable order without overlap or page-wide scrolling. Preserve the distinction between **Apply** (stage percentage changes for the current filter) and **Update Prices** (commit the staged changes). Do not change the arithmetic, filter scope, rounding, reset behavior, validation, persistence, or submitted values. Check that error text and the material table still fit after the control layout changes.

### 5.3 Detail Summary within card width (#166)

Group each label with its value so pairings survive wrapping and responsive changes. Replace the width-hungry multi-track arrangement with a card-width-aware layout that gives long values a shrinkable, wrapping area. Allow safe breaks for long material names, finishes, dimensions, and add-on labels without silently truncating meaningful text. Keep the current field order, values, detail toggle, BOM section, and quote calculation. If a source value is already cut before rendering, trace that separately and correct only the presentation source needed for accurate display. Avoid fixed widths that work at one screenshot size but fail at zoom or tablet breakpoints.

### 5.4 Compact comparison banner (#163)

Keep the `/comparison` video banner free of text. Reduce its height at phone, tablet, and desktop widths so **Your Visual Preview** and the first comparison controls appear sooner, with particular attention to the currently oversized desktop gap. Choose the new height from measured viewport layouts rather than a single screenshot. Preserve the existing video, overlay, and static reduced-motion or loading fallback. Keep **Your Visual Preview** as the page's visible heading. Prefer a route-specific size treatment; if the shared `BackgroundNavbar` needs a size option, verify that its four other routes retain their intended layouts. Do not add a hero heading.

### 5.5 Scope boundary

This is a presentation and navigation pass. Do not change price formulas, batch update service calls, quotation data, comparison rendering, Supabase schema or RLS, or CV processing. Reuse the existing component system and design tokens; add no dependency or global CSS override without a measured shared cause.

---

## 6. Verification and Acceptance Matrix

| Case | Required result |
|---|---|
| FIX-UI12-V1: Desktop arrows | At every desktop width tested, visible previous and next arrows navigate exactly one step, including first/last wraparound. The active dot and active card agree after arrow, dot, and timed navigation. Arrows do not obscure cards; keyboard activation, focus visibility, hover/focus pause, and reduced motion work. Existing mobile arrows and swipe still work. |
| FIX-UI12-V2: Batch modal | Category chips, percentage input, Apply, and reset fit and remain understandable at 320px through desktop and 200% zoom. Apply is visually compact but usable. Switching categories changes only the target set; Apply stages the correct positive/negative/zero result, reset restores the current filter, and Update Prices commits only valid changed rows. The footer and table remain readable. |
| FIX-UI12-V3: Summary | Every Detail Summary label remains paired with its complete value at narrow card widths, breakpoint transitions, long realistic strings, and 200% zoom. No value is clipped or hidden, and the page has no unintended horizontal scroll. The values, BOM amounts, totals, and expand/collapse behavior match the pre-change quote. |
| FIX-UI12-V4: Banner | `/comparison` keeps a text-free video banner that is visibly shorter at phone, tablet, and desktop widths. **Your Visual Preview** and the first comparison controls appear sooner without being clipped, covered by navigation, or pushed into an awkward gap. Video and fallback remain usable; other `BackgroundNavbar` routes retain their intended banner size. Comparison controls and imagery remain usable. |
| FIX-UI12-V5: Flow regression | From the home step carousel into visualization, comparison, and quotation, navigation and displayed configuration remain coherent. An authorized admin can stage, reset, and submit batch prices without a behavior change beyond layout. |

Use focused existing tests where they cover carousel state, batch price operations, quotation values, and comparison interaction. Add an automated check only for a meaningful uncovered regression; visual geometry and contrast require browser inspection. After implementation, run `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Run the FastAPI health check only if reproduction starts that service. Record pre-existing failures separately.

---

## 7. Implementation Sequence and Open Decisions

1. Confirm the checkout and reported deployment revision. Capture baseline screenshots, element bounds, and `document.documentElement.scrollWidth` for all four issues at the relevant widths.
2. Measure #163's banner and first comparison controls across desktop and mobile widths, and inspect the other shared-banner routes before choosing a route-specific height. Confirm #166's smallest actual card width and whether any value is truncated upstream.
3. Give each frontend agent file ownership, collect `ui-designer` guidance, and make the smallest changes that satisfy the measured cases.
4. Have `qa-expert` run the viewport and browser matrix, then send failures to the owning agent. Have `code-reviewer` inspect the integrated diff and rerun focused checks after corrections.

The main open decisions are exact arrow placement around the scaled desktop track, how many modal control rows fit each width, the summary's narrow-card layout, and the comparison banner height at each breakpoint. Resolve these from measured layouts and existing component patterns before changing code.

## 8. Implementation Record

The home steps carousel now has desktop previous and next controls beside its dots. The batch price modal separates category filtering from a compact percentage action row. The quotation Detail Summary groups each label with its value in a wrapping grid. The comparison page uses a text-free compact banner, with a 192px desktop height after navbar alignment review; other routes retain the standard banner height.

TypeScript and the production build passed. Targeted lint on the comparison files passed with an existing image warning. Repository-wide lint reported two pre-existing errors in `AdminLoginForm.tsx` and `MobileBottomSheet.tsx`. Browser and device acceptance in Section 6 remains to be recorded.

## Self-Check

- [x] `fix-ui12.md` follows the existing `docs/implementation/fix-ui*.md` naming, metadata, traceability, delegation, and acceptance format.
- [x] Each issue has source evidence, reproduction steps, a scoped implementation contract, and observable acceptance criteria.
- [x] Attached screenshots are treated as symptom evidence, separate from the user's request and from proven root causes.
- [x] The implementation uses existing dependencies and makes no schema or data change.
