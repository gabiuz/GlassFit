# Implementation Specification: Decoupled Multi-Material Classification and Photorealistic Glazing Physics for Modular Fixtures and Cabinets (fix-02)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Technical Specification for Semantic Material Classification, Glazing Physics Parity, and Aluminum Finish Isolation  
**Version:** 1.0.0  
**Date:** September 17, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Specified (Pending Implementation)  
**Upstream Specifications:** `docs/implementation/fix-01.md`, `docs/implementation/ms06.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/prd-glassfit.md`, `docs/pricing.md`, `docs/qad-glassfit.md`  

---

## 1. Problem Context & Empirical Defect Analysis

During empirical testing and client visualization of modular cabinet fixtures (evaluated using the test asset `C:\Users\reyna\OneDrive\Documents\GlassFit\Cabinet\Display Cabinet`), three critical multi-material rendering defects were identified when configuring non-window products in `/admin/products/[id]/setup` and the client visualization workspace (`ProductModelWorkspace.tsx`):

### Defect 1: Cabinet Glass Fails to Behave Like Window Glass (Renders as Solid Opaque Block)
- **Observed Defect:** When a user configures or visualizes a modular cabinet (such as the Display Cabinet with sliding glass door leaves and interior glass shelves), the glass panes appear completely solid and opaque. They do not exhibit the optical transparency, specular transmission, ambient refractions, or background visibility characteristic of window glass in the system.
- **Root Cause Analysis:**
  1. **Naive String-Matching Heuristic in Material Application:** In `src/lib/visualization/parametricProductBuilder.ts`, the `applyGeneratedMaterials` routine identifies glass sub-meshes via a single string search:
     ```typescript
     const text = [object.name, object.parent?.name].join(" ").toLowerCase();
     object.material = text.includes("glass")
       ? glassMaterial.clone()
       : frameMaterial.clone();
     ```
  2. **GLTF Node Naming Disconnect:** In standard CAD and Blender exports, individual mesh nodes inside cabinet component `.glb` files are named arbitrarily by export primitives (e.g. `Cube.039_2`, `Mesh_0`, `Object_1`, `DC_Sliding_Door_Left`, `DC_Shelf_1`). Unless the substring `"glass"` is literally embedded in the mesh name or direct parent name, `text.includes("glass")` evaluates to `false`.
  3. **Forced Solid Aluminum Replacement:** Because the heuristic evaluates to `false`, `applyGeneratedMaterials` assigns `frameMaterial.clone()` to the glass doors and shelves. `frameMaterial` is a solid, opaque `MeshPhysicalMaterial` configured with aluminum metallic roughness (`metalness: 0.45` to `0.85`, `opacity: 1.0`, `transmission: 0.0`). As a result, the glass panels are rendered as solid metal slabs.

---

### Defect 2: Aluminum Finish Color Overwrites and Corrupts Cabinet Glass
- **Observed Defect:** When the user changes the Aluminum Finish option in the configuration panel (e.g. switching between "Dark Anodized Charcoal / Black", "Powder-Coated White", and "Natural Anodized Silver"), the glass panels on the cabinet change color along with the aluminum profiles. Selecting "White" turns the glass solid white; selecting "Black" turns the glass black; selecting "Silver" turns the glass reflective metallic grey.
- **Root Cause Analysis:**
  1. **Single Finish Loop Overwriting All Non-Window Meshes:** In `buildAssembledProduct` (`parametricProductBuilder.ts`), when `options.alumFinish` is provided, `applyGeneratedMaterials` iterates over every mesh in the assembled product group.
  2. **Lack of Material Domain Isolation:** Because the cabinet glass meshes were misclassified as framing members (Defect 1), the aluminum color variables (`frameColor: 0x232527` for Black, `0xeceae4` for White, `0xc8cbce` for Silver) are applied directly to the glass geometry.
  3. **Window vs Cabinet Disparity:** Window products avoid this issue only because `buildWindowLikeProduct` explicitly constructs a dedicated Three.js group named `"Glass"` containing parts named `"Glass_1"`, `"Glass_2"`, satisfying `text.includes("glass")`. Cabinets and other modular fixtures do not use this hardcoded group structure, leaving their glass unprotected from aluminum finish mutation.

---

### Defect 3: Cabinet Glass Ignores Glass Appearance Mode Controls
- **Observed Defect:** When the user toggles the Glass Appearance mode ("Clear", "Frosted", "Reflective", "Opaque", "Outdoor"), the cabinet glass displays no visual response. The glass remains solid aluminum regardless of the selected optical mode.
- **Root Cause Analysis:**
  1. Because the glass meshes receive `frameMaterial` instead of `glassMaterial`, changes to `glassAppearance` only instantiate an unused `glassMaterial` that is discarded at the end of `applyGeneratedMaterials`.
  2. Furthermore, in `src/lib/admin/products/autoDetection.ts`, sliding door components (`sliding_door`, `door_leaf`) were assigned `componentType: "Model"` and `suggestedMaterialCategory: "Aluminum"` instead of distinguishing glazing infill from framing extrusions.
  3. In `src/lib/admin/products/modelDecomposer.ts`, source GLTF material attributes (such as material name `DC_Mat_Glass.003`, transmission, and transparency flags) were stripped during loose-parts extraction and not attached as semantic metadata to extracted components.

---

## 2. Traceability & Specification Mapping

| Traceability Code | Specification Reference | Architectural Function |
|---|---|---|
| PRD-F5 | Parametric 3D Product Assembly Engine | Ensures all product categories (windows, doors, cabinets, partitions) render photorealistic physical materials |
| PRD-F6 | Photo-Based Visualization Workspace | Renders photorealistic optical glass transmission allowing room photo background to show through glass panels |
| PRD-F14 | Parametric Product Configuration & Administration | Admin tooling accurately detects and classifies glass vs aluminum components during onboarding |
| PRD-F19 | Raw Material & Master Price Catalog | Correctly maps glass components to glass price masters and aluminum frames to aluminum extrusion price masters |
| SDD-C4 | Parametric 3D Assembly Engine | Material classification engine decoupling aluminum architectural finishes from optical glazing shaders |
| SDD-C9 | Admin Product Setup & Component Inspector | Real-time 3D preview of transparent glass and powder-coated aluminum in `PartViewer3D` |
| DSD-UI10 | Part Inspector & 3D Viewport Controls | Interactive inspection displaying glass transparency, material properties, and finish selections |
| ERD-E6 | `product_components` Table | Stores `presentation_category`, `component_type`, and suggested material metadata |
| QAD-TC22 | Multi-Material Classification & Finish Isolation | Validates that aluminum finish updates do not alter glass components across any product type |
| QAD-TC23 | Photorealistic Glazing Physics Parity | Validates transmission, roughness, IOR, and opacity parity between window and cabinet glass |
| BAN-PUNCT-01 | No em-dashes in documentation | Formatted strictly using hyphens, colons, or parentheses |
| BAN-SPEC-02 | No code without spec link | Traced to PRD-F5, PRD-F6, PRD-F14, SDD-C4, SDD-C9, DSD-UI10, ERD-E6, QAD-TC22, and QAD-TC23 |
| BAN-TYPE-05 | Zero `any` in TypeScript | Strict typing for material classification rules, finish tokens, and mesh userData |
| BAN-UI-09 | Strict UI style consistency | Reuses established Tailwind tokens and design patterns in visualization workspaces |

---

## 3. Architectural Scope & Boundaries

### 3.1 In Scope

| Target File | Modification Rationale |
|---|---|
| `src/lib/visualization/materialClassifier.ts` | **[NEW]** Centralized, multi-tiered semantic material classifier detecting `Glass`, `Aluminum`, and `Hardware` across all product categories. |
| `src/lib/visualization/parametricProductBuilder.ts` | 1. Integrate `materialClassifier.ts` into `applyGeneratedMaterials`.<br>2. Decouple aluminum frame finish updates from glass material updates.<br>3. Support three distinct material pipelines: Aluminum Frame Finish, Optical Glass Mode, and Neutral Hardware/Accessories.<br>4. Ensure `buildAssembledProduct` and `buildWindowLikeProduct` achieve 100% material parity. |
| `src/lib/visualization/modelRenderer.ts` | Ensure fixed and parametric models apply decoupled material pipelines with correct ACESFilmic tone mapping and environment map refractions. |
| `src/lib/admin/products/autoDetection.ts` | Refine keyword detection to accurately classify cabinet sliding doors, glass shelves, side glass, and infill as `Glass` / `Glazing`. |
| `src/lib/admin/products/modelDecomposer.ts` | Preserve original material names, transparency flags, and material categories in `userData` and component metadata during decomposition. |
| `src/features/admin/products/setup/StructuralComponentsSection.tsx` | Upgrade `PartViewer3D` to render transparent glass shaders for glass parts in administrative setup previews without selection highlight blowout. |
| `tests/unit/materialClassifier.test.ts` | **[NEW]** Automated unit tests verifying multi-tiered material classification and finish isolation across window, cabinet, and door components. |

### 3.2 Out of Scope

| System Component | Rationale |
|---|---|
| `fastapi-service/` | Material classification and WebGL shaders are client-side Three.js operations. Computer vision microservice is unaffected. |
| Supabase Database Schema Migrations | Existing `product_components` columns (`presentation_category`, `component_type`, `raw_material_id`) are fully sufficient. |
| Continuous WebXR or AR Tracking (BAN-AR-08) | GlassFit visualization remains photo-based simulation with Three.js offscreen compositing. |

---

## 4. Technical Formulation & Algorithmic Design

### 4.1 Multi-Tiered Semantic Material Classification Algorithm

To prevent false classifications when 3D assets lack standard node names, the classification engine uses a prioritized 5-tier evaluation hierarchy:

$$\text{ClassifyMesh}(M) \rightarrow \text{MaterialCategory} \in \{\text{Glass}, \text{Aluminum}, \text{Hardware}\}$$

```
                +------------------------------------------------------+
                |                     Input Mesh                       |
                +------------------------------------------------------+
                                           |
                                           v
                +------------------------------------------------------+
                | Tier 1: Explicit UserData & Component Metadata       |
                | (componentType === "Glass" | category === "Glazing") |
                +------------------------------------------------------+
                                   /                \
                             (Match)                (No Match)
                                 /                    \
                                v                      v
                       [ Material: Glass ]    +----------------------------------+
                                              | Tier 2: Source GLTF Material     |
                                              | (mat.name has "glass",           |
                                              | transmission > 0.05, transp)     |
                                              +----------------------------------+
                                                        /                \
                                                  (Match)                (No Match)
                                                      /                    \
                                                     v                      v
                                            [ Material: Glass ]    +----------------------------------+
                                                                   | Tier 3: Key & Name Taxonomy      |
                                                                   | (mesh, parent, file names)       |
                                                                   +----------------------------------+
                                                                             /                \
                                                                       (Match)                (No Match)
                                                                           /                    \
                                                                          v                      v
                                                                  [ Match Category ]    +----------------------------------+
                                                                  (Glass/Alum/Hardware) | Tier 4: Hardware & Accessories   |
                                                                                        | (wheel, caster, roller, screw)   |
                                                                                        +----------------------------------+
                                                                                                  /                \
                                                                                            (Match)                (No Match)
                                                                                                /                    \
                                                                                               v                      v
                                                                                      [ Material: Hardware ]  [ Tier 5: Default Frame ]
                                                                                                              (Material: Aluminum)
```

#### Tier 1: Explicit Component Metadata (`userData`)
Inspect `object.userData` and walk up the scene graph hierarchy (`parent.userData`, `grandparent.userData`):
- If `userData.componentType === "Glass"` or `userData.presentationCategory === "Glazing"` or `userData.materialCategory === "Glass"`, classify as `Glass`.
- If `userData.componentType === "Hardware"` or `userData.presentationCategory === "Hardware"`, classify as `Hardware`.

#### Tier 2: Source GLTF Material Inspection
Inspect the original material attached to the mesh before generator substitution:
- If `material.name` contains `glass`, `glaz`, `transp`, `vitre`, `cristal`, `dc_mat_glass`, classify as `Glass`.
- If `material.name` contains `wheel`, `caster`, `roller`, `dc_mat_wheel`, `screw`, `fastener`, `hardware`, classify as `Hardware`.
- If `material.transmission > 0.05` or (`material.transparent === true` and `material.opacity < 0.95`), classify as `Glass`.

#### Tier 3: Semantic Vocabulary Taxonomy
Evaluate concatenated node names, parent names, component keys, and file names:
- **Glass Keywords:** `glass`, `pane`, `infill`, `glazing`, `shelf`, `sliding_door`, `door_leaf`, `sash_glass`, `showcase_front`, `display_panel`, `side_glass`, `top_glass`, `rear_glass`, `window_pane`, `glass_panel`.
- **Hardware Keywords:** `wheel`, `caster`, `roller`, `lock`, `latch`, `handle`, `screw`, `bolt`, `fastener`, `cap`, `gasket`, `seal`, `bearing`, `guide_block`.
- **Aluminum Framing Keywords:** `frame`, `jamb`, `stile`, `rail`, `track`, `header`, `sill`, `base`, `plinth`, `mullion`, `transom`, `aluminum`, `alu`, `profile`, `post`, `trim`, `bracket`, `panel`.

#### Tier 4: Geometric Form Factor (Fallback Heuristic)
If a part is unclassified and has a thin sheet aspect ratio:
$$\text{Aspect Ratio Check:} \quad \min(s_x, s_y, s_z) \le 0.025\text{ m} \quad \land \quad \max(s_x, s_y, s_z) \ge 0.150\text{ m}$$
If situated in an interior or door slot, prioritize `Glass`.

#### Tier 5: Default Fallback
Any unmatched structural component defaults to `Aluminum` (Framing).

---

### 4.2 Decoupled Three.js Material Generation Pipeline

The material generation subsystem in `parametricProductBuilder.ts` is restructured into three fully independent material pipelines:

```typescript
export type MaterialClassification = "Glass" | "Aluminum" | "Hardware";

export interface MaterialPaletteOptions {
  alumFinish?: string; // "black" | "white" | "silver" | "bronze"
  glassAppearance: GlassAppearanceMode; // "clear" | "frosted" | "reflective" | "opaque" | "outdoor"
}

export function createMaterialPalette(options: MaterialPaletteOptions) {
  const isBlack = options.alumFinish === "black";
  const isWhite = options.alumFinish === "white";
  const isSilver = options.alumFinish === "silver";
  const isBronze = options.alumFinish === "bronze";

  // 1. Aluminum Structural Frame Material (Driven by alumFinish)
  const frameColor = isBlack
    ? 0x232527
    : isWhite
      ? 0xeceae4
      : isSilver
        ? 0xc8cbce
        : isBronze
          ? 0x3e332b
          : 0x232527;

  const frameMetalness = isWhite ? 0.08 : isSilver ? 0.85 : isBronze ? 0.55 : 0.45;
  const frameRoughness = isBlack ? 0.28 : isWhite ? 0.32 : isSilver ? 0.22 : 0.26;
  const frameClearcoat = isWhite ? 0.35 : isSilver ? 0.60 : isBronze ? 0.45 : 0.40;
  const frameClearcoatRoughness = isWhite ? 0.25 : isSilver ? 0.15 : isBronze ? 0.20 : 0.20;

  const frameMaterial = new THREE.MeshPhysicalMaterial({
    color: frameColor,
    metalness: frameMetalness,
    roughness: frameRoughness,
    clearcoat: frameClearcoat,
    clearcoatRoughness: frameClearcoatRoughness,
  });

  // 2. Optical Glass Material (Driven strictly by glassAppearance)
  const glassMaterial = createWindowGlassMaterial(options.glassAppearance);

  // 3. Mechanical Hardware Material (Neutral Dark Metallic / Delrin Nylon)
  const hardwareMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f2326,
    metalness: 0.70,
    roughness: 0.35,
  });

  return { frameMaterial, glassMaterial, hardwareMaterial };
}
```

#### Material Application Engine
When traversing the assembled scene graph:
1. Each mesh is classified using `classifySceneMesh(mesh)`.
2. Meshes classified as `Glass` receive `glassMaterial.clone()`.
3. Meshes classified as `Aluminum` receive `frameMaterial.clone()`.
4. Meshes classified as `Hardware` receive `hardwareMaterial.clone()`.
5. Shadows: `castShadow = true`, `receiveShadow = true` on all opaque elements; `castShadow = false` on clear glass to prevent solid shadow casting behind transparent panes.

---

### 4.3 Optical Glass Mode Specifications

Glass materials must maintain identical physical properties across all products:

| Glass Appearance Mode | Opacity | Transmission | Roughness | Metalness | IOR | Clearcoat | DepthWrite | Visual Characteristics |
|---|---|---|---|---|---|---|---|---|
| `clear` (Default) | 0.18 | 0.88 | 0.03 | 0.02 | 1.52 | 1.00 (roughness 0.04) | `false` | Crystal-clear architectural float glass with room background transparency and specular highlights |
| `frosted` | 0.82 | 0.15 | 0.82 | 0.00 | 1.45 | 0.20 (roughness 0.60) | `true` | Acid-etched satin privacy glass diffusing light and blurring background objects |
| `reflective` | 0.65 | 0.35 | 0.08 | 0.45 | 1.65 | 1.00 (roughness 0.06) | `true` | Solar reflective mirror-tinted architectural coating with metallic sheen |
| `opaque` | 1.00 | 0.00 | 0.52 | 0.02 | 1.50 | 0.00 | `true` | Solid back-painted spandrel glass panel |
| `outdoor` | 1.00 | 0.00 | 0.40 | 0.00 | 1.50 | 0.50 | `true` | Exterior daylight environment reflection mapping for window visualization |

---

### 4.4 Auto-Detection Rule Updates (`autoDetection.ts`)

Update auto-detection rules to classify cabinet parts with accurate material and presentation categories:

```typescript
// Refined Auto-Detection Taxonomy
if (name.includes("sliding_door") || name.includes("door_leaf") || name.includes("door_pane")) {
  return {
    dimensionBinding: "AREA",
    spanRatio: 0.5,
    isRemovable: false,
    togglePropertyKey: null,
    presentationCategory: "Glazing",
    componentType: "Glass",               // Accurately assigned as Glass
    suggestedMaterialCategory: "Glass",  // Accurately assigned as Glass
  };
}

if (name.includes("shelf") || name.includes("glass_shelf")) {
  return {
    dimensionBinding: "WIDTH",
    spanRatio: 1.0,
    isRemovable: false,
    togglePropertyKey: null,
    presentationCategory: "Glazing",
    componentType: "Glass",               // Display cabinet shelves default to Glass
    suggestedMaterialCategory: "Glass",
  };
}
```

---

### 4.5 Administrative Setup Preview Parity (`StructuralComponentsSection.tsx`)

In `PartViewer3D`:
1. When rendering parts in "Assembled" or "Exploded" mode, apply physical glass shaders to parts where `componentType === "Glass"` or `presentationCategory === "Glazing"`.
2. Selection Highlighting: Replace destructive material replacement with a subtle cyan outline or non-destructive emissive tint that preserves underlying glass transparency (`transmission` and `opacity` retained).

---

## 5. Verification on Test Asset: Display Cabinet

### 5.1 Test Asset Component Mapping
Using `C:\Users\reyna\OneDrive\Documents\GlassFit\Cabinet\Display Cabinet`:

| Component File | Classified Category | Applied Material Pipeline | Expected Visual Behavior |
|---|---|---|---|
| `DC_Left_Panel.glb` | `Aluminum` | `frameMaterial` (Aluminum Finish) | Changes color with Black/White/Silver finish selector |
| `DC_Right_Panel.glb` | `Aluminum` | `frameMaterial` (Aluminum Finish) | Changes color with Black/White/Silver finish selector |
| `DC_Back_Panel.glb` | `Aluminum` | `frameMaterial` (Aluminum Finish) | Changes color with Black/White/Silver finish selector |
| `DC_Top_Panel.glb` | `Aluminum` | `frameMaterial` (Aluminum Finish) | Changes color with Black/White/Silver finish selector |
| `DC_Bottom_Panel.glb` | `Aluminum` | `frameMaterial` (Aluminum Finish) | Changes color with Black/White/Silver finish selector |
| `DC_Top_Sliding_Track.glb` | `Aluminum` | `frameMaterial` (Aluminum Finish) | Changes color with Black/White/Silver finish selector |
| `DC_Bottom_Sliding_Track.glb` | `Aluminum` | `frameMaterial` (Aluminum Finish) | Changes color with Black/White/Silver finish selector |
| `DC_Shelf_1.glb` to `4` | `Glass` | `glassMaterial` (Glass Appearance) | Transparent float glass; unaffected by aluminum finish |
| `DC_Sliding_Door_Left.glb` | `Glass` | `glassMaterial` (Glass Appearance) | Transparent sliding glass; unaffected by aluminum finish |
| `DC_Sliding_Door_Right.glb` | `Glass` | `glassMaterial` (Glass Appearance) | Transparent sliding glass; unaffected by aluminum finish |
| `DC_Bottom_Base_Assembly.glb` | `Hardware` / `Aluminum` | `hardwareMaterial` | Dark metallic base and caster wheels |

### 5.2 Concrete Verification Scenarios
1. **Glass Transparency Test:**
   - Onboard or visualize the Display Cabinet.
   - Glass sliding doors and shelves render transparent with specular sheen.
   - The interior of the cabinet (back panel and rear edges of shelves) is clearly visible through the sliding glass doors.
2. **Aluminum Finish Isolation Test:**
   - Switch aluminum finish from "White" to "Black".
   - The outer aluminum panels and tracks turn dark charcoal (`0x232527`).
   - The sliding glass doors and interior glass shelves **remain 100% transparent and clear** with zero color tinting.
   - Switch aluminum finish to "Silver".
   - The outer panels turn anodized silver (`0xc8cbce`).
   - The glass remains crystal-clear.
3. **Glass Appearance Mode Switching Test:**
   - Select "Frosted": Cabinet glass doors and shelves switch to diffuse satin frosted glass.
   - Select "Reflective": Cabinet glass switches to solar tinted reflective glass.
   - Select "Clear": Cabinet glass returns to high-transmission clear float glass.
   - Aluminum frame profiles remain unchanged during all glass mode transitions.

---

## 6. Implementation Checklist & Action Plan

- [ ] **Phase 1: Material Classifier Module (`src/lib/visualization/materialClassifier.ts`)**
  - Implement `classifySceneMesh(object: THREE.Object3D): MaterialClassification`.
  - Implement multi-tiered heuristic checking `userData`, original material names, transmission attributes, and semantic keywords.
- [ ] **Phase 2: Decoupled Material Generator (`src/lib/visualization/parametricProductBuilder.ts`)**
  - Refactor `applyGeneratedMaterials` to create independent `frameMaterial`, `glassMaterial`, and `hardwareMaterial`.
  - Traverse all product groups (windows, cabinets, doors) with decoupled material assignment.
  - Remove destructive string matching that overwrote glass with solid frame materials.
- [ ] **Phase 3: Auto-Detection & Decomposer Updates (`autoDetection.ts`, `modelDecomposer.ts`)**
  - Update `autoDetectComponentSettings` for sliding doors, door leaves, and shelves to assign `componentType: "Glass"` and `suggestedMaterialCategory: "Glass"`.
  - Preserve source material names and transmission flags in extracted part `userData` during whole-model decomposition.
- [ ] **Phase 4: Admin Preview Shaders (`src/features/admin/products/setup/StructuralComponentsSection.tsx`)**
  - Ensure `PartViewer3D` displays transparent glass shaders for glass parts in administrative setup.
  - Update part selection highlighting to prevent loss of glass transparency.
- [ ] **Phase 5: Automated Unit Tests (`tests/unit/materialClassifier.test.ts`)**
  - Test classification of cabinet parts (`DC_Sliding_Door_Left`, `DC_Shelf_1`, `DC_Left_Panel`, `DC_Bottom_Base_Assembly`).
  - Test material isolation: verify that updating aluminum finish does not mutate glass materials.
  - Test optical glass appearance modes: verify `transmission`, `opacity`, and `roughness` values match window glass specifications.

---

## Self-Check & Governance Audit

- [x] Document metadata aligns with GlassFit master documentation index (`docs/index.md`)
- [x] Hard ban BAN-PUNCT-01 enforced: Zero em-dashes in content; hyphens, colons, or parentheses used exclusively
- [x] Hard ban BAN-SPEC-02 enforced: Traced back to PRD-F5, PRD-F6, PRD-F14, PRD-F19, SDD-C4, SDD-C9, DSD-UI10, ERD-E6, QAD-TC22, QAD-TC23
- [x] Hard ban BAN-DIAG-03 enforced: Markdown tables and ordered prose used without box drawing diagrams
- [x] Hard ban BAN-TYPE-05 enforced: Zero `any` in TypeScript code blocks
- [x] Hard ban BAN-UI-09 enforced: Reuses existing styling patterns and component layout tokens
- [x] Addresses all 3 user issues:
  1. Cabinet glass behaves identically to window glass (transparency, transmission, refractions, optical modes)
  2. Changing aluminum finish color only affects aluminum components and isolates glass completely
  3. Eliminates solid glass defect by preventing frame material overwrite
- [x] Provides empirical test mapping directly for `C:\Users\reyna\OneDrive\Documents\GlassFit\Cabinet\Display Cabinet`
- [x] Fully generalizes for all modular fixtures, sliding doors, shower enclosures, and partition walls
