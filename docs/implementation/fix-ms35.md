# Implementation Specification: Restore Image Uploads Regardless of Scene Content (fix-MS-35)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document Function:** Bug fix plan for MS35 image ingestion and visualization session admission
**Version:** 1.0.0
**Date:** November 20, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Ready for Implementation (plan only)
**Upstream Specifications:** [MS35 image ingestion](ms35.md), [MS62 calibration modes](ms62.md), [MS63 image preparation](ms63.md), [PRD](../prd-glassfit.md), [SDD](../sdd-glassfit.md), [DSD](../dsd-glassfit.md), [QAD](../qad-glassfit.md)

---

## 1. Problem Context & Motivation

Some uploaded images are being refused. The requested behavior is the one GlassFit had before space-photo screening: a supported, decodable image within the upload limit can become the workspace background regardless of what it depicts. A room, a close-up wall, a portrait, and a screenshot must all follow the same upload flow. The reported files were unavailable for diagnosis, so their individual failure reasons are unknown.

[fix-14](fix-14.md) introduced content-based rejection. [fix-16](fix-16.md) refined how the service assesses architectural evidence around a dominant subject. Commits `d143842` and `32d2668` admitted more space photos, including framed openings, while retaining the check. This plan restores the upload behavior from before fix-14.

After preparing the workspace WebP, `POST /analyze-image` calls `assess_photo_suitability`. A rejected or too-close verdict raises HTTP 422. An unverifiable scene raises HTTP 503. The service then deletes the incomplete session, so dismissing the message in either upload page cannot recover the background.

## 2. Traceability & Specification Mapping

| Reference | Planned contract |
|---|---|
| PRD-F3, SDD-C2, DSD-UI3, QAD-TC3, QAD-TC50 | Enforce the existing file type, byte limit and decode checks on upload. The subject is unrestricted. |
| PRD-F4, SDD-C3, DSD-UI4, QAD-TC4 | Return the prepared image and available CV results. Empty detections or unavailable optional models are valid analysis outcomes. |
| PRD-F6, SDD-C5, QAD-TC77, QAD-TC78 | Carry the usable session through both upload entry points and their existing calibration flows. |

## 3. Architectural Scope & Boundaries

| Area | Planned work |
|---|---|
| `fastapi-service/main.py`, `photo_suitability.py`, `scene_detection.py` | Remove the admission decision and computations used exclusively for it. Preserve scene outputs used for placement, masks, lighting and scale. |
| `src/lib/imageApi.ts` | Retire the typed `SpacePhotoError` handling and its special retry rules. Keep file preflight, response validation, cancellation and bounded retries for transient failures. |
| `src/features/visualization/components/DirectVisualizationPage.tsx`, `ProductAwareUploadPage.tsx` | Retire the semantic-error state, modal guidance and retry restrictions on both pages. Keep the existing upload UI and ordinary file or service error recovery. |
| Tests, evaluator and specifications | Replace assertions that require semantic rejection. Retire the gate-only evaluator together with its classifier. Reconcile the active requirements and preserve dated regression records as history. |

Out of scope are new formats or size limits, CV model changes, calibration accuracy, product eligibility, database migrations and storage policy changes.

## 4. Technical Specification & Implementation Sequence

1. Update the active fix-14 admission clauses in the PRD, SDD, DSD and QAD and the corresponding traceability entry in `docs/index.md`. Cross-reference this reversal from fix-14 and fix-16 so their historical acceptance criteria are identifiable.
2. In `analyze_image`, remove the suitability call and the branch that emits `SPACE_PHOTO_REJECTED`, `SPACE_PHOTO_TOO_CLOSE` or `SPACE_PHOTO_UNVERIFIABLE`. Continue from scene analysis to artifact mapping, scale estimation, calibration and normal session finalization. Remove independent-subject evidence and geometric-opening checks used only for admission. Keep private arrays such as `_semantic_map` out of the serialized response.
3. Preserve empty-file, supported-format, declared-versus-decoded-format and 12 MiB limit checks, including the existing HEIC/HEIF decode path. A genuine file, workspace preparation or service failure must still surface an error and clean partial artifacts. Successful sessions retain the prepared workspace image and delete temporary uploads.
4. In both clients, remove the three verdict-specific branches. Follow the existing success path with the returned session. Automatic Detection proceeds with available analysis. Paper Reference Calibration retains review or manual pinning when needed. A missing room, object or sheet cannot invalidate the upload. Preserve the selected product, existing cancellation behavior and actionable errors for genuine failures.
5. Start the endpoint regression with the existing dominant-screen fixture in `fastapi-service/tests/test_fix16_endpoint.py`. Its four cases currently expect 422 or 503 across the two calibration modes and the two semantic-map states. Change all four to expect 200, a finalized session and a loadable `workspace_image.url`. Verify the new expectation fails against the old gate and passes after removal. Retain the framed-opening success control. Replace obsolete verdict assertions in `test_photo_suitability.py` and `tests/unit/spacePhotoUploadError.test.ts` with coverage for the surviving behavior below.

## 5. Automated Verification Matrix

| Case | Expected result |
|---|---|
| Previously excluded subjects | Submit synthetic portrait, screenshot and close-surface cases alongside a room control. Exercise both `auto_detect` and `paper_fiducial` with deterministic CV results. Each returns HTTP 200, a session ID and a retrievable workspace WebP. |
| Missing architectural evidence | Return empty object detections and disable scene detection or supply its existing unavailable result. Both modes return usable sessions with honest availability metadata. The JSON excludes private semantic maps. |
| Format and failure boundaries | Exercise JPEG, PNG, WebP and HEIC/HEIF through supported decode paths. Empty, oversized, unsupported, corrupt and mismatched files retain their technical errors and leave no usable session or partial uploads. |
| Client recovery | Check a nonretryable file error, a transient service 503 and a canceled or superseded request. Assert the existing retry policy and that a stale response cannot open the workspace. |

## 6. Manual Verification Matrix

| Entry point | Automatic Detection | Paper Reference Calibration |
|---|---|---|
| Direct visualization (`/visualization`) | Upload a screenshot and a room photo. Open each in the workspace and verify the chosen image is the background. | Upload a close-up without a sheet and proceed through the existing manual calibration flow. |
| Catalog product (`/visualize/[productId]/upload`) | Upload a portrait or graphic and verify the selected catalog product opens against it. | Upload an image with a reference sheet and exercise review. Repeat without a sheet and verify manual recovery and product continuity. |

If an originally refused image is available locally, repeat its original upload flow and record the outcome without committing the image.

## 7. Definition of Done (Exit Criteria)

- [ ] Both routes and calibration modes accept supported images independently of subject, framing and classifier availability.
- [ ] The service returns the existing success payload, including a loadable background. Optional analysis data, paper review and manual calibration remain usable.
- [ ] File validation, retry, cancellation and partial-session cleanup pass the regression cases above.
- [ ] Run the affected Python and TypeScript tests, `npm run test:ms35`, `npm run test:ms62`, `npm run lint`, `npx tsc --noEmit` and `npm run build`. Verify `GET http://localhost:8000/health` returns `{"status":"ok"}`.
- [ ] Record the browser matrix results and reconcile the active specifications.

## 8. Risk Assessment

| Risk | Mitigation |
|---|---|
| Removing the verdict also removes masks or scene geometry used in placement. | Compare a room control's available analysis fields and load its mask assets before and after the change. |
| A client-only change hides the message while the API still discards the session. | Post a previously rejected case directly to FastAPI and fetch the returned workspace URL. |
| Removing the semantic 503 exception alters retries for real outages. | Exercise the existing retry budget with a transient 503 followed by success and a persistent outage. |

## Self-Check

- [x] The plan identifies the prior screening requirements, their replacement and the components that enforce them.
- [x] Acceptance covers non-space images, ordinary room uploads, technical failures and both calibration modes.
- [x] Implementation and runtime verification are pending.
