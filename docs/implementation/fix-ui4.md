# Implementation Specification: Tablet Layout, Footer Visibility, and Mobile Visualization Controls (fix-ui4)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Implementation-ready plan for responsive public UI corrections  
**Version:** 1.0.0  
**Date:** October 26, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Ready for Implementation  
**Upstream Specifications:** `docs/brd-glassfit.md` (BRD-M4), `docs/prd-glassfit.md` (PRD-F1, PRD-F3, PRD-F5, PRD-F6), `docs/sdd-glassfit.md` (SDD-C1, SDD-C5), `docs/dsd-glassfit.md` (Sections 1, 2, 3, and 4; DSD-UI3, DSD-UI4, DSD-UI15), `docs/qad-glassfit.md` (QAD-TC52, QAD-VG4)  
**Implementation State:** Implemented in the working tree; physical-device acceptance remains pending.  

---

## 1. Authorized Requirements

The next implementation pass must address five user-reported presentation issues:

1. Improve the public UI at tablet widths, especially the visualization intake shown in user attachment 1. Review the shared header and content layouts across customer-facing routes so text, cards, controls, and spacing fit without clipping or awkward wrapping.
2. Make the shared footer visible and reachable on tablet pages. The footer must appear after page content and remain accessible by normal scrolling.
3. Restore the missing "Bicutan, Parañaque" location line in the mobile footer. Use the confirmed location consistently with the site headers.
4. Reduce the height of the Visualization Workspace hero on mobile so the heading remains legible while the first content section appears sooner. User attachments 1 and 3 show the mobile and tablet hero presentation.
5. Place the Quantity control below the Dimension controls in the mobile visualization workspace, including the compact editor when its configuration drawer is open. Keep the desktop arrangement and all quantity behavior intact.

The DSD defines **Mobile Compact** as 320px to 639px, **Tablet Intermediate** as 640px to 1023px, and **Desktop Standard** from 1024px. Check both sides of the 640px and 1024px boundaries. Tablet portrait and landscape are both in scope.

---

## 2. Problem Statement and Current Evidence

| Reported issue | Current repository evidence | Investigation required before editing |
|---|---|---|
| Tablet layout feels poor | `HeroSection.tsx` switches hero height at `md` and heading size at `sm` and `lg`; `CalibrationModeSelector.tsx` switches its option grid to two columns at `md`. The user capture shows the workspace heading and calibration cards occupying or crowding the tablet viewport. | Reproduce on actual tablet Safari and responsive browser widths. Record which routes, orientations, text widths, card rows, and controls fail. Apply focused breakpoint fixes to the confirmed components. |
| Tablet footer appears missing | `LayoutWrapper.tsx` already renders `<Footer />` for public routes. `Footer.tsx` has no tablet-wide visibility rule on its root. | Scroll to the document end on the affected route. Distinguish a missing footer from a footer below a long page, blocked document scrolling, or a full-viewport workspace overlay. Fix the verified cause only. |
| Mobile location line is missing | `Footer.tsx` renders its location paragraph with `hidden md:block`, so it is deliberately hidden below 768px. | Restore visibility below 640px using the existing footer type and spacing. Use the confirmed "Bicutan, Parañaque" copy. |
| Mobile workspace hero is too tall | The shared visualization hero uses `min-h-60` below `md` and `md:min-h-115` from 768px. It is used by `/visualization`, product-aware upload, and product-aware workspace pages. | Measure the rendered hero, fixed navbar overlap, title wrapping, and first-section position at 320px through 639px. Reduce only the mobile hero footprint without clipping the title or changing the tablet and desktop presentation unintentionally. |
| Quantity should follow Dimension on mobile | `ProductModelWorkspace.tsx` already renders the Dimension block immediately before the Quantity block in source order. | Inspect the rendered normal workspace and compact editor drawer. Identify whether the complaint concerns visual placement, collapsed sections, drawer scrolling, or a different `/visualize` route. Preserve one shared control instance and correct only the confirmed mobile layout issue. |

The screenshots are visual evidence, not a complete root-cause diagnosis. In particular, a screenshot taken before the end of a long page cannot establish that its footer was omitted.

---

## 3. Traceability and Specification Mapping

| Traceability code | Relationship to this plan |
|---|---|
| BRD-M4 | Supports the system usability and spatial-confidence target through a usable tablet and mobile customer journey. |
| PRD-F1 | Covers the public product catalog and product-detail responsive entry path used during the tablet audit. |
| PRD-F3 | Covers the space-photo upload flow below the visualization hero. |
| PRD-F5, PRD-F6 | Cover dimension and quantity configuration in the interactive visualization workspace. |
| SDD-C1, SDD-C5 | Limit changes to public catalog presentation and the client-side visualization workspace. |
| DSD Section 2 | Defines 320px to 639px mobile, 640px to 1023px tablet, and the existing responsive grid. |
| DSD-UI3, DSD-UI4, DSD-UI15 | Cover the upload surface, workspace stage, and compact editor shell affected by the responsive audit. |
| QAD-TC52 | Requires compact workspace viewport, scrolling, control reachability, and desktop regression checks. |
| QAD-VG4 | Requires public and workspace routes to maintain WCAG 2.1 Level AA accessibility. |
| FIX-UI4-V1 through FIX-UI4-V5 | Plan-local verification cases for the five issues. No new QAD catalog identifier is claimed. |

---

## 4. Architectural Scope and Boundaries

### 4.1 In Scope for the Future Implementation

| File or area | Planned responsibility |
|---|---|
| `src/components/shared/LayoutWrapper.tsx` | Confirm shared footer placement and public-route visibility. Change only if inspection proves the shell is responsible. |
| `src/components/ui/Footer.tsx` | Restore the location line on mobile and make tablet footer columns, map, and legal links readable and reachable. Reuse current branding and content. |
| `src/components/ui/Navbar.tsx` and public hero/header components | Audit tablet logo, menu, top information bar, fixed-header clearance, and heading wrapping. Change only components with reproduced layout failures. |
| `src/features/visualization/components/HeroSection.tsx` | Reduce hero height and adjust heading fit for 320px to 639px viewports. Preserve the background treatment and shared route behavior. |
| `src/features/visualization/components/CalibrationModeSelector.tsx`, `DirectVisualizationPage.tsx`, and `ProductAwareUploadPage.tsx` | Correct confirmed tablet card, spacing, and container-width issues in the visualization intake. |
| `src/features/visualization/components/ProductModelWorkspace.tsx` | Ensure Dimension appears before Quantity in the rendered mobile configurator and compact editor drawer, with both controls usable. |
| Other customer-facing page components | Include only when the tablet audit identifies a reproducible shared or route-specific failure. Record the file and screenshot before expanding the diff. |

### 4.2 Out of Scope

- Backend behavior, FastAPI, Supabase schema or migrations, RLS, pricing formulas, and product configuration persistence
- A new visual theme, new UI library, new font, or new design tokens
- Changes to full-viewport editor behavior that would expose the page footer while the editor intentionally covers the document
- Admin and authentication routes, which use separate shells
- Changing the confirmed business location to a different address

---

## 5. Technical Implementation Contract

### 5.1 Tablet Audit and Layout Corrections

Start with `/`, `/product`, a product-detail route, `/visualization`, and `/visualize/[productId]/upload`. Include `/visualize/[productId]/workspace` after entering a valid photo session. Check 640px, 768px, 820px, 1023px, and 1024px widths in portrait and landscape where the device permits. At each route, inspect header clearance, heading line breaks, card and button widths, content margins, horizontal overflow, document scrolling, and footer access.

Use the existing DSD tablet grid, shared components, and Tailwind breakpoints. Prefer local adjustments to width, wrapping, padding, and grid transition points. Do not solve a single screenshot by applying a site-wide CSS override that affects unrelated routes. Record before-and-after captures for each confirmed defect.

### 5.2 Tablet Footer and Mobile Location

On public pages, the footer must follow content in normal document flow. Verify it at the true bottom of the page, including Safari on tablet. If it is rendered but unreachable, inspect scroll locks and full-height containers before changing the footer. If it is clipped or crowded, adjust the footer's existing responsive flex layout and map visibility at the affected tablet widths. Keep company links, contact details, social links, map, copyright, and legal links available.

On mobile, remove the location line's `hidden md:block` behavior and tune its adjacent break and spacing so "Bicutan, Parañaque" appears once, above the contact number, without an empty line. Match the confirmed location across the footer and header surfaces. The current footer uses the unaccented spelling "Paranaque"; use the confirmed spelling when updating its copy.

### 5.3 Mobile Visualization Hero

For 320px to 639px, reduce the current 240px minimum hero height using the repository's existing spacing scale. Keep the H1 readable within the viewport, permit natural wrapping, and allow enough clearance below the fixed navbar. The video and white overlay must continue to cover the hero area. Apply the change in the shared visualization hero so direct and product-aware visualization entry routes agree. Verify that the 640px to 1023px tablet hero does not inherit an unintended mobile height.

### 5.4 Dimension and Quantity Ordering

Inspect both the normal workspace inspector and the compact editor drawer after opening the relevant configuration section. On mobile, the visible sequence must be Dimension heading, Width, Height, Thickness inputs, then Quantity heading and stepper. If this already holds in the actual rendered view, avoid a redundant reorder and fix the specific visibility or scrolling issue that made Quantity appear misplaced. Keep the quantity stepper's minimum of 1, existing state, price updates, keyboard operation, and quotation data unchanged.

### 5.5 Implementation Sequence

1. Reproduce the five reports and capture exact viewport, route, orientation, scroll position, and editor state.
2. Use the confirmed "Bicutan, Parañaque" wording for the mobile footer location line.
3. Fix shared tablet shell and footer behavior, then mobile footer location visibility.
4. Fix visualization hero sizing and confirmed tablet intake layout defects.
5. Confirm and, only if needed, correct mobile Dimension and Quantity presentation.
6. Run the viewport and repository checks in Section 6 and review the final diff for unrelated changes.

---

## 6. Acceptance and Verification Matrix

| Case | Required result |
|---|---|
| FIX-UI4-V1: Tablet layout | At 640px, 768px, 820px, and 1023px, audited public routes have no horizontal overflow, clipped headings, overlapping cards, unusable controls, or fixed-header obstruction. At 1024px the desktop transition remains usable. |
| FIX-UI4-V2: Tablet footer | On each audited public tablet route, normal scrolling reaches the full footer. The footer is readable in portrait and landscape, including company links, contact details, legal links, and the map when intended by the responsive design. Exiting a full-viewport editor restores normal page scrolling and footer reachability. |
| FIX-UI4-V3: Mobile location | At 320px, 375px, 390px, and 639px, the approved location line appears once above contact details in the footer. No empty spacer remains, and the chosen address agrees with the approved header copy. |
| FIX-UI4-V4: Mobile hero | At the same mobile widths, the hero is visibly shorter than the current 240px minimum, its full heading remains legible without navbar overlap, and the calibration or upload content starts sooner. Tablet and desktop hero layouts do not regress. |
| FIX-UI4-V5: Mobile configurator | In the normal workspace and compact editor drawer, Dimension and its three inputs precede Quantity. Controls are reachable by scroll, usable by touch and keyboard, and changing quantity still updates the active configuration and price. Desktop order remains usable. |

Verify on iPad Safari in portrait and landscape and in a Chromium responsive viewport. Where available, also check mobile Safari and Android Chrome for footer, hero, and configurator behavior. Validate QAD-TC52 scroll and compact-editor behavior and QAD-VG4 accessibility for the touched public routes. Run `npm run lint`, `npx tsc --noEmit`, and `npm run build` after implementation. The FastAPI health check is unnecessary for a presentation-only change unless that service is used during the manual visualization flow.

---

## 7. Risks and Controls

| Risk | Control |
|---|---|
| A reported missing footer is actually below a long page or behind the intentionally fixed editor | Reproduce at the document end and after exiting the editor before changing shared layout. |
| Tablet breakpoint fixes affect desktop or narrow mobile | Test 639px, 640px, 1023px, and 1024px boundary widths as well as representative devices. |
| Footer and header location spelling differ | Use the confirmed "Bicutan, Parañaque" spelling consistently in touched location labels. |
| Quantity is already in the requested source order | Verify visible order and reachability first; avoid duplicating controls or changing state logic. |
| Shorter hero causes title clipping beneath the fixed navbar | Measure rendered title and navbar bounds at narrow mobile widths and adjust height or padding within existing design patterns. |

---

## 8. Readiness Decision

The responsive layout and visibility work is implemented in the working tree. The user confirmed "Bicutan, Parañaque" as the correct mobile footer location. Physical iPad Safari, mobile Safari, and Android Chrome acceptance remains pending.

## 9. Implementation Record (October 26, 2026)

- The public layout already renders the footer after content, and browser inspection found it at the document end. No shared shell change was needed. The footer now shows the confirmed location on mobile, exposes its map at tablet widths, and wraps columns and legal links at narrow desktop widths.
- The shared visualization hero is 208px high on mobile, with heading clearance under the fixed navbar. Tablet hero and calibration cards use intermediate layouts. The product-aware upload banner wraps long product names.
- The existing configurator already rendered Dimension, Width, Height, Thickness, then Quantity in both normal and compact views. The three inputs now stack on mobile and in the narrow landscape drawer; inputs and quantity buttons have 44px targets. Quantity state and pricing logic were not changed.
- A browser audit found product-detail horizontal overflow at the 1024px transition. Its image and detail columns now remain stacked until the wider desktop breakpoint.
- Follow-up iPad evidence exposed an overlap in the shared background header: its information strip started at 640px while the fixed navbar stayed at the top through 1023px. The strip now starts at 1024px, matching the navbar's desktop offset. This also covers comparison, quotation, and send-booking pages that share the background header.
- Chromium responsive checks covered 320px, 375px, 390px, 639px, 640px, 768px, 820px, 1023px, and 1024px on available public routes. The footer remained in document flow. The compact editor could not be entered without a valid uploaded photo session, so QAD-TC52 still needs a physical-device pass.
- `npx tsc --noEmit`, `npm run build`, and `npm run test:ms37` passed. ESLint on changed application files passed with nine existing warnings in `ProductModelWorkspace.tsx`. Repository-wide `npm run lint` remains blocked by six existing errors in untouched admin and product files.

---

## Self-Check

- [x] Target file is `docs/implementation/fix-ui4.md`; Section 9 records the implementation and remaining device acceptance.
- [x] All five user-reported issues have a scoped implementation and verification path.
- [x] Traceability references existing BRD, PRD, SDD, DSD, and QAD identifiers without inventing a new catalog test ID.
- [x] Current source facts are distinguished from hypotheses that require browser reproduction.
- [x] Responsive changes reuse existing components, spacing, and design tokens.
- [x] No em-dashes, box diagrams, secrets, schema changes, or new dependencies are introduced.
