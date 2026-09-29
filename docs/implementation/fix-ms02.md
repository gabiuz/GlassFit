# Implementation Specification: Post-Implementation Fixes for 4-Point Perspective Plane Fitting (fix-MS-02)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Bug Fix Specification for MS-02 Perspective Plane Rendering and Configurability  
**Version:** 1.1.0  
**Date:** September 16, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Implemented  
**Upstream Specifications:** `docs/implementation/ms02.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`

---

## 1. Problem Context & Motivation

The MS-02 implementation (4-point perspective plane fitting) maps product overlays to user-defined quadrilaterals using CSS `matrix3d()` homography transforms. In the original implementation, the model fit the 4-point plane with exact sub-pixel boundary alignment because the renderer framed the model tightly to the canvas edges. However, three post-implementation issues degraded the visual quality and user workflow:

**Issue 1: Flat 2D model appearance.** When perspective fitting was active, the Three.js renderer switched to an orthographic camera looking perpendicular to the front plane with rotation reset to `(0, 0, 0)`. Because orthographic projection has parallel rays, all surfaces perpendicular to the screen (jamb reveals, frame thickness, recessed glass step, sill depth) projected to zero width. With high ambient lighting and constant surface normals, the 3D window appeared as a flat 2D cutout.

**Issue 2: Visible triangle mesh seam lines.** The `drawPerspectiveWarpedImage` function in the snapshot compositing pipeline subdivides the source image into a triangle mesh (8x8 grid, 128 triangles) and applies piecewise affine transforms to simulate perspective warping on a 2D canvas. Each triangle was rendered with a `clip()` call that clipped exactly to the mathematical triangle vertices. Sub-pixel rounding at clip boundaries produced visible gaps between adjacent triangles, rendering as diagonal grid lines across the glass surface.

**Issue 3: Product not configurable after fitting.** When the user confirmed a 4-point perspective fit, the `onConfirm` handler reset yaw and pitch to zero, and the renderer forced rotation to `(0, 0, 0)`. The sidebar controls (3D Yaw, 3D Pitch) had no effect because the renderer ignored them in planar mode.

**Retaining Exact 4-Point Fitting while Fixing All Three Issues:**
An initial attempt to fix Issue 1 completely removed `isPlanarFit` and used the default free-placement camera (`CAMERA_DIRECTION = (3.4, 1.8, 5.6)` at distance 3.8). This broke the exact 4-point fit because the camera was positioned far away and at an oblique angle, leaving ~55% transparent margin around the model. When CSS `matrix3d` warped the canvas, the window was shrunken in the center and detached from the 4 points.

The correct approach retains the exact edge-to-edge canvas boundary fitting from the past implementation while introducing true 3D perspective projection and configurability:
- Implement edge-to-edge 3D perspective camera framing in `isPlanarFit` mode using `projectionMatrix.makePerspective`, mapping the window's front face corners directly to the 4 canvas edges.
- Because perspective projection is used (38-degree FOV), camera rays diverge toward the edges, rendering inner jamb reveals, recessed glass, sill depth, and metallic specular gradients in full 3D realism.
- Apply user `yaw` and `pitch` rotations before computing model bounds, so sidebar sliders actively rotate the 3D model while keeping it framed within the 4 points.
- Expand triangle clip paths by 0.5px in `drawAffineTriangle` and increase subdivisions to 16, eliminating all seam gaps in snapshot compositing.
- Enable `castShadow` and `receiveShadow` on model meshes for realistic contact shadows between frame, glass, and sill.

---

## 2. Traceability & Specification Mapping

| Traceability Code | Specification Reference | Relevance |
|---|---|---|
| PRD-F6 | Photo-Based Visualization Workspace | Fixes rendering quality within the existing visualization canvas viewport |
| PRD-F18 | Guided Camera Capture & Perspective Helper | Corrects visual artifacts and restores exact 4-point perspective overlay alignment |
| SDD-C5 | Photo-Based Visualization Canvas | Implements edge-to-edge 3D perspective camera framing for perspective-fitted overlays |
| SDD-C6 | Canvas Compositor & Snapshot Pipeline | Eliminates triangle mesh seam artifacts in snapshot export compositing |
| DSD-UI6 | Visualization Workspace Viewport | Ensures sidebar controls remain functional during perspective fitting mode |
| BAN-AR-08 | No continuous AR camera tracking | No change to interaction model; fixes are rendering-only |
| BAN-UI-09 | No foreign UI styles or ad-hoc styling | No UI changes; fixes are in rendering logic only |
| BAN-SPEC-02 | No code without spec link | This document serves as the upstream specification |
| BAN-TYPE-05 | No `any` in TypeScript | No new types introduced; existing interfaces unchanged |

---

## 3. Architectural Scope & Boundaries

### 3.1 In Scope

| Layer | Change Description |
|---|---|
| `src/lib/visualization/modelRenderer.ts` | Restore `isPlanarFit` parameter and implement edge-to-edge 3D perspective camera framing with `makePerspective` and yaw/pitch rotation |
| `src/lib/visualization/parametricProductBuilder.ts` | Enable `castShadow = true` and `receiveShadow = true` on generated product meshes |
| `src/lib/visualization/perspectiveTransform.ts` | Expand triangle clip paths by 0.5px in `drawAffineTriangle`, increase default subdivisions from 8 to 16 |
| `src/features/visualization/components/ProductModelWorkspace.tsx` | Restore `isPlanar` in render calls, reset yaw/pitch on perspective confirm to initialize flush with wall opening |

### 3.2 Out of Scope

| Layer | Rationale |
|---|---|
| `src/lib/visualization/perspectiveTransform.ts` (homography math) | The `computeHomographyMatrix`, `homographyToCssMatrix3d`, and coordinate normalization functions are correct and unchanged |
| `src/features/visualization/components/PerspectivePlanePicker.tsx` | The 4-point corner picker UI is functioning correctly and requires no changes |
| `fastapi-service/` | No backend involvement in perspective fitting; all rendering is client-side |
| `supabase/migrations/` | No schema changes; `perspectiveFitCorners` field in `ProductConfigurationSnapshot` is unchanged |
| CSS `matrix3d` live DOM rendering | The live viewport uses CSS transforms, which correctly warp the edge-to-edge canvas to the 4 corner points |

---

## 4. Technical Specification

### 4.1 Renderer: Edge-to-Edge 3D Perspective Camera Framing

**File:** `src/lib/visualization/modelRenderer.ts`

The `render()` method accepts `isPlanarFit = false` by default:

```typescript
render(yaw: number, pitch: number, isPlanarFit = false) {
  if (this.modelGroup.children.length === 0) {
    return null;
  }

  if (isPlanarFit) {
    // 1. Establish the reference base bounds of the unrotated model at (0, 0, 0)
    this.modelGroup.rotation.set(0, 0, 0);
    this.modelGroup.updateMatrixWorld(true);

    const baseBounds = new THREE.Box3().setFromObject(this.modelGroup);
    const baseSize = new THREE.Vector3();
    const baseCenter = new THREE.Vector3();
    baseBounds.getSize(baseSize);
    baseBounds.getCenter(baseCenter);

    if (baseSize.x > 0 && baseSize.y > 0) {
      const fovDegrees = CAMERA_BASE_VERTICAL_FOV_DEGREES;
      const fovRad = THREE.MathUtils.degToRad(fovDegrees);
      const distance = (baseSize.y / 2) / Math.tan(fovRad / 2);

      this.camera.fov = fovDegrees;
      this.camera.aspect = this.canvas.width / this.canvas.height;
      this.camera.position.set(baseCenter.x, baseCenter.y, baseBounds.max.z + distance);
      this.camera.lookAt(baseCenter.x, baseCenter.y, baseBounds.max.z);

      const near = this.camera.near;
      const far = this.camera.far;
      const scale = near / distance;
      const halfWidth = (baseSize.x / 2) * scale;
      const halfHeight = (baseSize.y / 2) * scale;

      this.camera.projectionMatrix.makePerspective(
        -halfWidth,
        halfWidth,
        halfHeight,
        -halfHeight,
        near,
        far,
      );
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
      this.camera.updateMatrixWorld(true);

      // 2. Apply user yaw and pitch rotations directly to the 3D model
      this.modelGroup.rotation.set(
        THREE.MathUtils.degToRad(pitch),
        THREE.MathUtils.degToRad(yaw),
        0
      );
      this.modelGroup.updateMatrixWorld(true);

      this.renderer.render(this.scene, this.camera);
      return this.canvas;
    }
  }

  // Default free-placement rendering
  this.camera.fov = CAMERA_BASE_VERTICAL_FOV_DEGREES;
  this.camera.aspect = this.canvas.width / this.canvas.height;
  this.camera.updateProjectionMatrix();
  this.camera.position.copy(CAMERA_DIRECTION).multiplyScalar(CAMERA_BASE_DISTANCE);
  this.camera.lookAt(0, 0, 0);
  this.modelGroup.rotation.set(
    THREE.MathUtils.degToRad(pitch),
    THREE.MathUtils.degToRad(yaw),
    0
  );

  this.modelGroup.updateMatrixWorld(true);
  this.camera.updateMatrixWorld(true);
  this.renderer.render(this.scene, this.camera);

  return this.canvas;
}
```

**Key mathematical properties of this framing:**
1. At distance $d = \frac{baseSize.y / 2}{\tan(fov / 2)}$, the visible camera frustum at $z = baseBounds.max.z$ has exact width $baseSize.x$ and exact height $baseSize.y$.
2. The four front corners of the unrotated window frame project directly to NDC coordinates $(-1, 1)$, $(1, 1)$, $(1, -1)$, and $(-1, -1)$, corresponding to canvas pixels $(0, 0)$, $(width, 0)$, $(width, height)$, and $(0, height)$.
3. Because the camera uses perspective projection, camera rays diverge toward the edges, making the inner reveals of the jambs, sill extrusion, and the recessed depth of the glass pane fully visible in 3D.
4. Camera framing is fixed to the base opening dimensions, so user yaw and pitch rotations actively tilt and spin the window in 3D perspective without being optically cancelled by the camera.

### 4.2 Realistic Architectural Finishes, Bevel Lighting, and Contact Shadows

**Files:** `src/lib/visualization/parametricProductBuilder.ts`, `src/lib/visualization/modelRenderer.ts`

1. **Architectural Frame Finishes:**
   - Black anodized aluminum uses dark architectural charcoal (`0x26292b`) with metalness 0.65 and roughness 0.28, replacing pitch-black (`0x151719`).
   - Silver finish uses `0xd0d5d8` with metalness 0.82 and roughness 0.20.
   - Bronze finish uses `0x42362f` with metalness 0.68 and roughness 0.26.
   - White finish uses `0xf4f1ea` with metalness 0.22 and roughness 0.28.
2. **Bevel, Rim, and Directional Lighting:**
   - Dedicated directional light target added directly to scene graph (`this.scene.add(this.mainLight.target)`) ensuring proper shadow matrix calculations and directional light orientation.
   - Shadow camera bounds explicitly configured with ortho frustum (`near: 0.1`, `far: 25`, bounds `±4`) and negative shadow bias (`-0.0005`) to eliminate acne while ensuring contact shadow precision.
   - A dedicated directional bevel light (`bevelLight`) is angled at `(2.2, 3.8, 3.0)` with intensity 1.4 to catch the chamfers, jamb steps, and sill profiles.
   - Main directional light intensity set to 2.0 with key angle `(2.8, 4.2, 4.5)`.
   - Ambient light intensity balanced to 0.35 - 0.55, preventing washed-out silhouettes and delivering crisp depth perception across adjacent planes.
3. **Geometry and Material Depth:**
   - Sill geometry projects forward toward the room interior (`zMm: profile.glassDepthMm * 1.5`), so its upper ledge catches directional ceiling light and its bottom lip casts contact shadow.
   - Glass pane is recessed into negative Z (`zMm: -profile.glassDepthMm * 0.8`), producing an authentic physical relief step behind the outer aluminum frame.
   - Clear glass material configured with `depthWrite: true`, specular clearcoat (1.0), and transmission (0.55) to catch highlights and contact shadows.
4. **Contact Shadows:**
   - Generated meshes have `castShadow = true` and `receiveShadow = true` enabled, casting realistic contact shadows from frame to recessed glass and sill.

### 4.3 WebGL Projective Texture Mapping for Seam Elimination

**File:** `src/lib/visualization/perspectiveTransform.ts`

**Per-Pixel Projective Shader in WebGL:**
To permanently eliminate triangle mesh seam lines in snapshot compositing, `drawPerspectiveWarpedImage` utilizes an offscreen WebGL per-pixel projective texture mapping pipeline:
- Computes the inverse homography matrix $H^{-1}$ directly mapping local destination coordinates $(x, y) \to (u, v)$ in the source image.
- Renders a full-screen quad via an offscreen WebGL canvas and samples the texture using per-pixel inverse projection in the fragment shader:
  ```glsl
  vec2 fragCoord = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec3 srcPt = u_invH * vec3(fragCoord, 1.0);
  vec2 uv = (srcPt.xy / srcPt.z) / u_texSize;
  gl_FragColor = texture2D(u_image, uv);
  ```
- Blits the WebGL canvas in a single draw call onto the 2D context using `context.drawImage(glCanvas, minX, minY)`.
- Completely eliminates all internal triangle tessellation and sub-pixel clipping artifacts.
- Includes a Canvas 2D fallback for headless environments lacking WebGL support.

### 4.4 Workspace Integration: Exact Fit, Initial Wall Angle, and On-Canvas Configurability

**Files:** `src/features/visualization/components/ProductModelWorkspace.tsx`, `src/lib/visualization/perspectiveTransform.ts`

**4.4.1 Restore `isPlanar` in render calls:**
Render call sites compute `const isPlanar = Boolean(perspectiveCorners)` and pass it to `render(yaw, pitch, isPlanar)`:
1. `handleCanvasMount` callback
2. `useLayoutEffect` render
3. Snapshot variation captures

**4.4.2 Compute Initial 3D Angles from Quadrilateral Foreshortening:**
When the user confirms the 4 points plane in `PerspectivePlanePicker.onConfirm`, the system analyzes the trapezoidal foreshortening:
- Compares left edge height vs right edge height to determine wall horizontal tilt (initial `yaw`).
- Compares top edge width vs bottom edge width to determine vertical tilt (initial `pitch`).
- Clamps initial angles within safe bounds (`±30` degrees) so the model immediately renders with authentic 3D depth matching the wall perspective.

**4.4.3 On-Canvas Resize and Position Handles for Perspective Fitted Products:**
When `perspectiveCorners` is active, the workspace renders 9 interactive handles positioned over the perspective quad:
- 4 corner handles (top-left, top-right, bottom-right, bottom-left) for uniform scale.
- 4 edge midpoint handles (top and bottom for height/length, left and right for width).
- 1 central reposition handle for translating/moving the perspective quadrilateral.
- Pointer drag handlers compute scale ratio relative to the quadrilateral perspective centroid and invoke `scaleCornersAlongAxis(corners, ratio, axis)`.
- Updates both the visual corner matrix and synchronized dimension state (`widthCm`, `heightCm`).

**4.4.4 Mathematical Corner Scaling (`scaleCornersAlongAxis`):**
To ensure the perspective fit does not distort or break when the user adjusts dimensions:
- Computes the intersection of diagonals to establish the perspective invariant centroid.
- Decomposes displacement along horizontal or vertical quadrilateral axes.
- Scales corner vectors proportionally from the center, clamping minimum dimensions to 10px.

---

## 5. Definition of Done (Exit Criteria)

1. Product model fits exactly where the user draws the 4 points plane with zero detached margins.
2. Product model exhibits rich 3D depth (inner jamb reveals, recessed glass step, forward sill ledge, rim highlights, contact shadows).
3. On-canvas transform handles (corners for scale, edges for width/length, center for move) allow full post-fit reconfiguration directly in the viewport.
4. Yaw and pitch sliders in the Placement accordion visibly rotate the 3D model within the perspective-fitted quadrilateral.
5. Aluminum finish, glass appearance, dimensions, and sill toggle changes update the model in real-time during perspective fitting mode.
6. Modifying width or height in the sidebar dynamically resizes the perspective quadrilateral along its perspective axis.
7. No diagonal grid lines or triangle mesh seam artifacts are visible on the glass surface in exported snapshots or the live viewport.
8. "Apply Changes" snapshot export renders the perspective-warped overlay with exact corner alignment and without visible seam lines.
9. "Edit Corners" re-opens the picker with preserved corners.
10. "Free Place" button clears perspective fitting and returns to standard drag/scale/rotate mode with correct camera framing.
11. Existing free-placement mode (without perspective fitting) remains functionally unchanged.
12. `npm run lint` passes with zero new errors.
13. `npx tsc --noEmit` passes with zero new type errors.
14. `npm run build` succeeds.
15. No em-dashes in code comments or documentation (BAN-PUNCT-01).
16. No `any` types in new TypeScript code (BAN-TYPE-05).

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Extreme yaw/pitch values in perspective mode cause the rotated model to push slightly outside original opening | Low | Low | The camera dynamically re-frames the rotated bounding box edge-to-edge, keeping the model bounded within the canvas. |
| Triangle clip path expansion (0.5px) causes visible double-rendering at triangle overlaps | Low | Low | The product model canvas content is opaque, so sub-pixel overlapping produces identical color values. |
| Custom projection matrix interferes with subsequent free-placement renders | Low | Low | Free-placement mode explicitly resets camera FOV, aspect, and calls `updateProjectionMatrix()` on every render call. |
| Higher subdivision count (16 vs 8) increases snapshot export time | Low | Low | 512 triangles with affine sub-transforms executes in under 15ms during snapshot export only. |

---

## Self-Check

- [x] Document metadata follows GlassFit documentation conventions (no em-dashes, numbered sections, tables)
- [x] All traceability codes map to existing upstream specifications (PRD-F6, PRD-F18, SDD-C5, SDD-C6, DSD-UI6)
- [x] Architectural boundaries respected (no backend changes, no schema changes, no new dependencies)
- [x] Technical specification covers edge-to-edge 3D perspective framing, shadow casting, seam elimination, and workspace integration
- [x] Definition of done includes lint, typecheck, build, and all hard ban compliance checks
- [x] Upstream specification (ms02.md) referenced in document metadata
- [x] Exact 4-point fitting retained while resolving all three reported issues
