# Implementation Specification: Booking and Quotation Responsive Layout Fixes (fix-ui10)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document Function:** Implementation-ready plan for five reported frontend defects
**Version:** 1.0.0
**Date:** October 30, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Implemented; browser acceptance pending
**Upstream Specifications:** `docs/brd-glassfit.md` (BRD-M4), `docs/prd-glassfit.md` (PRD-F10, PRD-F13), `docs/sdd-glassfit.md` (SDD-C7, SDD-C8), `docs/dsd-glassfit.md` (Section 2, DSD-UI8), `docs/qad-glassfit.md` (QAD-TC10, QAD-TC13, QAD-VG4)
**Implementation State:** Presentation fixes implemented. Automated link and quotation tests pass; authenticated browser acceptance remains pending.

---

## 1. Authorized Requirements

1. [Issue #169](https://github.com/gabiuz/GlassFit/issues/169): The loading indicator beside **Generating Secure Link...** must remain circular while the booking reference link is being created.
2. [Issue #170](https://github.com/gabiuz/GlassFit/issues/170): The Step 2 **Reference Summary** must fit inside its card on a tablet, including its values and optional add-on row.
3. [Issue #171](https://github.com/gabiuz/GlassFit/issues/171): The 2D image in **Product Summary** must show the complete intended product preview instead of cropping its top.
4. [Issue #172](https://github.com/gabiuz/GlassFit/issues/172): In the mobile **Estimated Total** callout shown in the report, align the amount with the left-aligned heading and explanatory copy. Keep the amount and price calculation unchanged.
5. [Issue #173](https://github.com/gabiuz/GlassFit/issues/173): On the public reference page, the **Itemized Cost Breakdown** must have visible horizontal breathing room on mobile. All columns and values must remain reachable and readable.

The five issue screenshots and the five user attachments show the reported symptoms. They contain example products, prices, dates, and browser chrome, not instructions to change those values. Source inspection below identifies likely layout causes, but a screenshot alone does not prove computed geometry or the deployed revision. No application code is changed in this planning pass.

---

## 2. Evidence and Reproduction

| Issue | Current source evidence and lead | Reproduce before editing |
|---|---|---|
| #169 | `src/features/booking/components/Step2GenerateLink.tsx` renders the loading ring as a 20px by 20px flex item inside a button with a potentially wrapping label. Flex shrink is a plausible reason the ring appears oval in the screenshot; the actual rendered dimensions have not been measured. | Enter Step 2 of `/send-booking`, trigger link generation in an authorized test flow, and capture the loading state at 320px, 375px, tablet, and desktop widths. Measure the ring's rendered width and height while the label occupies one and two lines. Verify the button is disabled only during generation and still reports progress. |
| #170 | The same component switches the summary to six `auto` grid tracks at `md`, adds 67px column gaps, and marks several labels and values `whitespace-nowrap`. This can demand more width than the tablet card provides. The image shows the date extending beyond the card's right side. | At 640px, 768px, 820px, 1023px, and 1024px, inspect the Step 2 card with ordinary and long reference codes, product names, dates, filenames, customer names, and an add-on summary. Record card and grid bounds, text wrapping, and document scroll width. Check with and without a generated link. |
| #171 | `src/features/quotation/components/PriceCard.tsx` uses `object-cover` inside a fixed-height preview frame. `ProductSummary.tsx` can pass an overlay image, a final snapshot, or a fallback image. The screenshot shows a product cut off at the frame's top; determine which image source is displayed before changing image fit. | Open `/quotation` with a configured sliding window and inspect the image's intrinsic aspect ratio, rendered frame ratio, and visible content at 320px, 390px, tablet, and desktop. Repeat with a tall door, wide window, and multi-product quotation. Compare the source image with the displayed preview. |
| #172 | `ProductSummary.tsx` uses `items-center` for the final total callout at all widths; the amount is a sibling of the left-aligned heading and copy. This is a likely reason the amount sits in the middle on mobile. | Open the bottom of `/quotation` at 320px, 375px, 390px, 430px, tablet, and desktop. Record the left edges of the callout heading, explanatory copy, and amount for one and multiple products. Test a large PHP amount and enlarged text. |
| #173 | `src/app/q/[code]/page.tsx` wraps a four-column table in `overflow-x-auto`, while the page and gray section have mobile padding and cells have their own padding. The screenshot shows the table content ending close to the visible right edge, with a later column offscreen. The exact cause could be the scroll container, table minimum width, or missing end inset. | Open a valid public `/q/[code]` reference at 320px, 375px, 390px, and 430px. Scroll the table fully in both directions and measure the white table, gray card, cell contents, and viewport edges. Verify the Subtotal column, long item names, and large currency values remain reachable. |

DSD Section 2 defines mobile as 320px through 639px and tablet as 640px through 1023px. Include 639px and 640px in the viewport matrix to catch the breakpoint transition. Compare against the revision serving the reported `glassfit-delta.vercel.app` screenshots before assuming the current checkout reproduces every symptom. Browser emulation can establish layout geometry; final mobile checks should include Android Chrome and iOS Safari.

---

## 3. Traceability

| Requirement | Relationship |
|---|---|
| BRD-M4 | Supports a usable customer quotation and consultation workflow on phone, tablet, and desktop. |
| PRD-F13; SDD-C8; DSD-UI8; QAD-TC13 | Preserve signed-link generation and booking handoff while correcting the Step 2 spinner and reference summary presentation. QAD-TC13 tests link behavior, not the spinner's shape or tablet layout. |
| PRD-F10; SDD-C7; QAD-TC10 | Preserve quotation values, product identity, and calculation while correcting the preview and total callout presentation. QAD-TC10 tests calculation, not image fit or alignment. |
| PRD-F10, PRD-F13; SDD-C7, SDD-C8 | Keep the public reference breakdown consistent with the saved quotation and booking reference. The new mobile spacing acceptance below is plan-local. |
| DSD Section 2; QAD-VG4 | Use the project's viewport boundaries and maintain readable, accessible content without clipped controls or unintended page overflow. |
| FIX-UI10-V1 through FIX-UI10-V6 | Plan-local visual and interaction acceptance cases, not new QAD catalog IDs. |

---

## 4. Agent Delegation Before Implementation

The initial `agent-organizer` review recommended a frontend owner, independent QA, and a final read-only review. Source inspection shows three distinct file groups, so later implementation can give each group one explicit owner without overlapping edits:

| Agent | Later responsibility | File ownership and coordination |
|---|---|---|
| `frontend-developer` (booking) | Reproduce and fix #169 and #170 together, then verify link generation still works. | Own `src/features/booking/components/Step2GenerateLink.tsx`. Inspect parent booking layout only if measurements point there. |
| `frontend-developer` (quotation) | Reproduce and fix #171 and #172 together, including single and multiple product cases. | Own `src/features/quotation/components/PriceCard.tsx` and `ProductSummary.tsx`. Coordinate any image-source decision within this track. |
| `frontend-developer` (public reference) | Reproduce and fix #173, preserving table semantics and all four columns. | Own `src/app/q/[code]/page.tsx`. Inspect shared page layout only if the overflow starts outside this section. |
| `qa-expert` | Establish before-change measurements and screenshots, then verify the full viewport and browser matrix after integration. | Read-only acceptance owner; report any mismatch to the relevant frontend owner. |
| `code-reviewer` | Review the integrated diff for layout regressions, data changes, accessibility, and unintended shared-style effects. | Read-only final review after QA. |

The three frontend tracks can run in parallel after QA records a baseline. If investigation finds a shared parent layout, assign that file to one track before editing to avoid conflicting changes. Only the `agent-organizer` was consulted for this plan; implementation, QA, and review agents have not been started.

---

## 5. Planned Implementation Contract

### 5.1 Circular loading indicator (#169)

Measure the loading indicator during the real pending state. If flex compression is confirmed, make its inline and block dimensions equal and prevent it from shrinking while the text wraps; keep the existing ring color, spin treatment, and button styling. The indicator must remain circular throughout generation, and the button's accessible progress message and disabled state must remain coherent. Do not replace link-generation logic to solve a visual defect.

### 5.2 Tablet reference summary (#170)

Replace the rigid tablet six-track arrangement with a layout that fits the available card width and retains clear label-to-value pairing. Permit long values to wrap or break safely, and use narrower gaps or fewer columns at tablet widths as measured. Keep the existing labels, values, order, optional add-on information, card style, and link actions. No summary text may cross the white card boundary or create document-level horizontal scrolling.

### 5.3 Complete 2D preview (#171)

First identify whether the reported image is an isolated product render, room snapshot, or fallback asset. For an isolated product render, use a fit mode and available frame space that show its full intended silhouette without stretching it. If a room snapshot uses the same component, verify that its presentation remains intentional; distinguish image kinds only if the current source data and use cases require it. Keep the preview's image alternative text, product identity, and card hierarchy. Do not crop the model or change the underlying snapshot data as a layout workaround.

### 5.4 Left-aligned total amount (#172)

At mobile widths, align the final amount's left edge with the **Estimated Total** heading and supporting copy in the cyan callout. Let a long amount wrap or scale within the existing callout spacing without clipping. Preserve the current responsive desktop composition if it fits, the PHP formatting, and the calculation. Verify both single-product and overall multi-product wording.

### 5.5 Mobile itemized cost gutters (#173)

Keep the four-column semantic table and its horizontal scrolling where the data cannot fit at phone width. Give the visible table content a consistent inset from the gray section and a clear end gutter when scrolled to the last column, so currency values do not touch or disappear at the viewport edge. Use column sizing and cell wrapping that keep long item names readable without compressing numeric columns into overlap. Do not change the prices, quantity units, row order, or subtotal data.

### 5.6 Scope boundary

These are presentation fixes in the existing booking, quotation, and public reference surfaces. Pricing formulas, signed-token behavior, PDF generation, Supabase records, schema, and FastAPI are outside scope. Reuse current design tokens and components; add no dependency or broad global CSS rule unless a measured shared cause requires it.

---

## 6. Verification and Acceptance Matrix

| Case | Required result |
|---|---|
| FIX-UI10-V1: Link spinner | In pending state, the rendered indicator has equal width and height at every tested viewport and remains circular when the label wraps. Generation succeeds or reports its existing error; repeated clicks cannot create duplicate requests while pending. |
| FIX-UI10-V2: Reference summary | At 320px, 375px, 390px, 430px, 639px, 640px, 768px, 820px, 1023px, 1024px, and desktop, all labels and values stay inside their card with correct pairing. Long dates, names, filenames, codes, and add-on text remain available. No page-wide horizontal overflow appears. |
| FIX-UI10-V3: Product preview | In the reported sliding-window case, the complete 2D product is visible in the frame at phone, tablet, and desktop widths. Tall and wide products do not stretch or crop unexpectedly; any room-snapshot variant remains usable. |
| FIX-UI10-V4: Final amount | The mobile total amount starts on the same left alignment as its heading and description, including a large PHP value. It remains inside the cyan callout at enlarged text, while tablet and desktop layouts remain legible. |
| FIX-UI10-V5: Itemized costs | At all tested phone widths, the table has visible side breathing room, including at its maximum horizontal scroll. Every column header and value, including Subtotal, can be reached and read. Long item names and large amounts do not overlap or force the document itself to scroll horizontally. |
| FIX-UI10-V6: Flow regression | From quotation through link generation to a valid public reference, product details and all displayed totals remain consistent with the pre-change values. Focus, keyboard operation, touch scrolling, and readable progress feedback remain available. |

The `qa-expert` should capture before and after screenshots and record element rectangles and `document.documentElement.scrollWidth` at the relevant widths. Check 200% browser zoom and longer realistic content. Use focused existing booking and quotation tests where they cover behavior; add a new automated check only if it catches a meaningful layout or state regression that current tests miss. After implementation, run `npm run lint`, `npx tsc --noEmit`, and `npm run build`, recording any unrelated pre-existing failures separately. A FastAPI health check is unnecessary unless reproduction actually starts that service.

---

## 7. Implementation Sequence and Open Risks

1. Confirm the checkout and deployed revision, gather an authorized booking test state and valid public reference, and capture the five reported failures with viewport measurements.
2. Give the three frontend tracks their file ownership and implement the smallest changes supported by the measurements.
3. Have QA run the acceptance matrix on browser emulation and physical mobile browsers, then correct any remaining failures in the owning track.
4. Have the `code-reviewer` inspect the integrated diff and rerun the focused checks after any review corrections.

The main unknowns are whether the current checkout matches the reported deployment, which image source appears in #171, and whether #173 needs table sizing, scroll padding, or both. Resolve those by reproduction before choosing exact CSS. Do not mark an issue complete from a screenshot comparison alone if a hidden column, keyboard path, or real-device viewport still fails.

## Self-Check

- [x] Plan-only `fix-ui10.md` follows the existing `docs/implementation/fix-ui*.md` naming, metadata, and acceptance format.
- [x] Each linked issue has source evidence, reproduction steps, a scoped implementation contract, agent ownership, and observable acceptance criteria.
- [x] The attached images are treated as symptom evidence, separate from instructions and proven root causes.
- [x] No application code, dependency, schema, or data is changed by this document.
