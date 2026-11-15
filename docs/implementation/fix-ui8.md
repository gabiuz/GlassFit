# Implementation Specification: Mobile Admin Search and Booking Success Visibility (fix-ui8)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Implementation-ready plan for two reported mobile frontend defects  
**Version:** 1.0.0  
**Date:** October 30, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Ready for Implementation  
**Upstream Specifications:** `docs/brd-glassfit.md` (BRD-M4), `docs/prd-glassfit.md` (PRD-F13, PRD-F14), `docs/sdd-glassfit.md` (SDD-C8, SDD-C9), `docs/dsd-glassfit.md` (Section 2, DSD-UI8, DSD-UI14), `docs/qad-glassfit.md` (QAD-TC13, QAD-TC51, QAD-VG4)  
**Implementation State:** Not started. This document is a plan only.  

---

## 1. Authorized Requirements

1. Make the search input on the mobile admin Product page proportionate to the surrounding controls. Preserve search behavior, its accessible name, and mobile keyboard usability.
2. Keep the entire "Booking sent successfully" dialog visible or reachable by scrolling on mobile. Its top edge, success icon, details, and Back to Home action must remain accessible when the dialog exceeds the visible browser viewport.

The user screenshots establish the reported appearance, not a confirmed CSS root cause. Text and numbers inside the screenshots are example data, not instructions or required copy changes. This plan does not authorize application changes in the current request.

---

## 2. Evidence and Reproduction

| Issue | Repository evidence and current lead | Reproduction required before editing |
|---|---|---|
| Oversized mobile search | The screenshot shows a tall search field and cyan action area above Add Product. `src/features/admin/products/ProductsContent.tsx` renders the shared `SearchBar`. `src/components/shared/SearchBar.tsx` uses a 60px input wrapper (`h-15`) and 20px input text without a mobile size variant. These are leads, not a measured cause. The current local page also has an Add-on Accessory action and scope tabs absent from the screenshot, so the capture may show another deployed revision. | Confirm the deployed commit or reproduce against the current checkout with an authorized admin account at 320px, 375px, 390px, and 430px CSS viewport widths. Measure rendered search height, font size, action hit area, neighboring button heights, focus zoom, and horizontal overflow. Account for the revision difference before choosing a correction. |
| Cropped booking success | The screenshot shows the success dialog touching the top of the browser content area. `src/features/booking/components/Step4Success.tsx` uses a fixed `inset-0` overlay with centered flex alignment, `overflow-y-auto`, and vertical card margins. `BookingFlow.tsx` renders it at step 5 over the prior confirmation step. A tall centered card could place its top above the scroll origin, but that is not proven by the screenshot. | Complete Messenger and Viber booking flows through confirmation. At mobile, short-height, and landscape viewports, measure the visual viewport, overlay scroll area, card bounds, scroll range, and focus behavior with browser chrome expanded. Confirm whether the top is reachable before editing. |

DSD Section 2 defines mobile as 320px through 639px. Include 639px and 640px to catch the breakpoint transition. Emulation can expose geometry; final viewport and scroll acceptance requires physical Android Chrome and iOS Safari checks.

---

## 3. Traceability

| Code | Relationship |
|---|---|
| BRD-M4 | Supports usable, readable customer and administrative workflows on phones. |
| PRD-F14, SDD-C9, DSD-UI14 | Govern the admin product workbench, search, filters, and responsive presentation. |
| PRD-F13, SDD-C8, DSD-UI8 | Govern the signed booking and messaging handoff whose final success state must remain usable. |
| QAD-TC51 | Protects product search and filter composition, result count, keyboard operation, and row actions. |
| QAD-TC13 | Protects the Messenger and Viber booking handoff path leading to success. |
| QAD-VG4 | Provides the existing accessibility gate for readable content and reachable controls. |
| FIX-UI8-V1 through FIX-UI8-V4 | Plan-local acceptance cases; these do not claim new QAD catalog IDs. |

---

## 4. Planned Implementation Contract

### 4.1 Admin Product search

**Primary files:** `src/features/admin/products/ProductsContent.tsx` and, only if a shared variant is warranted, `src/components/shared/SearchBar.tsx`.

After measuring the current page, reuse its spacing, typography, cyan search treatment, and shared controls to reduce the field's mobile height and text scale. Keep input text at least 16px on mobile to avoid focus zoom and the search action's touch target at least 44px. The input and action must fit without clipping the placeholder, hiding focus, or causing document-level horizontal overflow. Preserve the `value`/`onChange` search contract and filter composition. If changing the shared `SearchBar`, use an explicit variant or verify its other consumers: public product search, dashboard products, admin materials, and admin bookings. Do not resize the whole admin page to compensate for one control.

### 4.2 Booking success dialog

**Primary file:** `src/features/booking/components/Step4Success.tsx`. Inspect `BookingFlow.tsx` and `/send-booking` only if reproduction shows that the parent flow affects viewport height or scrolling.

Make the overlay and card behave correctly when the card is taller than the visible viewport. Preserve centered presentation when it fits; when it does not, allow scrolling from the card's true top to its bottom. Reserve space for mobile browser chrome and device safe areas without disabling zoom or preventing scroll. Preserve the success message, reference, channel, date, estimated price, next steps, and Back to Home action. Check keyboard and focus reachability. Do not alter booking persistence, pricing, message handoff, or copy for this layout fix.

### 4.3 Scope boundary

The admin product table's horizontal scrolling is visible in the first screenshot but is separate from the reported search size. Record an independent table defect for a later request. Screenshot booking values are example data and do not authorize record changes. Reuse repository styles and dependencies; no new UI library, global token change, or database migration is needed.

---

## 5. Agent Delegation Before Implementation

| Agent | Later responsibility | Ownership and sequence |
|---|---|---|
| `frontend-developer` (admin Product) | Reproduce and implement measured mobile search sizing. Check behavior and every shared `SearchBar` consumer if changing that component. | Own `ProductsContent.tsx`; own `SearchBar.tsx` only after confirming a variant is needed. Can proceed independently of booking. |
| `frontend-developer` (booking success) | Reproduce tall-dialog scrolling, then correct success overlay geometry and reachability. | Own `Step4Success.tsx`; inspect `BookingFlow.tsx` first and coordinate before changing it. Can proceed independently of admin Product. |
| `qa-expert` | Verify the combined viewport, touch, keyboard, and flow matrix, including physical devices and desktop regression. | Prepare cases during implementation; validate after both frontend changes are integrated. |

The `agent-organizer` advised separate file owners and a final QA pass. If reproduction contradicts the current leads, the relevant frontend agent should diagnose the measured cause before editing; add a `debugger` only if the failure crosses component boundaries or remains unexplained. No implementation agents were started for this plan-only request.

---

## 6. Verification and Acceptance Matrix

| Case | Required result |
|---|---|
| FIX-UI8-V1: Search geometry | At 320px, 375px, 390px, 430px, 639px, and 640px, the admin search is proportionate to nearby controls; placeholder and focus fit; input text remains at least 16px on mobile; search action has a minimum 44px touch target. Search causes no document-level horizontal overflow. |
| FIX-UI8-V2: Search behavior | Typing, clearing, combined type and status filters, result counts, empty state, keyboard operation, and Add Product actions still work. If shared `SearchBar` changes, its other four callers retain expected mobile and desktop layout. |
| FIX-UI8-V3: Booking success reachability | After Messenger and Viber handoff, the dialog top, icon, heading, details, and Back to Home action can be seen or reached by normal scrolling at 320px through 430px, short-height portrait, and landscape. Scroll reaches the true top and bottom with browser chrome visible and after its height changes. No content hides under a safe area. |
| FIX-UI8-V4: Booking flow regression | Confirmation still advances once to success; reference, channel, date, and price display as before; Back to Home works by touch and keyboard. A fitting dialog stays centered and readable at tablet and desktop widths. |

Use screenshots and measured bounds for geometry, then verify scroll reachability on physical Android Chrome and iOS Safari. Check browser zoom and larger text where practical. After implementation, run relevant existing frontend tests, `npm run lint`, `npx tsc --noEmit`, and `npm run build`; record pre-existing failures separately. The FastAPI health check is relevant only if the full photo-based booking reproduction starts that service.

---

## 7. Readiness and Risks

The screenshots and local source identify the affected areas and credible layout leads, but not exact root causes. The Product screenshot differs from the current checkout, so implementation must identify which revision will be fixed. Booking must be tested against the visual viewport and on real phones because browser chrome and safe areas can change available height after initial render.

## Self-Check

- [x] Plan-only `fix-ui8.md` follows the existing `docs/implementation/fix-ui*.md` naming and metadata convention.
- [x] Both defects have reproduction steps, scoped file ownership, traceability, and observable acceptance criteria.
- [x] Screenshot evidence is distinguished from hypotheses and from user instructions.
- [x] No application code, dependencies, data, or design tokens are changed by this document.
