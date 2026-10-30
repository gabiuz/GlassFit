# Implementation Specification: Messaging, Mobile Workspace, Admin, and Quotation Fixes (fix-ui11)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document Function:** Implementation-ready plan for five reported frontend issues
**Version:** 1.0.0
**Date:** October 30, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Implemented in source (manual device and catalog QA pending)
**Upstream Specifications:** `docs/brd-glassfit.md` (BRD-M1, BRD-M4, BRD-M5), `docs/prd-glassfit.md` (PRD-F6, PRD-F10, PRD-F13, PRD-F14), `docs/sdd-glassfit.md` (SDD-C5, SDD-C7, SDD-C8, SDD-C9), `docs/dsd-glassfit.md` (Section 2, DSD-UI4, DSD-UI8, DSD-UI15), `docs/qad-glassfit.md` (QAD-TC10, QAD-TC13, QAD-TC14, QAD-TC18, QAD-TC29, QAD-TC30, QAD-TC59, QAD-VG4)

---

## 1. Authorized Requirements and Evidence Boundary

1. [Issue #174](https://github.com/gabiuz/GlassFit/issues/174): The **Send via Viber** action must take the customer into a usable Viber handoff with the signed reference and message available.
2. [Issue #175](https://github.com/gabiuz/GlassFit/issues/175): A room photo must remain fully visible and correctly aligned with product overlays while editing a visualization on a phone.
3. [Issue #176](https://github.com/gabiuz/GlassFit/issues/176): The admin dashboard's **Quick Actions** must fit and remain readable on smaller screens, including the tablet width shown in the report.
4. [Issue #167](https://github.com/gabiuz/GlassFit/issues/167): A product with no glass must not show a positive **Glass Infill** charge. The displayed amount and underlying BOM must agree.
5. [Issue #168](https://github.com/gabiuz/GlassFit/issues/168): Improve the quotation draft summary shown in the issue image. The working interpretation is that its gray information pills need clearer contrast, spacing, wrapping, and accurate labels. The issue contains no further written criteria, so reproduction must confirm the exact surface and intended content before implementation.

The five GitHub issues are open and have images but no comments or written acceptance details. The five images attached to this request corroborate the visual symptoms. Image text, sample prices, and browser chrome are evidence of the current UI, not instructions to change specific values. Source inspection below identifies leads, not verified runtime causes. This document changes no application code.

---

## 2. Evidence and Reproduction

| Issue | Current source evidence and uncertainty | Reproduce before editing |
|---|---|---|
| #174 | `Step3SendReference.tsx` copies the message without awaiting Clipboard API success, calls `onSend`, then uses `window.open` on a custom scheme. `formatBookingShareMessage` currently builds `viber://forward?text=...`, while SDD-C8 specifies a `viber://chat?number=...` handoff. A unit test in `milestone7.test.ts` asserts the current `forward` URL. The screenshot does not show whether the browser blocked the popup, Viber is absent, or the URI is unsuitable. | Complete `/send-booking` with a valid signed reference, tap Viber on Android Chrome and iOS Safari with Viber installed, and record whether the app opens a compose or business chat with the message and link. Repeat without Viber, with clipboard permission denied, and after returning to the browser. Compare Messenger and verify whether the UI advances to Step 4 only after a meaningful handoff. |
| #175 | `ProductModelWorkspace.tsx` sizes the compact editor with a `100dvh` three-row shell and a container-query-sized aspect-ratio canvas. The room `<img>` uses `object-cover`, while the snapshot path comments and code use contain-fit drawing. The reported portrait screenshot shows visible photo content ending above a large dark region and a warning partly cut at the stage edge. The responsible geometry has not been measured. | Edit a placed sliding door in portrait at 320px, 375px, 390px, 430px, and short viewport heights; capture source photo dimensions, canvas and stage rectangles, computed image fit, overlay coordinates, and warning bounds. Rotate to landscape, open and close controls, resize browser chrome, then inspect the saved snapshot and return to editing. Repeat with wide and tall photos and at least two placed products. |
| #176 | `DashboardContent.tsx` gives Quick Actions 5 of 12 columns at `md`, while `QuickActions.tsx` switches its cards to two columns at `sm`. Those nested breakpoints can make each card very narrow at tablet widths. The screenshot shows this beside the booking table, but exact widths remain unmeasured. | Open `/admin` with an authorized account at 320px, 375px, 390px, 639px, 640px, 768px, 820px, 1023px, 1024px, and desktop. Measure both cards, titles, and buttons; check the adjacent Recent Booking Request table and Product Update section for overflow. Activate both actions with touch and keyboard. |
| #167 | `PriceCard.tsx` always renders a Glass Infill tile when `bomGroups` exists. `ProductSummary.tsx` supplies `bomCalc.effectiveGlazingCost`; `pricingEngine.ts` classifies components with `presentationCategory === "Glazing"` and always creates a Glass Infill group. It also has a default glass description when no glazing item exists. A positive amount may reflect incorrect component classification or a valid non-glass infill stored under Glazing. | Identify the exact no-glass product from the report and inspect its product components, material bindings, `presentationCategory`, calculated `glazingItems`, `effectiveGlazingCost`, group rows, and rendered quote. Compare one glass product, one no-glass product, and any opaque or metal infill product. Check whether the amount is truly charged or only mislabeled, and compare the customer quote with the frozen quotation and document preview. |
| #168 | `Step1ViewPdf.tsx` renders the reported **Quotation DRAFT** metadata and pills. The standard pills use white text on `#c3c3c3`, `whitespace-nowrap`, and a hardcoded **Parametric Series 798** label. The screenshot supports a readability and layout concern, but not a precise requested design. | Open Step 1 of `/send-booking` for one and multiple products at phone, tablet, and desktop widths. Inspect pill contrast, wrapping, spacing, and document overflow with large prices, long identifiers, waiver state, and enlarged text. Compare each label and amount with the actual quotation. Verify the preview and Print / Save as PDF actions still work. |

DSD Section 2 defines mobile as 320px through 639px and tablet as 640px through 1023px. Include 639px and 640px to catch breakpoint transitions. Check the revision serving the reported screenshots against the current checkout before assuming every defect still reproduces. Browser emulation can measure layout; final mobile acceptance needs Android Chrome and iOS Safari. Authentication, a valid quotation, and an admin test account are required for full browser reproduction. No private customer photo should be placed in `public/` or committed as a test fixture.

---

## 3. Traceability

| Requirement | Relationship |
|---|---|
| BRD-M1; PRD-F13; SDD-C8; DSD-UI8; QAD-TC13, QAD-TC29 | #174 must preserve signed-link generation and booking records while making the Viber handoff usable. Existing QAD-TC13 exercises Messenger, so Viber requires plan-local device acceptance. |
| BRD-M4; PRD-F6; SDD-C5; DSD-UI4, DSD-UI15; QAD-TC59 | #175 must preserve room-photo, overlay, pointer, and snapshot coordinate parity in the compact editor. |
| BRD-M4; PRD-F14; SDD-C9; QAD-TC14 | #176 must keep the protected admin dashboard and its navigation usable at all supported widths. |
| BRD-M5; PRD-F10; SDD-C7; QAD-TC10, QAD-TC18, QAD-TC30 | #167 must reconcile displayed Glass Infill with the calculated and frozen BOM without concealing a real charge. |
| BRD-M4; PRD-F10, PRD-F13; SDD-C7, SDD-C8; DSD-UI8; QAD-TC30, QAD-VG4 | #168 must make Step 1 quotation metadata legible and accurate while preserving preview, print, and booking handoff. |
| FIX-UI11-V1 through FIX-UI11-V6 | Plan-local acceptance cases, not new QAD catalog IDs. |

---

## 4. Agent Delegation Before Implementation

The `agent-organizer` was consulted for the initial breakdown. These are proposed assignments for a later implementation pass. No implementation, design, QA, or review agent has been started.

| Agent | Later responsibility | Ownership and coordination |
|---|---|---|
| `frontend-developer` (booking handoff) | Reproduce #174 on devices, correct the launch and message fallback, and update its existing link tests. | Own `Step3SendReference.tsx` and the share-link formatter in `quotationPdfGenerator.ts`; coordinate edits to the shared formatter with the pricing owner. |
| `frontend-developer` (visualization) | Reproduce #175 and correct photo/stage fitting with overlay, pointer, and snapshot parity. | Own `ProductModelWorkspace.tsx` and only the visualization helpers proven necessary by measurement. |
| `frontend-developer` (admin and quotation metadata) | Fix #176's responsive card arrangement and #168's draft pills after source comparison. | Own `DashboardContent.tsx`, `QuickActions.tsx`, and `Step1ViewPdf.tsx`. These surfaces are separate but share a presentation focus. |
| `fullstack-developer` (pricing) | Trace #167 from product binding through BOM computation, quotation display, and frozen document before selecting a correction. | Own `pricingEngine.ts`, `ProductSummary.tsx`, `PriceCard.tsx`, and pricing tests only as evidence requires. If the data binding is wrong, coordinate a separate admin product correction rather than masking the value. |
| `ui-designer` | Advise on #176 and #168 using existing components, DSD layout rules, and established color tokens. | Read-only design guidance before the presentation owner edits; no new palette or library. |
| `qa-expert` and `code-reviewer` | Establish a before-change baseline, run the acceptance matrix after integration, and review the final diff for regressions. | QA and review are read-only roles; route failures to the owning agent. |

The booking, visualization, admin/metadata, and pricing files can be owned independently. Coordinate `quotationPdfGenerator.ts` changes because it also renders pricing documents. Assign a single owner to any newly shared file before editing. Read the relevant `node_modules/next/dist/docs/` guide before changing Next.js code, as required by this repository's agent rules.

---

## 5. Planned Implementation Contract

### 5.1 Viber handoff (#174)

Determine the supported Viber launch contract and the business's configured destination before replacing the URI. Use a user-gesture-safe launch path that works on supported mobile browsers; retain the signed reference and prefilled message where the platform permits. Provide an explicit copy or share fallback when Viber is unavailable or a custom scheme cannot be opened. Report clipboard failure honestly and do not show a copied or sent success solely because `writeText` or `window.open` was called. Keep booking creation idempotent and avoid duplicate requests on repeated taps. Update tests that currently encode `viber://forward` once the verified contract is chosen. Do not embed an unverified business phone number or change signed-link semantics.

### 5.2 Mobile photo editing (#175)

Choose the photo fit from measured intrinsic and stage dimensions so the full intended room image is visible without distortion in the compact editor. Keep the product overlay, perspective handles, obstruction warning, and bottom controls inside their intended stage or drawer. Apply the same transform to visual display, hit testing, and snapshot composition; a CSS-only fit change is insufficient if saved images or pointer positions diverge. Preserve safe-area behavior, scroll isolation, edits across orientation changes, and the landscape guidance. Keep photo ingestion and CV processing unchanged unless reproduction proves a source-image problem.

### 5.3 Admin Quick Actions (#176)

Size the Quick Action cards according to their actual parent width, including the tablet two-column dashboard layout. If two cards cannot fit side by side with readable titles and buttons, stack them within their column or adjust the dashboard track distribution using existing responsive patterns. Preserve card order, colors, labels, route destinations, adjacent booking content, and keyboard focus. Neither card should overlap or create document-level horizontal scrolling.

### 5.4 No-glass BOM and display (#167)

Trace the reported positive amount to its contributing components. If the product has no glazing material, correct the component category or calculation so `glazingItems`, `effectiveGlazingCost`, the group row, and the UI agree at zero. If a legitimate opaque infill charge is grouped as Glazing, classify and label it consistently with the actual material rather than deleting its cost. Hide the Glass Infill tile only when its absence is semantically correct; never solve a real pricing defect by hiding a positive charge. Preserve unrelated framing, hardware, labor, margin, total, saved snapshot, and historical quotation values. Any catalog-data correction must use the project's supported authoring path or a versioned migration, not a manual database mutation.

### 5.5 Draft quotation summary (#168)

Improve the Step 1 metadata pills' contrast, breathing room, and responsive wrapping using existing GlassFit tokens and components. Keep the draft status and price prominent without making the information pills look like unavailable controls. Make dynamic values safe for long product names and large PHP amounts. Confirm whether **Parametric Series 798** describes the actual quotation; use truthful quotation data where available rather than preserving a hardcoded false label. Preserve the date, estimate value, waiver meaning, preview action, and print action. Keep any broader redesign outside this issue unless the owner supplies more criteria.

### 5.6 Scope boundary

Do not introduce dependencies, new messaging accounts, WebXR, pricing changes unrelated to the no-glass product, or global CSS overrides. No schema change is anticipated. Existing UI patterns and current Tailwind tokens govern presentation work.

---

## 6. Verification and Acceptance Matrix

| Case | Required result |
|---|---|
| FIX-UI11-V1: Viber | With Viber installed on Android and iOS, tapping Send via Viber reaches a usable compose or business conversation path and keeps the signed reference available. Without Viber or with denied clipboard access, the customer receives a clear usable copy/share path. Booking state and displayed feedback match what actually occurred; repeated taps do not create duplicate records. |
| FIX-UI11-V2: Photo fit | At phone widths, short heights, and both orientations, all four edges of wide and tall room photos are reachable in the intended fit, with no unintended crop. Product placement, handles, warnings, and controls remain usable; resized and reopened edits retain coordinates. Saved snapshots align with the visible composite. |
| FIX-UI11-V3: Admin cards | At 320px, 375px, 390px, 639px, 640px, 768px, 820px, 1023px, 1024px, and desktop, both Quick Action titles and buttons stay inside their cards without text overlap or page-wide scrolling. Products and Bookings navigate correctly by touch, mouse, and keyboard; adjacent dashboard sections remain readable. |
| FIX-UI11-V4: No-glass price | A no-glass product has no positive Glass Infill charge in the calculation, quote UI, frozen item breakdown, and document preview. Glass products retain correct glazing amounts and scrap. Any non-glass infill cost appears under a truthful category; all totals reconcile to the centavo and historical saved quotes are unchanged. |
| FIX-UI11-V5: Draft metadata | At 320px through desktop and 200% zoom, every quotation metadata pill is readable, has sufficient contrast, wraps or fits within its container, and reflects the actual product, price, sill, and waiver state. Preview and Print / Save as PDF still open correctly. |
| FIX-UI11-V6: Cross-flow regression | From visualization through quotation and signed booking, the displayed image and reference, price, selected platform, and saved document remain consistent. Existing Messenger behavior and protected admin access still work. |

Use focused existing tests in `tests/unit/milestone7.test.ts`, `signedBookingLink.test.ts`, `milestone8.test.ts`, `milestone4.test.ts`, and quotation document/pricing suites where their assertions cover behavior. Add a focused no-glass BOM case and a corrected Viber link case if the current tests miss these regressions. UI geometry and external app launch require browser/device checks; unit tests alone cannot prove them. After implementation, run `npm run lint`, `npx tsc --noEmit`, and `npm run build`, and record unrelated pre-existing failures separately. Run the FastAPI health check only if the visualization reproduction starts that service.

---

## 7. Sequence and Open Decisions

1. Confirm the current checkout and deployed revision, prepare authorized test states, and capture before-change device and viewport measurements for all five issues.
2. Resolve the Viber destination and supported launch behavior, the #175 photo/stage transform, and the actual components behind #167's amount before choosing implementation details. Confirm #168's intended summary content against the quotation data.
3. Give each implementation agent explicit file ownership, obtain design guidance for #176 and #168, and make the smallest changes that satisfy the measured cases.
4. Run the acceptance matrix on browser emulation and physical phones, fix any failures in the owning track, then complete integrated code review and required repository checks.

The main unknowns are the Viber URI supported by the target devices and business account, whether the current mobile editor crop is caused by image fit or stage sizing, which product/component creates the #167 charge, and how far the issue owner wants #168's visual enhancement to go. The first three require reproduction before code changes; the working acceptance for #168 is limited to the visible summary and truthful metadata.

## 8. Implementation Record

The source changes for #174 through #176, #167, and #168 are implemented. Viber now uses a separate message within its 200-character share limit, with the quotation number, amount, and complete signed link preserved. The compact editor uses contain-fit photo rendering, Quick Actions stack inside the tablet dashboard column, no-glass pricing follows the bound material category, and Step 1 shows readable quotation metadata from the actual product. The booking information card also uses flexible columns to keep warranty text inside its card.

Focused booking and pricing tests, TypeScript, targeted lint, and the production build passed during implementation. Repository-wide lint remains blocked by existing React effect errors in `AdminLoginForm.tsx` and `MobileBottomSheet.tsx`. Physical Android and iOS Viber launch, authenticated viewport checks, and the reported product's live catalog binding still need manual verification.

## Self-Check

- [x] `fix-ui11.md` follows the repository's `docs/implementation/fix-ui*.md` naming, metadata, traceability, delegation, and acceptance format.
- [x] Each linked issue has source evidence, reproduction steps, scoped ownership, and observable acceptance criteria.
- [x] Screenshots are treated as symptoms, separate from instructions and proven root causes.
- [x] The implementation adds no dependency, schema change, or manual database mutation.
