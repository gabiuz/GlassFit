# Implementation Specification: Post-Implementation Fixes for MS-04 Controls Attachment and Perspective Model Configurability (fix-MS-04)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Bug Fix Specification for Model Control Attachment, Perspective Quad Handles, and Post-Fit Reconfigurability  
**Version:** 1.0.0  
**Date:** September 16, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Implemented  
**Upstream Specifications:** `docs/implementation/ms04.md`, `docs/implementation/fix-ms02.md`, `docs/implementation/ms02.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/prd-glassfit.md`, `docs/qad-glassfit.md`

---

## 1. Problem Context & Motivation

Following the implementation of Milestone 4 (Scene-Adaptive Photorealism Harmonization, MS-04) and recent visualization UI refactoring, two critical regressions emerged in the 3D model interaction pipeline:

### Issue 1: Model Cannot Be Configured After 4-Point Plane Fitting
- **Observed Defect:** Once a user fits a window product into a wall opening using the 4-point perspective plane picker, the model becomes rigid and un-configurable. The interactive transform controls previously established in fix-MS-02 are missing.
- **Root Cause:**
  1. During layer stacking refactoring in `ProductModelWorkspace.tsx` (separating `active-product` at `z-20` and `product-controls` at `z-40`), the conditional rendering block for perspective mode (`perspectiveCorners ? (...) : (...)`) only retained the floating toolbar (`Edit Corners`, `Free Place`, `Flip`, `Reset`, `Remove`).
  2. All 9 on-canvas transform handles (`perspectiveHandlePoints`: 4 corner scaling handles, 4 edge midpoint width/height handles, and 1 center translation handle) were omitted from the perspective controls layer.
  3. The interactive pointer drag handlers (`startPerspectiveResize`, `startPerspectiveMove`) and the pointer event binding on `overlayBoxRef` were wiped out.
  4. In `PerspectivePlanePicker.onConfirm`, natural 3D yaw and pitch estimation based on quadrilateral foreshortening was hard-reset to `(0, 0)`, eliminating the initial wall-aligned depth.

### Issue 2: Model Controls Detached from the Model (Spacing Gap vs. Perspective Quad Alignment)
- **Observed Defect (Reference: Picture 1 vs. Picture 2):**
  - **Picture 1 (Broken State):** The model controls (corner resize squares, midpoint pills, rotation handles, center drag badge) do not hug the window model. Instead, they expand to the outer boundary of the entire canvas buffer, creating a large, floating gap of empty space between the controls and the 3D extrusion. In addition, when perspective fitting is active, the controls fail to follow the slanted quadrilateral boundaries.
  - **Picture 2 (Correct Desired State):** The controls are attached directly and snugly to the model. In perspective fitting mode, the 4 white square handles sit exactly on the 4 perspective corners, the 4 cyan midpoint dots sit on the 4 perspective edge centers, and the cyan center badge sits at the perspective centroid, moving and scaling in unison with the model geometry.
- **Root Cause:**
  1. **Free Placement Mode:** In `handleCanvasMount` and `useLayoutEffect`, `getVisibleModelBounds` was called directly on `sourceCanvas` (the WebGL canvas instance created by Three.js `WebGLRenderer`). Calling `canvas.getContext("2d")` on a canvas that already possesses a WebGL rendering context returns `null` per the HTML5 Canvas specification. Because `getContext("2d")` failed, `getVisibleModelBounds` returned `null`, leaving `projectedModelBounds` stuck at `{ left: 0, top: 0, width: 1, height: 1 }` (100% of the canvas frame). Consequently, `outlineControlsStyle` expanded the controls to the full canvas bounds rather than the actual model silhouette.
  2. **Perspective Mode:** Because the perspective transform handles were omitted from `product-controls`, no handles were attached to the perspective quad. If the system fell back to free-placement controls, those controls rendered as an upright, un-warped rectangle around the canvas center instead of mapping to the fitted 4-point perspective plane.

---

## 2. Traceability & Specification Mapping

| Traceability Code | Specification Reference | Relevance |
|---|---|---|
| PRD-F6 | Photo-Based Visualization Workspace | Restores intuitive on-canvas manipulation for placed and perspective-fitted models |
| PRD-F18 | Guided Camera Capture & Perspective Helper | Re-attaches transform handles directly to 4-point perspective quadrilateral vertices |
| SDD-C5 | Photo-Based Visualization Canvas | Fixes 2D bounding box measurement on WebGL canvases and restores perspective quad handles |
| SDD-C6 | Canvas Compositor & Snapshot Pipeline | Ensures real-time model changes via transform handles propagate cleanly to snapshots |
| DSD-UI6 | Visualization Workspace Viewport | Enforces visual fidelity of control handles matching Picture 2 (corner squares, edge dots, center badge) |
| QAD-TC8 | Object-Aware Foreground Occlusion Layering | Maintains `z-40` controls layer strictly above `z-30` occlusion and `z-20` product canvas |
| QAD-TC12 | Visual Realism and Lighting Adaptation | Preserves MS-04 photorealism (noise, PBR lighting, contact shadows) without interfering with bounds |
| MS-02 | 4-Point Perspective Plane Fitting | Preserves CSS `matrix3d` homography warping and corner coordinate integrity |
| fix-MS-02 | Post-Implementation Perspective Fixes | Restores `scaleCornersAlongAxis` on-canvas configurability and 3D angle estimation |
| MS-04 | Scene-Adaptive Photorealism Harmonization | Harmonizes procedural noise and contact occlusion with clean bounding box measurements |
| BAN-PUNCT-01 | No em-dashes in documentation or comments | Enforces hyphens, colons, or parentheses exclusively |
| BAN-TYPE-05 | No `any` in TypeScript | Strict type safety across all corner geometries and event handlers |
| BAN-UI-09 | No foreign UI styles or ad-hoc styling | Strictly reuses established Tailwind classes and design tokens |

---

## 3. Architectural Scope & Boundaries

### 3.1 In Scope

| Layer | Component | Planned Modification |
|---|---|---|
| `src/features/visualization/components/` | `ProductModelWorkspace.tsx` | 1. Fix `getVisibleModelBounds` measurement on 2D canvas buffer after WebGL blit.<br>2. Restore `perspectiveHandlePoints` memoized calculation (corners, edges, center).<br>3. Restore `startPerspectiveResize` and `startPerspectiveMove` pointer callbacks.<br>4. Re-attach 9 interactive handles to the perspective quadrilateral layer in `product-controls`.<br>5. Restore draggable overlay behavior in perspective mode (`startPerspectiveMove` on `overlayBoxRef`).<br>6. Restore initial yaw/pitch estimation from quadrilateral foreshortening in `PerspectivePlanePicker.onConfirm`. |
| `src/lib/visualization/` | `perspectiveTransform.ts` | Verify and preserve `scaleCornersAlongAxis` for uniform, width, and height scaling along perspective axes. |
| `tests/unit/` | Vitest suites | Add unit tests validating perspective handle coordinates, bounding box recovery, and two-way sidebar synchronization. |

### 3.2 Out of Scope

| Layer | Rationale |
|---|---|
| `fastapi-service/` | Backend brightness and depth services are functioning properly; no backend alterations required. |
| `src/lib/visualization/modelRenderer.ts` | Three.js PBR camera framing, shadow frustums, and lighting ratios are verified and stable. |
| `src/lib/visualization/noiseGenerator.ts` | Monochromatic grain masking with `destination-in` is verified and operational. |
| `src/lib/visualization/contactShadow.ts` | Contact occlusion and aperture reveal shading calculations are verified and stable. |
| Database migrations | Persistence schema for `perspectiveFitCorners` is unchanged. |

---

## 4. Technical Specification

### 4.1 Resolving Model Controls Detachment in Free Placement (Picture 1 Defect)

**Problem Detail:**  
In `ProductModelWorkspace.tsx`, `getVisibleModelBounds` requires a 2D rendering context to execute `getImageData(0, 0, width, height)`. When called with `sourceCanvas` (the Three.js WebGL canvas), `canvas.getContext("2d")` returns `null`. This prevents visible pixel scanning, causing `projectedModelBounds` to remain at the default `{ left: 0, top: 0, width: 1, height: 1 }`.

**Solution:**  
Execute `getVisibleModelBounds` on `mvpCanvasRef.current` (or the intermediate 2D display canvas) immediately after drawing `sourceCanvas` into the 2D context and before applying any post-processing overlays (grain or contact shadows):

```typescript
// Inside handleCanvasMount and useLayoutEffect:
const ctx = targetCanvas.getContext("2d");
if (ctx) {
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.drawImage(
    sourceCanvas,
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
    0,
    0,
    targetCanvas.width,
    targetCanvas.height,
  );

  // Measure visible bounds directly from clean 2D canvas before noise/shadows
  if (!isOutlineMeasurementPaused && !perspectiveCorners) {
    const computedBounds = getVisibleModelBounds(targetCanvas);
    if (computedBounds) {
      setProjectedModelBounds(computedBounds);
    }
  }

  // Apply MS-04 photorealism post-processing
  if (isPlanar && autoRealism && autoShadow && effectiveLighting) {
    applyContactOcclusionAndReveals(ctx, targetCanvas.width, targetCanvas.height, {
      lightDirection: effectiveLighting.light_direction,
      shadowOpacity: effectiveLighting.suggested?.shadow_opacity ?? 0.28,
    });
  }

  if (autoRealism && effectiveLighting?.suggested?.grain) {
    applyNoiseToCanvas(ctx, targetCanvas.width, targetCanvas.height, effectiveLighting.suggested.grain);
  }
}
```

This ensures `outlineControlsStyle` shrinks tightly around the actual rendered window profile with exact padding (`MODEL_CONTROLS_PADDING_PX = 6`), eliminating the detached gap in Picture 1.

---

### 4.2 Restoring 9 On-Canvas Perspective Transform Handles (Picture 2 Desired State)

**File:** `src/features/visualization/components/ProductModelWorkspace.tsx`

When `perspectiveCorners` is present, the workspace must compute the exact screen-space coordinates of the 4 quadrilateral corners, the 4 edge midpoints, and the perspective centroid:

```typescript
const perspectiveHandlePoints = useMemo(() => {
  if (!perspectiveCorners) return null;
  const currentW = canvasDisplaySize.width;
  const currentH = canvasDisplaySize.height;
  if (currentW <= 0 || currentH <= 0) return null;

  const pxCorners = denormalizeCorners(perspectiveCorners, currentW, currentH);
  const [p0, p1, p2, p3] = pxCorners;

  return {
    corners: [
      { id: "tl", x: p0.x, y: p0.y, cursor: "cursor-nwse-resize", signX: -1, signY: -1 },
      { id: "tr", x: p1.x, y: p1.y, cursor: "cursor-nesw-resize", signX: 1, signY: -1 },
      { id: "br", x: p2.x, y: p2.y, cursor: "cursor-nwse-resize", signX: 1, signY: 1 },
      { id: "bl", x: p3.x, y: p3.y, cursor: "cursor-nesw-resize", signX: -1, signY: 1 },
    ],
    edges: [
      { id: "top", x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, mode: "height" as const, signX: 0, signY: -1, cursor: "cursor-ns-resize" },
      { id: "bottom", x: (p3.x + p2.x) / 2, y: (p3.y + p2.y) / 2, mode: "height" as const, signX: 0, signY: 1, cursor: "cursor-ns-resize" },
      { id: "left", x: (p0.x + p3.x) / 2, y: (p0.y + p3.y) / 2, mode: "width" as const, signX: -1, signY: 0, cursor: "cursor-ew-resize" },
      { id: "right", x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, mode: "width" as const, signX: 1, signY: 0, cursor: "cursor-ew-resize" },
    ],
    center: {
      x: (p0.x + p1.x + p2.x + p3.x) / 4,
      y: (p0.y + p1.y + p2.y + p3.y) / 4,
    },
  };
}, [perspectiveCorners, canvasDisplaySize.width, canvasDisplaySize.height]);
```

#### Handle Visual Specifications (Matching Picture 2):
1. **4 Corner Handles (Scale):**
   - Style: `absolute size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 pointer-events-auto`
   - Centered on corner vertex: `transform: translate(-50%, -50%)`
   - Tooltip: "Drag corner to scale"
2. **4 Edge Midpoint Handles (Width and Height):**
   - Style: `absolute size-3 bg-[#07b6d3] rounded-full shadow-md z-20 pointer-events-auto`
   - Centered on edge midpoint: `transform: translate(-50%, -50%)`
   - Tooltip: "Drag to resize width" or "Drag to resize length/height"
3. **1 Center Move Handle (Translation):**
   - Style: `absolute size-6 rounded-full bg-[#07b6d3] flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing z-20 pointer-events-auto`
   - Inner dot: `size-2 bg-white rounded-full`
   - Centered at perspective centroid: `transform: translate(-50%, -50%)`
   - Tooltip: "Drag to move"

---

### 4.3 Perspective Drag & Resize Handlers

Implement smooth pointer interaction with two-way synchronization to sidebar dimensions:

```typescript
const startPerspectiveResize = useCallback(
  (
    event: React.PointerEvent,
    mode: "scale" | "width" | "height",
    signX: number,
    signY: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!perspectiveCorners) return;

    const session = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startCorners: [...perspectiveCorners] as QuadrilateralCorners,
      startWidthCm: Number(widthCm) || 120,
      startHeightCm: Number(heightCm) || 120,
      signX,
      signY,
    };
    setIsUsingTransformHandle(true);

    const currentW = canvasRef.current?.clientWidth || canvasDisplaySize.width || 800;
    const currentH = canvasRef.current?.clientHeight || canvasDisplaySize.height || 600;

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - session.startX) * session.signX;
      const dy = (moveEvent.clientY - session.startY) * session.signY;

      if (session.mode === "scale") {
        const dominantDelta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        const initialSpan = currentW * 0.35;
        const scaleRatio = Math.max(0.15, 1 + dominantDelta / initialSpan);
        const nextCorners = scaleCornersAlongAxis(session.startCorners, scaleRatio, "scale");
        setPerspectiveCorners(nextCorners);
        const nextW = Math.max(20, Math.round(session.startWidthCm * scaleRatio));
        const nextH = Math.max(20, Math.round(session.startHeightCm * scaleRatio));
        setWidthCm(String(nextW));
        setHeightCm(String(nextH));
        setOverlaySize(getOverlaySizeFromDimensions(String(nextW), String(nextH)));
        return;
      }

      if (session.mode === "width") {
        const initialSpan = currentW * 0.30;
        const widthRatio = Math.max(0.15, 1 + dx / initialSpan);
        const nextCorners = scaleCornersAlongAxis(session.startCorners, widthRatio, "width");
        setPerspectiveCorners(nextCorners);
        const nextW = Math.max(20, Math.round(session.startWidthCm * widthRatio));
        setWidthCm(String(nextW));
        setOverlaySize(getOverlaySizeFromDimensions(String(nextW), heightCm));
        return;
      }

      if (session.mode === "height") {
        const initialSpan = currentH * 0.30;
        const heightRatio = Math.max(0.15, 1 + dy / initialSpan);
        const nextCorners = scaleCornersAlongAxis(session.startCorners, heightRatio, "height");
        setPerspectiveCorners(nextCorners);
        const nextH = Math.max(20, Math.round(session.startHeightCm * heightRatio));
        setHeightCm(String(nextH));
        setOverlaySize(getOverlaySizeFromDimensions(widthCm, String(nextH)));
        return;
      }
    };

    const handleEnd = () => {
      setIsUsingTransformHandle(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
  },
  [perspectiveCorners, widthCm, heightCm, canvasDisplaySize.width, canvasDisplaySize.height],
);

const startPerspectiveMove = useCallback(
  (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!perspectiveCorners || isUsingTransformHandle) return;

    const session = {
      startX: event.clientX,
      startY: event.clientY,
      startCorners: [...perspectiveCorners] as QuadrilateralCorners,
    };
    setIsUsingTransformHandle(true);

    const currentW = canvasRef.current?.clientWidth || canvasDisplaySize.width || 800;
    const currentH = canvasRef.current?.clientHeight || canvasDisplaySize.height || 600;

    const handleMove = (moveEvent: PointerEvent) => {
      const normDx = (moveEvent.clientX - session.startX) / Math.max(currentW, 1);
      const normDy = (moveEvent.clientY - session.startY) / Math.max(currentH, 1);

      const nextCorners = session.startCorners.map((p) => ({
        x: clampNumber(p.x + normDx, -0.2, 1.2),
        y: clampNumber(p.y + normDy, -0.2, 1.2),
      })) as QuadrilateralCorners;

      setPerspectiveCorners(nextCorners);
    };

    const handleEnd = () => {
      setIsUsingTransformHandle(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
  },
  [perspectiveCorners, isUsingTransformHandle, canvasDisplaySize.width, canvasDisplaySize.height],
);
```

---

### 4.4 Direct Perspective Overlay Dragging & Initial Angle Estimation

1. **Draggable Model Surface in Perspective Mode:**  
   Attach `onPointerDown={isEditingProduct ? startPerspectiveMove : undefined}` directly to `overlayBoxRef`:
   ```tsx
   <div
     ref={overlayBoxRef}
     onPointerDown={isEditingProduct ? startPerspectiveMove : undefined}
     className={`absolute pointer-events-auto select-none ${
       isEditingProduct ? "cursor-grab active:cursor-grabbing" : "cursor-default"
     }`}
     style={{
       left: 0,
       top: 0,
       width: overlaySize.width,
       height: overlaySize.height,
       transformOrigin: "0 0",
       transform: homographyToCssMatrix3d(...),
       ...
     }}
   >
   ```

2. **Restore 3D Perspective Orientation Estimation on Confirm:**  
   In `PerspectivePlanePicker.onConfirm`, compute initial 3D yaw and pitch from the geometric foreshortening of the 4 points:
   ```typescript
   const [p0, p1, p2, p3] = pxCorners;
   const leftH = Math.hypot(p3.x - p0.x, p3.y - p0.y);
   const rightH = Math.hypot(p2.x - p1.x, p2.y - p1.y);
   const topW = Math.hypot(p1.x - p0.x, p1.y - p0.y);
   const bottomW = Math.hypot(p2.x - p3.x, p2.y - p3.y);

   const maxH = Math.max(leftH, rightH, 1);
   const maxW = Math.max(topW, bottomW, 1);
   const deltaH = (leftH - rightH) / maxH;
   const deltaW = (bottomW - topW) / maxW;

   const initialYaw = Math.round(clampNumber(deltaH * 35, -25, 25));
   const initialPitch = Math.round(clampNumber(deltaW * 25, -20, 20));

   setYaw(initialYaw);
   setPitch(initialPitch);
   setRotateAngle(0);
   setModelRevision((prev) => prev + 1);
   setShowPerspectivePicker(false);
   ```

---

### 4.5 Stacking Architecture and Controls Integration

Update the controls layer (`data-visualization-layer="product-controls"` at `z-40`) to render both the toolbar and the 9 perspective handles when `perspectiveCorners` is active:

```tsx
{selectedProduct && isEditingProduct && (
  <div
    data-visualization-layer="product-controls"
    className="absolute inset-0 z-40 pointer-events-none"
  >
    {perspectiveCorners ? (
      <>
        {/* Floating Toolbar for Perspective Mode */}
        {perspectiveToolbarPosition && (
          <div
            className="absolute flex items-center gap-2.5 select-none animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto"
            style={{
              left: perspectiveToolbarPosition.left,
              top: perspectiveToolbarPosition.top,
              transform: "translateX(-50%)",
            }}
          >
            <button
              type="button"
              onClick={() => setShowPerspectivePicker(true)}
              className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
            >
              <Maximize className="w-4 h-4 text-white" />
              <span className="text-[13px] font-normal tracking-[-0.266px]">Edit Corners</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPerspectiveCorners(null);
                setModelRevision((prev) => prev + 1);
              }}
              className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
            >
              <Move className="w-4 h-4 text-white" />
              <span className="text-[13px] font-normal tracking-[-0.266px]">Free Place</span>
            </button>
            <button
              type="button"
              onClick={handleFlip}
              className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
            >
              <FlipHorizontal className="w-4 h-4 text-white" />
              <span className="text-[13px] font-normal tracking-[-0.266px]">Flip</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
            >
              <RotateCcw className="w-4 h-4 text-white" />
              <span className="text-[13px] font-normal tracking-[-0.266px]">Reset</span>
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="bg-[#c50000] hover:bg-[#a30000] text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
            >
              <Trash2 className="w-4 h-4 text-white" />
              <span className="text-[13px] font-normal tracking-[-0.266px]">Remove</span>
            </button>
          </div>
        )}

        {/* 9 Perspective Quadrilateral Transform Handles (Picture 2 Parity) */}
        {perspectiveHandlePoints && (
          <>
            {/* 4 Corner Scale Handles */}
            {perspectiveHandlePoints.corners.map((c) => (
              <div
                key={c.id}
                onPointerDown={(e) => startPerspectiveResize(e, "scale", c.signX, c.signY)}
                className={`absolute size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 ${c.cursor} pointer-events-auto`}
                style={{
                  left: c.x,
                  top: c.y,
                  transform: "translate(-50%, -50%)",
                }}
                title="Drag corner to scale"
              />
            ))}

            {/* 4 Edge Midpoint Handles */}
            {perspectiveHandlePoints.edges.map((e) => (
              <div
                key={e.id}
                onPointerDown={(evt) => startPerspectiveResize(evt, e.mode, e.signX, e.signY)}
                className={`absolute size-3 bg-[#07b6d3] rounded-full shadow-md z-20 ${e.cursor} pointer-events-auto`}
                style={{
                  left: e.x,
                  top: e.y,
                  transform: "translate(-50%, -50%)",
                }}
                title={e.mode === "width" ? "Drag to resize width" : "Drag to resize length/height"}
              />
            ))}

            {/* 1 Center Move Handle */}
            <div
              onPointerDown={startPerspectiveMove}
              className="absolute size-6 rounded-full bg-[#07b6d3] flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing z-20 pointer-events-auto"
              style={{
                left: perspectiveHandlePoints.center.x,
                top: perspectiveHandlePoints.center.y,
                transform: "translate(-50%, -50%)",
              }}
              title="Drag to move"
            >
              <div className="size-2 bg-white rounded-full" />
            </div>
          </>
        )}
      </>
    ) : (
      /* Free-Placement Controls (snug outline bounds from clean 2D canvas) */
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          style={{
            width: overlaySize.width,
            height: overlaySize.height,
            x: overlayX,
            y: overlayY,
          }}
          className="relative pointer-events-none"
        >
          {/* Free-Placement Toolbar */}
          <div
            className="absolute flex items-center gap-2.5 select-none animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto"
            style={toolbarControlsStyle}
          >
            {isWindowProduct && (
              <button
                type="button"
                onClick={() => setShowPerspectivePicker(true)}
                className="bg-[#07b6d3] hover:bg-[#069bb5] text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
              >
                <Maximize className="w-4 h-4 text-white" />
                <span className="text-[13px] font-normal tracking-[-0.266px]">Fit to Opening</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleRotate}
              className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
            >
              <RotateCw className="w-4 h-4 text-white" />
              <span className="text-[13px] font-normal tracking-[-0.266px]">Rotate</span>
            </button>
            <button
              type="button"
              onClick={handleFlip}
              className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
            >
              <FlipHorizontal className="w-4 h-4 text-white" />
              <span className="text-[13px] font-normal tracking-[-0.266px]">Flip</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
            >
              <RotateCcw className="w-4 h-4 text-white" />
              <span className="text-[13px] font-normal tracking-[-0.266px]">Reset</span>
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="bg-[#c50000] hover:bg-[#a30000] text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
            >
              <Trash2 className="w-4 h-4 text-white" />
              <span className="text-[13px] font-normal tracking-[-0.266px]">Remove</span>
            </button>
          </div>

          {/* Model Measured Outline Controls */}
          <div
            className="relative pointer-events-none"
            style={{
              width: overlaySize.width,
              height: overlaySize.height,
              transform: `rotate(${rotateAngle}deg)`,
              transformOrigin: "center center",
            }}
          >
            <div
              ref={outlineControlsRef}
              className="absolute pointer-events-none"
              style={outlineControlsStyle}
            >
              <button type="button" aria-label="Rotate from top left" onPointerDown={startRotation} className="absolute -top-10 -left-10 z-30 flex size-7 items-center justify-center rounded-full border border-[#07b6d3] bg-white text-[#0f1422] shadow-md hover:bg-[#e9f9fb] cursor-grab active:cursor-grabbing pointer-events-auto"><RotateCw className="size-4" /></button>
              <button type="button" aria-label="Rotate from top right" onPointerDown={startRotation} className="absolute -top-10 -right-10 z-30 flex size-7 items-center justify-center rounded-full border border-[#07b6d3] bg-white text-[#0f1422] shadow-md hover:bg-[#e9f9fb] cursor-grab active:cursor-grabbing pointer-events-auto"><RotateCw className="size-4" /></button>
              <button type="button" aria-label="Rotate from bottom left" onPointerDown={startRotation} className="absolute -bottom-10 -left-10 z-30 flex size-7 items-center justify-center rounded-full border border-[#07b6d3] bg-white text-[#0f1422] shadow-md hover:bg-[#e9f9fb] cursor-grab active:cursor-grabbing pointer-events-auto"><RotateCw className="size-4" /></button>
              <button type="button" aria-label="Rotate from bottom right" onPointerDown={startRotation} className="absolute -bottom-10 -right-10 z-30 flex size-7 items-center justify-center rounded-full border border-[#07b6d3] bg-white text-[#0f1422] shadow-md hover:bg-[#e9f9fb] cursor-grab active:cursor-grabbing pointer-events-auto"><RotateCw className="size-4" /></button>

              <div onPointerDown={(event) => startResize(event, "scale", -1, -1)} className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 cursor-nwse-resize pointer-events-auto" />
              <div onPointerDown={(event) => startResize(event, "scale", 1, -1)} className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 cursor-nesw-resize pointer-events-auto" />
              <div onPointerDown={(event) => startResize(event, "scale", -1, 1)} className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 cursor-nesw-resize pointer-events-auto" />
              <div onPointerDown={(event) => startResize(event, "scale", 1, 1)} className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 cursor-nwse-resize pointer-events-auto" />

              <div onPointerDown={(event) => startResize(event, "height", 0, -1)} className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 size-3 bg-[#07b6d3] rounded-full shadow-md z-20 cursor-ns-resize pointer-events-auto" />
              <div onPointerDown={(event) => startResize(event, "height", 0, 1)} className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 size-3 bg-[#07b6d3] rounded-full shadow-md z-20 cursor-ns-resize pointer-events-auto" />
              <div onPointerDown={(event) => startResize(event, "width", -1, 0)} className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 size-3 bg-[#07b6d3] rounded-full shadow-md z-20 cursor-ew-resize pointer-events-auto" />
              <div onPointerDown={(event) => startResize(event, "width", 1, 0)} className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 size-3 bg-[#07b6d3] rounded-full shadow-md z-20 cursor-ew-resize pointer-events-auto" />

              <div onPointerDown={startOverlayDrag} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-6 rounded-full bg-[#07b6d3] flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing z-20 pointer-events-auto">
                <div className="size-2 bg-white rounded-full" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )}
  </div>
)}
```

---

## 5. UI Controls & Styling Compliance

All restored elements strictly comply with repository standards and design tokens:
- **Design Tokens:** Exact color hex codes `#07b6d3` (GlassFit cyan accent), `#06e5ff` (handle outline), `#0f1422` (action dark), `#c50000` (destructive red).
- **Z-Index Layering (Strict Hierarchy):**
  - Layer 1 (`z-0`): Background room photograph.
  - Layer 2 (`z-10`): Cached placed multi-product snapshots.
  - Layer 3 (`z-20`): Active 3D product canvas (`data-visualization-layer="active-product"`).
  - Layer 4 (`z-30`): Foreground occlusion (`data-visualization-layer="foreground-occlusion"`).
  - Layer 5 (`z-40`): Product controls (`data-visualization-layer="product-controls"`).
- **Pointer Events:** Root container is `pointer-events-none`; interactive buttons and handles explicitly specify `pointer-events-auto`.

---

## 6. Definition of Done (Exit Criteria)

1. In 4-point perspective fitting mode, the 9 interactive transform handles render directly on top of the model quadrilateral matching Picture 2:
   - 4 white corner square handles for uniform scaling.
   - 4 cyan edge midpoint dots for width and height/length adjustments.
   - 1 cyan center badge for moving the quadrilateral.
2. Dragging any of the 9 perspective handles updates both the visual quadrilateral and the synchronized sidebar dimensions (`widthCm`, `heightCm`).
3. Dragging the window surface directly repositions the perspective quadrilateral across the wall opening.
4. Changing `widthCm` or `heightCm` in the sidebar dynamically scales the perspective quadrilateral along its perspective axis without breaking the 4-point fit.
5. In free-placement mode, the model outline controls hug the 3D model geometry tightly with no detached gap, resolving Picture 1.
6. Initial confirmation of 4 points plane estimates natural 3D yaw and pitch from wall foreshortening rather than locking flat at `(0, 0)`.
7. Full MS-04 photorealism (monochromatic grain, dynamic PBR exposure, contact shadows) remains active without corrupting bounding box detection.
8. `npm test` passes all unit test suites.
9. `npx tsc --noEmit` completes with zero TypeScript errors (BAN-TYPE-05).
10. `npm run lint` completes with zero lint errors.
11. `npm run build` succeeds cleanly.
12. Zero em-dashes exist across all code comments and documentation (BAN-PUNCT-01).

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scaling perspective corners near canvas edge pushes points outside visible view | Low | Low | `clampNumber` constrains normalized corner points within safe boundary `[-0.2, 1.2]`. |
| Modifying dimensions in sidebar causes rapid successive re-renders | Low | Low | Existing `debounce` and guardrail validations prevent excessive Three.js model rebuilds. |
| WebGL context read race condition in test environments | Low | Low | Reading 2D context from `mvpCanvasRef.current` ensures robust fallbacks if WebGL is mocked in tests. |

---

## Self-Check

- [x] Target file is `docs/implementation/fix-ms04.md`
- [x] Follows exact markdown structure and document conventions of `fix-ms02.md` and `ms04.md`
- [x] Traceability codes map to PRD-F6, PRD-F18, SDD-C5, SDD-C6, DSD-UI6, QAD-TC8, and QAD-TC12
- [x] Root causes for both Issue 1 (post-fit configurability) and Issue 2 (detached controls vs Picture 2) are thoroughly analyzed and specified
- [x] Mathematical equations and code blocks strictly detail the fix for WebGL context conflict and 9 perspective handles
- [x] Hard bans enforced: zero em-dashes (BAN-PUNCT-01), zero `any` types (BAN-TYPE-05), and zero box diagrams (BAN-DIAG-03)
- [x] Implementation completed across ProductModelWorkspace.tsx and unit tests verified
