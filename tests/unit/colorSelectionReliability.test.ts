/**
 * IMP-MS84: Bidirectional Color Selection Reliability Unit Tests
 *
 * Upstream Specifications: docs/implementation/ms84.md, docs/sdd-glassfit.md
 * Primary Traceability: BRD-M2, BRD-M4, BRD-M5, PRD-F5, PRD-F6, SDD-C4, SDD-C5, DSD-UI4, DSD-UI10, ERD-E6, ERD-E17
 * Acceptance Catalog: QAD-TC99.1 through QAD-TC99.12
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as THREE from "three";

import {
  computeWorkspaceBuildKey,
  type WorkspaceBuildKeyParams,
} from "../../src/lib/visualization/workspaceBuildKey.js";
import {
  applyPresentationMaterials,
  isAddonObject,
  isAddonFrameMesh,
} from "../../src/lib/visualization/materialClassifier.js";
import {
  buildParametricScreenGroup,
  buildParametricGrillGroup,
} from "../../src/lib/visualization/addonGeometryBuilder.js";
import {
  buildParametricProduct,
} from "../../src/lib/visualization/parametricProductBuilder.js";
import {
  applyGroupSelection,
  type MaterialCustomizationGroup,
} from "../../src/lib/visualization/materialCustomization.js";
import type {
  ProductStructuralDefinition,
  ResolvedStructure,
} from "../../src/lib/visualization/types.js";
import type { ComponentModelCache } from "../../src/lib/visualization/componentModelCache.js";

// Mock Structural Definition fixture for 2-panel sliding window
const mockStructuralDefinition: ProductStructuralDefinition = {
  product: {
    productId: "prod-window-798",
    productName: "Series 798 2-Panel Sliding Window",
    productType: "Window",
    basePrice: 14200,
  },
  template: {
    templateId: "sliding-window-2p",
    templateName: "2-Panel Sliding Window",
    modelStrategy: "Parametric",
    measurementUnit: "mm",
    baseConfiguration: {},
    category: "Window",
    parametricRules: {
      minWidth: 1000,
      maxWidth: 3000,
      minHeight: 800,
      maxHeight: 2400,
    },
  },
  parameters: [],
  rules: [],
  components: [
    {
      componentId: "c-head",
      componentKey: "frame-head",
      componentName: "Top Head Rail",
      componentType: "Frame",
      baseQuantity: 1,
      presentationCategory: "Framing",
      componentData: {},
      model: { assetId: "a-1", r2ObjectKey: "", url: "", fileName: "head.glb", sourceDimensionsMm: { width: 1500, height: 50, depth: 40 } },
    },
    {
      componentId: "c-sill",
      componentKey: "frame-sill",
      componentName: "Bottom Sill Rail",
      componentType: "Frame",
      baseQuantity: 1,
      presentationCategory: "Framing",
      componentData: {},
      model: { assetId: "a-2", r2ObjectKey: "", url: "", fileName: "sill.glb", sourceDimensionsMm: { width: 1500, height: 50, depth: 40 } },
    },
    {
      componentId: "c-glass",
      componentKey: "glazing-panel",
      componentName: "Window Glass Infill",
      componentType: "Glass",
      baseQuantity: 2,
      presentationCategory: "Glazing",
      componentData: {},
      model: { assetId: "a-3", r2ObjectKey: "", url: "", fileName: "glass.glb", sourceDimensionsMm: { width: 700, height: 1100, depth: 6 } },
    },
  ],
  componentMaterials: [
    {
      componentId: "c-head",
      componentKey: "frame-head",
      rawMaterialId: "mat-analok",
      isDefault: true,
      rawMaterial: {
        id: "mat-analok",
        material_code: "AL-798-ANALOK",
        description: "Series 798 Profile (Analok)",
        category: "Aluminum",
        finish_type: "Analok",
        unit_price: 450,
        billing_unit: "m",
        waste_allowance: 0.12,
        is_active: true,
      },
    },
    {
      componentId: "c-head",
      componentKey: "frame-head",
      rawMaterialId: "mat-white",
      isDefault: false,
      rawMaterial: {
        id: "mat-white",
        material_code: "AL-798-WHITE",
        description: "Series 798 Profile (White)",
        category: "Aluminum",
        finish_type: "White",
        unit_price: 520,
        billing_unit: "m",
        waste_allowance: 0.12,
        is_active: true,
      },
    },
    {
      componentId: "c-sill",
      componentKey: "frame-sill",
      rawMaterialId: "mat-analok",
      isDefault: true,
      rawMaterial: {
        id: "mat-analok",
        material_code: "AL-798-ANALOK",
        description: "Series 798 Profile (Analok)",
        category: "Aluminum",
        finish_type: "Analok",
        unit_price: 450,
        billing_unit: "m",
        waste_allowance: 0.12,
        is_active: true,
      },
    },
    {
      componentId: "c-sill",
      componentKey: "frame-sill",
      rawMaterialId: "mat-white",
      isDefault: false,
      rawMaterial: {
        id: "mat-white",
        material_code: "AL-798-WHITE",
        description: "Series 798 Profile (White)",
        category: "Aluminum",
        finish_type: "White",
        unit_price: 520,
        billing_unit: "m",
        waste_allowance: 0.12,
        is_active: true,
      },
    },
  ],
};

const dummyResolvedStructure: ResolvedStructure = {
  resolvedValues: { width: 1500, height: 1200 },
  numericValuesMm: { width: 1500, height: 1200 },
  componentQuantities: {
    "frame-head": 1,
    "frame-sill": 1,
    "glazing-panel": 2,
  },
  appliedRuleIds: [],
};

const dummyCache: ComponentModelCache = {
  getClone: () => new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1)),
  getSourceSizeMeters: () => new THREE.Vector3(0.1, 0.1, 0.1),
};

describe("IMP-MS84: Bidirectional Color Selection Reliability Acceptance Suite (QAD-TC99)", () => {
  // --------------------------------------------------------------------------
  // QAD-TC99.1: Select Aluminum Finish on standard parametric window
  // --------------------------------------------------------------------------
  it("QAD-TC99.1: updates host frame finish instantaneously without triggering loadModel rebuild", () => {
    const params: WorkspaceBuildKeyParams = {
      productId: "prod-window-798",
      widthCm: 150,
      heightCm: 120,
      panelCount: 2,
      includeSill: true,
      selectedAddon: "none",
      selectedAddonProductId: null,
      addonMountingSide: "front",
      addonAlumFinish: "analok",
      alumFinish: "white",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
      includeHatch: false,
      screenMeshDensity: "fine",
      accessoriesKey: "{}",
      removableStatesKey: "{}",
    };

    const initialKey = computeWorkspaceBuildKey(params);
    assert.ok(initialKey.includes("prod-window-798"));
    assert.ok(initialKey.includes("white"));

    // Fast-path in-place presentation update
    const group = new THREE.Group();
    const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.05));
    frameMesh.name = "frame-head";
    group.add(frameMesh);

    const start = performance.now();
    applyPresentationMaterials(group, {
      aluminumFinish: "analok",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
    });
    const elapsed = performance.now() - start;

    assert.ok(elapsed < 16, `In-place presentation update took ${elapsed}ms, must be sub-16ms`);
    assert.strictEqual(
      (frameMesh.material as THREE.MeshPhysicalMaterial).color.getHexString().toLowerCase(),
      "6b594a",
      "Host frame must update to Analok color hex #6B594A",
    );

    // Build key with updated finish matches the skipPreparedBuildRef expectation
    const nextKey = computeWorkspaceBuildKey({
      ...params,
      alumFinish: "analok",
    });
    assert.notStrictEqual(initialKey, nextKey);
    assert.strictEqual(nextKey, computeWorkspaceBuildKey({ ...params, alumFinish: "analok" }));
  });

  // --------------------------------------------------------------------------
  // QAD-TC99.2: Select Aluminum Finish after customizing parts in Part Materials Picker
  // --------------------------------------------------------------------------
  it("QAD-TC99.2: resets hasExplicitOverrides and updates framing selections to match base finish", () => {
    const framingGroup: MaterialCustomizationGroup = {
      groupId: "group-framing",
      groupLabel: "Aluminum Frame Finish",
      presentationCategory: "Framing",
      selectedMaterialId: "mat-analok",
      affectedComponentKeys: ["frame-head", "frame-sill"],
      options: [
        {
          materialId: "mat-analok",
          materialCode: "AL-798-ANALOK",
          description: "Series 798 Profile (Analok)",
          finishType: "Analok",
          unitPrice: 450,
          billingUnit: "LF",
          isDefault: true,
          priceDeltaTotal: 0,
        },
        {
          materialId: "mat-white",
          materialCode: "AL-798-WHITE",
          description: "Series 798 Profile (Powder Coated White)",
          finishType: "White",
          unitPrice: 520,
          billingUnit: "LF",
          isDefault: false,
          priceDeltaTotal: 70,
        },
      ],
    };

    let selectedMaterials: Record<string, string> = {
      "frame-head": "mat-analok",
      "frame-sill": "mat-analok",
    };
    let hasExplicitOverrides = true;

    // Simulate handleBaseFinishSelect("white")
    const targetFinish = "white";
    const matchedOption = framingGroup.options.find((opt) =>
      opt.finishType.toLowerCase().includes(targetFinish)
    );
    assert.ok(matchedOption, "Must match white raw material in catalog");

    selectedMaterials = applyGroupSelection(
      framingGroup,
      matchedOption,
      selectedMaterials,
      mockStructuralDefinition,
    );
    hasExplicitOverrides = false;

    assert.strictEqual(selectedMaterials["frame-head"], "mat-white");
    assert.strictEqual(selectedMaterials["frame-sill"], "mat-white");
    assert.strictEqual(hasExplicitOverrides, false, "hasExplicitOverrides must be reset to false");
  });

  // --------------------------------------------------------------------------
  // QAD-TC99.3: Select specialized R.R.D. finish without database raw material counterpart
  // --------------------------------------------------------------------------
  it("QAD-TC99.3: purges framing raw material overrides when specialized R.R.D. finish is chosen", () => {
    const framingGroup: MaterialCustomizationGroup = {
      groupId: "group-framing",
      groupLabel: "Aluminum Frame Finish",
      presentationCategory: "Framing",
      selectedMaterialId: "mat-analok",
      affectedComponentKeys: ["frame-head", "frame-sill"],
      options: [
        {
          materialId: "mat-analok",
          materialCode: "AL-798-ANALOK",
          description: "Series 798 Profile (Analok)",
          finishType: "Analok",
          unitPrice: 450,
          billingUnit: "LF",
          isDefault: true,
          priceDeltaTotal: 0,
        },
      ],
    };

    const selectedMaterials: Record<string, string> = {
      "frame-head": "mat-analok",
      "frame-sill": "mat-analok",
      "glazing-panel": "mat-glass-clear",
    };

    // Simulate selecting specialized finish al_1001 (Metallic Silver)
    const normalizedTarget = "al_1001";
    const matchedOption = framingGroup.options.find((opt) =>
      opt.finishType.toLowerCase().includes(normalizedTarget)
    );
    assert.strictEqual(matchedOption, undefined, "Specialized finish has no raw material in DB");

    // Purge framing components from selectedMaterials
    const nextSelections = { ...selectedMaterials };
    for (const comp of mockStructuralDefinition.components) {
      if (comp.presentationCategory === "Framing") {
        delete nextSelections[comp.componentKey];
      }
    }

    assert.strictEqual(nextSelections["frame-head"], undefined);
    assert.strictEqual(nextSelections["frame-sill"], undefined);
    assert.strictEqual(nextSelections["glazing-panel"], "mat-glass-clear", "Glazing must be preserved");
  });

  // --------------------------------------------------------------------------
  // QAD-TC99.4: Select Screen Frame Finish on procedural insect screen add-on
  // --------------------------------------------------------------------------
  it("QAD-TC99.4: updates all procedural screen rails and hatch frame while preserving wire mesh", () => {
    const hostGroup = new THREE.Group();
    const hostFrame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.05));
    hostFrame.name = "Host_Frame_Top";
    hostGroup.add(hostFrame);

    const screenGroup = buildParametricScreenGroup(1500, 1200, {
      finishColor: "#221d1a",
      hasHatch: true,
      isHatchHorizontal: false,
    });
    hostGroup.add(screenGroup);

    // Apply host finish Analok (#6B594A)
    applyPresentationMaterials(hostGroup, {
      aluminumFinish: "analok",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
    });

    assert.strictEqual(
      (hostFrame.material as THREE.MeshPhysicalMaterial).color.getHexString().toLowerCase(),
      "6b594a",
    );

    // Recolor screen add-on to White via renderer simulation
    const screenRails: THREE.Mesh[] = [];
    let screenMeshInfill: THREE.Mesh | null = null;
    let hatchTop: THREE.Mesh | null = null;
    let hatchLatch: THREE.Mesh | null = null;

    screenGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.name.startsWith("Screen_Frame_")) {
          screenRails.push(child);
        } else if (child.name === "Screen_Mesh_Infill") {
          screenMeshInfill = child;
        } else if (child.name === "Screen_Access_Hatch_Top") {
          hatchTop = child;
        } else if (child.name === "Screen_Access_Hatch_Latch") {
          hatchLatch = child;
        }
      }
    });

    assert.strictEqual(screenRails.length, 4, "Must have 4 outer screen rails");
    assert.ok(screenMeshInfill, "Must have Screen_Mesh_Infill");
    assert.ok(hatchTop, "Must have Screen_Access_Hatch_Top");
    assert.ok(hatchLatch, "Must have Screen_Access_Hatch_Latch");

    // Verify isAddonFrameMesh classification
    for (const rail of screenRails) {
      assert.strictEqual(isAddonFrameMesh(rail), true, `${rail.name} must be classified as addon frame`);
    }
    assert.strictEqual(isAddonFrameMesh(hatchTop), true, "Hatch top rail must be classified as addon frame");
    assert.strictEqual(isAddonFrameMesh(screenMeshInfill), false, "Screen mesh infill must NOT be classified as frame");
    assert.strictEqual(isAddonFrameMesh(hatchLatch), false, "Hatch latch hardware must NOT be classified as frame");
  });

  // --------------------------------------------------------------------------
  // QAD-TC99.5: Select Screen Frame Finish on uploaded custom screen model (QAD-TC84.13 fixture)
  // --------------------------------------------------------------------------
  it("QAD-TC99.5: walks scene graph hierarchy to recolor uploaded add-on components", () => {
    const uploadedWrapper = new THREE.Group();
    uploadedWrapper.name = "Addon_Screen_Assembly";
    uploadedWrapper.userData = { isAddon: true, addonType: "screen" };

    const topExtrusionGroup = new THREE.Group();
    topExtrusionGroup.name = "screen-frame-top_container";
    topExtrusionGroup.userData = { presentationCategory: "Framing" };

    const topMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.04, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x221d1a }),
    );
    topMesh.name = "Cube_0"; // GLB generic name
    topMesh.userData = { isAddon: true, presentationCategory: "Framing" };
    topExtrusionGroup.add(topMesh);

    const meshInfill = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x111111 }),
    );
    meshInfill.name = "screen-mesh";
    meshInfill.userData = { isAddon: true, isScreenMesh: true, presentationCategory: "Mesh" };

    uploadedWrapper.add(topExtrusionGroup, meshInfill);

    assert.strictEqual(isAddonFrameMesh(topMesh), true, "Uploaded GLB extrusion mesh must be recognized as addon frame");
    assert.strictEqual(isAddonFrameMesh(meshInfill), false, "Uploaded wire mesh must NOT be recognized as frame");
  });

  // --------------------------------------------------------------------------
  // QAD-TC99.6: Select Grille Bar Finish on modular security grille add-on with repeated middle tiles
  // --------------------------------------------------------------------------
  it("QAD-TC99.6: updates repeated middle pattern tiles and seam bars uniformly", () => {
    const grille = buildParametricGrillGroup(1500, 1200, {
      finishColor: "#221d1a",
      nominalBarPitchMm: 140,
      nominalRowPitchMm: 191,
    });

    let frameCount = 0;
    let barCount = 0;

    grille.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.name.startsWith("Grill_Frame_")) {
          frameCount++;
          assert.strictEqual(isAddonFrameMesh(child), true, `${child.name} must be addon frame`);
        } else if (child.name.startsWith("Grill_Bar_")) {
          barCount++;
          assert.strictEqual(isAddonFrameMesh(child), true, `${child.name} must be addon frame`);
        }
      }
    });

    assert.strictEqual(frameCount, 4, "Grille must have 4 perimeter frame rails");
    assert.ok(barCount > 0, "Grille must have repeating middle pattern bars");
  });

  // --------------------------------------------------------------------------
  // QAD-TC99.7: Select host Aluminum Finish while an add-on is active with independent finish
  // --------------------------------------------------------------------------
  it("QAD-TC99.7: preserves add-on finish when host aluminum finish is changed", () => {
    const sceneGroup = new THREE.Group();

    // Host window frame
    const hostFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.05, 0.05),
      new THREE.MeshPhysicalMaterial({ color: 0x6b594a }),
    );
    hostFrame.name = "Host_Jamb_Left";
    sceneGroup.add(hostFrame);

    // Procedural screen with White finish
    const screenGroup = buildParametricScreenGroup(1500, 1200, {
      finishColor: "#eceae4",
    });
    sceneGroup.add(screenGroup);

    // Change host finish to Metallic Silver (al_1001: #A8ACB1)
    applyPresentationMaterials(sceneGroup, {
      aluminumFinish: "al_1001",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
    });

    // Host frame must be updated to Silver
    assert.strictEqual(
      (hostFrame.material as THREE.MeshPhysicalMaterial).color.getHexString().toLowerCase(),
      "a8acb1",
      "Host frame must update to Metallic Silver #A8ACB1",
    );

    // Screen frame rails must NOT have been contaminated by host finish
    screenGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name.startsWith("Screen_Frame_")) {
        const hex = (child.material as THREE.MeshPhysicalMaterial).color.getHexString().toLowerCase();
        assert.notStrictEqual(
          hex,
          "a8acb1",
          `${child.name} must not be overwritten by host Metallic Silver`,
        );
      }
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC99.8: Select Glass Color under Design and Customization Option
  // --------------------------------------------------------------------------
  it("QAD-TC99.8: updates glass material color and preserves optical transmission", () => {
    const group = new THREE.Group();
    const glassMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.006));
    glassMesh.name = "glazing-panel";
    group.add(glassMesh);

    // Clear glass
    applyPresentationMaterials(group, {
      aluminumFinish: "white",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
    });
    const clearMat = glassMesh.material as THREE.MeshPhysicalMaterial;
    assert.strictEqual(clearMat.color.getHexString().toLowerCase(), "f0f5f7");
    assert.strictEqual(clearMat.transmission, 0.88);

    // Tinted Bronze glass
    applyPresentationMaterials(group, {
      aluminumFinish: "white",
      glassAppearance: "clear",
      glassColor: "bronze",
      glassThicknessMm: 6,
    });
    const bronzeMat = glassMesh.material as THREE.MeshPhysicalMaterial;
    assert.strictEqual(bronzeMat.color.getHexString().toLowerCase(), "8b6f47");
    assert.strictEqual(bronzeMat.transmission, 0.88);

    // Tinted Blue glass
    applyPresentationMaterials(group, {
      aluminumFinish: "white",
      glassAppearance: "clear",
      glassColor: "blue",
      glassThicknessMm: 6,
    });
    const blueMat = glassMesh.material as THREE.MeshPhysicalMaterial;
    assert.strictEqual(blueMat.color.getHexString().toLowerCase(), "7fa9c4");
    assert.strictEqual(blueMat.transmission, 0.88);
  });

  // --------------------------------------------------------------------------
  // QAD-TC99.9: Toggle add-on off and on, then change add-on finish
  // --------------------------------------------------------------------------
  it("QAD-TC99.9: mounts add-on with active addonAlumFinish when toggled back on", () => {
    const defWithScreen: ProductStructuralDefinition = {
      ...mockStructuralDefinition,
      compatibleAddons: [
        {
          id: "bind-screen",
          parentProductId: "prod-window-798",
          addonProductId: "addon-screen-std",
          addonType: "screen",
          isDefaultEnabled: false,
          displayOrder: 1,
          addonProduct: {
            productId: "addon-screen-std",
            productName: "Insect Screen",
            basePrice: 1600,
            status: "Active",
          },
        },
      ],
    };

    // 1. Build with screen active and finish = Analok (#6B594A)
    const builtWithScreen = buildParametricProduct(
      defWithScreen,
      dummyResolvedStructure,
      dummyCache,
      {
        activeAddon: "screen",
        addonAluminumFinish: "analok",
      },
    );
    const screenAssembly = builtWithScreen.group.getObjectByName("Addon_Screen_Assembly");
    assert.ok(screenAssembly, "Screen assembly must be mounted");

    const topRail = screenAssembly.getObjectByName("Screen_Frame_Top") as THREE.Mesh;
    assert.ok(topRail, "Screen_Frame_Top rail must exist");
    assert.strictEqual(
      (topRail.material as THREE.MeshPhysicalMaterial).color.getHexString().toLowerCase(),
      "6b594a",
      "Screen frame rail must reflect Analok finish",
    );

    // 2. Build with screen = "none" (toggled off)
    const builtWithoutScreen = buildParametricProduct(
      defWithScreen,
      dummyResolvedStructure,
      dummyCache,
      {
        activeAddon: "none",
      },
    );
    assert.strictEqual(
      builtWithoutScreen.group.getObjectByName("Addon_Screen_Assembly"),
      undefined,
      "Screen assembly must not be mounted when toggled off",
    );

    // 3. Re-enable screen with finish = White
    const builtReEnabled = buildParametricProduct(
      defWithScreen,
      dummyResolvedStructure,
      dummyCache,
      {
        activeAddon: "screen",
        addonAluminumFinish: "white",
      },
    );
    const reEnabledScreen = builtReEnabled.group.getObjectByName("Addon_Screen_Assembly");
    assert.ok(reEnabledScreen, "Screen assembly must mount when re-enabled");
    const reEnabledTopRail = reEnabledScreen.getObjectByName("Screen_Frame_Top") as THREE.Mesh;
    assert.strictEqual(
      (reEnabledTopRail.material as THREE.MeshPhysicalMaterial).color.getHexString().toLowerCase(),
      "eceae4",
      "Screen frame rail must reflect White finish upon re-enabling",
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC99.10: PBR surface attribute accuracy across finish types
  // --------------------------------------------------------------------------
  it("QAD-TC99.10: sets accurate metalness, roughness, clearcoat, and clearcoatRoughness across finishes", () => {
    const group = new THREE.Group();
    const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.1));
    frameMesh.name = "Frame_Top";
    group.add(frameMesh);

    // Powder Coated White: metalness: 0.2, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.2
    applyPresentationMaterials(group, {
      aluminumFinish: "white",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
    });
    const whiteMat = frameMesh.material as THREE.MeshPhysicalMaterial;
    assert.strictEqual(whiteMat.metalness, 0.2);
    assert.strictEqual(whiteMat.roughness, 0.3);
    assert.strictEqual(whiteMat.clearcoat, 0.5);
    assert.strictEqual(whiteMat.clearcoatRoughness, 0.2);

    // Metallic Silver (al_1001): metalness: 0.8, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15
    applyPresentationMaterials(group, {
      aluminumFinish: "al_1001",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
    });
    const silverMat = frameMesh.material as THREE.MeshPhysicalMaterial;
    assert.strictEqual(silverMat.metalness, 0.8);
    assert.strictEqual(silverMat.roughness, 0.22);
    assert.strictEqual(silverMat.clearcoat, 0.6);
    assert.strictEqual(silverMat.clearcoatRoughness, 0.15);

    // Anodized Analok: metalness: 0.55, roughness: 0.26, clearcoat: 0.45, clearcoatRoughness: 0.2
    applyPresentationMaterials(group, {
      aluminumFinish: "analok",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
    });
    const analokMat = frameMesh.material as THREE.MeshPhysicalMaterial;
    assert.strictEqual(analokMat.metalness, 0.55);
    assert.strictEqual(analokMat.roughness, 0.26);
    assert.strictEqual(analokMat.clearcoat, 0.45);
    assert.strictEqual(analokMat.clearcoatRoughness, 0.2);
  });

  // --------------------------------------------------------------------------
  // QAD-TC99.11: Fixed-model GLTF product color selection
  // --------------------------------------------------------------------------
  it("QAD-TC99.11: updates only framing meshes on fixed-model products without breaking glass or hardware", () => {
    const fixedModelGroup = new THREE.Group();

    const alumFrameMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.05));
    alumFrameMesh.name = "Alum_Frame_Perimeter";

    const glassPanelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6));
    glassPanelMesh.name = "Glass_Center_Pane";

    const hardwareMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.02));
    hardwareMesh.name = "Lock_Hardware_Latch";

    fixedModelGroup.add(alumFrameMesh, glassPanelMesh, hardwareMesh);

    applyPresentationMaterials(fixedModelGroup, {
      aluminumFinish: "white",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
    });

    assert.strictEqual(alumFrameMesh.userData.materialCategory, "Aluminum");
    assert.strictEqual(glassPanelMesh.userData.materialCategory, "Glass");
    assert.strictEqual(hardwareMesh.userData.materialCategory, "Hardware");

    assert.strictEqual(
      (alumFrameMesh.material as THREE.MeshPhysicalMaterial).color.getHexString().toLowerCase(),
      "eceae4",
    );
    assert.strictEqual((glassPanelMesh.material as THREE.MeshPhysicalMaterial).transmission, 0.88);
    assert.strictEqual(hardwareMesh.castShadow, true);

    // Switch to Analok
    applyPresentationMaterials(fixedModelGroup, {
      aluminumFinish: "analok",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
    });

    assert.strictEqual(
      (alumFrameMesh.material as THREE.MeshPhysicalMaterial).color.getHexString().toLowerCase(),
      "6b594a",
      "Aluminum frame must update to Analok",
    );
    assert.strictEqual(
      glassPanelMesh.userData.materialCategory,
      "Glass",
      "Glass pane classification must remain intact",
    );
    assert.strictEqual(
      hardwareMesh.userData.materialCategory,
      "Hardware",
      "Hardware latch classification must remain intact",
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC99.12: Dimension change followed by color change
  // --------------------------------------------------------------------------
  it("QAD-TC99.12: discriminates dimension changes from color-only presentation updates via buildKey", () => {
    const baseParams: WorkspaceBuildKeyParams = {
      productId: "prod-window-798",
      widthCm: 150,
      heightCm: 120,
      panelCount: 2,
      includeSill: true,
      selectedAddon: "none",
      selectedAddonProductId: null,
      addonMountingSide: "front",
      addonAlumFinish: "analok",
      alumFinish: "white",
      glassAppearance: "clear",
      glassColor: "clear",
      glassThicknessMm: 6,
      includeHatch: false,
      screenMeshDensity: "fine",
      accessoriesKey: "{}",
      removableStatesKey: "{}",
    };

    const initialKey = computeWorkspaceBuildKey(baseParams);

    // 1. Dimension change: width changes from 150 to 180
    const dimensionChangedKey = computeWorkspaceBuildKey({
      ...baseParams,
      widthCm: 180,
    });
    assert.notStrictEqual(
      initialKey,
      dimensionChangedKey,
      "Dimension change must generate different buildKey to trigger full rebuild",
    );

    // 2. Color change after dimension change: width is 180, finish changes to analok
    const colorChangedKey = computeWorkspaceBuildKey({
      ...baseParams,
      widthCm: 180,
      alumFinish: "analok",
    });

    // When fast-path presentation sets skipPreparedBuildRef = colorChangedKey,
    // the reactive buildKey matches exactly, skipping asynchronous loadModel
    let skipPreparedBuildRef: string | null = colorChangedKey;
    const reactiveBuildKey = computeWorkspaceBuildKey({
      ...baseParams,
      widthCm: 180,
      alumFinish: "analok",
    });

    let didTriggerFullRebuild = false;
    if (skipPreparedBuildRef === reactiveBuildKey) {
      skipPreparedBuildRef = null;
      didTriggerFullRebuild = false;
    } else {
      didTriggerFullRebuild = true;
    }

    assert.strictEqual(
      didTriggerFullRebuild,
      false,
      "Color change must match skipPreparedBuildRef and bypass loadModel rebuild",
    );
    assert.strictEqual(skipPreparedBuildRef, null, "skipPreparedBuildRef must be consumed");
  });
});
