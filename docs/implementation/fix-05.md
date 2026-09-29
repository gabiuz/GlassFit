# Implementation Specification: Perspective Plane Picker Corner Handle Drag Offset Correction (fix-05)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Technical Specification for 4-Point Plane Corner Handle Drag Drift Defect  
**Version:** 1.0.0  
**Date:** September 19, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Completed  
**Upstream Specifications:** `docs/implementation/fix-04.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/prd-glassfit.md`, `docs/qad-glassfit.md`  

---

## 1. Problem Context & Empirical Defect Analysis

During end-to-end testing of the Perspective Plane Picker overlay (`PerspectivePlanePicker.tsx`), a single critical defect was identified in the corner handle drag workflow:

### 1.1 Defect 1: Corner Handle Drifts Away from Cursor During Readjustment

- **Observed Behavior:** When the user clicks to place all 4 corners and then attempts to drag a corner handle to a new position, the handle visually moves away from the cursor. As the user drags faster or moves farther from the initial click point, the handle increasingly lags behind or snaps to a wrong position relative to the cursor.
- **Impact:** The user cannot accurately fine-tune the quadrilateral boundary to match the room opening. The perspective plane confirmation is blocked because the handle does not settle on the intended pixel coordinate, producing an invalid or imprecise quadrilateral.

#### 1.1.1 Root Cause A: Missing Pointer Pickup Offset

The `handleHandlePointerDown` handler (line 97 of `PerspectivePlanePicker.tsx`) calls `setPointerCapture` and sets `activeDragIndex`, but it does not capture the sub-pixel offset between the cursor position at mousedown and the center of the handle circle. During `handleHandlePointerMove` (line 106), `getCanvasCoordinates` returns the raw cursor position in canvas space and assigns it directly to the point:

```typescript
// Current behavior (lines 113-117):
setPoints((prev) => {
  const next = [...prev];
  next[activeDragIndex] = coord;
  return next;
});
```

Because the cursor rarely lands exactly on the center of the `r=8` handle circle at the start of the drag, the handle center jumps to the cursor position on the first `pointerMove` event and thereafter tracks the cursor center, not the original grab offset. This manifests as an apparent "teleport then drift" when the user initiates a drag from the edge of a handle badge.

#### 1.1.2 Root Cause B: PointerMove Registered on Handle Element, Not on SVG

The `onPointerMove` and `onPointerUp` event handlers are attached to the `<g>` element (lines 273-274), which is the handle group itself. Even though `setPointerCapture` is called on `e.currentTarget`, browser-captured pointer events are still dispatched to the capturing element via its React synthetic event handlers only when the pointer is within the React event subtree. When the user drags fast and the cursor exits the hit area of the `<g>` group, React no longer dispatches `onPointerMove` to that element, so the handle freezes at the last reported cursor position while the cursor continues to move. The `ManualOcclusionPointPicker.tsx` component (which handles the same interaction correctly) solves this by registering `onPointerMove` and `onPointerUp` on the SVG root element, ensuring drag events are received regardless of cursor position.

#### 1.1.3 Root Cause Summary

| Root Cause | Location | Effect |
|---|---|---|
| No pickup offset captured at `pointerDown` | `handleHandlePointerDown` (line 97) | Handle center jumps to cursor on first move event |
| `onPointerMove`/`onPointerUp` on `<g>` element, not SVG root | `<g>` render (lines 272-274) | Handle freezes when cursor exits the small hit area at fast drag speed |

---

## 2. Traceability & Specification Mapping

| Traceability Code | Specification Reference | Architectural Function |
|---|---|---|
| PRD-F3 | Space Photo Upload & Room Boundary Analysis | Enables room boundary detection required before product visualization |
| PRD-F4 | Perspective Correction & Plane Fitting | Governs 4-point quadrilateral selection for homographic plane registration |
| SDD-C2 | Room Analysis & Perspective Engine | Manages perspective transform lifecycle for room boundary delineation |
| DSD-UI6 | Perspective Plane Picker Overlay | Defines the 4-point interactive drag UI component and corner handle behavior |
| QAD-TC10 | Perspective Plane Picker Functional Test | Validates corner placement, drag adjustment, and confirm workflow |
| BAN-PUNCT-01 | Zero em-dashes in documentation | Hyphens, colons, and parentheses used exclusively |
| BAN-SPEC-02 | Spec-linked commits and tasks | Direct traceability to PRD-F3, PRD-F4, SDD-C2, DSD-UI6, and QAD-TC10 |
| BAN-TYPE-05 | Zero `any` in TypeScript | Strict typing across drag state and coordinate transform utilities |
| BAN-UI-09 | Strict UI consistency | Reuses established GlassFit Tailwind tokens and presentation components |

---

## 3. Architectural Scope & Boundaries

### 3.1 In Scope

| Target File | Modification Rationale |
|---|---|
| `src/features/visualization/components/PerspectivePlanePicker.tsx` | 1. Add a `dragOffsetRef` (`useRef`) to capture the sub-pixel offset between cursor and handle center at `pointerDown`.<br>2. Lift `onPointerMove` and `onPointerUp` handlers from the `<g>` handle element to the SVG root element, matching the proven pattern in `ManualOcclusionPointPicker.tsx`.<br>3. Apply the captured offset when computing the new point coordinate in `handleHandlePointerMove` to maintain natural grab feel. |

### 3.2 Out of Scope

| System Component | Rationale |
|---|---|
| `src/lib/visualization/perspectiveTransform.ts` | Coordinate normalization and quadrilateral validation utilities are correct and unaffected. |
| `src/lib/visualization/types.ts` | `Point2D` and `QuadrilateralCorners` type definitions are correct and unchanged. |
| `src/features/visualization/components/ManualOcclusionPointPicker.tsx` | Already implements the correct drag pattern; no changes needed. |
| `fastapi-service/` | Space image analysis and YOLOv8 segmentation are unaffected. |
| `supabase/migrations/` | No database schema changes required. |

---

## 4. Technical Implementation

### 4.1 Add `dragOffsetRef` for Pickup Offset Tracking

A `useRef<{ x: number; y: number } | null>` stores the vector from the cursor canvas position to the handle center at the moment `pointerDown` fires. This prevents the handle from teleporting on the first `pointerMove`:

```typescript
// Add alongside activeDragIndex state (after line 52):
const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
```

### 4.2 Capture Offset in `handleHandlePointerDown`

```typescript
// BEFORE (lines 97-104):
const handleHandlePointerDown = (
  index: number,
  e: React.PointerEvent<SVGCircleElement | SVGTextElement | SVGGElement>,
) => {
  e.stopPropagation();
  e.currentTarget.setPointerCapture(e.pointerId);
  setActiveDragIndex(index);
};
```

```typescript
// AFTER:
const handleHandlePointerDown = (
  index: number,
  e: React.PointerEvent<SVGCircleElement | SVGTextElement | SVGGElement>,
) => {
  e.stopPropagation();
  e.preventDefault();
  const coord = getCanvasCoordinates(e.clientX, e.clientY);
  if (coord) {
    dragOffsetRef.current = {
      x: points[index].x - coord.x,
      y: points[index].y - coord.y,
    };
  }
  setActiveDragIndex(index);
};
```

`setPointerCapture` is removed from the handle element because pointer capture is managed on the SVG root element via `svgRef.current?.setPointerCapture` called from `onPointerDown` on the `<g>`.

### 4.3 Apply Offset in Lifted SVG-Root Pointer Handlers

```typescript
// BEFORE (lines 106-131):
const handleHandlePointerMove = (
  e: React.PointerEvent<SVGCircleElement | SVGTextElement | SVGGElement>,
) => {
  if (activeDragIndex === null) return;
  const coord = getCanvasCoordinates(e.clientX, e.clientY);
  if (!coord) return;

  setPoints((prev) => {
    const next = [...prev];
    next[activeDragIndex] = coord;
    return next;
  });
};

const handleHandlePointerUp = (
  e: React.PointerEvent<SVGCircleElement | SVGTextElement | SVGGElement>,
) => {
  if (activeDragIndex !== null) {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may have already been released
    }
    setActiveDragIndex(null);
  }
};
```

```typescript
// AFTER (handlers lifted to SVG root element signature):
const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
  if (activeDragIndex === null) return;
  const coord = getCanvasCoordinates(e.clientX, e.clientY);
  if (!coord) return;

  const offset = dragOffsetRef.current ?? { x: 0, y: 0 };
  const x = Math.max(0, Math.min(canvasWidth, coord.x + offset.x));
  const y = Math.max(0, Math.min(canvasHeight, coord.y + offset.y));

  setPoints((prev) => {
    const next = [...prev];
    next[activeDragIndex] = { x, y };
    return next;
  });
};

const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
  if (activeDragIndex !== null) {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may have already been released
    }
    dragOffsetRef.current = null;
    setActiveDragIndex(null);
  }
};
```

### 4.4 Wire Handlers to SVG Root and Update `<g>` Element

```typescript
// BEFORE (SVG element, lines 234-241):
<svg
  ref={svgRef}
  viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
  onClick={handleSvgClick}
  className={`absolute inset-0 w-full h-full object-contain z-10 ${
    points.length < 4 ? "cursor-crosshair" : "cursor-default"
  }`}
  style={{ touchAction: "none" }}
>
```

```typescript
// AFTER:
<svg
  ref={svgRef}
  viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
  onClick={handleSvgClick}
  onPointerMove={handleSvgPointerMove}
  onPointerUp={handleSvgPointerUp}
  onPointerCancel={handleSvgPointerUp}
  className={`absolute inset-0 w-full h-full object-contain z-10 ${
    points.length < 4
      ? "cursor-crosshair"
      : activeDragIndex !== null
      ? "cursor-grabbing"
      : "cursor-default"
  }`}
  style={{ touchAction: "none" }}
>
```

```typescript
// BEFORE (lines 269-280):
<g
  key={index}
  transform={`translate(${point.x}, ${point.y})`}
  onPointerDown={(e) => isDraggable && handleHandlePointerDown(index, e)}
  onPointerMove={isDraggable ? handleHandlePointerMove : undefined}
  onPointerUp={isDraggable ? handleHandlePointerUp : undefined}
  className={
    isDraggable
      ? "cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
      : "cursor-default"
  }
  style={{ touchAction: "none" }}
>
```

```typescript
// AFTER:
<g
  key={index}
  transform={`translate(${point.x}, ${point.y})`}
  onPointerDown={(e) => {
    if (!isDraggable) return;
    handleHandlePointerDown(index, e);
    svgRef.current?.setPointerCapture(e.pointerId);
  }}
  className={
    isDraggable
      ? "cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
      : "cursor-default"
  }
  style={{ touchAction: "none" }}
>
```

Key design decisions in this transformation:

1. **Pointer capture on SVG root:** Capturing the pointer on the SVG root rather than the `<g>` element guarantees that all `pointerMove` events are dispatched to the SVG even when the cursor exits the small handle hit area at high drag speed. This matches the proven pattern in `ManualOcclusionPointPicker.tsx`.
2. **Pickup offset neutralizes jump-on-first-move:** Storing the delta between the handle center and the cursor position at `pointerDown` and re-applying it during `pointerMove` ensures the handle remains exactly under the cursor original grab point throughout the entire drag gesture.
3. **`onPointerCancel` on SVG root:** Handles tablet stylus lift and touch cancellation by resetting drag state identically to `pointerUp`, preventing a stuck drag state.

---

## 5. Verification Plan

### 5.1 Static Verification

Execute lint, typecheck, and production build to confirm zero regressions:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

### 5.2 Manual End-to-End Verification Scenarios

1. **Test Scenario 1: Slow Corner Drag Stays on Cursor**
   - Navigate to the workspace and trigger the Perspective Plane Picker for a window opening.
   - Place all 4 corners, then slowly drag corner 1 to a new position.
   - **Expected Result:** Corner handle center tracks exactly under the cursor at all times. No jump occurs on the first move event.

2. **Test Scenario 2: Fast Corner Drag Does Not Freeze**
   - With 4 corners placed, drag any corner handle rapidly across the canvas.
   - **Expected Result:** The handle continues to follow the cursor even at high speed. The handle does not freeze mid-drag when the cursor exits the handle badge area.

3. **Test Scenario 3: Grab from Handle Edge, Not Center**
   - Initiate a drag by clicking on the outer edge of the handle circle (not the center).
   - **Expected Result:** The handle does not jump; it moves such that the grab point on the handle remains under the cursor throughout the drag.

4. **Test Scenario 4: Touch and Stylus Drag (Tablet)**
   - On a touch device, use a finger or stylus to drag a corner handle.
   - **Expected Result:** Touch drag follows the contact point. Lifting the finger mid-drag (`pointerCancel`) resets drag state correctly; no ghost drag remains active.

5. **Test Scenario 5: Confirm Workflow Unaffected**
   - Place 4 corners, adjust all via drag, then click "Confirm Fit."
   - **Expected Result:** `onConfirm` is called with normalized `QuadrilateralCorners`. The downstream perspective transform processes the corrected quad without regression.

---

## 6. Risk Assessment & Mitigation

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| `svgRef.current` is null at `pointerDown` before SVG mounts | Low | Very Low | Guard with optional chaining (`svgRef.current?.setPointerCapture`); if null, drag falls back to no pointer capture but still functions via the lifted SVG handlers. |
| `dragOffsetRef` retains stale offset if `pointerUp` is missed | Low | Very Low | `handleSvgPointerUp` and `handleSvgPointerCancel` both reset `dragOffsetRef.current = null`; subsequent `pointerDown` always overwrites the ref before any move. |
| Removing `onPointerMove` from `<g>` breaks scroll behavior | None | None | `style={{ touchAction: "none" }}` already suppresses scroll on the `<g>`; scroll suppression is also set on the SVG root, which covers all child elements. |

---

## Self-Check & Quality Checklist

- [x] Document metadata aligns with GlassFit master documentation index (`docs/index.md`)
- [x] Primary operating directives map to core specifications (PRD-F3, PRD-F4, SDD-C2, DSD-UI6, QAD-TC10)
- [x] Zero em-dashes present in text or code comments (enforced by BAN-PUNCT-01)
- [x] Both root causes identified with exact file paths and line numbers (`PerspectivePlanePicker.tsx:97-104`, `PerspectivePlanePicker.tsx:106-131`, `PerspectivePlanePicker.tsx:272-274`)
- [x] Fix pattern cross-referenced against the proven `ManualOcclusionPointPicker.tsx` drag implementation
- [x] Concrete before-and-after code provided for all handler and JSX changes
- [x] Verification plan includes static checks, slow/fast drag scenarios, grab-from-edge, touch, and end-to-end confirm workflow
