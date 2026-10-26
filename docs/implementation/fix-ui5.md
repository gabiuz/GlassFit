# Implementation Specification: Photo Editor Control Overlap and Mobile Preview Parity (fix-ui5)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Investigation and implementation plan for photo editing controls and compact editor preview parity  
**Version:** 1.0.0  
**Date:** October 26, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Implemented with emulated browser acceptance; physical device and snapshot checks pending  
**Upstream Specifications:** `docs/brd-glassfit.md` (BRD-M4), `docs/prd-glassfit.md` (PRD-F5, PRD-F6), `docs/sdd-glassfit.md` (SDD-C4, SDD-C5), `docs/dsd-glassfit.md` (Section 2, DSD-UI4, DSD-UI15), `docs/qad-glassfit.md` (QAD-TC52, QAD-VG4), `docs/implementation/ms37.md`  
**Implementation State:** Toolbar layout and canvas resize parity fixes implemented in `ProductModelWorkspace.tsx`.  

---

## 1. Authorized Requirements

1. Find the actual device, browser, viewport, orientation, and photo conditions under which the photo editing buttons overlap or are cut off. Once reproduced, make every editing action readable, reachable, and operable without covering the product handles or escaping the photo editor.
2. Improve the compact full-screen editor on mobile. For the same photo, product, configuration, and transform state, the product's visible placement and proportions must agree with the standard workspace before entering full-screen mode and after leaving it. Keep the editing actions usable in portrait and landscape.
3. Preserve the existing photo-based approximate-preview wording. Visual parity between the two editor layouts does not establish real-world measurement accuracy.

The supplied images are visual evidence. Attachments 1, 2, and 5 show a floating Edit Corners, Free Place, Flip, Reset, and Remove row crowding or extending beyond narrow photo cards. Attachments 3 and 4 show the compact portrait editor. The phone frame in an attachment does not identify the actual test device or browser.

---

## 2. Problem Statement and Current Evidence

| Reported issue | Current repository evidence | Diagnosis required before editing |
|---|---|---|
| Photo controls overlap or clip on some photos | `ProductModelWorkspace.tsx` renders five controls in one non-wrapping, absolutely positioned row when perspective corners exist and the full-screen editor is closed. `perspectiveToolbarPosition` clamps its center using a fixed 160px inset, while the rendered row width and photo canvas width can vary. The photo canvas wrapper has `overflow-hidden`. | Reproduce and measure the row and canvas rectangles. Establish whether row width, center position, photo aspect ratio, zoom, text wrapping, clipping, or another element causes each observed failure. The screenshots alone do not identify the device or prove one cause. |
| Compact editor preview differs from standard workspace | `ProductModelWorkspace.tsx` switches the same canvas between a standard card limited to `55vh` and a compact `100dvh` three-row shell. The compact canvas uses `height: 100%`, `width: auto`, `maxWidth: 100%`, `maxHeight: 100%`, and a photo aspect ratio. A `ResizeObserver` updates `canvasDisplaySize`, which is used for handles and perspective transforms. | With one unchanged session, compare actual photo and product bounds before entry, in compact mode, and after exit. Determine whether the difference is expected uniform scaling, photo crop or fit, stale display measurements, nonuniform transform scaling, model render sizing, or saved transform state. Do not infer geometry failure from different screenshot framing alone. |
| Portrait editor feels cramped | DSD-UI15 and `ms37.md` specify a header, flexible stage, HUD, safe areas, an internal controls drawer, and a usable portrait mode. The supplied compact editor image shows these regions but cannot establish touch behavior or browser chrome effects. | Observe stage height and action reachability with browser bars shown and hidden, orientation changes, and the controls drawer open. Record which interaction is difficult and its measured bounds before changing the shell. |

The floating five-button row is intentionally hidden inside the compact full-screen editor. Investigate the narrow standard photo card separately from the compact HUD so a fix targets the surface shown in attachments 1, 2, and 5.

---

## 3. Traceability and Specification Mapping

| Traceability code | Relationship to this plan |
|---|---|
| BRD-M4 | Supports the usability and spatial-confidence target. |
| PRD-F5, PRD-F6 | Preserve parametric product presentation and interactive photo placement across editor layouts. |
| SDD-C4, SDD-C5 | Keep model geometry and canvas placement within their existing client-side owners. |
| DSD Section 2, DSD-UI4, DSD-UI15 | Define responsive widths, the workspace canvas, transform handles, and compact full-viewport editor behavior. |
| QAD-TC52 | Covers compact portrait and landscape viewports, scroll isolation, touch ergonomics, 44px actions, focus, and desktop regression. |
| QAD-VG4 | Covers accessible action labels, focus visibility, and operability. |
| FIX-UI5-V1 through FIX-UI5-V4 | Plan-local acceptance cases. These do not claim new QAD catalog IDs. |

---

## 4. Agent Assignment and Handoff

The requested `agent-organizer` has assigned the following future work. These are plan assignments only; neither implementation agent is being asked to edit code in this planning pass.

| Sequence | Agent | Ownership and deliverable | Handoff gate |
|---|---|---|---|
| 1 | `qa-expert` (device and viewport investigator) | Identify the affected physical device or devices when available, and reproduce the overlap using the same photo and product. Produce a matrix with device model, OS, browser/version, CSS viewport, device pixel ratio, zoom, orientation, route, editor state, photo dimensions and aspect ratio, toolbar and canvas rectangles, screenshots, and exact reproduction steps. Also capture standard-to-compact preview differences for the same session. | Give the `frontend-developer` a confirmed failing case and measurements. If only emulation is available, label it as emulation and leave physical-device identity unconfirmed. |
| 2 | `frontend-developer` (fix owner) | After the handoff, change only the confirmed toolbar, canvas sizing, or transform code and existing styles needed for the two defects. Reuse current components, tokens, and state. Supply before-and-after captures and the verification results in Section 6. | Return the changed behavior to `qa-expert` for reproduction on the original failing case and regression viewports. |
| 3 | `qa-expert` (acceptance reviewer) | Recheck the original device and photo, compact portrait and landscape, control access, preview parity, and desktop behavior. Record remaining failures instead of assuming a Chromium emulator proves mobile Safari or Android Chrome behavior. | Close the task only when the acceptance matrix passes or unresolved device coverage is explicitly reported. |

---

## 5. Architectural Scope and Technical Implementation Contract

### 5.1 In Scope for the Future Implementation

| File or area | Planned responsibility |
|---|---|
| `src/features/visualization/components/ProductModelWorkspace.tsx` | Primary owner of the floating perspective toolbar, canvas dimensions, image presentation, compact shell, model overlay, and transform handles. |
| `src/features/visualization/hooks/useCompactViewport.ts` and existing canvas geometry helpers | Inspect only if device classification or coordinate conversion is shown to cause a reproduced defect. |
| `src/app/globals.css` | Use only if a narrowly scoped existing style cannot express the confirmed layout correction. Reuse repository colors, spacing, and typography. |
| Existing visualization tests | Update or add a focused test only for a measurable geometry or responsive behavior that cannot be adequately verified by inspection alone. |

### 5.2 Investigation and Fix Sequence

1. Reproduce attachment 1 or 2 in the standard workspace photo card. Check a tall photo and a wide photo with the same control labels. Start at 320px, 360px, 375px, 390px, 430px, and 639px; check 640px, 768px, 899px, 900px, 1023px, and 1024px when the affected layout changes. Cover mobile Safari and Android Chrome on available physical devices, then use Chromium responsive viewports for boundary checks. Record actual devices rather than guessing from the attachment frame.
2. Measure the rendered width of each control and the row, its center position, the photo canvas box, clipping ancestors, and any overlap with the corner or edge handles. Distinguish control-on-control collision from row clipping and handle occlusion. Set the final toolbar placement from available bounds and measured content, with a responsive arrangement that keeps all five actions reachable and at least 44px tall. Do not hide an action or rely on horizontal page overflow.
3. In a single session, capture the photo and model before entering the full-screen editor, inside portrait full-screen mode, inside landscape full-screen mode, and after Done. Keep product, dimensions, fit corners, zoom, flip, rotation, and material selection unchanged. Compare normalized product corners against fixed photo landmarks, not just pixel sizes between screenshots with different canvas dimensions.
4. Trace the same photo and model through image fit or crop, canvas aspect ratio, `ResizeObserver` measurement, overlay position and size, perspective corner normalization, Three.js render frame, and snapshot composition. Correct only the proven mismatch. The photo, product, handles, and saved snapshot must share one coordinate interpretation as the canvas changes size.
5. Review the compact shell's header, stage, HUD, controls drawer, safe-area padding, and dynamic browser chrome. Keep portrait usable, preserve the existing Done, drawer, scroll lock, focus, and touch semantics from `ms37.md`, and make any layout change with current UI patterns.
6. Return the fixed build to the investigator for original-device acceptance and the regression checks below.

### 5.3 Out of Scope

- FastAPI, Supabase, migrations, pricing, authentication, and product catalog behavior
- A new UI library, new design tokens, new dependency, or a redesigned visual theme
- Claims of physical dimension accuracy based solely on matching the two previews
- A persistent editable 3D scene or changes to quotation measurements without separate specification work

---

## 6. Acceptance and Verification Matrix

| Case | Required result |
|---|---|
| FIX-UI5-V1: Device identification | The investigator records the exact affected device, OS, browser, viewport, orientation, photo aspect ratio, and reproduction steps. A simulated viewport is identified as simulated. If no physical device reproduces it, the result states that limitation. |
| FIX-UI5-V2: Photo controls | With tall and wide photos at affected widths, Edit Corners, Free Place, Flip, Reset, and Remove are all visible, non-overlapping, readable, and operable. Each action has a 44px minimum touch target and visible focus. The toolbar stays within the editor's usable bounds and does not block essential transform handles. |
| FIX-UI5-V3: Preview parity | For the same unchanged session, normalized product corners and visual alignment to photo landmarks agree before full-screen entry, inside portrait and landscape full-screen mode, and after Done. Any pixel-size difference is explained by uniform canvas scaling; no product shape, position, crop, or fit jumps when modes change. The saved snapshot agrees with the visible composition. |
| FIX-UI5-V4: Compact and desktop regression | Compact header, canvas, HUD, and controls drawer remain reachable with mobile browser chrome changes. Scroll isolation, safe areas, Done, focus return, touch gestures, and desktop canvas behavior continue to satisfy QAD-TC52 and QAD-VG4. |

After implementation, run `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npm run test:ms37`. Perform the manual iOS Safari and Android Chrome checks specified by QAD-TC52. Record any pre-existing command failures separately from failures introduced by this work. A FastAPI health check is needed only if the manual flow uses the CV service to prepare a photo session.

---

## 7. Risks and Controls

| Risk | Control |
|---|---|
| The screenshots are treated as proof of a specific phone model | Require physical device metadata or label the result as emulator evidence. |
| A toolbar change fixes one photo but fails at a different aspect ratio | Test tall and wide photos and measure the row and clipping bounds at narrow and breakpoint widths. |
| A cosmetic full-screen change masks a transform-coordinate mismatch | Compare the same session using normalized photo landmarks, inspect canvas and model bounds, and verify the saved snapshot. |
| Responsive changes disrupt the compact editor or desktop | Keep one active canvas and inspector, preserve state callbacks, and rerun QAD-TC52 across portrait, landscape, and desktop. |
| A matching visual preview is described as calibrated measurement | Retain approximate-preview labels and existing evidence gates for metric dimensions. |

---

## 8. Readiness Decision

The assigned investigation reproduced toolbar clipping from the original non-wrapping row and a free-place placement jump during canvas resizing. Below 1024px, the toolbar now flows below the photo canvas in the existing card. At desktop widths of 1024px and above, the original floating toolbar and canvas card layout remain in place. Free-place position, size, and motion values scale with measured canvas width. Perspective corners remain normalized.

The desktop floating toolbar is positioned relative to the surrounding photo card while the photo canvas keeps its own clipped, rounded image surface. This lets the controls extend past the image edge without cutting off their labels or hit areas. All five desktop actions use the same 100 by 48 pixel size.

In Chromium viewport emulation at 320 by 700 CSS pixels, the standard photo canvas measured 214 by 194.82 pixels and compact portrait measured 320 by 291.32 pixels. Perspective handle coordinates differed by less than 0.00003 in normalized photo space. Before the free-place correction, normalized top-left and bottom-right corners changed from (0.15975, 0.10306) and (0.87843, 1.03497) to (0.27246, 0.23455) and (0.75308, 0.85776) on compact entry. After correction, standard, compact portrait, compact landscape, and Done differed by at most 0.00002 after resize settled; repeated toggles showed no drift. Five toolbar actions fit in two columns below the 320-pixel photo canvas with 103 by 55.5 pixel buttons and no handle overlap. The 700 by 320 compact landscape HUD actions measured 44 pixels.

Physical iOS Safari and Android Chrome devices were unavailable, so their behavior and the original device identity remain unconfirmed. The browser session did not yield a saved snapshot file for visual comparison. A transient DOM measurement before the resize observer update was observed; a painted mismatch was not confirmed. These gaps keep FIX-UI5-V1 and the snapshot portion of FIX-UI5-V3 open.

---

## Self-Check

- [x] Investigation and implementation evidence is recorded in this file.
- [x] The two user-reported issues have separate diagnosis, ownership, and acceptance paths.
- [x] `agent-organizer` assigned the device investigator and future fix owner with an explicit handoff.
- [x] Existing BRD, PRD, SDD, DSD, and QAD IDs are used without inventing a catalog ID.
- [x] Current source facts are separated from causes that require device reproduction.
- [x] No em-dashes, box diagrams, secrets, schema changes, or dependencies are introduced.
