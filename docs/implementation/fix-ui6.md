# Implementation Specification: Admin Step 4 Model Part Picking Alignment (fix-ui6)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Reproduction record and implementation plan for the admin Components 3D viewer  
**Version:** 1.0.0  
**Date:** October 28, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Partial implementation; original-draft browser acceptance pending
**Upstream Specifications:** `docs/brd-glassfit.md` (BRD-M4), `docs/prd-glassfit.md` (PRD-F5, PRD-F14), `docs/sdd-glassfit.md` (SDD-C4, SDD-C9), `docs/dsd-glassfit.md` (DSD-UI10), `docs/qad-glassfit.md` (QAD-TC94.4, QAD-TC94.5, QAD-TC94.6), `docs/implementation/ms79.md`  
**Implementation State:** Front-surface selection parity implemented; original right-frame coordinate defect remains unverified.

---

## 1. Authorized Requirement

In Step 4 of admin product setup, hovering and clicking a visible 3D part must identify that part at its rendered screen location. The right frame is the reported failing case: an administrator should not need to move the pointer into empty space to select it. The model, selected name, part navigator, and inspector must agree. Preserve the existing assembled and exploded views, camera controls, material bindings, and keyboard-accessible part navigator.

This document records the reproduced click defect and defines the future fix. No application code is changed in this planning pass.

---

## 2. Reproduction and Evidence

### 2.1 Test setup

| Field | Observed value |
|---|---|
| Browser | Existing authenticated Brave desktop window |
| Route | `/admin/products/aefa7781-ed96-4387-851a-52b550dd285d/setup?step=components` |
| Product and step | Jealousy Window draft, Step 4: Components |
| Viewer state | Assembled (Built), 18 parts |
| Screenshot size | 2940 by 1726 pixels |
| Evidence | Right-frame offset screenshot captured during the original review; retained outside the repository. |

The coordinates below are screenshot pixels from that browser session. They are useful for comparing locations within this capture; they are not CSS pixel or device-pixel-ratio measurements.

### 2.2 Steps and results

1. Open the draft at the route above and keep **Assembled (Built)** selected.
2. Select another part to make a subsequent right-frame selection observable.
3. Click the visible **JW Frame Right** bar, approximately x=1425 to 1462 and y=495 to 864 in the captured window. Clicks at (1435,550), (1445,550), (1455,550), (1445,670), (1445,790), and (1455,830) did not select JW Frame Right. A click at (1445,610) selected **JW Right Louvers**.
4. Click visually empty space at (1550,550) or (1550,700), roughly 88 pixels right of the bar's visible edge. **JW Frame Right** becomes selected and its outline appears on the bar. A click at (1500,700) selected **JW Right Louver Clips**.
5. Select **JW Frame Right** from the part navigator. Its outline appears on the visible right bar, confirming where the part is rendered. The original **JW Right Operator Upper** selection was restored after QA.

**Observed defect:** Click hit results are displaced relative to visible geometry, and an on-part click can choose an adjacent part. This directly reproduces the user's off-model selection report.

**Verification limit:** The available native browser control exposed clicks but no pointer-move-only action. A pure hover prehighlight offset was not independently measured. The future investigator must verify hover and click separately before attributing both to one cause.

---

## 3. Traceability and Specification Mapping

| Traceability code | Relationship to this plan |
|---|---|
| BRD-M4 | Supports usable, predictable admin product setup. |
| PRD-F5, PRD-F14 | Keep 3D component assembly and the admin Part Inspector usable for exact part selection. |
| SDD-C4, SDD-C9 | Keep geometry handling in the existing Three.js assembly and admin viewer boundaries. |
| DSD-UI10 | Requires selected mesh outline and agreement between the viewport and inspector. |
| QAD-TC94.4 | Covers visible selection treatment for glass and pale frame parts. |
| QAD-TC94.5 | Covers exact selection through the part navigator. |
| QAD-TC94.6 | Covers small or overlapping targets and a reliable named choice path. |
| FIX-UI6-V1 through FIX-UI6-V5 | Plan-local acceptance cases; these are not new QAD catalog IDs. |

---

## 4. Current Source Evidence and Open Diagnosis

`PartViewer3D` in `src/features/admin/products/setup/StructuralComponentsSection.tsx` clones uploaded meshes into an assembled group, assigns each part's `fileId` to its scene objects, and attaches pointer handlers to the group. The click handler builds a candidate list from mesh intersections. The same component adds selection and hover outlines and exposes an exploded view. A separate part navigator provides exact selection without 3D picking.

The browser result proves a mismatch between visible geometry and selected part at specific screen positions. It does **not** establish whether the cause is GLB geometry, scene transforms, an invisible or oversized mesh, overlapping ray intersections, camera/projection state, canvas sizing, or event handling. The fact that the navigator highlights the visible bar narrows the investigation to picking or scene geometry used for picking; it does not prove a single code defect.

The future fix must log, for one failing pointer position, the canvas rectangle, CSS-to-renderer pixel ratio, camera matrices, ray origin and direction, ordered intersections with distances and `fileId`s, and the world and projected screen bounds of the rendered right-frame meshes. Inspect the actual mesh geometry and visibility that Three.js raycasts, including any transparent or hidden surfaces. Compare these measurements in assembled, exploded, and front views before changing hit selection.

---

## 5. Architectural Scope and Fix Plan

### 5.1 In scope for future implementation

| File or area | Planned responsibility |
|---|---|
| `src/features/admin/products/setup/StructuralComponentsSection.tsx` | Inspect `PartViewer3D` scene construction, transforms, hover and click intersections, overlap choice, and selection identity. Apply the smallest correction supported by measurements. |
| Existing Three.js model loading or geometry helpers in `src/lib/admin/products/` | Inspect only if the defect originates in loaded mesh coordinates, geometry, or assembly transforms. |
| Focused viewer interaction coverage | Add a test only if it verifies the proven coordinate or intersection contract rather than merely mirroring implementation. |

### 5.2 Investigation and correction sequence

1. Reproduce the recorded right-frame case in the same draft. Record the browser viewport in CSS pixels, device pixel ratio, zoom, canvas bounds, screenshot, pointer position, visible part bounds, hovered name, and clicked name. Measure hover by moving without clicking.
2. Compare the visible right-frame mesh's projected bounds with its raycast geometry and actual intersection positions. Record all intersected part IDs in distance order at the on-bar and off-bar coordinates above. Check whether nonvisible or oversized geometry receives hits.
3. Check the source GLB transforms and how the assembled viewer clones, recenters, mirrors, scales, and nests meshes. Compare assembled and exploded views, plus Fit Model and Front View, to locate the first stage where displayed and pickable positions diverge.
4. Correct the proven mismatch in the appropriate existing owner. If picking geometry differs from rendered geometry, align them or use a bounded pick target tied to the visible mesh. If genuine visual overlap remains, present the existing named overlap choice only for parts actually under the pointer. Do not compensate with a fixed screen-space offset or a broad invisible hit area.
5. Make hover prehighlight and click selection use the same eligible part identity and intersection rules. Keep selection synchronization with the navigator and inspector, preserve Shift+Click multiselection, and retain a clear list path for thin and transparent parts.
6. Repeat the exact failing coordinates and the regression matrix below. Capture before and after evidence on the original draft and at another viewport width.

### 5.3 Out of scope

- Supabase data, migrations, material pricing, FastAPI, and customer visualization flows
- A new model format, UI library, dependency, color palette, or redesign of the admin workbench
- Rewriting the source GLB or saved component bindings unless inspection proves the asset itself is malformed and a separate asset correction is authorized

---

## 6. Acceptance and Verification Matrix

| Case | Required result |
|---|---|
| FIX-UI6-V1: Right frame alignment | Hovering and clicking across the visible JW Frame Right bar identifies JW Frame Right. Empty space at the recorded x=1550 positions does not select it. The result holds at the original camera and viewport. |
| FIX-UI6-V2: Adjacent parts | JW Right Louvers and JW Right Louver Clips are selected only from their visible projected geometry. Thin members remain reachable; true overlapping parts present a named choice. |
| FIX-UI6-V3: View and viewport changes | Picking remains aligned after Fit Model, Reset Camera, Front View, orbit, zoom, assembled/exploded toggle, and viewer resize. No fixed pixel correction is used. |
| FIX-UI6-V4: Selection parity | Hover prehighlight, click selection, outline, part name, navigator state, and inspector identity agree. Navigator selection remains an exact fallback and Shift+Click still works. |
| FIX-UI6-V5: Other parts and accessibility | Check the other 17 Jalousie parts, especially glass, pale framing, and small hardware, against QAD-TC94.4 through QAD-TC94.6. Keyboard selection through the navigator remains operable. |

After implementation, run `npm run lint`, `npx tsc --noEmit`, `npm run build`, and the focused component/viewer tests available at that time. Record pre-existing command failures separately from regressions. Browser acceptance is required because static checks cannot establish screen-space picking alignment.

---

## 7. Risks and Controls

| Risk | Control |
|---|---|
| A visible outline is mistaken for proof that raycast geometry is aligned | Measure rendered bounds and ordered ray intersections separately. |
| A hardcoded offset works only at one size or camera angle | Fix the shared world-to-screen or mesh hit geometry contract and retest camera and viewport changes. |
| An adjacent or transparent mesh steals the hit | Inspect all eligible intersections and visible surfaces before changing selection priority. |
| The reproduced click failure is assumed to prove hover behavior | Run a pointer-move-only check and record hover state separately. |
| Changes to picking disturb existing inspector behavior | Recheck navigator, inspector, multiselection, and QAD-TC94 cases. |

---

## 8. Readiness Decision

The original planning pass reproduced the reported off-model right-frame selection in the authenticated admin viewer and documented it with a screenshot and coordinates. No application code was changed in that planning pass.

### October 29, 2026 implementation note

The exact Jalousie draft URL in Section 2 returned HTTP 404 in the authenticated Brave session during implementation, so its on-bar and off-bar intersections and hover-only behavior could not be remeasured. The available Awning Window Step 4 viewer loaded, but it is a different asset and cannot establish resolution of the recorded 88-pixel offset.

Source inspection found a separate selection inconsistency: hover used the nearest mesh while click offered every intersected part, including occluded parts. `partPicking.ts` now excludes hidden and fully transparent meshes, uses the same eligible hits for hover and click, and limits the overlap choice to coincident front surfaces. Three focused tests cover occluded, coincident, and invisible surfaces. FIX-UI6-V1 through V5, especially the original right-frame offset, remain pending browser acceptance when the Jalousie draft or equivalent assets are available.

---

## Self-Check

- [x] Uses the existing `fix-uiN.md` filename and implementation-specification structure.
- [x] Records a live reproduction, exact route and viewer state, observed click positions, and a preserved screenshot.
- [x] Separates verified behavior from source-based hypotheses and unverified hover behavior.
- [x] Maps the fix to upstream PRD, SDD, DSD, and QAD requirements.
- [x] Defines measurable acceptance for the right frame, adjacent parts, view changes, and selection parity.
- [x] Makes no application code, database, dependency, or UI-style change.
