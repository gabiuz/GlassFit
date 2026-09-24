# Implementation Specification: Post-Implementation Fixes for MS-14 Mobile Quotation PDF Rendering (fix-MS-14)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Bug Fix Specification for Mobile Print Pagination, Asset Readiness, and Saved PDF Layout Integrity  
**Version:** 1.1.0
**Date:** September 22, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Implemented
**Upstream Specifications:** `docs/implementation/ms14.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/erd-glassfit.md`, `docs/qad-glassfit.md`, `docs/build-glassfit.md`

---

## 1. Problem Context & Motivation

Following implementation of IMP-MS14, quotation previews remain readable on screen but PDFs saved from mobile browser print dialogs can contain partially empty visual sections. In the supplied failure capture, page 2 retains the cyan divider, pale card backgrounds, snapshot background, and dark pricing summary container while their expected foreground content is absent or displaced. The lower quotation table, total, ocular checklist, and consumer notice continue rendering.

This is a document rendering defect rather than a pricing calculation defect. The generated HTML still contains the quotation sections, but the mobile print engine is allowed to combine narrow-screen responsive rules, paged-media rules, long fragmenting containers, and an early print request. The existing automated tests assert that CSS strings exist, but they do not prove that mobile print uses a stable A4 layout or that the saved PDF contains visible content in every retained card.

### 1.1 Observed Defect

1. The defect occurs after the user selects Print / Save as PDF on a mobile device.
2. Page backgrounds, borders, and some later table content remain visible.
3. Foreground text or image content in earlier page sections can be blank, clipped, or displaced.
4. The output can contain excessive whitespace before the itemized quotation table.
5. The captured PDF has two pages, with the malformed continuation visible on page 2.

### 1.2 Current Implementation Evidence

1. `quotationPdfGenerator.ts` declares `@media (max-width:640px)` without limiting it to screen media. A narrow mobile print viewport can therefore apply both the mobile screen rules and `@media print` rules.
2. The print stylesheet resets only the body, toolbar, document sheet, selected break controls, and table headers. It does not explicitly restore the A4 print geometry for the header, metadata grid, fixture specifications, signature grid, logo, snapshot, or table typography.
3. `.item-card` uses `overflow:hidden` while its contents are allowed to span pages. Fragmenting an overflow-clipped container is inconsistently handled by mobile Chromium and WebKit print engines.
4. Several decorated blocks can fragment without a print-specific keep rule, including `.document-header`, `.meta-grid`, `.snapshot`, `.fixture-specs`, `.item-card > header`, and `.consumer-notice`.
5. `waitForImage()` returns immediately when `image.complete` is true and does not require `decode()` to settle. A complete network state does not guarantee that the image is decoded and painted for printing.
6. `printWhenReady()` waits for fonts and images, but it does not wait for the preview document load event or a completed layout and paint cycle before invoking `print()`.
7. `quotationPdfGenerator.test.ts` checks CSS substrings and lifecycle calls only. It has no assertion for screen-only responsive rules, print resets, overflow behavior, image decode in the complete state, or a post-layout print barrier.

### 1.3 Ranked Root Cause Hypotheses

These hypotheses must be tested in order during implementation. The screenshot alone is insufficient to declare one cause final.

| Rank | Hypothesis | Prediction |
|---|---|---|
| 1 | Narrow-screen CSS is active during print and conflicts with A4 paged layout | Scoping the 640px rules to `screen` and explicitly restoring print grids and typography removes the mobile-only malformed continuation |
| 2 | Decorated blocks and `overflow:hidden` fragment incorrectly across mobile PDF pages | Removing print-time overflow clipping and adding bounded keep rules prevents blank card fragments and excessive whitespace |
| 3 | Auto-print starts after resource fetch completion but before image decode and stable paint | Requiring document load, image decode, fonts, and two animation frames prevents empty snapshot or foreground layers |
| 4 | A large committed snapshot exceeds the available first-page print area and exposes engine-specific fragmentation | Applying a print-only physical maximum height and preserving aspect ratio keeps the snapshot intact without suppressing technical content |
| 5 | A specific mobile browser or PDF viewer has a rendering defect outside the generated document | The same PDF renders correctly in Poppler and a second viewer, while only one device viewer shows missing layers |

### 1.4 Required Diagnosis Gate

Before modifying production behavior, implementation must establish one red-capable reproduction using a fixed quotation fixture. The preferred signal is a saved mobile PDF or mobile-emulated Chromium PDF whose rendered PNG shows a blank or clipped decorated block. If browser automation cannot reproduce the exact device behavior, the supplied failing PDF must be inspected with `pdfinfo`, `pdftotext`, and `pdftoppm`, then compared with a newly generated control PDF.

The implementation must record:

1. Device, operating system, browser, and browser version.
2. Viewport width and orientation.
3. Single-fixture or multi-fixture quotation mode.
4. Snapshot MIME type, pixel dimensions, and approximate encoded size.
5. Whether the defect appears in the PDF content itself or only in one PDF viewer.
6. The smallest quotation fixture that still reproduces the failure.

No root cause shall be marked confirmed until changing one variable makes the reproduction pass.

---

## 2. Traceability & Specification Mapping

| Traceability Code | Specification Reference | Relevance |
|---|---|---|
| BRD-M5 | Minimize Estimator Preliminary Drafting Overhead | A saved quotation must remain usable without manual PDF repair |
| PRD-F9 | Canvas Compositing & Lean Snapshot Capture | Preserves the committed visualization snapshot in the printable document |
| PRD-F10 | Quotation Measurement Modal & Parametric BOM Engine | Preserves calculated itemization and exact totals while changing layout only |
| PRD-F11 | Consultation PDF Reference Generation | Repairs the browser print and Save as PDF increment without claiming server PDF completion |
| SDD-C6 | Canvas Compositor & Snapshot Pipeline | Keeps the supplied raster snapshot intact and aspect-correct |
| SDD-C7 | Parametric BOM Pricing Engine & PDF Generator | Stabilizes browser quotation markup, print styling, and print lifecycle behavior |
| ERD-E10 | Visualization Snapshots | Consumes existing snapshot data without database mutation |
| ERD-E13 | Quotation Estimates | Does not change `pdf_r2_object_key` or quotation persistence |
| ERD-E14 | Quotation Items | Preserves every item and consolidated amount |
| QAD-TC10 | Quotation Calculation Accuracy | Confirms layout changes do not alter arithmetic |
| QAD-TC11 | Consultation Reference PDF | Adds mobile saved-PDF integrity coverage while retaining the IMP-MS14 partial-fulfillment boundary |
| BAN-PUNCT-01 | No em dashes in documentation or comments | Uses standard hyphens, colons, and parentheses only |
| BAN-TYPE-05 | No `any` in TypeScript | Requires explicit preview-window and readiness-port types |
| BAN-UI-09 | No foreign UI styles | Reuses the established quotation visual tokens and markup |

---

## 3. Architectural Scope & Boundaries

### 3.1 In Scope

| Layer | Component | Planned Modification |
|---|---|---|
| `src/lib/pricing/` | `quotationPdfGenerator.ts` | Separate screen responsiveness from print layout, add print-safe fragmentation rules, bound printable snapshots, and remove print-time overflow clipping |
| `src/lib/pricing/` | `quotationPdfContent.ts` | Centralize the approved preliminary terms and accessory warranty copy |
| `src/lib/pricing/` | `quotationPreviewWindow.ts` | Wait for document readiness, decode all images, and cross a stable layout and paint barrier before auto-printing |
| `tests/unit/` | `quotationPdfGenerator.test.ts` | Add deterministic regression assertions for media scoping, print resets, fragmentation, and readiness ordering |
| Manual QA | Mobile browser print flows | Verify Android Chrome and iOS Safari or the available equivalent across narrow viewports and representative quotation shapes |
| `docs/implementation/` | `fix-ms14.md` | Preserve the diagnosis, implementation contract, verification matrix, and release boundary |

### 3.2 Out of Scope

| Area | Rationale |
|---|---|
| Pricing formulas | The failure capture indicates rendering loss, not incorrect BOM arithmetic |
| Server-side PDF generation | IMP-MS14 explicitly defers the production renderer and R2 PDF pipeline |
| R2 PDF persistence | No `pdf_r2_object_key` update is authorized by this fix |
| Database schema or RLS | No persistence contract changes are required |
| Snapshot capture or Three.js compositing | The fix consumes the existing committed snapshot and does not regenerate it |
| Other quotation copy or legal claims | Only the preliminary terms and accessory warranty in Section 4.7 are approved for this increment |
| New browser or PDF dependency | Existing browser print support, Node tests, and available Poppler tools are sufficient |
| User-agent-specific CSS | The fix must rely on media types and paged-media behavior, not browser sniffing |

---

## 4. Technical Specification

### 4.1 Establish a Deterministic Mobile Print Fixture

Create a fixed test fixture inside the existing quotation generator test suite or a focused adjacent fixture module. It must contain:

1. A single fixture matching the supplied failure shape.
2. A valid raster snapshot with a tall enough aspect ratio to exercise pagination.
3. Customer metadata, dimensions, pricing summary, BOM, checklist, signatures, and consumer notice.
4. A multi-fixture variant with at least two item cards and one structural waiver.
5. Stable monetary and dimensional values so text and page comparisons are deterministic.

The fixture must not use network images. Use a small approved raster data URL for automated checks and the real committed snapshot only for manual reproduction.

### 4.2 Isolate Screen Responsive Rules from Print Rules

Change the narrow layout query from an unqualified media query to a screen-only media query:

```css
@media screen and (max-width: 640px) {
  /* Preview-only responsive rules. */
}
```

The print stylesheet must explicitly define its A4 layout rather than depend on whichever screen rules happen to win the cascade. At minimum, print mode must set:

1. Two-column header, metadata, fixture specification, and signature layouts when content fits.
2. Print-safe font sizes and cell padding independent of the mobile viewport.
3. Logo dimensions in physical or bounded print units without `vw` limits.
4. A document width of 100% inside the `@page` content box.
5. Snapshot width of 100%, height auto, `object-fit:contain`, and a physical maximum height that fits with its caption.
6. No screen toolbar, screen shadow, screen radius, or viewport gutter.

The screen preview must retain its current 320px responsive behavior.

### 4.3 Define Print-Safe Fragmentation Boundaries

Use explicit print classes or selectors with narrowly scoped responsibilities:

1. Keep the document header, metadata card, pricing summary, compact fixture specifications, ocular card, and consumer notice intact when each block can fit on one page.
2. Keep a fixture header with at least the first following content block.
3. Keep snapshot image and caption together.
4. Allow long BOM tables and multi-fixture collections to paginate.
5. Keep individual table rows intact and repeat table headers.
6. Set `.item-card` to `overflow:visible` in print so a long fixture can fragment without clipping descendants.
7. Avoid `break-inside:avoid` on the entire document, the entire multi-fixture collection, or an item card that can exceed one page.
8. Use `orphans` and `widows` values for prose where supported, while treating them as progressive enhancement.

Print rules must not solve pagination by hiding content, shrinking the entire document to unreadable size, or forcing every quotation into two pages.

### 4.4 Bound Snapshot Geometry for A4 Output

The screen preview may continue using its current responsive maximum height. Print mode must use a separate bounded height in millimeters so a large portrait or landscape snapshot cannot consume an unpredictable page fragment.

Required behavior:

1. Preserve the source aspect ratio.
2. Never crop the client-space visualization.
3. Never stretch the snapshot to fill a fixed box.
4. Keep the caption on the same page as the snapshot.
5. Render the neutral fallback with equivalent print-safe geometry.
6. Leave sufficient room for at least one adjacent identifying section where practical.

The exact millimeter limit must be selected from the red reproduction, then verified with portrait, landscape, square, and missing snapshots.

### 4.5 Strengthen Preview Readiness Before Auto-Print

Refine `quotationPreviewWindow.ts` without introducing a third-party dependency.

1. Wait for the written preview document to reach a ready state suitable for printing.
2. Await `document.fonts.ready` when available.
3. Call `decode()` for supported images even when `image.complete` is already true.
4. Treat image decode rejection as a settled asset so one broken image cannot deadlock printing.
5. Preserve the existing bounded 5-second escape hatch.
6. After assets settle, wait for two animation frames in the preview window before invoking `print()` so style calculation, layout, and paint can complete.
7. Keep preview mode free of automatic printing.
8. Keep the preview window open after printing or cancellation.
9. Preserve typed `POPUP_BLOCKED` and `DOCUMENT_WRITE_FAILED` results.

The preview port interfaces must be extended explicitly for any load-state, event, or animation-frame capability. Do not use `any` or cast away the contract.

### 4.6 Preserve Content and Pricing Contracts

The fix must not alter:

1. `QuotationPdfMetadata` business fields.
2. Single-fixture or multi-fixture pricing calculations.
3. The four BOM groups and consolidated totals.
4. HTML escaping and image-source sanitization.
5. Structural waiver conditions and wording.
6. Booking share-message exports.
7. The browser-preview boundary documented by IMP-MS14.

Except for the approved appendix in Section 4.7, only structural markup classes needed for reliable pagination may be added.

### 4.7 Add a Preliminary Terms and Warranty Appendix

Add a dedicated appendix after the consumer notice with the headings `TERMS AND CONDITIONS` and `WARRANTY`.

Required behavior:

1. Start the appendix on a new printed page.
2. State that the preliminary estimate does not by itself create a binding contract.
3. State that the terms apply only when incorporated into a final written quotation or agreement accepted by both parties.
4. Require amendments to be agreed upon in writing by both the Customer and R.R.D. Aluminum and Glass Works.
5. Define the final contract as the final quotation and other written documents signed or expressly accepted by both parties.
6. Provide a six-month warranty on defective accessories beginning at project completion or turnover.
7. Make warranty coverage subject to inspection and repair by R.R.D. Aluminum and Glass Works.
8. Exclude misuse, improper handling, accidents, unauthorized repairs or modifications, normal wear and tear, and circumstances beyond the control of R.R.D. Aluminum and Glass Works.
9. Keep the approved copy in one typed internal module and escape it during HTML generation.
10. Render the appendix in draft and signed-reference quotations.
11. Do not include bank details, payment instructions, payment links, QR codes, or claims that payment was requested or received.
12. Do not change `QuotationPdfMetadata`, pricing, persistence, or the browser-preview boundary.

---

## 5. Implementation Sequence

1. Capture the failing PDF or reproduce it with the fixed mobile quotation fixture.
2. Render every failing PDF page to PNG and extract its text to determine whether content is absent, clipped, or viewer-only.
3. Test the ranked hypotheses one variable at a time, starting with screen-only media scoping.
4. Convert the minimized reproduction into regression assertions at the generator and preview-window seams.
5. Implement print-specific layout resets and fragmentation rules.
6. Implement document, font, image decode, and stable paint readiness.
7. Re-run the original failing mobile scenario and render the resulting PDF pages for inspection.
8. Verify single-fixture, multi-fixture, waiver, missing-image, and long-text cases.
9. Run the required repository quality gates.
10. Record the confirmed root cause in the implementation commit or pull request summary.

---

## 6. Automated Verification Matrix

| Test ID | Requirement |
|---|---|
| TC-fix-MS14-01 | Mobile responsive rules are scoped to `screen` and do not apply to print media |
| TC-fix-MS14-02 | Print CSS explicitly restores header, metadata, fixture, signature, logo, table, and document geometry |
| TC-fix-MS14-03 | Print mode removes overflow clipping from fragmenting item cards |
| TC-fix-MS14-04 | Compact decorated sections avoid internal page breaks, while long tables and multi-fixture collections remain pageable |
| TC-fix-MS14-05 | Snapshot and caption remain together with aspect ratio preserved and a bounded print height |
| TC-fix-MS14-06 | Already-complete images still pass through `decode()` when supported |
| TC-fix-MS14-07 | Decode rejection settles readiness and does not prevent printing |
| TC-fix-MS14-08 | Auto-print waits for document readiness, fonts, images, and the stable paint barrier |
| TC-fix-MS14-09 | The 5-second fallback still releases printing when a readiness signal never settles |
| TC-fix-MS14-10 | Preview mode never invokes print automatically |
| TC-fix-MS14-11 | Single-fixture HTML retains the same itemization and exact total |
| TC-fix-MS14-12 | Multi-fixture HTML retains every fixture, per-item BOM, waiver, and consolidated total |
| TC-fix-MS14-13 | Invalid or missing snapshots retain the neutral fallback and do not create an empty print region |
| TC-fix-MS14-14 | HTML escaping, trusted image origins, popup failure, and public generator contracts remain unchanged |
| TC-fix-MS14-15 | Draft and signed-reference quotations render the preliminary terms and accessory warranty appendix on a dedicated print page |
| TC-fix-MS14-16 | The appendix contains no bank details, payment instructions, or payment-status claims |

The existing `node:test`, `node:assert`, and `tsx --test` stack must be used. Do not add Jest, Vitest, Playwright, Puppeteer, or another production dependency.

---

## 7. Manual PDF Verification Matrix

| Scenario | Expected Result |
|---|---|
| Android Chrome at 320px or equivalent narrow viewport | Saved PDF contains no blank decorated continuation, clipped text, or excessive unexplained whitespace |
| Android Chrome at 375px and 390px | Print output remains A4 and does not inherit the single-column screen layout |
| iOS Safari or available WebKit mobile equivalent | Snapshot, summary, BOM, checklist, and notice remain visible and correctly paginated |
| Desktop Chrome control | Existing A4 output remains visually stable |
| Single fixture with portrait snapshot | Snapshot is contained, uncropped, and kept with its caption |
| Single fixture with landscape snapshot | Snapshot remains legible without consuming an unpredictable page fragment |
| Single fixture without snapshot | Neutral fallback is visible and compact |
| Multiple fixtures | Long fixture cards paginate without clipping; each fixture header and repeated table header remain understandable |
| Long customer and product values | Text wraps without horizontal overflow or content loss |
| Print dialog cancellation and retry | Preview remains open and a second print produces the same complete output |
| PDF opened in two independent viewers | Both viewers show the same content; any viewer-only defect is documented separately |

For every release candidate PDF:

1. Run `pdfinfo` and confirm A4 page dimensions and expected page count.
2. Run `pdftotext` and confirm the header, customer, project, estimated total, four BOM groups, checklist, and consumer notice are present.
3. Run `pdftoppm -png` and inspect every page for clipped, blank, duplicated, or orphaned sections.

---

## 8. Definition of Done (Exit Criteria)

1. The original mobile failure no longer reproduces on the identified device and browser.
2. Saved mobile PDFs contain visible text and images wherever card backgrounds or borders are rendered.
3. No unexplained blank continuation or excessive whitespace appears before the itemized table.
4. Mobile screen preview rules do not affect A4 print layout.
5. Snapshots remain uncropped, aspect-correct, and bounded for paged output.
6. Long multi-fixture content paginates without overflow clipping.
7. Auto-print occurs only after document, fonts, images, layout, and paint are ready or the bounded fallback expires.
8. Preview mode and print cancellation behavior remain unchanged.
9. Single-fixture and multi-fixture prices remain exact to the centavo.
10. Existing escaping, sanitization, waiver, popup, share-message, and generator contracts remain intact.
11. `npm run lint` passes with zero new errors.
12. `npx tsc --noEmit` passes with zero type errors.
13. `npm test` passes, including all TC-fix-MS14 automated coverage.
14. `npm run build` succeeds.
15. Manual Android Chrome and one WebKit or second-browser PDF verification pass.
16. No em dashes are introduced in code comments or documentation.
17. No `any` types or new dependencies are introduced.
18. Release notes continue to state that server-rendered and R2-persisted PDF completion remains outside IMP-MS14 and fix-MS14.
19. Every quotation includes the approved preliminary terms and accessory warranty on a dedicated appendix page.
20. No bank details or payment instructions appear in the generated quotation.

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Aggressive keep rules create large blank areas | Medium | Medium | Keep only compact blocks intact and allow long tables and item cards to fragment |
| Snapshot height becomes too small to be useful | Low | Medium | Choose the physical limit from real A4 renders and test portrait and landscape images |
| Additional readiness steps delay the print dialog | Medium | Low | Use two animation frames rather than an arbitrary delay and retain the 5-second upper bound |
| Image decode is unsupported or rejects on one browser | Medium | Low | Treat unsupported or rejected decode as settled after load state evaluation |
| A viewer-specific rendering bug is mistaken for bad PDF content | Medium | Medium | Compare extracted text and rendered pages across Poppler and a second viewer |
| Print changes regress the mobile screen preview | Low | Medium | Scope print and screen rules explicitly and retain 320px screen assertions |
| Multi-fixture quotations exceed expected page counts | Medium | Low | Define correctness by complete readable pagination, not a fixed page total |

---

## Self-Check

- [x] Target file is `docs/implementation/fix-ms14.md`
- [x] Follows the metadata, numbered sections, scope tables, definition of done, risk assessment, and self-check conventions used by existing fix-MS documents
- [x] Distinguishes observed evidence from ranked, falsifiable hypotheses
- [x] Requires a red-capable mobile PDF reproduction before production changes
- [x] Maps the fix to PRD-F9, PRD-F10, PRD-F11, SDD-C6, SDD-C7, ERD-E10, ERD-E13, ERD-E14, QAD-TC10, and QAD-TC11
- [x] Preserves the IMP-MS14 browser print boundary and does not claim server PDF or R2 completion
- [x] Changes print layout, pagination, readiness, approved appendix copy, tests, and verification behavior
- [x] Introduces no database migration, pricing change, new dependency, hardcoded secret, or RLS bypass
- [x] Contains no em dash, no box diagram, and no authorization for TypeScript `any`
- [x] Status reflects the implemented production and regression-test changes
