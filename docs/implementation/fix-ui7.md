# Implementation Specification: Tablet Upload Copy, Mobile Outline Resizing, and Quotation Name Overflow (fix-ui7)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Implementation-ready plan for three reported frontend defects  
**Version:** 1.0.0  
**Date:** October 30, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Ready for Implementation  
**Upstream Specifications:** `docs/implementation/fix-ui4.md`, `docs/implementation/ms37.md`, `docs/brd-glassfit.md` (BRD-M4), `docs/prd-glassfit.md` (PRD-F3, PRD-F5, PRD-F6, PRD-F10), `docs/sdd-glassfit.md` (SDD-C2, SDD-C4, SDD-C5, SDD-C7), `docs/dsd-glassfit.md` (DSD-UI3, DSD-UI4, DSD-UI15, Section 2), `docs/qad-glassfit.md` (QAD-TC6, QAD-TC52, QAD-TC53, QAD-TC67, QAD-TC71, QAD-VG4)  
**Implementation State:** Not started. This document is a plan only.  

---

## 1. Authorized Requirements

1. Correct the upload explanation copy's presentation at the tablet viewport sizes shown in attachment 1. Keep the existing approved wording unless a separate copy change is requested. The explanation must fit, wrap naturally, and remain clear of the fixed header and adjacent guideline content.
2. Make the width and height handles on the mobile 3D product outline resize the model on the selected axis. Dragging a resize handle must not translate the model. Preserve the separate center move control and corner scale behavior.
3. Keep a long uploaded image name within the small-screen quotation viewport. The name, product count, and tags must remain readable without document-level horizontal overflow.

The three user attachments are visual and behavioral evidence. They do not establish a code-level root cause. This plan extends the earlier tablet audit in `fix-ui4.md` with targeted acceptance criteria for the newly reported failures.

---

## 2. Evidence and Investigation Boundaries

| Issue | Current evidence | First reproduction step |
|---|---|---|
| Tablet upload copy | Attachment 1 highlights the explanatory paragraph at 1024 x 768 and 768 x 1024. The 800 x 1280 and 992 x 1280 captures show the neighboring header and upload area for comparison. `UploadImage.tsx` renders this copy with a forced `<br />` inside a full-width paragraph; both visualization upload entry pages use that component. | Capture `/visualization` and the product-aware upload page at all four supplied viewport sizes at 100% zoom. Record the paragraph's computed width, line breaks, header bounds, scroll width, and whether the navbar obscures any upload copy. Check both Automatic Detection and Paper Reference modes. |
| Mobile outline resize | Attachment 2 shows a free-placement 3D outline with side and top or bottom handles. The user reports that dragging a width or height handle moves the model. `ProductModelWorkspace.tsx` has separate `startResize` and `startOverlayDrag` paths. Its side handles are 12px elements, while corner handles have 44px targets and `touch-none`. This size difference is a lead, not a confirmed cause. | On an actual touch device or a browser with touch emulation, log the pointer-down target and active handler for each edge handle. Record model position, overlay size, width, height, and cancellation behavior before, during, and after the gesture. Repeat in the standard canvas and compact editor. |
| Long quotation name | Attachment 3 shows an uploaded filename extending past the right side of a narrow quotation view. `Quotation.tsx` passes `originalFileName` through `getVisualizationHeaderDetails` to `VisualizationHeader.tsx`, whose heading has no explicit long-token wrapping or min-width constraint. | Use a filename with a long unbroken stem and extension, plus a long product tag, at 320px, 375px, 390px, and 430px. Measure `document.documentElement.scrollWidth` against `clientWidth` and inspect the heading's actual text bounds. |

DSD Section 2 defines mobile as 320px to 639px, tablet as 640px to 1023px, and desktop from 1024px. The supplied 1024 x 768 capture sits exactly on the desktop boundary, so test both sides of that breakpoint.

---

## 3. Traceability

| Code | Relationship |
|---|---|
| BRD-M4 | Supports a readable and operable customer flow on phones and tablets. |
| PRD-F3, SDD-C2, DSD-UI3 | Govern the photo upload entry surface and its explanatory guidance. |
| PRD-F5, PRD-F6, SDD-C4, SDD-C5, DSD-UI4, DSD-UI15 | Govern model dimensions, canvas transforms, resize controls, and compact touch interaction. |
| PRD-F10, SDD-C7 | Govern the quotation journey in which the uploaded name and product count appear. |
| QAD-TC6, QAD-TC52 | Cover placement, resize, touch target size, mobile browser behavior, and desktop regression. |
| QAD-TC53, QAD-VG4 | Cover long-string wrapping and accessible customer-facing presentation. |
| QAD-TC67, QAD-TC71 | Protect model dimension, control, and quotation consistency when resize changes dimensions. |
| FIX-UI7-V1 through FIX-UI7-V4 | Plan-local acceptance cases below. These are not new QAD catalog identifiers. |

---

## 4. Planned Implementation Contract

### 4.1 Tablet upload explanation

**Primary file:** `src/features/visualization/components/UploadImage.tsx`. Inspect `DirectVisualizationPage.tsx`, `ProductAwareUploadPage.tsx`, `GuideLine.tsx`, and the shared navbar only if the reproduction shows that their container widths or fixed-header clearance cause the defect.

Measure the actual text container before changing breakpoints. Keep the explanation inside the upload content width with natural line wrapping and existing typography, spacing, and color tokens. Remove or condition the forced line break only if it causes the observed narrow lines; use a responsive content width where needed. At 768px through 1024px, the paragraph must not be clipped, covered by navigation, or force horizontal page scrolling. Correct any reproduced header overlap in the narrow tablet captures as part of the same upload flow, without changing unrelated routes.

### 4.2 Mobile outline width and height gestures

**Primary file:** `src/features/visualization/components/ProductModelWorkspace.tsx`. Inspect the existing compact viewport and pointer geometry helpers only if the event trace reaches them.

Confirm whether the finger misses a small handle, the browser starts a pan gesture, the move handler also starts, or another event path overrides resize state. Then make the edge controls reliably targetable by touch using the project's established 44px handle pattern, while preserving their existing 12px visual dots. Bind a touch gesture to the intended handle and pointer ID for its full lifecycle; cancel and clean up correctly on pointer end or interruption. Keep `touch-action` scoped to the interactive surface or handle so the page and compact inspector retain intentional scrolling.

The left and right handles change width only, and the top and bottom handles change height only. The model and outline must visibly resize together; the model's saved position must remain fixed for a resize gesture. The center control continues to move the model, corner controls continue to scale it, and the perspective-fit path is checked for regressions. Ensure dimension state and displayed values follow the existing model-sizing contract rather than allowing the outline, mesh, and quotation values to diverge. Do not infer a specific fix from the handle-size clue until pointer tracing confirms the failure path.

### 4.3 Long quotation filename

**Primary file:** `src/features/quotation/components/VisualizationHeader.tsx`. Inspect `Quotation.tsx` and `multiProductPresentation.ts` to confirm the value's source; change them only if presentation cannot be fixed locally.

Constrain the heading to its container and allow long, unbroken filenames to wrap within the viewport. Keep the entire filename available as visible text, retain the extension and product-count meaning, and allow the count to wrap cleanly after the name. Ensure long tag labels also stay inside their pills and the page width. Use existing typography and brand styles. Avoid silently truncating, renaming, or changing stored upload metadata to solve a presentation defect.

### 4.4 Scope limits

The future code change is limited to the three customer-facing defects above and any directly proven shared-layout cause. It does not alter upload validation, CV processing, Supabase data, pricing formulas, saved quotation content, global design tokens, or external dependencies. The PDF document layout is outside scope unless reproduction shows that the same long name also breaks its existing QAD-TC53 contract.

---

## 5. Agent Delegation Before Implementation

| Agent | Assigned responsibility | Dependency and file ownership |
|---|---|---|
| `debugger` | Reproduce and trace the mobile pointer failure, including hit testing, browser gesture handling, event propagation, and size or position state. Report the confirmed cause and a minimal correction path. | Read-only diagnosis first. No source edits. |
| `frontend-developer` | Implement the tablet upload copy and layout fix, then the quotation name containment. | Own `UploadImage.tsx` and `VisualizationHeader.tsx`; touch parent components only when measurements prove the need. May start while resize diagnosis runs. |
| `frontend-developer` | Implement the confirmed mobile resize correction. | Own `ProductModelWorkspace.tsx` exclusively after the debugger's findings; coordinate any shared helper changes before editing. |
| `qa-expert` | Check the viewport and touch acceptance matrix, review dimension consistency, and report device-specific gaps. | Prepare cases during implementation; validate the integrated result afterward. |

The implementing agents should work in separate file areas and accommodate each other's changes. A single frontend developer can perform both implementation assignments sequentially if parallel staffing is unnecessary. The agent organizer's initial breakdown informed this division; the implementation agents have not been started for this plan-only request.

---

## 6. Verification and Acceptance Matrix

| Case | Required result |
|---|---|
| FIX-UI7-V1: Tablet explanation | At 768 x 1024, 800 x 1280, 992 x 1280, and 1024 x 768, the upload explanation is readable, naturally wrapped, and clear of the navbar and guideline content. Both upload entry paths and both calibration modes have no document-level horizontal overflow. Check 767px, 1023px, and 1024px boundary widths as well. |
| FIX-UI7-V2: Width and height resize | On mobile Safari and Android Chrome, all four edge handles can be acquired by touch. Left or right changes width; top or bottom changes height. The product's center position stays fixed while the outline and 3D model resize together. Releasing or canceling a pointer ends the gesture cleanly. |
| FIX-UI7-V3: Other canvas gestures | Center move, corner scale, rotation, perspective-fit editing, normal page scroll, and compact editor drawer scroll still work. Repeat at 320px, 375px, 390px, 430px, portrait and landscape, then check mouse and pen behavior at tablet and desktop widths. |
| FIX-UI7-V4: Long names | A long unbroken uploaded filename and long product tag remain entirely inside the quotation viewport at 320px, 375px, 390px, 430px, and 639px. Filename, extension, product count, and tags remain readable; `scrollWidth` does not exceed `clientWidth`. Normal short names retain their current layout. |

For the resize case, compare the model's position and dimensions before and after each gesture, then verify the subsequent quotation uses the expected dimensions under QAD-TC67 and QAD-TC71. Browser screenshots alone cannot prove gesture correctness; use touch interaction and state observations. After implementation, run the relevant existing unit suites, `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Record any pre-existing lint failures separately from changes introduced by this fix. The FastAPI health check is needed only if the manual end-to-end photo flow starts that service.

---

## 7. Readiness and Risks

The screenshots and source inspection are sufficient to plan targeted work, but they do not confirm the mobile gesture's root cause. The debugger must reproduce it before the resize implementation is chosen. Tablet copy changes need measurement at the exact supplied viewports because 1024px starts a different DSD breakpoint tier. Long-name containment must preserve the original filename and quotation meaning while handling single-token strings.

## Self-Check

- [x] Plan-only `fix-ui7.md` follows the `docs/implementation/fix-ui*.md` naming and metadata pattern.
- [x] All three reported issues have an implementation path, assigned agents, and observable acceptance criteria.
- [x] Existing PRD, SDD, DSD, and QAD identifiers provide traceability without inventing catalog IDs.
- [x] Evidence is separated from unconfirmed root-cause hypotheses.
- [x] No application code, dependencies, schema, or design tokens are changed by this document.
