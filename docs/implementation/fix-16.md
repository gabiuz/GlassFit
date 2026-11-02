# Implementation Specification: Independent Space Evidence for Dominant Subjects (fix-16)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document ID:** fix-16
**Document Function:** Technical plan for preventing a screen or other dominant non-space subject from supplying its own apparent architectural evidence
**Version:** 1.0.0
**Date:** November 2, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Ready for Implementation; plan only
**Primary Traceability:** `PRD-F3`, `PRD-F4`, `PRD-F6`, `SDD-C2`, `SDD-C3`, `SDD-C5`, `DSD-UI3`, `DSD-UI4`, `QAD-TC3`, `QAD-TC4`, `QAD-TC50`, `QAD-TC77`, `QAD-TC78`
**Upstream Specifications:** `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/qad-glassfit.md`, `docs/implementation/fix-14.md`
**Comparison Base:** `origin/dev` at `663eab2`; reviewed branch `fix/image-upload` at `27db989`

---

## 1. Required Outcome and Scope

A dominant television, laptop, phone, book, or person must not establish that an image is a usable installation space merely because the subject's pixels receive wall, window, door, or other architectural labels. Accept occupied rooms and real openings when enough independent room or building evidence exists outside the subject. Apply the same authoritative decision before session creation in both calibration modes and both upload routes.

This document is a plan. It changes no application code, tests, assets, models, dependencies, database schema, or live data.

---

## 2. Confirmed Defect and Contract

| Evidence | Consequence |
|---|---|
| `fastapi-service/photo_suitability.py` rejects a dominant detected subject only when `architectural_evidence` is false. An opening label covering 4% of the image makes that evidence true. | Architectural labels on a screen can bypass the dominant-subject rejection. |
| A pure-function reproduction used a `television` bounding box from `(50, 50)` to `(950, 950)` in a 1000 x 1000 image, confidence `0.95`, real model markers, and `opening_coverage=0.05`. | `assess_photo_suitability` returned `accepted` with reason `architectural_evidence`. This proves a decision-rule gap, not the frequency of real-world false acceptance. |
| `fix-14` requires clear non-space subjects to stay out of the workspace while occupied rooms and close opening views remain usable. | A blanket rejection of every photo containing a person or screen is not an acceptable correction. |

`FIX16-V1` through `FIX16-V7` below are plan-local acceptance cases, not new QAD identifiers.

---

## 3. Planned Implementation Contract

1. Preserve the existing YOLO and SegFormer model readiness checks. A mock, unavailable model, or depth-only fallback cannot establish acceptance.
2. Calculate architectural evidence spatially against the detected dominant subject. Use the semantic class map and subject mask when available, or a validated bounding box with a documented margin. Transform original-image subject coordinates to the workspace-image coordinate system before intersecting them with semantic pixels. Record the independent exterior evidence needed by the suitability decision without exposing private masks or images to logs.
3. For a dominant non-space subject, ignore architectural classes inside its region when deciding whether the surrounding image is a usable room, building surface, or opening. Accept only if the remaining pixels provide sufficient independent evidence. If the evidence is absent, reject a clear non-space subject; if segmentation or geometry makes the relationship uncertain, return `unverifiable` rather than accepting it.
4. Keep the occupied-room exception evidence based. A person or small laptop in a real room must remain acceptable when wall, floor, opening, or building context outside the subject meets the established contract. Recheck the guarded partial-room path added under `fix-14` so that it cannot accept a dominant screen from its own labels.
5. Keep the decision in the FastAPI service. Rejected and unverifiable requests must not return a usable workspace URL and must clean generated session artifacts. Existing semantic error codes and client recovery messages remain the transport contract. Do not add a new model or dependency.
6. Add privacy-safe synthetic feature-map tests for architectural labels inside versus outside dominant subject regions, coordinate scaling, overlapping subjects, and absent masks. Add a small consented or synthetic image set for service-level validation. Measure false acceptance, false rejection, and latency against the `fix-14` baseline before release.

The implementation owner should inspect `fastapi-service/segmentation.py`, `scene_detection.py`, `photo_suitability.py`, and the ordering in `main.py` before selecting the typed evidence interface. Retain the existing response shape unless a documented additive field is required. No Next.js code is expected; if it becomes necessary, read the relevant installed Next.js 16 guide first.

---

## 4. Agent Delegation Before Implementation

The `agent-organizer` reviewed this breakdown. These are proposed assignments for a later implementation pass; no implementation agent was started for this plan.

| Agent | Later responsibility | Ownership |
|---|---|---|
| `backend-developer` | Define the spatial evidence contract and implement the FastAPI decision and endpoint integration. | `fastapi-service/photo_suitability.py`, `scene_detection.py`, `main.py`, and related service helpers. |
| `qa-expert` | Prepare privacy-safe positive and negative scenes, run both calibration modes, quantify classification and latency, and verify artifact cleanup. | CV test files and acceptance evidence. |
| `code-reviewer` | Independently check coordinate transforms, overlapping masks, false rejections, cleanup, and requirement traceability. | Read-only integrated review. |

The backend owner and QA should agree on the synthetic evidence cases before thresholds change. This CV work may run independently of fixes 17 through 19.

---

## 5. Verification and Acceptance

| Case | Required result |
|---|---|
| FIX16-V1: Room shown on a screen | A dominant TV, laptop, or phone whose interior pixels are labeled as an opening or wall cannot create a session without independent surrounding space evidence. |
| FIX16-V2: Occupied room | A large person or small device in a real room remains accepted when usable architectural evidence is visible outside the detected subject. |
| FIX16-V3: Close opening | A legitimate close view of an installation opening remains accepted; an almost full-frame surface without placement context retains the existing too-close guidance. |
| FIX16-V4: Spatial coordinates | Original and downscaled workspace dimensions produce the same decision; boxes at image edges and overlapping objects cannot create negative or inflated evidence areas. |
| FIX16-V5: Missing evidence | Unavailable masks, semantic output, or model readiness cannot silently promote a dominant subject to accepted. |
| FIX16-V6: Mode and route parity | Direct API calls and both browser upload routes return the same decision in Automatic Detection and Paper Reference Calibration. Rejected sessions leave no generated workspace image or masks. |
| FIX16-V7: Performance and accuracy | Record a consented validation set, false acceptance and rejection counts, and added processing time. Review any regression against QAD-TC4 and `fix-14` before release. |

Run focused FastAPI tests, relevant upload-client tests, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `GET http://localhost:8000/health` after implementation. Verify the reported pure-function case plus real or consented screen and occupied-room photos. This plan alone does not close the defect.

---

## Self-Check

- [x] Uses the next numbered `fix-##.md` planning format and upstream requirement IDs.
- [x] Names later implementation agents, file ownership, and acceptance cases.
- [x] Adds no application implementation, dependency, private image, or database mutation.
