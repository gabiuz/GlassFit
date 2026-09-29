# Implementation Specification: Post-Implementation Fixes for Multi-Part Structural Assembly Ingestion and Mesh Loose-Parts Decomposition (fix-01)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Technical Specification for Assembled Multi-Part Ingestion, Natural Coordinate Preservation, and Topological Loose-Parts Decomposition  
**Version:** 1.0.0  
**Date:** September 17, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Specified (Pending Implementation)  
**Upstream Specifications:** `docs/implementation/ms06.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/prd-glassfit.md`, `docs/pricing.md`, `docs/qad-glassfit.md`  

---

## 1. Problem Context & Empirical Analysis

During administrative product setup in `/admin/products/[id]/setup` (Step 4: Structural Components), two critical structural assembly defects were identified when onboarding commercial modular fixtures (empirically evaluated using `C:\Users\reyna\OneDrive\Documents\GlassFit\Cabinet\Display Cabinet`):

### Defect A: Structural Upload Renders Components Separated in a Row Instead of Built as One Cabinet
- **Observed Defect:** When an administrator uploads individual structural component `.glb` files for a product (such as `DC_Left_Panel.glb`, `DC_Right_Panel.glb`, `DC_Back_Panel.glb`, `DC_Top_Panel.glb`, `DC_Bottom_Panel.glb`, `DC_Shelf_1.glb` through `DC_Shelf_4.glb`, `DC_Sliding_Door_Left.glb`, `DC_Sliding_Door_Right.glb`, and tracks), the 3D preview canvas (`PartViewer3D`) displays all 14 components spaced out horizontally in a single file row along the X axis. Instead of appearing as a fully assembled, cohesive cabinet, the pieces appear detached like disjointed inventory on a conveyor belt.
- **Root Cause Analysis:**
  1. **Window-Centric Assembly Hardcoding:** In `src/features/admin/products/setup/StructuralComponentsSection.tsx`, the `PartViewer3D` component determines whether to construct an assembled product via a strict window key heuristic:
     ```typescript
     const hasLeft = filesByKey.has("frame-left");
     const hasRight = filesByKey.has("frame-right");
     const hasTop = filesByKey.has("frame-top");
     const hasBottom = filesByKey.has("frame-bottom");
     const isWindow = productType.toLowerCase().includes("window") || (hasLeft && hasRight && hasTop && hasBottom);
     ```
     For cabinets, showcase counters, sliding partitions, doors, or any non-window product, `isWindow` evaluates to `false`.
  2. **Linear Stacking Fallback:** When `isWindow` is `false`, `PartViewer3D` drops into a general fallback loop:
     ```typescript
     let offsetX = 0;
     files.forEach((f) => {
       if (f.previewMesh) {
         const part = createPreviewPart(f, offsetX, 0, 0);
         if (part) {
           root.add(part);
           const size = f.sourceDimensions || { x: 0.4, y: 0.4, z: 0.4 };
           offsetX += (size.x || 0.4) + 0.15;
         }
       }
     });
     ```
     This loop forcibly translates each component along the X axis by its bounding width plus a 150mm gap (`offsetX += size.x + 0.15`).
  3. **Destructive Local Re-centering:** Inside `createPreviewPart`, the code calls `recenterGroup(clone)`. This shifts every sub-mesh bounding center to `(0, 0, 0)`, stripping away the natural relative spatial offsets modeled by the 3D designer.
  4. **Empirical Ground Truth:** Inspection of the 14 individual `.glb` files in the Display Cabinet test asset directory confirms that CAD and Blender modelers export parts using a shared assembly world origin:
     - `DC_Left_Panel.glb`: Center = `[-0.616, 1.015, 0.000]` m
     - `DC_Right_Panel.glb`: Center = `[+0.616, 1.015, 0.000]` m
     - `DC_Back_Panel.glb`: Center = `[0.000, 1.015, -0.201]` m
     - `DC_Top_Panel.glb`: Center = `[0.000, 1.941, 0.000]` m
     - `DC_Bottom_Panel.glb`: Center = `[0.000, 0.089, 0.000]` m
     - `DC_Shelf_1.glb` to `DC_Shelf_4.glb`: Y centers stepped from `0.465` m to `1.565` m
     - `DC_Sliding_Door_Left.glb` and `Right`: Z centers placed at `+0.200` m and `+0.174` m
     When all 14 files are loaded into a `THREE.Group` at origin `(0, 0, 0)` without individual re-centering or linear offset, their bounding box measures `Width = 1.250m`, `Height = 1.950m`, `Depth = 0.428m`, matching the true finished cabinet with 100% geometric accuracy.
  5. **Runtime Builder Disconnect:** A similar linear stacking fallback exists in `src/lib/visualization/parametricProductBuilder.ts` (`buildStackedProduct`), causing non-window products in Step 6 (Validation Workspace) and client-facing visualization to also render as separated linear rows (`cursorX += size.x * 1000 + 40`).

---

### Defect B: Decomposing Whole Model `00DC_Complete_Display_Cabinet.glb` Splits into Only 3 Parts and Separates Them
- **Observed Defect:** When an administrator toggles "Decompose Whole Model" and drops `00DC_Complete_Display_Cabinet.glb`, the system extracts only 3 components instead of the 14 to 19 distinct structural elements of the cabinet. Furthermore, the 3 extracted parts are centered at `(0, 0, 0)` and rendered separated from each other.
- **Root Cause Analysis:**
  1. **Blender Material-Primitive Grouping:** 3D modelers frequently join meshes before export (`Ctrl + J`), producing a single GLTF Node (`DC_Complete_Display_Cabinet`) and a single Mesh (`Cube.039`). The GLTF format splits geometry with multiple materials into separate `primitives`:
     - Primitive 0: `DC_Mat_WhiteAlu.003` (Aluminum profiles, panels, and tracks)
     - Primitive 1: `DC_Mat_Wheel.003` (Base wheel assemblies)
     - Primitive 2: `DC_Mat_Glass.003` (Sliding glass door panels)
  2. **Top-Level Node Traversal Limitation:** In `src/lib/admin/products/modelDecomposer.ts`, `decomposeSceneGraph` only iterates over top-level `THREE.Mesh` instances:
     ```typescript
     root.traverse((node) => {
       if (node instanceof THREE.Mesh && node.geometry) {
         meshNodes.push(node);
       }
     });
     ```
     Three.js `GLTFLoader` creates exactly one `THREE.Mesh` per primitive (`Cube039`, `Cube039_1`, `Cube039_2`). The decomposer treated each primitive mesh as an indivisible atomic component.
  3. **Absence of Topological Loose-Parts Analysis:** In reality, each material primitive consists of multiple disconnected geometric islands:
     - `Cube039` (Aluminum) contains **13 disconnected topological parts** (left panel, right panel, back panel, top panel, bottom panel, tracks, shelf supports, base structure).
     - `Cube039_1` (Wheels) contains **4 disconnected topological parts** (the 4 base caster wheels).
     - `Cube039_2` (Glass) contains **2 disconnected topological parts** (the 2 sliding glass door panes).
     The total number of physically distinct components is **19 parts**, but `modelDecomposer.ts` lacked a connected-components graph traversal to identify and isolate loose geometric islands.
  4. **Assembly Spatial Offset Erasure:** Lines 212 and 225 to 227 in `modelDecomposer.ts` call:
     ```typescript
     const clonedGeometry = mesh.geometry.clone();
     clonedGeometry.center();
     clonedMesh.position.set(0, 0, 0);
     ```
     Centering the geometry discards the original spatial translation of each part relative to the assembly origin. When saved to standalone `.glb` files, the relative spatial coordinates are wiped out, making automated reassembly impossible.

---

## 2. Traceability & Specification Mapping

| Traceability Code | Specification Reference | Architectural Function |
|---|---|---|
| PRD-F5 | Parametric 3D Product Assembly Engine | Enables realistic multi-component assembly for non-window architectural fixtures |
| PRD-F6 | Photo-Based Visualization Workspace | Renders assembled cabinets, doors, and enclosures as cohesive structures in 3D scene |
| PRD-F14 | Parametric Product Configuration & Administration | Admin tooling for configuring structural components with assembly coordinate fidelity |
| PRD-F19 | Raw Material & Inventory Unit Price Master Catalog | Binding extracted cabinet parts (panels, tracks, shelves, wheels) to raw material prices |
| SDD-C4 | Parametric 3D Assembly Engine | Procedural assembly logic supporting both coordinate-aligned models and parametric profiles |
| SDD-C9 | Admin Product Setup & Component Inspector | Presentation and preview engine for multi-part structural component setup |
| DSD-UI10 | Part Inspector & Structural Component Setup | 3D viewport controls and preview toggles (Assembled View vs Exploded View) |
| ERD-E4 | `product_templates` Table | Stores `model_strategy` and `base_configuration.builder_key` (e.g. `cabinet_box_v1`) |
| ERD-E6 | `product_components` Table | Persists extracted components, bounding dimensions, and optional assembly coordinate metadata |
| QAD-TC20 | Whole-Model GLB Decomposition & Scene Graph Extraction Parity | Validates decomposition of multi-node GLBs into independent structural components |
| QAD-TC21 | Topological Loose-Parts Segmentation & Assembly Coordinate Retention | Validates extraction of disconnected geometric islands and zero-offset assembly preview |
| BAN-PUNCT-01 | No em-dashes in documentation | Formatted strictly using hyphens, colons, or parentheses |
| BAN-SPEC-02 | No code without spec link | Traced to PRD-F5, PRD-F14, SDD-C4, SDD-C9, DSD-UI10, ERD-E6, and QAD-TC21 |
| BAN-TYPE-05 | Zero `any` in TypeScript | Strict typing for geometry attributes, loose parts, and preview configuration |
| BAN-UI-09 | Strict UI style consistency | Reuses established Tailwind tokens and design patterns in `StructuralComponentsSection.tsx` |

---

## 3. Architectural Scope & Boundaries

### 3.1 In Scope

| Layer / Target File | Modification Rationale |
|---|---|
| `src/lib/admin/products/modelDecomposer.ts` | 1. Implement topological loose-parts (connected components) segmentation algorithm for merged meshes.<br>2. Preserve assembly coordinate offsets in exported geometries so parts naturally assemble at `(0, 0, 0)`.<br>3. Populate `assemblyPosition`, `assemblyBounds`, and spatial metadata on `ExtractedComponentPart`. |
| `src/lib/admin/products/autoDetection.ts` | Expand keyword heuristics for cabinet, door, partition, and furniture structural parts (`panel`, `shelf`, `sliding_door`, `track`, `wheel`, `base`, `caster`). |
| `src/features/admin/products/setup/StructuralComponentsSection.tsx` | 1. Eliminate destructive `recenterGroup` and linear `offsetX += size.x + 0.15` fallback in `PartViewer3D`.<br>2. Implement auto-detection for assembly-mode coordinates.<br>3. Add an interactive UI toggle in the 3D viewport: "Assembled (Built)" vs "Exploded (Separated)" view.<br>4. Center the unified assembly root in the camera viewport rather than centering each piece individually. |
| `src/features/admin/products/setup/DecompositionPreviewModal.tsx` | Display assembly-relative bounding positions and group related loose parts with descriptive default labels. |
| `src/lib/visualization/parametricProductBuilder.ts` | Update non-window product builder (`buildStackedProduct` / `buildAssembledProduct`) to assemble components at their natural coordinate offsets rather than spreading them across X. |
| `tests/unit/modelDecomposer.test.ts` | Add automated unit tests verifying topological loose-parts extraction, component count parity, and coordinate retention. |

### 3.2 Out of Scope

| System Component | Rationale |
|---|---|
| `fastapi-service/` | Model decomposition, geometry partitioning, and scene assembly are client-side WebGL operations. Computer vision backend is unaffected. |
| Supabase Database Schema Migrations | Existing `product_components` schema already supports `component_key`, `dimensions_mm`, and `glb_file_url`. Metadata can be stored in existing JSON columns or derived directly from GLB vertex bounds. |
| Continuous WebXR or AR Tracking (BAN-AR-08) | GlassFit visualization remains photo-based simulation with Three.js rendering. |

---

## 4. Technical Formulation & Algorithmic Design

### 4.1 Topological Loose-Parts Segmentation Engine (`modelDecomposer.ts`)

When an uploaded mesh contains multiple disconnected solid volumes (such as `Cube039` in `00DC_Complete_Display_Cabinet.glb`), the system must segment the mesh into its constituent physical parts.

#### Algorithm: Disjoint-Set Union (DSU) on BufferGeometry Triangles
1. **Spatial Vertex Hashing:**
   Given a `THREE.BufferGeometry`, vertices may be indexed or un-indexed. To handle vertices that are geometrically coincident but duplicate in attribute arrays (due to differing normal or UV seams), construct a spatial hash map:
   $$\text{hash}(x, y, z) = \lfloor x \cdot 10000 \rceil \parallel \lfloor y \cdot 10000 \rceil \parallel \lfloor z \cdot 10000 \rceil$$
   This maps every vertex to a discrete spatial coordinate at $0.1\text{ mm}$ tolerance.
2. **Triangle Adjacency Graph:**
   Let $T$ be the total number of triangles. For each triangle $t \in [0, T-1]$, identify its 3 spatial vertex keys. For each spatial key, append triangle index $t$ to a lookup table: $\text{VertexToTriangles}[key]$.
3. **Connected Components via Union-Find:**
   Initialize a Disjoint-Set Union (DSU) structure of size $T$. For each spatial key that touches multiple triangles, union all adjacent triangles into the same set:
   $$\forall \text{ key } k, \forall t_i, t_j \in \text{VertexToTriangles}[k]: \text{Union}(t_i, t_j)$$
4. **Sub-Geometry Construction:**
   Group triangle indices by their DSU root:
   - Filter out micro-partitions whose total bounding dimension is smaller than `minBoundingDimensionMeters` (e.g. $0.005\text{ m}$).
   - For each group of triangles, construct a new `THREE.BufferGeometry` containing only the corresponding vertices, normals, and UVs.
   - Retain the exact world/assembly position of the vertices. Do not shift vertices to $(0,0,0)$.
5. **Material Inheritance:**
   Assign the source mesh material to each new sub-mesh so visual appearance (e.g. White Aluminum, Glass, Wheel plastic) is fully preserved.

```typescript
export interface DisconnectedPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  worldBox: THREE.Box3;
  suggestedName: string;
}

export function segmentMeshLooseParts(
  mesh: THREE.Mesh,
  minDimensionMeters = 0.005
): DisconnectedPart[] {
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);

  const position = geometry.attributes.position;
  if (!position || position.count === 0) return [];

  const index = geometry.index;
  const numTriangles = index ? index.count / 3 : position.count / 3;
  if (numTriangles <= 1) {
    return [{
      geometry,
      material: mesh.material,
      worldBox: new THREE.Box3().setFromBufferAttribute(position),
      suggestedName: mesh.name || "part",
    }];
  }

  // 1. Initialize DSU
  const parent = new Int32Array(numTriangles);
  for (let i = 0; i < numTriangles; i++) parent[i] = i;

  const find = (i: number): number => {
    let root = i;
    while (root !== parent[root]) root = parent[root];
    let curr = i;
    while (curr !== root) {
      const nxt = parent[curr];
      parent[curr] = root;
      curr = nxt;
    }
    return root;
  };

  const union = (i: number, j: number) => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  };

  // 2. Map spatial coordinates to triangle indices
  const vertexToTriangles = new Map<string, number[]>();
  for (let t = 0; t < numTriangles; t++) {
    for (let v = 0; v < 3; v++) {
      const vIdx = index ? index.getX(t * 3 + v) : t * 3 + v;
      const x = Math.round(position.getX(vIdx) * 10000);
      const y = Math.round(position.getY(vIdx) * 10000);
      const z = Math.round(position.getZ(vIdx) * 10000);
      const key = `${x},${y},${z}`;

      let list = vertexToTriangles.get(key);
      if (!list) {
        list = [];
        vertexToTriangles.set(key, list);
      }
      list.push(t);
    }
  }

  // 3. Union adjacent triangles
  for (const triList of vertexToTriangles.values()) {
    if (triList.length > 1) {
      const first = triList[0];
      for (let i = 1; i < triList.length; i++) {
        union(first, triList[i]);
      }
    }
  }

  // 4. Group triangle indices by root
  const groups = new Map<number, number[]>();
  for (let t = 0; t < numTriangles; t++) {
    const root = find(t);
    let list = groups.get(root);
    if (!list) {
      list = [];
      groups.set(root, list);
    }
    list.push(t);
  }

  // If only 1 connected component, return the original
  if (groups.size <= 1) {
    return [{
      geometry,
      material: mesh.material,
      worldBox: new THREE.Box3().setFromBufferAttribute(position),
      suggestedName: mesh.name || "part",
    }];
  }

  // 5. Extract sub-geometries
  const results: DisconnectedPart[] = [];
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;

  for (const triIndices of groups.values()) {
    const subGeo = new THREE.BufferGeometry();
    const vertexCount = triIndices.length * 3;
    const subPositions = new Float32Array(vertexCount * 3);
    const subNormals = normal ? new Float32Array(vertexCount * 3) : null;
    const subUvs = uv ? new Float32Array(vertexCount * 2) : null;

    let outV = 0;
    for (const t of triIndices) {
      for (let v = 0; v < 3; v++) {
        const srcIdx = index ? index.getX(t * 3 + v) : t * 3 + v;
        subPositions[outV * 3] = position.getX(srcIdx);
        subPositions[outV * 3 + 1] = position.getY(srcIdx);
        subPositions[outV * 3 + 2] = position.getZ(srcIdx);

        if (subNormals && normal) {
          subNormals[outV * 3] = normal.getX(srcIdx);
          subNormals[outV * 3 + 1] = normal.getY(srcIdx);
          subNormals[outV * 3 + 2] = normal.getZ(srcIdx);
        }

        if (subUvs && uv) {
          subUvs[outV * 2] = uv.getX(srcIdx);
          subUvs[outV * 2 + 1] = uv.getY(srcIdx);
        }

        outV++;
      }
    }

    subGeo.setAttribute("position", new THREE.BufferAttribute(subPositions, 3));
    if (subNormals) subGeo.setAttribute("normal", new THREE.BufferAttribute(subNormals, 3));
    if (subUvs) subGeo.setAttribute("uv", new THREE.BufferAttribute(subUvs, 2));

    subGeo.computeBoundingBox();
    const box = subGeo.boundingBox || new THREE.Box3();
    const size = new THREE.Vector3();
    box.getSize(size);

    // Filter negligible noise geometry
    if (size.x < minDimensionMeters && size.y < minDimensionMeters && size.z < minDimensionMeters) {
      continue;
    }

    results.push({
      geometry: subGeo,
      material: mesh.material,
      worldBox: box,
      suggestedName: mesh.name || "part",
    });
  }

  return results;
}
```

---

### 4.2 Preservation of Assembly Coordinates vs Local Origin Centering

When a 3D artist models an assembly (window, door, cabinet, curtain wall), every piece is positioned relative to the product assembly origin `(0, 0, 0)`.

There are two primary paradigms in 3D assets:
1. **Assembled Coordinate Assets (Default in CAD and Assemblies):** Each part's geometry vertices are positioned where the part resides in the finished product. Left panel vertices are at $x \approx -0.616$, right panel at $x \approx +0.616$, top panel at $y \approx 1.941$, shelves at $y \in [0.465, 1.565]$. When all parts are added to a parent `THREE.Group` at `(0, 0, 0)`, they form the complete fixture with zero calculation required.
2. **Local Origin Assets (Extrusion Profiles):** A profile (such as a 6-meter aluminum bar) is centered at `(0, 0, 0)` and must be mathematically positioned and scaled by a parametric builder script.

#### Rule for Decomposition and Export:
- When exporting decomposed parts to standalone `.glb` files, **retain assembly vertex coordinates in the geometry**.
- Do not execute `clonedGeometry.center()` unconditionally.
- Store each part's bounding box center $\mathbf{c} = (c_x, c_y, c_z)$ and dimensions $(w, h, d)$ in the part metadata:
  ```typescript
  export interface ExtractedComponentPart {
    // ... existing properties ...
    assemblyPosition: { x: number; y: number; z: number };
    assemblyDimensionsMm: { width: number; height: number; depth: number };
  }
  ```
- Because the geometry retains assembly coordinates, any application that loads these `.glb` files into a single root node will automatically see the completed, assembled product.

---

### 4.3 Assembled Multi-Part 3D Preview (`PartViewer3D`)

In `src/features/admin/products/setup/StructuralComponentsSection.tsx`, `PartViewer3D` must be upgraded to support both assembled viewing and exploded part inspection.

#### 1. Automatic Assembly Coordinate Detection
The preview engine examines the bounding box centers of all uploaded parts:
$$\mathbf{c}_i = \text{BoxCenter}(\text{file}_i)$$
If the uploaded parts have distinct spatial centers (for example, left panel has $c_x < -0.2$, right panel has $c_x > 0.2$, top panel has $c_y > 1.0$), the system detects that the files **share an assembly coordinate system**.
$$\text{isAssemblyCoordinates} = \max_i(|c_{x,i}|) > 0.05 \lor \max_i(|c_{y,i}|) > 0.05 \lor \max_i(|c_{z,i}|) > 0.05$$

#### 2. Dual-Mode Viewport Toggle: "Assembled (Built)" vs "Exploded (Separated)"
Administrators are provided with a segmented toggle in the 3D viewer header:
- **Assembled View (Default):**
  Each part is added directly to `root` at `(0, 0, 0)` without calling `recenterGroup` and without adding artificial `offsetX`.
  After all parts are added, `recenterGroup(root)` centers the entire finished cabinet in front of the camera.
  The administrator sees the cabinet built as one complete unit.
- **Exploded View (Inspection Mode):**
  Parts are displaced along a radial explosion vector $\mathbf{v}_i = \mathbf{c}_i - \mathbf{c}_{\text{root}}$, or laid out in a grid for individual part dimension inspection.

#### 3. Preserving the Window Profile Workflow
If the product is configured with window-specific profiles (`series798`, etc.) where parts are local-origin extrusions requiring procedural assembly, the existing parametric window assembly logic runs seamlessly. The system checks:
$$\text{Strategy} = \begin{cases} 
\text{Window Assembly} & \text{if } \text{hasLeft} \land \text{hasRight} \land \text{hasTop} \land \text{hasBottom} \land \text{isLocalOrigin} \\ 
\text{Natural Assembly} & \text{if } \text{isAssemblyCoordinates} \lor \text{viewMode} = \text{"assembled"} \\ 
\text{Exploded Grid} & \text{if } \text{viewMode} = \text{"exploded"} 
\end{cases}$$

```typescript
// Upgraded PartViewer3D assembly resolution logic
const group = useMemo(() => {
  const root = new THREE.Group();
  root.name = "AssembledProductRoot";

  if (viewMode === "assembled") {
    // 1. Natural Assembled Mode: Place each component at its modeled assembly coordinates
    files.forEach((file) => {
      if (!file.previewMesh) return;
      const part = file.previewMesh.clone();
      part.userData.fileId = file.id;
      highlightPart(part, selectedIds.has(file.id));
      root.add(part);
    });
  } else {
    // 2. Exploded / Inspection Mode: Spread parts with clear visual separation
    let offsetX = 0;
    files.forEach((file) => {
      if (!file.previewMesh) return;
      const wrapper = new THREE.Group();
      wrapper.userData.fileId = file.id;
      const clone = file.previewMesh.clone();
      recenterGroup(clone);
      wrapper.add(clone);
      wrapper.position.set(offsetX, 0, 0);
      highlightPart(wrapper, selectedIds.has(file.id));
      root.add(wrapper);

      const size = file.sourceDimensions || { x: 0.4, y: 0.4, z: 0.4 };
      offsetX += (size.x || 0.4) + 0.15;
    });
  }

  // Recenter the entire assembled cabinet or layout to camera center
  recenterGroup(root);
  return root;
}, [files, selectedIds, viewMode]);
```

---

### 4.4 Runtime Builder Assembly (`parametricProductBuilder.ts`)

In `src/lib/visualization/parametricProductBuilder.ts`, replace the fallback `buildStackedProduct` with a coordinate-aware `buildAssembledProduct`:
- If components have modeled assembly coordinates, add each cloned mesh at its origin `(0, 0, 0)`.
- Apply architectural materials (powder-coated aluminum finish, clear/tinted/frosted float glass) across the assembly parts.
- When dimensional scaling is applied (e.g. width adjustment $W_{\text{target}} / W_{\text{base}}$), scale parts relative to the cabinet bounding box center or anchor points.

---

### 4.5 Expanded Auto-Detection Rules (`autoDetection.ts`)

Expand `autoDetectComponentSettings` to recognize common cabinet, enclosure, and door components:

| Keyword Pattern | Detected Component Type | Presentation Category | Dimension Binding | Span Ratio | Suggested Material |
|---|---|---|---|---|---|
| `left_panel`, `right_panel`, `side_panel`, `jamb` | `Frame` | Framing | `HEIGHT` | 1.0 | Aluminum / Wood-Plastic Composite |
| `top_panel`, `bottom_panel`, `header`, `sill` | `Frame` | Framing | `WIDTH` | 1.0 | Aluminum |
| `back_panel` | `Glass` / `Model` | Glazing / Framing | `AREA` | 1.0 | Glass / Aluminum Composite |
| `shelf`, `divider`, `partition` | `Frame` / `Glass` | Framing / Glazing | `WIDTH` | 1.0 | Aluminum / Float Glass |
| `sliding_door`, `door_leaf`, `sash` | `Model` | Glazing | `AREA` | 0.5 | Aluminum / Tempered Glass |
| `track`, `rail`, `guide` | `Frame` | Framing | `WIDTH` | 1.0 | Aluminum |
| `wheel`, `caster`, `roller` | `Hardware` | Hardware | `FIXED` | 1.0 | Stainless Steel / POM |
| `base`, `plinth`, `kickplate` | `Frame` | Framing | `WIDTH` | 1.0 | Aluminum |

---

## 5. Verification on Test Asset: Display Cabinet

### 5.1 Test Asset Specifications
- **Directory:** `C:\Users\reyna\OneDrive\Documents\GlassFit\Cabinet\Display Cabinet`
- **Whole Model:** `00DC_Complete_Display_Cabinet.glb` (51,032 bytes)
- **Part Files (14 Files):**
  1. `DC_Back_Panel.glb` (1.214m x 1.834m x 0.018m)
  2. `DC_Bottom_Base_Assembly.glb` (1.230m x 0.080m x 0.400m)
  3. `DC_Bottom_Panel.glb` (1.250m x 0.018m x 0.420m)
  4. `DC_Bottom_Sliding_Track.glb` (1.214m x 0.018m x 0.050m)
  5. `DC_Left_Panel.glb` (0.018m x 1.870m x 0.420m)
  6. `DC_Right_Panel.glb` (0.018m x 1.870m x 0.420m)
  7. `DC_Shelf_1.glb` (1.209m x 0.020m x 0.342m)
  8. `DC_Shelf_2.glb` (1.209m x 0.020m x 0.342m)
  9. `DC_Shelf_3.glb` (1.209m x 0.020m x 0.342m)
  10. `DC_Shelf_4.glb` (1.209m x 0.020m x 0.342m)
  11. `DC_Sliding_Door_Left.glb` (0.632m x 1.810m x 0.036m)
  12. `DC_Sliding_Door_Right.glb` (0.632m x 1.810m x 0.036m)
  13. `DC_Top_Panel.glb` (1.250m x 0.018m x 0.420m)
  14. `DC_Top_Sliding_Track.glb` (1.214m x 0.018m x 0.050m)

### 5.2 Verification Criteria
1. **Individual Parts Upload Test:**
   - When all 14 files are dragged into the Structural Components dropzone, the 3D preview canvas renders the cabinet **built as one complete structure**.
   - Width = 1.25m, Height = 1.95m, Depth = 0.428m.
   - Shelves sit horizontally inside the cabinet frame.
   - Left and right panels form vertical cabinet sides.
   - Sliding doors sit in front tracks.
   - No parts are separated or floating in a horizontal line.
2. **Whole Model Decomposition Test:**
   - When `00DC_Complete_Display_Cabinet.glb` is dropped into "Decompose Whole Model", the engine executes loose-parts segmentation.
   - The modal displays all 19 constituent parts (13 aluminum sections, 4 base wheels, 2 glass sliding doors).
   - In the decomposition preview, parts retain their assembly coordinates and render as a complete assembled cabinet.
   - Clicking "Apply Extracted Parts" populates the wizard state with the 19 extracted parts and displays the unified cabinet in the main viewer.
3. **Generalization Test (Future Products):**
   - The fix applies to sliding glass doors (2 to 4 leaves), office partitions, shower enclosures, kitchen display shelves, and folding glass doors.
   - Any multi-part GLB where components share a common coordinate origin assembles automatically without requiring custom code per product type.

---

## 6. Implementation Checklist & Phase Plan

- [x] **Phase 1: Loose-Parts Segmentation Algorithm (`src/lib/admin/products/modelDecomposer.ts`)**
  - Implement `segmentMeshLooseParts` using triangle adjacency and DSU connected components.
  - Update `decomposeSceneGraph` to split composite meshes with loose parts into discrete components.
  - Preserve assembly coordinates in sub-geometries and export buffers.
- [x] **Phase 2: Auto-Detection Vocabulary Expansion (`src/lib/admin/products/autoDetection.ts`)**
  - Add cabinet and general furniture keywords (`panel`, `shelf`, `track`, `door`, `base`, `wheel`).
- [x] **Phase 3: Assembled Multi-Part 3D Preview (`src/features/admin/products/setup/StructuralComponentsSection.tsx`)**
  - Refactor `PartViewer3D` to place assembly-coordinate parts at `(0, 0, 0)` without individual re-centering.
  - Add "Assembled" vs "Exploded" view toggle to the 3D preview toolbar.
  - Recenter the combined assembly root so the camera frames the complete fixture.
- [x] **Phase 4: Runtime Assembly Harmonization (`src/lib/visualization/parametricProductBuilder.ts`)**
  - Update `buildStackedProduct` to detect and respect assembly-space coordinate offsets for non-window products.
- [x] **Phase 5: Automated Unit Tests (`tests/unit/modelDecomposer.test.ts`)**
  - Test topological segmentation on composite meshes with multiple loose volumes.
  - Test coordinate preservation across decomposition and export.
  - Run `npm test` and verify all test suites pass.

---

## Self-Check & Governance Audit

- [x] Document follows GlassFit implementation specification structure (`fix-ms02.md`, `fix-ms04.md`, `ms06.md`)
- [x] Hard ban BAN-PUNCT-01 enforced: Zero em-dashes in content; hyphens, colons, or parentheses used exclusively
- [x] Hard ban BAN-SPEC-02 enforced: Traced back to PRD-F5, PRD-F14, SDD-C4, SDD-C9, DSD-UI10, ERD-E6, QAD-TC20, QAD-TC21
- [x] Hard ban BAN-DIAG-03 enforced: Markdown tables and ordered prose used without box drawing diagrams
- [x] Hard ban BAN-TYPE-05 enforced: Zero `any` in TypeScript code blocks
- [x] Hard ban BAN-UI-09 enforced: Reuses existing styling patterns and component layout tokens
- [x] Addresses both defects: Individual structural upload separation AND whole-model decomposition split count (3 parts vs 19 loose parts)
- [x] Provides empirical measurements and coordinates directly from `C:\Users\reyna\OneDrive\Documents\GlassFit\Cabinet\Display Cabinet`
- [x] Generalizes architectural solution for all future products (sliding doors, partitions, shower enclosures, custom furniture)
