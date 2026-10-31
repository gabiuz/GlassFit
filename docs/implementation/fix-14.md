# Implementation Specification: Reject Non-Space Photos During Visualization Upload (fix-14)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document ID:** fix-14  
**Document Function:** Technical plan for preventing portraits, selfies, ID photos, and other unsuitable images from entering the visualization workspace  
**Version:** 1.0.0  
**Date:** October 31, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Ready for Implementation; plan only  
**Primary Traceability:** `PRD-F3`, `PRD-F4`, `PRD-F6`, `SDD-C2`, `SDD-C3`, `SDD-C5`, `DSD-UI3`, `DSD-UI4`, `QAD-TC3`, `QAD-TC4`, `QAD-TC50`, `QAD-TC77`, `QAD-TC78`  
**Upstream Specifications:** `docs/brd-glassfit.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/qad-glassfit.md`, `docs/build-glassfit.md`  

---

## 1. Decision Summary

Require an authoritative space-photo suitability decision before an analyzed image can become a visualization session. Reject clear portraits, selfies, ID photos, and other images without a usable architectural space. An image whose suitability cannot be verified must also stay out of the workspace and receive a distinct retry message. Preserve legitimate interior and exterior installation photos, including occupied rooms and close views of openings. Apply the same decision to Automatic Detection and Paper Reference Calibration in both upload entry paths.

This document changes no application code, dependencies, database schema, or test catalog. The attached images are defect evidence, not UI or implementation instructions. The supplied portrait is identifiable; use it only for the local reproduction and do not commit it as a fixture.

---

## 2. Evidence and Reproduction

| Evidence | Observation and limit |
|---|---|
| Attached workspace screenshot | A portrait appears as the workspace background, with the normal **Add Product** path available. The screenshot establishes the user-visible failure, but does not identify the server revision or the exact upload route. |
| Supplied portrait image | The 944 x 914 PNG is a head-and-shoulders portrait on a white background, not a usable installation space. Its appearance is evidence only. |
| Local reproduction on October 31, 2026 | `POST http://localhost:8000/analyze-image` with the supplied PNG and `calibration_mode=auto_detect` returned HTTP 200 in 4.55 seconds and a `workspace_image` URL. YOLO reported two `person` objects. SegFormer reported `wall_coverage=0.559` and `floor_coverage=0.0`, apparently treating much of the plain background as wall. No suitability error was returned. This confirms the local API acceptance path, not every deployed browser state. |
| Client source | `src/lib/imageApi.ts` validates type, size, extension agreement, and browser decoding. `src/features/visualization/components/UploadImage.tsx` then calls `onImageSelected`; neither checks whether the photo depicts a usable space. |
| Analysis and navigation source | `fastapi-service/main.py` returns a successful session after image analysis without a suitability gate. `ProductAwareUploadPage.tsx` and `DirectVisualizationPage.tsx` treat any successful `analyzeImage` result as ready, allowing workspace entry. |
| Existing CV signals | `scene_detection.py` exposes wall and floor coverage, but its depth fallback has no semantic coverage. The portrait reproduction shows that wall coverage alone is unsafe. A `person` detection alone is also unsafe because valid room photos may contain people. |

Repeat the browser reproduction on `/visualization` and `/visualize/[productId]/upload`, with both calibration modes, before editing. Record the observed success modal, whether placement is enabled, and the deployed API response. Do not upload this identifiable image to a shared or production service without the owner's authorization.

---

## 3. Requirement and Acceptance Contract

| Requirement | fix-14 responsibility |
|---|---|
| PRD-F3, SDD-C2, DSD-UI3, QAD-TC3/QAD-TC50 | Keep existing format, size, decode, HEIC/HEIF fallback, and accessible upload feedback. File validity alone must not imply scene suitability. |
| PRD-F4, SDD-C3, QAD-TC4 | Classify suitability from the normalized uploaded image and available CV evidence. The service is the final authority for direct API callers as well as the browser. |
| PRD-F6, SDD-C5, DSD-UI4 | Do not create or activate a workspace session for a rejected or unverifiable image. An accepted image continues through the existing visualization flow. |
| QAD-TC77/QAD-TC78 | Keep Automatic Detection, Paper Reference Calibration, supported formats, retry behavior, and upload-session semantics consistent across both entry paths. |
| FIX14-V1 through FIX14-V8 | Plan-local acceptance cases in Section 6. These are not new QAD catalog identifiers. |

The upstream PRD describes a room or opening photo but currently specifies pre-flight checks mainly by file format. Before implementation, reconcile PRD-F3/F4, SDD-C2/C3, DSD-UI3, and QAD with this explicit semantic acceptance contract through the project's normal specification review. Do not silently redefine accepted architectural photos through an incidental model threshold.

---

## 4. Planned Technical Contract

### 4.1 Define and validate photo suitability

1. Define a typed three-way result: `accepted`, `rejected`, or `unverifiable`, with a stable reason code for diagnostics and a user-safe message. `accepted` requires affirmative evidence of a usable room, building surface, or installation opening. `rejected` covers clear non-space subjects such as an ID portrait. `unverifiable` covers missing model output, conflicting evidence, or a scene too ambiguous to assess. Only `accepted` may return a usable session.
2. Evaluate the existing YOLO segmentation and SegFormer semantic output together. Reuse installed models and dependencies. Inspect actual person-mask or bounding-box dominance and relevant architectural classes, confidence, and spatial relationship. Do not equate a white backdrop labeled as wall with a valid room. Do not reject solely because a person is present, a floor is absent, a paper marker is absent, or the image is in portrait orientation. The depth-plane fallback is not affirmative semantic evidence.
3. Select decision rules and thresholds against a documented, consented fixture set before freezing them. Include empty rooms, occupied rooms, installation walls, windows, doors, shower enclosures, cabinets, exterior facades, close opening views, low-light photos, unusual angles, portraits, selfies, ID photos, documents, product catalog images, and screenshots. Review false acceptance and false rejection separately. Where the existing signals cannot meet the acceptance target, revise the design through specification review; do not add an unapproved model or dependency.
4. Treat `unverifiable` as a controlled failure. Return an actionable message to retake or retry the photo; do not convert a model outage or mock segmentation into `accepted`. Define model readiness and operational behavior so an unavailable classifier is visible rather than silently bypassed.

### 4.2 Enforce the decision at the API boundary

1. In `POST /analyze-image`, apply the suitability decision after authoritative decode/orientation normalization and before returning HTTP 200 or a workspace URL. Reuse CV outputs where possible to avoid a second model pass. Keep the same gate for `auto_detect`, legacy `standard`, and `paper_fiducial`; paper detection must not substitute for scene suitability.
2. Return a documented, machine-readable 4xx response for `rejected` and a distinct controlled response for `unverifiable`. Include a stable code and safe detail text. Update the TypeScript adapter to parse the exact FastAPI error shape instead of assuming every `detail` is a string. These responses must not enter the network retry loop; only transient transport or service failures should retry.
3. Remove any session directory, workspace WebP, masks, and other generated artifacts created for a rejected or unverifiable upload, while retaining existing input-file cleanup. Ensure a response never exposes a rejected session URL. Do not persist raw or derived versions of the supplied portrait in repository fixtures.
4. Preserve the existing 12 MB, 40 MP, format, MIME, orientation, and HEIC/HEIF behavior. Measure incremental latency and memory against the current analysis path and QAD-TC4 target before release.

### 4.3 Make both upload paths recoverable

1. Handle the typed suitability response in `src/lib/imageApi.ts` and both page components. Clear `pendingSession`; never call `setPreparedSpaceImage`, set `activeSession`, show `ImageSuccessModal`, or navigate to the workspace for a rejected or unverifiable file. Ignore a stale analysis response after the user selects another file or cancels.
2. Reuse `UploadImage` and existing modal/design tokens. Give a semantic rejection a specific explanation such as "Upload a photo of the room or opening where the product will be installed." Replace the current generic "Please upload a clearer photo" guidance for this case. Offer a clear **Choose Another Photo** action; resending the same rejected bytes must not be presented as the expected remedy. Keep a distinct retry action for temporary verification failure.
3. Preserve keyboard focus, alert announcement, selected-file reset, cancellation, and a clean second upload on mobile and desktop. Keep the paper-specific review dialog inaccessible until a suitable image has been accepted.

### 4.4 Planned file ownership

| Area | Planned work |
|---|---|
| `fastapi-service/main.py`, `scene_detection.py`, and a focused suitability module if warranted | Produce and enforce one deterministic suitability decision; define rejection, unavailable behavior, and artifact cleanup. |
| `src/lib/imageApi.ts` | Parse the typed error contract and keep semantic 4xx responses out of transport retries. |
| `src/features/visualization/components/UploadImage.tsx`, `ImageErrorModal.tsx`, `ProductAwareUploadPage.tsx`, `DirectVisualizationPage.tsx` | Present specific, accessible feedback and prevent entry through either route. Reuse current components and styling. |
| `fastapi-service/tests/`, `tests/unit/`, and QAD documentation | Cover decisions, API contract, cleanup, transport, and browser acceptance with consented or synthetic fixtures. |

Read the relevant installed Next.js 16 guide in `node_modules/next/dist/docs/` before changing Next.js code. No database migration or new third-party dependency is planned.

---

## 5. Agent Delegation Before Implementation

| Agent | Responsibility and handoff |
|---|---|
| `backend-developer` | Own the FastAPI suitability decision, error response, failure handling, and generated-artifact cleanup. First agree on decision and response schemas with the frontend owner. |
| `frontend-developer` | Own the typed client adapter and both upload entry paths after the API contract is fixed. Reuse existing components and DSD styling. |
| `qa-expert` | Curate a privacy-safe acceptance matrix, establish measured false acceptance/rejection and latency baselines, then verify both modes and routes. Use the supplied portrait only for the authorized local reproduction. |
| `code-reviewer` | Independently review the integrated change for bypasses, false rejections, stale-session races, cleanup, and specification traceability. |

The backend and frontend owners have separate file ownership. QA defines the fixture and measurement contract before thresholds are frozen, then runs acceptance after integration. A single owner should reconcile the PRD, SDD, DSD, and QAD updates with the finalized behavior.

---

## 6. Verification and Test Catalog

| Case | Required result |
|---|---|
| FIX14-V1: Reported portrait | The supplied portrait receives a semantic rejection from the local API, with no session URL or retained generated artifacts. Both browser entry paths stay on upload and show space-photo guidance. |
| FIX14-V2: Other non-space photos | Consented or synthetic selfies, ID-style portraits, documents, catalog images, and unrelated screenshots do not enter the workspace. Record reason codes and false acceptances. |
| FIX14-V3: Valid architectural photos | Empty and occupied rooms, exterior facades, close views of a wall/opening, and representative product installation scenes remain usable. A person, missing floor, or portrait image dimensions do not alone cause rejection. Record false rejections. |
| FIX14-V4: Mode and format parity | Accepted and rejected JPG, PNG, WebP, HEIC, and HEIF samples behave consistently for Automatic Detection and Paper Reference Calibration on both upload routes. Existing format and decode errors remain distinct. |
| FIX14-V5: Unavailable and conflicting CV | Disabled, failed, or mock semantic signals and conflicting outputs yield `unverifiable` with actionable feedback, no success modal, no session, and no silent bypass. |
| FIX14-V6: API and retry contract | Direct API calls cannot bypass suitability validation. Semantic 4xx responses preserve their specific message and do not trigger exponential network retries; transient failures follow existing retry policy. |
| FIX14-V7: Recovery and accessibility | After rejection, selecting a valid new photo succeeds; canceled or stale responses cannot overwrite it. Focus, alert announcement, mobile layout, and keyboard actions work in both routes. |
| FIX14-V8: Performance and cleanup | Rejected and unverifiable uploads leave no workspace WebP or masks. Accepted analysis remains within the documented QAD latency and memory budget or the measured deviation is reviewed before release. |

After implementation, run focused FastAPI and TypeScript tests, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `GET http://localhost:8000/health`. Execute QAD-TC3, QAD-TC4, QAD-TC50, QAD-TC77, and QAD-TC78 regressions where applicable. Record browser evidence for both routes and modes. Do not claim semantic classification is perfect from a single portrait reproduction.

---

## 7. Risks and Release Gate

| Risk | Control |
|---|---|
| Plain backgrounds are misclassified as walls | Require combined evidence; include the supplied portrait as a private reproduction case. |
| Legitimate rooms with people or no visible floor are rejected | Benchmark varied installation photos and review false rejections before freezing thresholds. |
| Model failure blocks valid uploads | Surface `unverifiable` clearly, monitor classifier availability, and define an operational recovery path. |
| Rejected files leave identifiable artifacts | Clean the generated session on every non-accepted outcome and test cleanup. |
| New classification increases upload latency | Reuse existing inference outputs and measure against the current path and QAD-TC4 budget. |

Implementation is ready to begin after the acceptance corpus and API decision contract are agreed. Release requires FIX14-V1 through FIX14-V8, specification reconciliation, and measured evidence that non-space photos are rejected without unreasonable rejection of valid installation scenes.

---

## Self-Check

- [x] Uses the next numbered `fix-##.md` convention and planning-only status.
- [x] Distinguishes attached-image evidence from user and project instructions.
- [x] Traces planned work to PRD, SDD, DSD, and QAD identifiers.
- [x] Names implementation agents and file ownership before any source change.
- [x] Adds no application implementation, dependency, migration, or identifiable fixture.
