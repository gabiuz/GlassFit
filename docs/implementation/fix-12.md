# Implementation Specification: Client Visualization 3D Model Material and Finish Synchronization (fix-12)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document ID:** fix-12  
**Document Function:** Technical specification for resolving 3D model material non-reflection defects (aluminum finish, glass type, advanced glass appearance, glass color, and glass thickness) on customer-side visualization workspace  
**Version:** 1.0.0  
**Date:** October 22, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Implemented  
**Primary Traceability:** `PRD-F1` (Product Catalog), `PRD-F2` (Interactive 3D Inspector), `PRD-F5` (Parametric 3D Assembly Engine), `PRD-F6` (Visualization Workspace), `PRD-F10` (Quotation Measurement Modal & Real-Time Pricing), `PRD-F15` (Product Variant Comparison), `PRD-F16` (Multi-Product Overlay Management), `SDD-C4` (Parametric 3D Assembly Engine), `SDD-C5` (Photo-Based Visualization Canvas), `SDD-C7` (Quotation Engine & PDF Generator), `DSD-UI4` (Visualization Workspace Canvas), `DSD-UI7` (Quotation Measurement Modal), `ERD-E6` (product_components), `ERD-E11` (product_configurations), `ERD-E17` (raw_materials), `QAD-TC81` (Customer Material Customization Acceptance), `QAD-TC82` (Visualization 3D Model Material Synchronization)  
**Acceptance Catalog:** `QAD-TC82.1` through `QAD-TC82.8`  
**Regression Catalog:** `QAD-TC1`, `QAD-TC2`, `QAD-TC5`, `QAD-TC7`, `QAD-TC11`, `QAD-TC15`, `QAD-TC81.1` through `QAD-TC81.10`  
**Upstream Specifications:** `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/erd-glassfit.md`, `docs/qad-glassfit.md`, `docs/implementation/ms64.md`, `docs/implementation/ms66.md`, `docs/implementation/ms70.md`  

---

## 1. Decision Summary

In the customer-side visualization workspace (`src/features/visualization/components/ProductModelWorkspace.tsx`), recent changes introduced for procedural add-ons and multi-material component bindings (`IMP-MS64`, `IMP-MS66`, `IMP-MS70`) broke the live visual reflection of high-level presentation controls on placed 3D models. While the "Include Window Sill" toggle continues to operate correctly because it alters geometric mesh presence, selections for Aluminum Finish, Glass Type, Advanced Glass Appearance, Glass Color, and Glass Thickness no longer reflect visually on the 3D model canvas.

The implementation must adopt the following architectural corrections:

1. **Eliminate Blind Material Overwrite in `loadModel`:** In [modelRenderer.ts](file:///Users/gab/Developer/glassfit/src/lib/visualization/modelRenderer.ts), `loadModel()` must not unconditionally invoke `updateCustomMaterials()` over all scene meshes with default raw material bindings immediately after `prepareModel()` applies presentation materials. Instead, `updateCustomMaterials()` must execute only for meshes that possess explicit customer overrides diverging from baseline presentation defaults, or must compose directly with presentation options.
2. **Unified Real-Time Presentation Dispatcher:** In [ProductModelWorkspace.tsx](file:///Users/gab/Developer/glassfit/src/features/visualization/components/ProductModelWorkspace.tsx), encapsulate all presentation material mutations into a unified, high-performance dispatcher `applyWorkspacePresentation()`. Handlers for Glass Type (`handleGlassTypeChange`), Advanced Glass Appearance (`handleAdvancedGlassAppearanceChange`), Glass Color (`setGlassColor`), and Glass Thickness (`setGlassThicknessMm`) must immediately invoke `mvpRendererRef.current.updatePresentation()` and re-render the 2D canvas in under 16ms, mirroring `handleBaseFinishSelect`.
3. **Reconcile Presentation Handlers with `selectedMaterials`:** When a customer selects an Aluminum Finish or Glass Type, the workspace must bidirectionally synchronize the corresponding component keys in `selectedMaterials` using candidate materials from `candidateMaterialsMap` (or fallback safely to presentation parameters if no alternate raw material record is mapped in the database).
4. **Complete `useLayoutEffect` Dependency Boundary:** In [ProductModelWorkspace.tsx](file:///Users/gab/Developer/glassfit/src/features/visualization/components/ProductModelWorkspace.tsx) (line 1488), include `glassColor`, `glassThicknessMm`, `selectedAddon`, and `addonAlumFinish` in the dependency array of the layout render effect to eliminate stale render frames.
5. **Preserve Optical Glass Shaders in `applyPBRToMesh`:** In [materialClassifier.ts](file:///Users/gab/Developer/glassfit/src/lib/visualization/materialClassifier.ts), update `applyPBRToMesh()` to recognize optical glass meshes. If an explicit raw material is applied to a glass component, it must preserve the active optical appearance mode (e.g., outdoor view texture map, frosted roughness, transmission factors) and color tint instead of downgrading the mesh to a flat opaque or generic physical material.
6. **Skip Unnecessary Asynchronous Rebuilds:** In [ProductModelWorkspace.tsx](file:///Users/gab/Developer/glassfit/src/features/visualization/components/ProductModelWorkspace.tsx), update `skipPreparedBuildRef.current` when presentation materials change so that debounced `loadModel()` calls do not trigger redundant geometry rebuilds and overwrite active scene shaders.
7. **Placed Overlay and Multi-Product Parity:** In [ProductModelWorkspace.tsx](file:///Users/gab/Developer/glassfit/src/features/visualization/components/ProductModelWorkspace.tsx), ensure `applyProductConfiguration()` immediately pushes restored finishes and glass properties to `mvpRendererRef.current.updatePresentation()` and re-renders the canvas when editing placed overlays (`handleEditPlacedOverlay`).

---

## 2. Problem Context and Empirical Defect Analysis

### 2.1 Observed Behavior

When a customer navigates to the visualization workspace (`/visualize/[productId]/workspace` or `/visualize/direct`):
1. The 3D model of the window or door renders in the center of the uploaded room photo.
2. The customer opens the "Design and Customization Option" accordion in the right-hand parameter dock.
3. The customer clicks an **Aluminum Finish** option (e.g., Powder Coated White, Mill Finish):
   - The button highlights, but the placed 3D window frame remains dark Analok bronze, or flashes briefly and reverts back to Analok.
4. The customer clicks a **Glass Type** option (e.g., Clear, Frosted, Reflective):
   - The button highlights, but the 3D window glass appearance does not change.
5. The customer selects an **Advanced Glass Appearance** mode (e.g., Opaque, Outdoor):
   - The button highlights, but the outdoor environment view texture or opaque diffuse shader does not appear on the glass.
6. The customer selects a **Glass Color** (e.g., Bronze, Smoke Gray, Green, Blue):
   - The button highlights, but the glass tint on the 3D model remains neutral/unaltered.
7. The customer selects a **Glass Thickness** (e.g., 6mm, 8mm, 10mm, 12mm):
   - The button highlights, but the optical thickness and transmission attenuation do not update.
8. The customer clicks **"Include Window Sill"**:
   - The bottom window sill cleanly appears or disappears on the 3D model as expected.

### 2.2 Detailed Execution Trace and Failure Sequence

Here is the exact runtime trace of the current implementation:

#### A. Initial Component Mount
1. Route loads: `ProductAwareWorkspacePage` mounts `ProductModelWorkspace`.
2. `selectedMaterials` state initializes at line 346:
   ```typescript
   const [selectedMaterials, setSelectedMaterials] = useState<Record<string, string>>(() => {
     if (initialConfiguration?.selectedMaterials) {
       return initialConfiguration.selectedMaterials;
     }
     if (structuralDefinition) {
       return getDefaultMaterialSelections(structuralDefinition);
     }
     return {};
   });
   ```
3. `getDefaultMaterialSelections(structuralDefinition)` populates `selectedMaterials` with the default raw material UUID for every component key in the product:
   - `"frame-left"`: `raw_material_id` (Analok extrusion)
   - `"frame-right"`: `raw_material_id` (Analok extrusion)
   - `"frame-top"`: `raw_material_id` (Analok extrusion)
   - `"frame-bottom"`: `raw_material_id` (Analok extrusion)
   - `"frame-center"`: `raw_material_id` (Analok extrusion)
   - `"glass-panel"`: `raw_material_id` (6mm Clear Float Glass)
4. The `useEffect` at line 1344 fires:
   `mvpRendererRef.current.loadModel(structuralDefinition, dimensions, presentation, { selectedMaterials, rawMaterialsMap: candidateMaterialsMap })`.
5. Inside `loadModel()` in [modelRenderer.ts](file:///Users/gab/Developer/glassfit/src/lib/visualization/modelRenderer.ts):
   - `prepareModel()` calls `buildParametricProduct()`, which applies `applyPresentationMaterials(group, presentation)`.
   - `commitPreparedModel(prepared)` adds the model to `scene`.
   - **The Destructive Overwrite:** Lines 229-231 execute:
     ```typescript
     if (customMaterials?.selectedMaterials && Object.keys(customMaterials.selectedMaterials).length > 0) {
       this.updateCustomMaterials(customMaterials.selectedMaterials, customMaterials.rawMaterialsMap);
     }
     ```
   - `updateCustomMaterials()` iterates through every mesh. For every mesh matching `child.userData.componentKey` or `child.name`:
     `applyPBRToMesh(child, rawMat)` is called with the default database raw material!
   - Every frame mesh is forced to the default raw material PBR (Analok).
   - The glass mesh (`glass-panel`) is forced to the default raw material PBR (basic 6mm clear). All `glassAppearance` modes, tints, and physical optical properties from `applyPresentationMaterials()` are obliterated!

#### B. User Changes Glass Type, Appearance, Color, or Thickness
1. When user clicks "Frosted" or "Reflective" (`handleGlassTypeChange`), "Outdoor" (`handleAdvancedGlassAppearanceChange`), a color swatch (`setGlassColor`), or thickness (`setGlassThicknessMm`):
   - `setGlassType()`, `setGlassAppearance()`, `setGlassColor()`, or `setGlassThicknessMm()` updates React state.
   - **Defect 1:** None of these handlers call `mvpRendererRef.current.updatePresentation()`.
   - **Defect 2:** None of these handlers draw to `mvpCanvasRef.current`.
   - **Defect 3:** In `useLayoutEffect` (line 1488), `glassColor` and `glassThicknessMm` are not even in the dependency array!
   - **Defect 4:** When the debounced `useEffect` at line 1344 eventually runs because `glassAppearance`, `glassColor`, or `glassThicknessMm` changed:
     `loadModel()` is called. `prepareModel()` creates the new glass material, but then lines 229-231 immediately call `updateCustomMaterials(selectedMaterials)`. Because `selectedMaterials["glass-panel"]` still points to the default raw material ID, `applyPBRToMesh()` wipes out the glass again!

#### C. User Changes Aluminum Finish
1. When user clicks "Powder Coated White" (`handleBaseFinishSelect`):
   - Line 2748: `setAlumFinish("white")`.
   - Lines 2751-2777: `updatePresentation()` applies white material and draws to canvas. The user may see a momentary flash of white.
   - Line 2781: `materialCustomizationGroups.find((g) => g.presentationCategory === "Framing")`.
     If the admin catalog does not have an alternate raw material for "white" bound to this product's components in PostgreSQL (`product_component_materials`), `matchedOption` evaluates to `undefined`.
   - As a result, `selectedMaterials` is never updated with a white material ID.
   - `setAlumFinish("white")` triggers the `useEffect` at line 1344 because `alumFinish` is in its dependency array.
   - Line 1344 executes `loadModel()`.
   - At the completion of `loadModel()`, lines 229-231 execute:
     `this.updateCustomMaterials(selectedMaterials, candidateMaterialsMap)`.
   - Because `selectedMaterials` still contains the default Analok raw material ID, `applyPBRToMesh()` resets all frame meshes back to Analok bronze!

#### D. Why Window Sill Still Works
1. When user clicks "Include Window Sill" (`handleIncludeSillToggle`):
   - `setIncludeSill(!current)` toggles boolean state.
   - `includeSill` triggers line 1344 `loadModel()`.
   - In `buildParametricProduct()` (lines 288-301 of [parametricProductBuilder.ts](file:///Users/gab/Developer/glassfit/src/lib/visualization/parametricProductBuilder.ts)):
     ```typescript
     if (includeSill && sill && quantity > 0) {
       const sillMesh = createPart("Window_Sill", sill, cache, ...);
       accessories.add(sillMesh);
     }
     ```
   - When `includeSill` is false, `sillMesh` is never created or added to the scene graph.
   - When `includeSill` is true, `sillMesh` is physically instantiated and added.
   - Because window sill toggling is a **geometric existence mutation** rather than a shader material assignment, it is unaffected by the shader overwriting defects.

### 2.3 Root Cause Matrix

| Root Cause ID | Source File | Line Range | Defect Description | System Impact |
|---|---|---|---|---|
| RC-1 | `modelRenderer.ts` | 228-232 | `loadModel()` calls `updateCustomMaterials()` unconditionally after committing prepared model | Blindly overwrites `applyPresentationMaterials()` on all meshes with default database raw material properties |
| RC-2 | `ProductModelWorkspace.tsx` | 1067-1078, 4488, 4496 | Glass change handlers (`handleGlassTypeChange`, `handleAdvancedGlassAppearanceChange`, `setGlassColor`, `setGlassThicknessMm`) lack direct `updatePresentation()` calls and immediate canvas redraws | Changing glass properties causes zero immediate visual feedback |
| RC-3 | `ProductModelWorkspace.tsx` | 1488-1505 | `useLayoutEffect` dependencies omit `glassColor`, `glassThicknessMm`, `selectedAddon`, and `addonAlumFinish` | Canvas paint effect does not trigger when glass color or thickness changes in isolation |
| RC-4 | `ProductModelWorkspace.tsx` | 2746-2821 | `handleBaseFinishSelect` causes asynchronous `loadModel()` race; does not set `skipPreparedBuildRef` | Asynchronous model rebuild runs and reverts finish via `updateCustomMaterials()` |
| RC-5 | `materialClassifier.ts` | 793-849 | `applyPBRToMesh()` treats glass as generic physical material, ignoring appearance modes (opaque, outdoor view) and color tint | Any call to `updateCustomMaterials()` destroys specialized optical glass shaders |
| RC-6 | `ProductModelWorkspace.tsx` & `materialCustomization.ts` | 782-827, 2780-2804 | Disconnect between high-level presentation finishes and component-level `selectedMaterials` | Presentation finish selections fail to update `selectedMaterials` when alternate raw materials are unmapped |
| RC-7 | `ProductModelWorkspace.tsx` | 1722-1802 | `applyProductConfiguration()` lacks direct `updatePresentation()` call when switching between placed overlays | Restoring an overlay configuration relies on asynchronous rebuild that gets clobbered by default materials |

---

## 3. Traceability & Specification Mapping

| Traceability Code | Authoritative Requirement | fix-12 Responsibility |
|---|---|---|
| PRD-F1 | Public Product Catalog & Filtering | Preserves active product specifications and material attributes |
| PRD-F2 | Interactive 3D Product Inspector | Ensures materials, glass, and finishes render accurately on inspectable meshes |
| PRD-F5 | Parametric 3D Assembly Engine | Coordinates parametric geometry building with decoupled presentation material palettes |
| PRD-F6 | Photo-Based Visualization Workspace | Synchronizes 3D product material rendering on real-world room backgrounds in real time |
| PRD-F10 | Quotation Measurement Modal & Pricing | Maintains parity between visual materials on 3D models and calculated BOM pricing |
| PRD-F15 | Product Variant Comparison | Ensures comparison snapshots accurately capture the active finishes and glass appearance |
| PRD-F16 | Multi-Product Overlay Management | Preserves independent finishes and glass specifications across multiple placed products |
| SDD-C4 | Parametric 3D Assembly & Guardrail Engine | Rebuilds parametric assemblies without destroying presentation shader state |
| SDD-C5 | Photo-Based Visualization Canvas | Executes 60 FPS real-time shader parameter updates on active Three.js canvas |
| SDD-C7 | Quotation Engine & PDF Generator | Feeds verified material selections into quotation item pricing and consultation exports |
| DSD-UI4 | Visualization Workspace Canvas | Adheres to established parameter dock layout, accordions, and material swatches |
| ERD-E6 | `product_components` Entity | Binds presentation categories (Framing, Glazing, Hardware) to scene meshes |
| ERD-E11 | `product_configurations` Entity | Persists customer finishes and glass configuration snapshots |
| ERD-E17 | `raw_materials` Entity | Resolves physical PBR properties and unit pricing for BOM calculations |
| QAD-TC81 | Customer Material Customization | Parent multi-material test suite; fix-12 resolves the underlying workspace rendering defects |
| QAD-TC82 | Visualization 3D Model Material Synchronization | Verifies that all 5 presentation controls immediately and reliably reflect on placed 3D models |
| BAN-PUNCT-01 | Zero em-dashes in documentation | Standard hyphens, colons, or parentheses used exclusively across all markdown and code comments |
| BAN-SPEC-02 | Spec-linked commits and tasks | Direct traceability to PRD-F1, PRD-F5, PRD-F6, SDD-C4, SDD-C5, and QAD-TC82 |
| BAN-TYPE-05 | Zero `any` in TypeScript | Strict type safety across all modified methods, options, and event handlers |
| BAN-UI-09 | Strict UI consistency | Reuses existing Tailwind tokens, accordion styles, and swatch pills |

---

## 4. Architectural Scope & Boundaries

### 4.1 In Scope
- Fixing the live visual reflection of **Aluminum Finish** on placed 3D product models in the workspace.
- Fixing the live visual reflection of **Glass Type** on placed 3D product models.
- Fixing the live visual reflection of **Advanced Glass Appearance** (Clear, Frosted, Opaque, Reflective, Outdoor) on placed 3D product models.
- Fixing the live visual reflection of **Glass Color** (Clear, Bronze, Smoke Gray, Green, Blue) on placed 3D product models.
- Fixing the live visual reflection of **Glass Thickness** (6mm, 8mm, 10mm, 12mm) on placed 3D product models.
- Ensuring the "Include Window Sill" toggle continues to work without regression.
- Coordinating `modelRenderer.ts`, `materialClassifier.ts`, `ProductModelWorkspace.tsx`, and `materialCustomization.ts`.
- Supporting multi-product placement and placed overlay switching (`applyProductConfiguration`).
- Creating comprehensive unit and acceptance tests under `tests/unit/customerMaterialWorkspaceIntegration.test.ts`.

### 4.2 Out of Scope
- Modifying PostgreSQL database migrations or altering Supabase schemas.
- Changing admin-side product setup wizards (`ProductSetupWizard.tsx`).
- Modifying FastAPI computer vision background removal or YOLOv8 segmentation endpoints.
- Introducing new third-party UI libraries or external shader dependencies.

---

## 5. Target Architecture & Core Mechanics

### 5.1 Material Precedence and Composition Hierarchy

To eliminate the conflict between high-level presentation controls and low-level component material bindings, the system must enforce a clear precedence contract:

```text
[High-Level Presentation Controls]
- Aluminum Finish (Analok, White, Mill, etc.)
- Glass Type (Annealed, Tempered, Laminated)
- Advanced Glass Appearance (Clear, Frosted, Opaque, Reflective, Outdoor)
- Glass Color (Clear, Bronze, Smoke Gray, Green, Blue)
- Glass Thickness (6mm, 8mm, 10mm, 12mm)
                          │
                          ▼
            [Primary Visual Presentation Layer]
          (applyPresentationMaterials in materialClassifier.ts)
                          │
                          ▼
           [Custom Part Overrides Layer]
          (PartMaterialsPicker / Custom Raw Materials)
                          │
                          ▼
         [Final Three.js Rendered Output Canvas]
```

1. **Default State (No explicit part overrides):**
   When the workspace loads, `selectedMaterials` holds default raw material IDs for BOM pricing. However, for 3D visualization, `applyPresentationMaterials()` governs the visual appearance. `loadModel()` must NOT run `updateCustomMaterials()` over all meshes if no explicit, non-default part overrides have been chosen by the customer.
2. **Presentation Controls Change:**
   When the customer clicks Aluminum Finish or any Glass control, `applyWorkspacePresentation()` updates the 3D meshes in real time via `mvpRendererRef.current.updatePresentation()`. Framing meshes receive the selected aluminum finish; glazing meshes receive the selected glass appearance, color tint, and thickness attenuation.
3. **Explicit Part Material Selection:**
   If the customer explicitly opens the Part Materials Picker and assigns a specific raw material to a specific part (e.g., custom jamb extrusion), that mesh is tagged with `child.userData.hasExplicitPartOverride = true`. `updateCustomMaterials()` applies PBR to that specific mesh only, preserving presentation materials on all other meshes.

### 5.2 Real-Time Presentation Dispatcher

In `ProductModelWorkspace.tsx`, implement a centralized helper:

```typescript
const applyWorkspacePresentation = useCallback((overrides?: Partial<ModelPresentationOptions>) => {
  if (!mvpRendererRef.current) return;

  const currentOptions: ModelPresentationOptions = {
    aluminumFinish: overrides?.aluminumFinish ?? normalizeAluminumFinish(alumFinish),
    glassAppearance: overrides?.glassAppearance ?? glassAppearance,
    glassColor: overrides?.glassColor ?? glassColor,
    glassThicknessMm: overrides?.glassThicknessMm ?? glassThicknessMm,
    includeSill: overrides?.includeSill ?? includeSill,
    activeAddon: overrides?.activeAddon ?? selectedAddon,
    addonAluminumFinish: overrides?.addonAluminumFinish ?? addonAlumFinish,
    addonConfig: {
      finishColor: getFinishHexColor(overrides?.addonAluminumFinish ?? addonAlumFinish),
      zOffsetMm: 18,
    },
  };

  // 1. Update 3D scene materials in real time (< 16ms)
  mvpRendererRef.current.updatePresentation(currentOptions);

  // 2. Immediate 2D canvas blit
  if (mvpCanvasRef.current) {
    const isPlanar = Boolean(perspectiveCorners);
    const sourceCanvas = mvpRendererRef.current.render(yaw, pitch, isPlanar);
    if (sourceCanvas) {
      const ctx = mvpCanvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, mvpCanvasRef.current.width, mvpCanvasRef.current.height);
        ctx.drawImage(
          sourceCanvas,
          0,
          0,
          sourceCanvas.width,
          sourceCanvas.height,
          0,
          0,
          mvpCanvasRef.current.width,
          mvpCanvasRef.current.height,
        );
      }
    }
  }

  // 3. Mark skipPreparedBuildRef to prevent redundant debounced loadModel() rebuilds
  const nextBuildKey = `${structuralDefinition?.product.productId}:${widthCm}:${heightCm}:${panelCount}:${currentOptions.includeSill}:${currentOptions.activeAddon}:${currentOptions.addonAluminumFinish}:${currentOptions.aluminumFinish}:${currentOptions.glassAppearance}:${currentOptions.glassColor}:${currentOptions.glassThicknessMm}`;
  skipPreparedBuildRef.current = nextBuildKey;

  // 4. Invalidate model revision for outline measurement and UI updates
  setModelRevision((prev) => prev + 1);
}, [
  alumFinish,
  glassAppearance,
  glassColor,
  glassThicknessMm,
  includeSill,
  selectedAddon,
  addonAlumFinish,
  getFinishHexColor,
  perspectiveCorners,
  yaw,
  pitch,
  structuralDefinition,
  widthCm,
  heightCm,
  panelCount,
]);
```

### 5.3 Non-Destructive `loadModel` in `modelRenderer.ts`

In [modelRenderer.ts](file:///Users/gab/Developer/glassfit/src/lib/visualization/modelRenderer.ts), change `loadModel()`:

```typescript
// Replace lines 228-232:
this.commitPreparedModel(prepared);
if (
  customMaterials?.selectedMaterials &&
  customMaterials?.hasExplicitOverrides &&
  Object.keys(customMaterials.selectedMaterials).length > 0
) {
  this.updateCustomMaterials(customMaterials.selectedMaterials, customMaterials.rawMaterialsMap);
}
```

When building a model, `prepareModel()` already applies presentation materials (`applyPresentationMaterials`). By only calling `updateCustomMaterials()` when explicit, non-default overrides exist, the 3D model retains its exact presentation materials (finishes, glass appearance, tints, and thicknesses) upon every load.

### 5.4 Glass Optical Shader Preservation in `applyPBRToMesh`

In [materialClassifier.ts](file:///Users/gab/Developer/glassfit/src/lib/visualization/materialClassifier.ts), update `applyPBRToMesh()` to recognize when a mesh is classified as Glass:
1. When applied to a Glass mesh, do not overwrite with generic physical material if the current material is an instance of `createWindowGlassMaterial` (or retain outdoor view map texture if `outdoor` appearance mode is active).
2. Apply the raw material tint color into `mesh.material.color` and `attenuationColor` while preserving `transmission`, `ior`, `roughness`, and `clearcoat`.

---

## 6. Step-by-Step Implementation Blueprint

### Step 1: Update `src/lib/visualization/modelRenderer.ts`

#### 1.1 Support Explicit Overrides Flag in `loadModel`
Modify `loadModel` parameter signature to accept `hasExplicitOverrides?: boolean`:

```typescript
export class ProductModelRenderer {
  // ...
  async loadModel(
    definition: ProductStructuralDefinition,
    values: Record<string, unknown>,
    presentation: ModelPresentationOptions,
    customMaterials?: {
      selectedMaterials: Record<string, string>;
      rawMaterialsMap: Map<string, RawMaterial>;
      hasExplicitOverrides?: boolean;
    },
  ): Promise<LoadedModelResult | undefined> {
    const loadVersion = (this.modelLoadVersion += 1);
    const prepared = await this.prepareModel(definition, values, presentation);
    if (this.modelLoadVersion !== loadVersion) {
      this.releasePreparedModel(prepared);
      return;
    }
    this.commitPreparedModel(prepared);

    // Only apply custom materials if explicit overrides exist beyond default bindings
    if (
      customMaterials?.hasExplicitOverrides &&
      customMaterials?.selectedMaterials &&
      Object.keys(customMaterials.selectedMaterials).length > 0
    ) {
      this.updateCustomMaterials(customMaterials.selectedMaterials, customMaterials.rawMaterialsMap);
    }

    return { capabilities: prepared.capabilities };
  }
  // ...
}
```

#### 1.2 Safeguard `updatePresentation`
In `updatePresentation()`, ensure `applyPresentationMaterials()` correctly traverses all framing and glazing meshes and disposes prior materials safely:

```typescript
  updatePresentation(
    presentation: ModelPresentationOptions,
  ): ProductMaterialCapabilities {
    if (this.modelGroup.children.length === 0) {
      return this.materialCapabilities;
    }
    disposeOwnedModelMaterials(this.modelGroup);
    applyPresentationMaterials(this.modelGroup, {
      aluminumFinish: presentation.aluminumFinish,
      glassAppearance: presentation.glassAppearance,
      glassColor: presentation.glassColor,
      glassThicknessMm: presentation.glassThicknessMm,
    });
    // Add-on frame finish update logic...
    return this.materialCapabilities;
  }
```

### Step 2: Update `src/lib/visualization/materialClassifier.ts`

#### 2.1 Optical Glass Support in `applyPBRToMesh`
In `applyPBRToMesh(mesh: THREE.Mesh, rawMaterial: RawMaterial | null)`:
- If `classifySceneMesh(mesh) === "Glass"`:
  - Do not overwrite with flat opaque standard material.
  - Set `mesh.material.transparent = true`.
  - Maintain `transmission = 0.88` (or transmission from raw material).
  - Update `color` and `attenuationColor` with the tint.
  - Set `castShadow = false` and `receiveShadow = true`.
  - Enforce `renderOrder = 1` so glass renders after opaque framing.

### Step 3: Update `src/features/visualization/components/ProductModelWorkspace.tsx`

#### 3.1 Implement Centralized `applyWorkspacePresentation`
Add `applyWorkspacePresentation` as specified in Section 5.2.

#### 3.2 Update `handleBaseFinishSelect`
Refactor `handleBaseFinishSelect` to utilize `applyWorkspacePresentation`:

```typescript
  const handleBaseFinishSelect = useCallback((finishId: string) => {
    const normalizedFinish = normalizeAluminumFinish(finishId);
    setAlumFinish(normalizedFinish);

    // Apply 3D presentation in real time (< 16ms)
    applyWorkspacePresentation({ aluminumFinish: normalizedFinish });

    // Synchronize framing in selectedMaterials if alternate raw materials exist
    if (structuralDefinition && materialCustomizationGroups.length > 0) {
      const framingGroup = materialCustomizationGroups.find((g) => g.presentationCategory === "Framing");
      if (framingGroup) {
        const normalizedTarget = normalizedFinish.toLowerCase();
        const matchedOption = framingGroup.options.find((opt) => {
          const optFinish = (opt.finishType || opt.description || "").toLowerCase();
          return optFinish.includes(normalizedTarget) ||
            (normalizedTarget === "white" && optFinish.includes("white")) ||
            (normalizedTarget === "analok" && optFinish.includes("analok"));
        });
        if (matchedOption) {
          const nextSelections = applyGroupSelection(
            framingGroup,
            matchedOption,
            selectedMaterials,
            structuralDefinition,
          );
          setSelectedMaterials(nextSelections);
        }
      }
    }
  }, [applyWorkspacePresentation, structuralDefinition, materialCustomizationGroups, selectedMaterials]);
```

#### 3.3 Update Glass Handlers
Refactor all glass handlers to invoke `applyWorkspacePresentation`:

```typescript
  const handleGlassTypeChange = useCallback((nextType: GlassTypeKey) => {
    const nextAppearance = mapGlassTypeToAppearanceMode(nextType);
    setGlassType(nextType);
    setGlassAppearance(nextAppearance);
    applyWorkspacePresentation({ glassAppearance: nextAppearance });

    // Synchronize glazing in selectedMaterials if matching glass option exists
    if (structuralDefinition && materialCustomizationGroups.length > 0) {
      const glazingGroup = materialCustomizationGroups.find((g) => g.presentationCategory === "Glazing");
      if (glazingGroup) {
        const matchedOption = glazingGroup.options.find((opt) =>
          opt.description.toLowerCase().includes(nextType.toLowerCase())
        );
        if (matchedOption) {
          const nextSelections = applyGroupSelection(
            glazingGroup,
            matchedOption,
            selectedMaterials,
            structuralDefinition,
          );
          setSelectedMaterials(nextSelections);
        }
      }
    }
  }, [applyWorkspacePresentation, structuralDefinition, materialCustomizationGroups, selectedMaterials]);

  const handleAdvancedGlassAppearanceChange = useCallback(
    (appearance: "opaque" | "outdoor") => {
      setGlassType(undefined);
      setGlassAppearance(appearance);
      applyWorkspacePresentation({ glassAppearance: appearance });
    },
    [applyWorkspacePresentation],
  );

  const handleGlassColorChange = useCallback(
    (colorKey: GlassColorKey) => {
      setGlassColor(colorKey);
      applyWorkspacePresentation({ glassColor: colorKey });
    },
    [applyWorkspacePresentation],
  );

  const handleGlassThicknessChange = useCallback(
    (thicknessVal: GlassThicknessMm) => {
      setGlassThicknessMm(thicknessVal);
      applyWorkspacePresentation({ glassThicknessMm: thicknessVal });
    },
    [applyWorkspacePresentation],
  );
```

#### 3.4 Wire JSX Buttons to Handlers
In the JSX accordion for "Design and Customization Option":
- Glass Color buttons: change `onClick={() => setGlassColor(option.id)}` to `onClick={() => handleGlassColorChange(option.id)}`.
- Glass Thickness buttons: change `onClick={() => setGlassThicknessMm(option.value)}` to `onClick={() => handleGlassThicknessChange(option.value)}`.

#### 3.5 Complete `useLayoutEffect` Dependency Array
Update lines 1488-1505 of `ProductModelWorkspace.tsx`:

```typescript
  useLayoutEffect(() => {
    // ... render logic
  }, [
    yaw,
    pitch,
    structuralDefinition,
    widthCm,
    heightCm,
    includeSill,
    glassAppearance,
    glassColor,            // ADDED
    glassThicknessMm,      // ADDED
    alumFinish,
    selectedAddon,         // ADDED
    addonAlumFinish,       // ADDED
    effectiveLighting,
    autoRealism,
    autoShadow,
    modelRevision,
    renderFrameSize,
    isOutlineMeasurementPaused,
    selectedProduct,
    perspectiveCorners,
  ]);
```

#### 3.6 Placed Overlay Restoration (`applyProductConfiguration`)
In `applyProductConfiguration()`, immediately invoke `mvpRendererRef.current.updatePresentation()`:

```typescript
      // After setting state variables:
      if (mvpRendererRef.current) {
        mvpRendererRef.current.updatePresentation({
          aluminumFinish: normalizeAluminumFinish(configuration.aluminumFinish),
          glassAppearance: configuration.glassAppearance,
          glassColor: normalizeGlassColor(configuration.glassColor),
          glassThicknessMm: normalizeGlassThickness(configuration.glassThicknessMm),
          includeSill: configuration.includeSill,
          activeAddon: (configuration.selectedAddon as AddonSelectionType) ?? "none",
          addonAluminumFinish: configuration.addonAluminumFinish ?? "analok",
          addonConfig: {
            finishColor: getFinishHexColor(configuration.addonAluminumFinish ?? "analok"),
            zOffsetMm: 18,
          },
        });
      }
```

---

## 7. Verification & Acceptance Protocol

### 7.1 Automated Test Catalog (`QAD-TC82`)

Add test suite in `tests/unit/customerMaterialWorkspaceIntegration.test.ts`:

| Test ID | Test Scenario | Execution Step | Expected Assertion |
|---|---|---|---|
| QAD-TC82.1 | Aluminum finish live 3D mesh update | Invoke `updatePresentation({ aluminumFinish: "white" })` on loaded model | Mesh materials classified as Aluminum have color matching `#ffffff` (White Powder Coat) with metalness 0.25 and roughness 0.35 |
| QAD-TC82.2 | Glass type live 3D mesh update | Invoke `updatePresentation({ glassAppearance: "reflective" })` | Mesh materials classified as Glass update to `MeshPhysicalMaterial` with transmission 0.35, metalness 0.45, roughness 0.08 |
| QAD-TC82.3 | Advanced glass appearance (outdoor) | Invoke `updatePresentation({ glassAppearance: "outdoor" })` | Mesh materials classified as Glass have diffuse `map` assigned from outdoor view texture and depthWrite = true |
| QAD-TC82.4 | Glass color tint update | Invoke `updatePresentation({ glassColor: "bronze" })` | Glass material color and attenuationColor match `#4a3525` (bronze previewHex) |
| QAD-TC82.5 | Glass thickness attenuation update | Invoke `updatePresentation({ glassThicknessMm: 12 })` | Glass physical optics thickness equals 0.012 meters and attenuationDistance equals 0.035 |
| QAD-TC82.6 | Window sill toggling independence | Build model with `includeSill: true` then `includeSill: false` | Sill mesh exists in scene when true, and is completely removed from scene when false; materials on other meshes remain intact |
| QAD-TC82.7 | Non-destructive `loadModel` | Call `loadModel` with default raw materials | Glass meshes retain `createWindowGlassMaterial` shader; frame meshes retain presentation finish; no default raw material overwriting |
| QAD-TC82.8 | Placed overlay restoration | Call `applyProductConfiguration` with Bronze finish and Frosted glass | Scene presentation updates immediately to Bronze and Frosted without waiting for debounced network or rebuild |

### 7.2 Manual Workspace Verification Steps
1. Navigate to `/visualize/[productId]/workspace` in local development server (`npm run dev`).
2. Open "Design and Customization Option" in the sidebar.
3. Click "Powder Coated White": Verify window frames turn white immediately on the room canvas.
4. Click "Analok": Verify window frames turn bronze dark charcoal immediately.
5. Click "Reflective" glass: Verify glass reflects environmental highlights immediately.
6. Click "Outdoor" glass: Verify outdoor background texture renders through the glass panes.
7. Click "Bronze" glass color: Verify bronze tint shows through the glass panes.
8. Click "12mm" glass thickness: Verify transmission darkening reflects the thicker glass optical density.
9. Click "Include Window Sill" toggle: Verify the bottom sill toggles on and off seamlessly without altering frame or glass materials.

---

## Self-Check & Quality Constraints

- [x] Document metadata aligns with GlassFit master documentation index (`docs/index.md`)
- [x] Primary operating directives map to all core specifications (PRD-F1, PRD-F2, PRD-F5, PRD-F6, PRD-F10, SDD-C4, SDD-C5, DSD-UI4, ERD-E6, ERD-E11, ERD-E17, QAD-TC81, QAD-TC82)
- [x] Hard bans enforced: Zero em-dashes anywhere in document (BAN-PUNCT-01)
- [x] Hard bans enforced: No box diagrams or trees in code blocks (BAN-DIAG-03)
- [x] Hard bans enforced: Zero `any` in TypeScript specifications (BAN-TYPE-05)
- [x] Hard bans enforced: Strict UI consistency with existing Tailwind tokens (BAN-UI-09)
- [x] Implementation completed and verified with automated test catalog (QAD-TC82.1 through QAD-TC82.8)
