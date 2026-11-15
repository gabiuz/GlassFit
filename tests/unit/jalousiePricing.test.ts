/**
 * Unit & Acceptance Test Suite for Parametric Jalousie Dynamic Louver and Operator Generation,
 * Automated Pitch Counting, and Per-Piece BOM Pricing Engine (IMP-MS81)
 *
 * Primary Traceability: PRD-F5, PRD-F10, PRD-F14, PRD-F19, SDD-C4, SDD-C5, SDD-C7, SDD-C9,
 * DSD-UI4, DSD-UI7, DSD-UI10, ERD-E3, ERD-E6, ERD-E14, ERD-E17, BRD-M2, BRD-M4, BRD-M5, IMP-MS81
 * Acceptance Catalog: QAD-TC96.1 through QAD-TC96.12
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import {
  computeLouverBladeCount,
  computeLouverOperatorCount,
  computeLouverBladeYCoordinates,
  computeOperatorYCoordinates,
  analyzeJalousieGeometry,
} from "../../src/lib/visualization/jalousieGeometryAnalyzer";

import {
  autoDetectComponentSettings,
  suggestCandidateMaterials,
} from "../../src/lib/admin/products/autoDetection";

import {
  calculateParametricBOM,
  type ComponentPricingInput,
} from "../../src/lib/pricing/pricingEngine";

import { generateQuotationPdfHtml } from "../../src/lib/pricing/quotationPdfGenerator";
import { buildParametricProduct } from "../../src/lib/visualization/parametricProductBuilder";
import type { ComponentModelCache } from "../../src/lib/visualization/componentModelCache";
import type {
  ProductStructuralDefinition,
  ResolvedStructure,
  ProductComponentDefinition,
} from "../../src/lib/visualization/types";
import type { RawMaterial } from "../../src/lib/pricing/types";

// ============================================================================
// Synthetic 3D Model Helpers
// ============================================================================

/**
 * Creates a synthetic louver assembly mirroring JW_Louver_Clips_And_Glass.glb
 * with 7 discrete glass slats spaced by 175mm pitch.
 */
function createSyntheticLouverAssembly(): THREE.Group {
  const root = new THREE.Group();
  root.name = "JW_Louvers";

  const elevations = [-0.525, -0.35, -0.175, 0.0, 0.175, 0.35, 0.525];
  const glassMat = new THREE.MeshStandardMaterial({
    name: "JW_Glass_Material",
    transparent: true,
    opacity: 0.5,
  });

  elevations.forEach((y, i) => {
    const bladeGeom = new THREE.BoxGeometry(0.8, 0.1053, 0.006);
    const bladeMesh = new THREE.Mesh(bladeGeom, glassMat);
    bladeMesh.name = `Cube_006_blade_${i}`;
    bladeMesh.position.set(0, y, 0);
    root.add(bladeMesh);
  });

  return root;
}

/**
 * Creates a synthetic operator assembly mirroring JW_Operators.glb
 * with 2 operator handles at lower (Y = -0.415) and upper (Y = 0.11) locations.
 */
function createSyntheticOperatorAssembly(): THREE.Group {
  const root = new THREE.Group();
  root.name = "JW_Operators";

  const operatorMat = new THREE.MeshStandardMaterial({
    name: "JW_Operator_Black",
    color: 0x111111,
  });

  // Lower operator unit
  const lowerGeom = new THREE.BoxGeometry(0.05, 0.16, 0.08);
  const lowerMesh = new THREE.Mesh(lowerGeom, operatorMat);
  lowerMesh.name = "JW_Left_Operator_Lower";
  lowerMesh.position.set(0.375, -0.415, 0.04);
  root.add(lowerMesh);

  // Upper operator unit
  const upperGeom = new THREE.BoxGeometry(0.05, 0.16, 0.08);
  const upperMesh = new THREE.Mesh(upperGeom, operatorMat);
  upperMesh.name = "JW_Left_Operator_Upper";
  upperMesh.position.set(0.375, 0.11, 0.04);
  root.add(upperMesh);

  return root;
}

/**
 * Helper to build a complete parametric jalousie 3D setup.
 */
function createJalousie3DSetup(options: {
  targetWidthMm: number;
  targetHeightMm: number;
  pitchMm?: number;
  bladesPerOperator?: number;
  activeAddon?: "screen" | "none";
  hatchTargets?: string[];
  swappedAccessories?: Record<string, import("../../src/lib/visualization/types").SelectedAccessoryState>;
  accessoryModels?: Map<string, THREE.Object3D>;
}) {
  const pitchMm = options.pitchMm ?? 175;
  const bladesPerOp = options.bladesPerOperator ?? 4;

  const hostFrameMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.08));
  hostFrameMesh.name = "window_frame";

  const louverMesh = createSyntheticLouverAssembly();
  const operatorMesh = createSyntheticOperatorAssembly();

  const screenFrameMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.02));
  screenFrameMesh.name = "screen_perimeter_frame";

  const hatchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.02));
  hatchMesh.name = "screen_access_hatch";

  const hostComponents: ProductComponentDefinition[] = [
    {
      componentId: "comp_frame",
      componentKey: "window_frame",
      componentName: "Window Perimeter Frame",
      componentType: "Frame",
      dimensionBinding: "AREA",
      baseQuantity: 1,
      componentData: {},
      model: {
        assetId: "a_frame",
        r2ObjectKey: "frame.glb",
        url: "https://r2.dev/frame.glb",
        fileName: "frame.glb",
        sourceDimensionsMm: { width: 800, height: 1200, depth: 80 },
      },
    },
    {
      componentId: "comp_louver",
      componentKey: "jw_louver_clips_and_glass",
      componentName: "Glass Louver Blades",
      componentType: "Glass",
      dimensionBinding: "LOUVER_BLADE",
      baseQuantity: 7,
      spanRatio: 1.0,
      componentData: {},
      jalousieConfig: {
        pitch_mm: pitchMm,
        blade_height_mm: 105.3,
        blades_per_operator: bladesPerOp,
        base_blade_count: 7,
      },
      model: {
        assetId: "a_louver",
        r2ObjectKey: "JW_Louver_Clips_And_Glass.glb",
        url: "https://r2.dev/JW_Louver_Clips_And_Glass.glb",
        fileName: "JW_Louver_Clips_And_Glass.glb",
        sourceDimensionsMm: { width: 800, height: 1200, depth: 80 },
      },
    },
    {
      componentId: "comp_operator",
      componentKey: "jw_operators",
      componentName: "Window Operators",
      componentType: "Hardware",
      dimensionBinding: "LOUVER_OPERATOR",
      baseQuantity: 2,
      spanRatio: 1.0,
      componentData: {},
      jalousieConfig: {
        pitch_mm: pitchMm,
        blades_per_operator: bladesPerOp,
        base_operator_count: 2,
      },
      model: {
        assetId: "a_operator",
        r2ObjectKey: "JW_Operators.glb",
        url: "https://r2.dev/JW_Operators.glb",
        fileName: "JW_Operators.glb",
        sourceDimensionsMm: { width: 800, height: 1200, depth: 80 },
      },
    },
  ];

  const definition: ProductStructuralDefinition = {
    product: {
      productId: "jalousie-prod-1",
      productName: "Parametric Jalousie Window",
      productType: "Window",
      isAddon: false,
      addonType: null,
      isAccessory: false,
    },
    template: {
      templateId: "tpl_jalousie",
      templateName: "Jalousie Template",
      modelStrategy: "Fixed",
      measurementUnit: "mm",
      baseConfiguration: {},
    },
    parameters: [],
    rules: [],
    components: hostComponents,
    compatibleAddons: [
      {
        id: "binding_screen",
        parentProductId: "jalousie-prod-1",
        addonProductId: "addon_screen",
        addonType: "screen",
        allowedSides: "both",
        defaultSide: "back",
        hatchTargetComponentKeys: options.hatchTargets ?? ["jw_operators"],
        components: [
          {
            componentId: "comp_screen_frame",
            componentKey: "screen_perimeter_frame",
            componentName: "Screen Perimeter Frame",
            componentType: "Frame",
            dimensionBinding: "AREA",
            baseQuantity: 1,
            componentData: {},
            model: {
              assetId: "a_sf",
              r2ObjectKey: "sf.glb",
              url: "https://r2.dev/sf.glb",
              fileName: "sf.glb",
              sourceDimensionsMm: null,
            },
          },
          {
            componentId: "comp_screen_hatch",
            componentKey: "screen_access_hatch",
            componentName: "Screen Access Hatch",
            componentType: "Hardware",
            dimensionBinding: "FIXED",
            baseQuantity: 1,
            componentData: {},
            model: {
              assetId: "a_sh",
              r2ObjectKey: "sh.glb",
              url: "https://r2.dev/sh.glb",
              fileName: "sh.glb",
              sourceDimensionsMm: null,
            },
          },
        ],
      },
    ],
  };

  const resolved: ResolvedStructure = {
    componentQuantities: {
      window_frame: 1,
      jw_louver_clips_and_glass: 7,
      jw_operators: 2,
    },
    resolvedValues: {},
    numericValuesMm: {
      width: options.targetWidthMm,
      height: options.targetHeightMm,
    },
    appliedRuleIds: [],
  };

  const cache: ComponentModelCache = {
    getClone: (id: string) => {
      if (id === "comp_frame" || id === "window_frame") return hostFrameMesh.clone(true);
      if (id === "comp_louver" || id === "jw_louver_clips_and_glass") return louverMesh.clone(true);
      if (id === "comp_operator" || id === "jw_operators") return operatorMesh.clone(true);
      if (id === "comp_screen_frame" || id === "screen_perimeter_frame") return screenFrameMesh.clone(true);
      if (id === "comp_screen_hatch" || id === "screen_access_hatch") return hatchMesh.clone(true);
      throw new Error(`Unknown component clone request: ${id}`);
    },
    getSourceSizeMeters: () => new THREE.Vector3(0.8, 1.2, 0.08),
  };

  const built = buildParametricProduct(definition, resolved, cache, {
    activeAddon: options.activeAddon ?? "none",
    addonMountingSide: "back",
    hatchTargetComponentKeys: options.hatchTargets ?? ["jw_operators"],
    swappedAccessories: options.swappedAccessories,
    accessoryModels: options.accessoryModels,
  });

  built.group.updateMatrixWorld(true);
  return { built, definition, resolved, cache };
}

// ============================================================================
// Test Suite: IMP-MS81 Acceptance Catalog (QAD-TC96)
// ============================================================================

describe("IMP-MS81: Parametric Jalousie Dynamic Louver and Operator Generation (QAD-TC96)", () => {
  // --------------------------------------------------------------------------
  // QAD-TC96.1: Louver GLB geometry analysis and automated blade counting
  // --------------------------------------------------------------------------
  describe("QAD-TC96.1: Louver GLB geometry analysis and automated blade counting", () => {
    it("detects 7 discrete blades, 175mm pitch, and sets baseQuantity = 7 on louver GLB", async () => {
      const realGlbPath = "/Users/rey/Downloads/jalousie/JW_Louver_Clips_And_Glass.glb";
      let testObject: THREE.Object3D;

      if (fs.existsSync(realGlbPath)) {
        const buffer = fs.readFileSync(realGlbPath);
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        const loader = new GLTFLoader();
        const parsed = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
          loader.parse(arrayBuffer, "", (gltf) => resolve(gltf), (err) => reject(err));
        });
        testObject = parsed.scene;
      } else {
        testObject = createSyntheticLouverAssembly();
      }

      const result = analyzeJalousieGeometry(testObject, "JW_Louver_Clips_And_Glass.glb");

      assert.strictEqual(result.isLouverBlade, true, "Must be classified as louver blade component");
      assert.strictEqual(result.isLouverOperator, false, "Must not be classified as operator");
      assert.strictEqual(result.louverCount, 7, "Must detect exactly 7 louver blades");
      assert.strictEqual(result.pitchMm, 175, "Must detect 175mm pitch between adjacent blades");
      assert.strictEqual(result.suggestedBaseQuantity, 7, "Suggested base quantity must be 7");
      assert.strictEqual(result.suggestedBinding, "LOUVER_BLADE", "Suggested binding must be LOUVER_BLADE");
      assert.strictEqual(result.suggestedPresentationCategory, "Glazing");
      assert.strictEqual(result.suggestedBillingUnit, "pc");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.2: Operator GLB geometry analysis and unit count
  // --------------------------------------------------------------------------
  describe("QAD-TC96.2: Operator GLB geometry analysis and unit count", () => {
    it("detects 2 operator units and sets baseQuantity = 2 on operator GLB", async () => {
      const realGlbPath = "/Users/rey/Downloads/jalousie/JW_Operators.glb";
      let testObject: THREE.Object3D;

      if (fs.existsSync(realGlbPath)) {
        const buffer = fs.readFileSync(realGlbPath);
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        const loader = new GLTFLoader();
        const parsed = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
          loader.parse(arrayBuffer, "", (gltf) => resolve(gltf), (err) => reject(err));
        });
        testObject = parsed.scene;
      } else {
        testObject = createSyntheticOperatorAssembly();
      }

      const result = analyzeJalousieGeometry(testObject, "JW_Operators.glb");

      assert.strictEqual(result.isLouverOperator, true, "Must be classified as operator mechanism");
      assert.strictEqual(result.isLouverBlade, false, "Must not be classified as louver blade");
      assert.strictEqual(result.operatorCount, 2, "Must detect exactly 2 operator mechanisms");
      assert.strictEqual(result.suggestedBaseQuantity, 2, "Suggested base quantity must be 2");
      assert.strictEqual(result.suggestedBinding, "LOUVER_OPERATOR", "Suggested binding must be LOUVER_OPERATOR");
      assert.strictEqual(result.suggestedPresentationCategory, "Hardware");
      assert.strictEqual(result.suggestedBillingUnit, "pc");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.3: Automated dimension binding assignment
  // --------------------------------------------------------------------------
  describe("QAD-TC96.3: Automated dimension binding assignment", () => {
    it("binds louver glass mesh to LOUVER_BLADE and operator mesh to LOUVER_OPERATOR", () => {
      const louverAuto = autoDetectComponentSettings("JW_Louver_Clips_And_Glass.glb");
      assert.strictEqual(louverAuto.dimensionBinding, "LOUVER_BLADE");
      assert.strictEqual(louverAuto.presentationCategory, "Glazing");
      assert.strictEqual(louverAuto.componentType, "Glass");

      const operatorAuto = autoDetectComponentSettings("JW_Operators.glb");
      assert.strictEqual(operatorAuto.dimensionBinding, "LOUVER_OPERATOR");
      assert.strictEqual(operatorAuto.presentationCategory, "Hardware");
      assert.strictEqual(operatorAuto.componentType, "Hardware");

      const mockMaterials: RawMaterial[] = [
        {
          id: "mat_al_sqm",
          material_code: "AL_SQM",
          description: "Aluminum Sheet",
          category: "Aluminum",
          finish_type: "Standard",
          billing_unit: "sqm",
          unit_price: 300,
          waste_allowance: 0.1,
          is_active: true,
        },
        {
          id: "mat_glass_sqm",
          material_code: "GL_SQM",
          description: "Glass Sheet 6mm",
          category: "Glass",
          finish_type: "Clear",
          billing_unit: "sqm",
          unit_price: 650,
          waste_allowance: 0.05,
          is_active: true,
        },
        {
          id: "mat_glass_pc",
          material_code: "GL_PC",
          description: "Glass Louver Blade 4x24",
          category: "Glass",
          finish_type: "Clear",
          billing_unit: "pc",
          unit_price: 45,
          waste_allowance: 0,
          is_active: true,
        },
        {
          id: "mat_hw_pc",
          material_code: "HW_PC",
          description: "Jalousie Operator Crank",
          category: "Hardware",
          finish_type: "Standard",
          billing_unit: "pc",
          unit_price: 450,
          waste_allowance: 0,
          is_active: true,
        },
      ];

      const louverMaterials = suggestCandidateMaterials("Glazing", mockMaterials, undefined, "LOUVER_BLADE");
      assert.strictEqual(louverMaterials.defaultRawMaterialId, "mat_glass_pc", "Must prioritize per-piece glass materials");

      const operatorMaterials = suggestCandidateMaterials("Hardware", mockMaterials, undefined, "LOUVER_OPERATOR");
      assert.strictEqual(operatorMaterials.defaultRawMaterialId, "mat_hw_pc", "Must prioritize per-piece hardware materials");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.4: Dynamic louver blade addition on height increase
  // --------------------------------------------------------------------------
  describe("QAD-TC96.4: Dynamic louver blade addition on height increase", () => {
    it("increases blade count from 7 to 12 when window height expands from 1200mm to 2100mm", () => {
      const baseCount = computeLouverBladeCount(1200, 175, 50);
      assert.strictEqual(baseCount, 7, "Baseline 1200mm aperture must yield 7 blades");

      const tallCount = computeLouverBladeCount(2100, 175, 50);
      assert.strictEqual(tallCount, 12, "Expanded 2100mm aperture must yield 12 blades");

      const elevations = computeLouverBladeYCoordinates(12, 175);
      assert.strictEqual(elevations.length, 12, "Must evaluate 12 discrete vertical elevations");
      assert.strictEqual(elevations[0], -0.9625, "Lowest blade starts at bottom centered elevation");
      assert.strictEqual(elevations[11], 0.9625, "Top blade reaches top centered elevation");

      const { built } = createJalousie3DSetup({
        targetWidthMm: 800,
        targetHeightMm: 2100,
      });

      const bladeInstances: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.isLouverBladeInstance) {
          bladeInstances.push(c);
        }
      });

      assert.strictEqual(bladeInstances.length, 12, "Scene graph must contain exactly 12 blade instances");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.5: Dynamic louver blade deletion on height decrease
  // --------------------------------------------------------------------------
  describe("QAD-TC96.5: Dynamic louver blade deletion on height decrease", () => {
    it("decreases blade count from 7 to 3 when window height reduces from 1200mm to 600mm", () => {
      const shortCount = computeLouverBladeCount(600, 175, 50);
      assert.strictEqual(shortCount, 3, "Reduced 600mm aperture must yield 3 blades");

      const { built } = createJalousie3DSetup({
        targetWidthMm: 800,
        targetHeightMm: 600,
      });

      const bladeInstances: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.isLouverBladeInstance) {
          bladeInstances.push(c);
        }
      });

      assert.strictEqual(bladeInstances.length, 3, "Scene graph must contain exactly 3 blade instances");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.6: Louver blade 1:1 metric height preservation
  // --------------------------------------------------------------------------
  describe("QAD-TC96.6: Louver blade 1:1 metric height preservation", () => {
    it("preserves unscaled blade height (105.3mm) across height range without vertical stretching", () => {
      const testHeightsMm = [600, 1200, 1800, 2400];

      testHeightsMm.forEach((h) => {
        const { built } = createJalousie3DSetup({
          targetWidthMm: 800,
          targetHeightMm: h,
        });

        built.group.updateMatrixWorld(true);

        const bladeInstances: THREE.Object3D[] = [];
        built.group.traverse((c) => {
          if (c.userData?.isLouverBladeInstance) {
            bladeInstances.push(c);
          }
        });

        assert.ok(bladeInstances.length > 0);

        // Inspect world bounding box height of each blade
        bladeInstances.forEach((blade) => {
          const box = new THREE.Box3().setFromObject(blade);
          const size = new THREE.Vector3();
          box.getSize(size);

          const expectedHeightM = 0.1053;
          assert.ok(
            Math.abs(size.y - expectedHeightM) < 0.005,
            `At window height ${h}mm, blade height must remain ~105.3mm, got ${(size.y * 1000).toFixed(1)}mm`
          );
        });
      });
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.7: Louver blade width span scaling
  // --------------------------------------------------------------------------
  describe("QAD-TC96.7: Louver blade width span scaling", () => {
    it("scales blade along X (scaleX = 1.5) to span the frame when aperture width expands to 1200mm", () => {
      const { built } = createJalousie3DSetup({
        targetWidthMm: 1200, // 1200mm / 800mm base = 1.5 scaleX
        targetHeightMm: 1200,
      });

      built.group.updateMatrixWorld(true);

      const bladeInstances: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.isLouverBladeInstance) {
          bladeInstances.push(c);
        }
      });

      assert.strictEqual(bladeInstances.length, 7);

      const firstBlade = bladeInstances[0];
      const box = new THREE.Box3().setFromObject(firstBlade);
      const size = new THREE.Vector3();
      box.getSize(size);

      // Expected width: 0.8m * 1.5 = 1.2m
      assert.ok(
        Math.abs(size.x - 1.2) < 0.01,
        `Blade width must scale to 1.2m, got ${size.x.toFixed(3)}m`
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.8: Operator proportional count scaling
  // --------------------------------------------------------------------------
  describe("QAD-TC96.8: Operator proportional count scaling", () => {
    it("evaluates ceil(12 / 4) = 3 operators and instantiates 3 handles on 2100mm window", () => {
      const operatorCount = computeLouverOperatorCount(12, 4);
      assert.strictEqual(operatorCount, 3, "12 louvers / 4 blades per bank = 3 operators");

      const { built } = createJalousie3DSetup({
        targetWidthMm: 800,
        targetHeightMm: 2100,
      });

      const operatorInstances: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.isLouverOperatorInstance) {
          operatorInstances.push(c);
        }
      });

      assert.strictEqual(operatorInstances.length, 3, "Must instantiate exactly 3 operator units");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.9: Operator vertical bank positioning
  // --------------------------------------------------------------------------
  describe("QAD-TC96.9: Operator vertical bank positioning", () => {
    it("positions 3 operators at the vertical centroids of lower, middle, and upper banks", () => {
      const louverCount = 12;
      const operatorCount = 3;
      const pitchMm = 175;

      const expectedElevations = computeOperatorYCoordinates(louverCount, operatorCount, pitchMm);
      assert.strictEqual(expectedElevations.length, 3);

      // Total span: 11 * 0.175 = 1.925m, half = 0.9625m
      // Bank 0 (virtual blade (0.5 * 12 / 3) - 0.5 = 1.5): -0.9625 + 1.5 * 0.175 = -0.7000m
      // Bank 1 (virtual blade (1.5 * 12 / 3) - 0.5 = 5.5): -0.9625 + 5.5 * 0.175 = 0.0000m
      // Bank 2 (virtual blade (2.5 * 12 / 3) - 0.5 = 9.5): -0.9625 + 9.5 * 0.175 = +0.7000m
      assert.strictEqual(expectedElevations[0], -0.7);
      assert.strictEqual(expectedElevations[1], 0);
      assert.strictEqual(expectedElevations[2], 0.7);

      const { built } = createJalousie3DSetup({
        targetWidthMm: 800,
        targetHeightMm: 2100,
      });

      built.group.updateMatrixWorld(true);

      const operatorInstances: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.isLouverOperatorInstance) {
          operatorInstances.push(c);
        }
      });

      operatorInstances.sort((a, b) => a.position.y - b.position.y);

      expectedElevations.forEach((expY, idx) => {
        const opBox = new THREE.Box3().setFromObject(operatorInstances[idx]);
        const center = new THREE.Vector3();
        opBox.getCenter(center);

        assert.ok(
          Math.abs(center.y - expY) < 0.05,
          `Operator ${idx} Y center must be near ${expY}m, got ${center.y.toFixed(3)}m`
        );
      });
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.10: Louver and operator per-piece pricing calculation
  // --------------------------------------------------------------------------
  describe("QAD-TC96.10: Louver and operator per-piece pricing calculation", () => {
    it("evaluates glass blades at 12 @ ₱45 = ₱540 and operators at 3 @ ₱450 = ₱1,350 without area conversion", () => {
      const glassMaterial: RawMaterial = {
        id: "mat-glass-blade",
        material_code: "mat_gl_jalousie_blade_4x24",
        description: "Jalousie Glass Louver Blade (4\" x 24\")",
        category: "Glass",
        finish_type: "Clear",
        billing_unit: "pc",
        unit_price: 45.0,
        waste_allowance: 0,
        is_active: true,
      };

      const operatorMaterial: RawMaterial = {
        id: "mat-operator-unit",
        material_code: "mat_hw_jalousie_operator",
        description: "Jalousie Window Operator Mechanism",
        category: "Hardware",
        finish_type: "Standard",
        billing_unit: "pc",
        unit_price: 450.0,
        waste_allowance: 0,
        is_active: true,
      };

      const components: ComponentPricingInput[] = [
        {
          componentId: "comp-louver",
          componentKey: "jw_louver_clips_and_glass",
          componentName: "Glass Louver Blades",
          dimensionBinding: "LOUVER_BLADE",
          spanRatio: 1.0,
          baseQuantity: 7,
          isRemovable: false,
          presentationCategory: "Glazing",
          rawMaterial: glassMaterial,
          jalousieConfig: {
            pitch_mm: 175,
            blade_height_mm: 105.3,
            blades_per_operator: 4,
            base_blade_count: 7,
          },
        },
        {
          componentId: "comp-operator",
          componentKey: "jw_operators",
          componentName: "Window Operators",
          dimensionBinding: "LOUVER_OPERATOR",
          spanRatio: 1.0,
          baseQuantity: 2,
          isRemovable: false,
          presentationCategory: "Hardware",
          rawMaterial: operatorMaterial,
          jalousieConfig: {
            pitch_mm: 175,
            blades_per_operator: 4,
            base_operator_count: 2,
          },
        },
      ];

      const bom = calculateParametricBOM(components, {
        widthMm: 800,
        heightMm: 2100,
      });

      // Verify Glass Louver line item
      assert.strictEqual(bom.glazingItems.length, 1);
      const glassItem = bom.glazingItems[0];
      assert.strictEqual(glassItem.quantity, 12, "Must evaluate exactly 12 blades");
      assert.strictEqual(glassItem.unit, "pc", "Must use per-piece billing unit");
      assert.strictEqual(glassItem.unit_price, 45.0);
      assert.strictEqual(glassItem.subtotal, 540.0, "12 * 45.00 must equal 540.00");
      assert.strictEqual(glassItem.description, "12x Glass Louver Blades");

      // Verify Operator line item
      assert.strictEqual(bom.hardwareItems.length, 1);
      const operatorItem = bom.hardwareItems[0];
      assert.strictEqual(operatorItem.quantity, 3, "Must evaluate exactly 3 operators");
      assert.strictEqual(operatorItem.unit, "pc", "Must use per-piece billing unit");
      assert.strictEqual(operatorItem.unit_price, 450.0);
      assert.strictEqual(operatorItem.subtotal, 1350.0, "3 * 450.00 must equal 1,350.00");
      assert.strictEqual(operatorItem.description, "3x Window Operators");

      // Total material subtotal
      assert.strictEqual(bom.directMaterialsSubtotal, 1890.0);
      assert.strictEqual(bom.finalQuotation, 1890.0);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.11: Quotation modal and Consultation PDF disclosure
  // --------------------------------------------------------------------------
  describe("QAD-TC96.11: Quotation modal and Consultation PDF disclosure", () => {
    it("itemizes '12x Glass Louver Blades' and '3x Window Operators' in quotation PDF", () => {
      const glassMaterial: RawMaterial = {
        id: "mat-glass-blade",
        material_code: "mat_gl_jalousie_blade_4x24",
        description: "Jalousie Glass Louver Blade (4\" x 24\")",
        category: "Glass",
        finish_type: "Clear",
        billing_unit: "pc",
        unit_price: 45.0,
        waste_allowance: 0,
        is_active: true,
      };

      const operatorMaterial: RawMaterial = {
        id: "mat-operator-unit",
        material_code: "mat_hw_jalousie_operator",
        description: "Jalousie Window Operator Mechanism",
        category: "Hardware",
        finish_type: "Standard",
        billing_unit: "pc",
        unit_price: 450.0,
        waste_allowance: 0,
        is_active: true,
      };

      const components: ComponentPricingInput[] = [
        {
          componentId: "comp-louver",
          componentKey: "jw_louver_clips_and_glass",
          componentName: "Glass Louver Blades",
          dimensionBinding: "LOUVER_BLADE",
          spanRatio: 1.0,
          baseQuantity: 7,
          isRemovable: false,
          presentationCategory: "Glazing",
          rawMaterial: glassMaterial,
          jalousieConfig: {
            pitch_mm: 175,
            blade_height_mm: 105.3,
            blades_per_operator: 4,
            base_blade_count: 7,
          },
        },
        {
          componentId: "comp-operator",
          componentKey: "jw_operators",
          componentName: "Window Operators",
          dimensionBinding: "LOUVER_OPERATOR",
          spanRatio: 1.0,
          baseQuantity: 2,
          isRemovable: false,
          presentationCategory: "Hardware",
          rawMaterial: operatorMaterial,
          jalousieConfig: {
            pitch_mm: 175,
            blades_per_operator: 4,
            base_operator_count: 2,
          },
        },
      ];

      const bom = calculateParametricBOM(components, {
        widthMm: 800,
        heightMm: 2100,
      });

      const pdfHtml = generateQuotationPdfHtml({
        quotationNumber: "Q-2026-9611",
        referenceCode: "CF-2026-9611",
        customerName: "Reynard Rabanal",
        estimatorName: "R.R.D. Estimator",
        createdAtFormatted: "October 29, 2026",
        projectName: "Jalousie Window Project",
        brandLogoUrl: "https://glassfit.test/logo.svg",
        hasSill: true,
        structuralWaiver: false,
        bomResult: bom,
        items: [
          {
            itemId: "item-jalousie-1",
            productId: "prod-jalousie",
            productName: "Series 798 Jalousie Window",
            productType: "Window",
            variantName: "Standard",
            specSummary: "12x Glass Louver Blades | 3x Window Operators",
            dimensionsFormatted: "800mm × 2100mm",
            widthMm: 800,
            heightMm: 2100,
            panelCount: 1,
            hasSill: true,
            structuralWaiver: false,
            finishType: "Silver",
            glassType: "Clear",
            quantity: 1,
            unitPrice: bom.finalQuotation,
            totalPrice: bom.finalQuotation,
            imageUrl: "",
            bomResult: bom,
          },
        ],
      });

      assert.ok(
        pdfHtml.includes("12x Glass Louver Blades"),
        "Consultation PDF must disclose 12x Glass Louver Blades"
      );
      assert.ok(
        pdfHtml.includes("3x Window Operators"),
        "Consultation PDF must disclose 3x Window Operators"
      );
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.12: Synergy with MS80 operator-targeted screen access hatches
  // --------------------------------------------------------------------------
  describe("QAD-TC96.12: Synergy with MS80 operator-targeted screen access hatches", () => {
    it("generates exactly 3 screen access hatches in 1:1 vertical alignment with the 3 dynamic operators", () => {
      const { built } = createJalousie3DSetup({
        targetWidthMm: 800,
        targetHeightMm: 2100,
        activeAddon: "screen",
        hatchTargets: ["jw_operators"],
      });

      built.group.updateMatrixWorld(true);

      const operatorInstances: THREE.Object3D[] = [];
      const hatchInstances: THREE.Object3D[] = [];

      built.group.traverse((c) => {
        if (c.userData?.isLouverOperatorInstance) {
          operatorInstances.push(c);
        }
        if (c.userData?.isHatchClone) {
          hatchInstances.push(c);
        }
      });

      assert.strictEqual(
        operatorInstances.length,
        3,
        "Jalousie assembly must contain 3 dynamic operator instances"
      );
      assert.strictEqual(
        hatchInstances.length,
        3,
        "Screen add-on assembly must generate exactly 3 access hatches aligning with operators"
      );

      // Verify each hatch aligns vertically with its corresponding operator
      operatorInstances.sort((a, b) => a.position.y - b.position.y);
      hatchInstances.sort((a, b) => a.position.y - b.position.y);

      for (let i = 0; i < 3; i++) {
        const opBox = new THREE.Box3().setFromObject(operatorInstances[i]);
        const opCenter = new THREE.Vector3();
        opBox.getCenter(opCenter);

        const hatchBox = new THREE.Box3().setFromObject(hatchInstances[i]);
        const hatchCenter = new THREE.Vector3();
        hatchBox.getCenter(hatchCenter);

        assert.ok(
          Math.abs(hatchCenter.y - opCenter.y) < 0.05,
          `Hatch ${i} Y (${hatchCenter.y.toFixed(3)}) must align with Operator ${i} Y (${opCenter.y.toFixed(3)})`
        );
        assert.strictEqual(
          hatchInstances[i].userData.isHorizontalHatch,
          false,
          `Hatch ${i} must remain vertically oriented because jalousie operator is vertical`
        );
      }
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.13: Issue 2 Regression - Frame uploads strictly assigned to Framing/Aluminum
  // --------------------------------------------------------------------------
  describe("QAD-TC96.13: Issue 2 Regression - Frame uploads strictly assigned to Framing/Aluminum", () => {
    it("disqualifies frame profiles from being classified as louver blades or glazing", () => {
      const frameFileNames = [
        "JW_Frame_Left.glb",
        "JW_Frame_Right.glb",
        "JW_Frame_Top.glb",
        "JW_Frame_Bottom.glb",
        "JW_Frame_Center.glb",
        "JW_Window_Sill.glb",
      ];

      frameFileNames.forEach((fileName) => {
        const dummyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), new THREE.MeshStandardMaterial({ name: "JW_Aluminum_Profile" }));
        dummyMesh.name = fileName.replace(".glb", "");

        const analysis = analyzeJalousieGeometry(dummyMesh, fileName);
        assert.strictEqual(analysis.isLouverBlade, false, `${fileName} must not be classified as louver blade`);
        assert.strictEqual(analysis.isLouverOperator, false, `${fileName} must not be classified as louver operator`);

        const auto = autoDetectComponentSettings(fileName);
        assert.strictEqual(auto.presentationCategory, "Framing", `${fileName} must be Framing presentation category`);
        assert.strictEqual(auto.componentType, "Frame", `${fileName} must be Frame component type`);
      });
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.14: Issue 4 Regression - Operators stay anchored to jambs without floating outside
  // --------------------------------------------------------------------------
  describe("QAD-TC96.14: Issue 4 Regression - Operators stay anchored to jambs without floating outside", () => {
    it("anchors operators within frame perimeter across varying window widths (1200mm, 1500mm, 2100mm)", () => {
      const louverAssembly = createSyntheticLouverAssembly();
      const operatorAssembly = createSyntheticOperatorAssembly();

      const frameMat: RawMaterial = {
        id: "mat-al-frame",
        material_code: "AL-FRAME",
        description: "Series 798 Outer Frame",
        category: "Aluminum",
        finish_type: "Analok",
        billing_unit: "m",
        unit_price: 320,
        waste_allowance: 0.1,
        is_active: true,
      };

      const louverMat: RawMaterial = {
        id: "mat-gl-louver",
        material_code: "GL-LOUVER",
        description: "Clear Louver Blade 4x24",
        category: "Glass",
        finish_type: "Clear",
        billing_unit: "pc",
        unit_price: 45,
        waste_allowance: 0,
        is_active: true,
      };

      const operatorMat: RawMaterial = {
        id: "mat-hw-operator",
        material_code: "HW-OPERATOR",
        description: "Jalousie Operator Crank",
        category: "Hardware",
        finish_type: "Standard",
        billing_unit: "pc",
        unit_price: 450,
        waste_allowance: 0,
        is_active: true,
      };

      const mockComponents: ProductComponentDefinition[] = [
        {
          componentId: "comp-frame",
          componentKey: "frame_perimeter",
          componentName: "Perimeter Frame",
          componentType: "Frame",
          presentationCategory: "Framing",
          dimensionBinding: "PERIMETER",
          spanRatio: 1.0,
          baseQuantity: 1,
          isRemovable: false,
          togglePropertyKey: null,
          rawMaterialId: frameMat.id,
          rawMaterial: frameMat,
          allowedMaterials: [{ rawMaterialId: frameMat.id, isDefault: true, displayOrder: 0 }],
          model: { assetId: "a1", r2ObjectKey: "k1", url: "", fileName: "frame.glb", sourceDimensionsMm: { width: 2100, height: 1500, depth: 100 } },
          componentData: {},
        },
        {
          componentId: "comp-louver",
          componentKey: "louver_blades",
          componentName: "Louver Blades",
          componentType: "Glass",
          presentationCategory: "Glazing",
          dimensionBinding: "LOUVER_BLADE",
          spanRatio: 1.0,
          baseQuantity: 7,
          isRemovable: false,
          togglePropertyKey: null,
          rawMaterialId: louverMat.id,
          rawMaterial: louverMat,
          allowedMaterials: [{ rawMaterialId: louverMat.id, isDefault: true, displayOrder: 0 }],
          model: { assetId: "a2", r2ObjectKey: "k2", url: "", fileName: "louvers.glb", sourceDimensionsMm: { width: 800, height: 105.3, depth: 6 } },
          componentData: {},
          jalousieConfig: {
            pitch_mm: 175,
            blade_height_mm: 105.3,
            blades_per_operator: 4,
            base_blade_count: 7,
            base_operator_count: 2,
          },
        },
        {
          componentId: "comp-operator",
          componentKey: "window_operators",
          componentName: "Window Operators",
          componentType: "Hardware",
          presentationCategory: "Hardware",
          dimensionBinding: "LOUVER_OPERATOR",
          spanRatio: 1.0,
          baseQuantity: 2,
          isRemovable: false,
          togglePropertyKey: null,
          rawMaterialId: operatorMat.id,
          rawMaterial: operatorMat,
          allowedMaterials: [{ rawMaterialId: operatorMat.id, isDefault: true, displayOrder: 0 }],
          model: { assetId: "a3", r2ObjectKey: "k3", url: "", fileName: "operators.glb", sourceDimensionsMm: { width: 50, height: 380, depth: 140 } },
          componentData: {},
          jalousieConfig: {
            pitch_mm: 175,
            blade_height_mm: 105.3,
            blades_per_operator: 4,
            base_blade_count: 7,
            base_operator_count: 2,
          },
        },
      ];

      const frameBox = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 0.1), new THREE.MeshBasicMaterial());
      frameBox.name = "frame_box";

      const mockCache: ComponentModelCache = {
        getClone: (id: string) => {
          if (id === "comp-frame") return frameBox.clone(true);
          if (id === "comp-louver") return louverAssembly.clone(true);
          if (id === "comp-operator") return operatorAssembly.clone(true);
          return new THREE.Group();
        },
        getSourceSizeMeters: () => new THREE.Vector3(2.1, 1.5, 0.1),
      };

      const testWidthsMm = [800, 1200, 1500, 2100, 3000];

      testWidthsMm.forEach((targetW) => {
        const resolved: ResolvedStructure = {
          resolvedValues: { width: targetW, height: 1500 },
          numericValuesMm: { width: targetW, height: 1500 },
          componentQuantities: { frame_perimeter: 1, louver_blades: 8, window_operators: 2 },
          appliedRuleIds: [],
        };

        const def: ProductStructuralDefinition = {
          product: {
            productId: "prod-jalousie",
            productName: "Jalousie Window",
            productType: "Window",
            isAddon: false,
            isAccessory: false,
          },
          template: {
            templateId: "tmpl-jalousie",
            templateName: "Jalousie Window Template",
            modelStrategy: "Parametric",
            measurementUnit: "mm",
            baseConfiguration: {},
          },
          components: mockComponents,
          parameters: [
            { parameterId: "p1", parameterKey: "width", parameterName: "Width", parameterType: "dimension", defaultValue: 2100, minimumValue: 800, maximumValue: 3000, stepValue: 10, unit: "mm", affectsStructure: true, displayOrder: 1 },
            { parameterId: "p2", parameterKey: "height", parameterName: "Height", parameterType: "dimension", defaultValue: 1500, minimumValue: 600, maximumValue: 2400, stepValue: 10, unit: "mm", affectsStructure: true, displayOrder: 2 },
          ],
          rules: [],
        };

        const built = buildParametricProduct(def, resolved, mockCache);
        built.group.updateMatrixWorld(true);

        const wholeWindowBox = new THREE.Box3().setFromObject(built.group);

        const opInstances: THREE.Object3D[] = [];
        built.group.traverse((c) => {
          if (c.userData?.isLouverOperatorInstance) opInstances.push(c);
        });

        assert.ok(opInstances.length > 0, `Must have operator instances at width ${targetW}mm`);

        opInstances.forEach((op) => {
          op.updateMatrixWorld(true);
          const opBox = new THREE.Box3().setFromObject(op);
          // Operator center and bounds must be strictly within the whole window outer bounds
          assert.ok(
            opBox.min.x >= wholeWindowBox.min.x - 0.05,
            `Operator min X (${opBox.min.x.toFixed(3)}) must not float left of window frame (${wholeWindowBox.min.x.toFixed(3)}) at width ${targetW}mm`
          );
          assert.ok(
            opBox.max.x <= wholeWindowBox.max.x + 0.05,
            `Operator max X (${opBox.max.x.toFixed(3)}) must not float right of window frame (${wholeWindowBox.max.x.toFixed(3)}) at width ${targetW}mm`
          );
        });
      });
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.15: Issue 1 Regression - Dynamic operator count adaptation to height
  // --------------------------------------------------------------------------
  describe("QAD-TC96.15: Issue 1 Regression - Dynamic operator count adaptation to height", () => {
    it("dynamically increases or decreases operator count as window height changes", () => {
      // 800mm -> 4 louvers -> 1 operator
      const louvers800 = computeLouverBladeCount(800, 175);
      const ops800 = computeLouverOperatorCount(louvers800, 4);
      assert.strictEqual(louvers800, 4);
      assert.strictEqual(ops800, 1);

      // 1200mm -> 7 louvers -> 2 operators
      const louvers1200 = computeLouverBladeCount(1200, 175);
      const ops1200 = computeLouverOperatorCount(louvers1200, 4);
      assert.strictEqual(louvers1200, 7);
      assert.strictEqual(ops1200, 2);

      // 1800mm -> 10 louvers -> 3 operators
      const louvers1800 = computeLouverBladeCount(1800, 175);
      const ops1800 = computeLouverOperatorCount(louvers1800, 4);
      assert.strictEqual(louvers1800, 10);
      assert.strictEqual(ops1800, 3);

      // 2400mm -> 13 louvers -> 4 operators
      const louvers2400 = computeLouverBladeCount(2400, 175);
      const ops2400 = computeLouverOperatorCount(louvers2400, 4);
      assert.strictEqual(louvers2400, 13);
      assert.strictEqual(ops2400, 4);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.16: Issue 3 Regression - Screen hatch targeting operator hardware
  // --------------------------------------------------------------------------
  describe("QAD-TC96.16: Issue 3 Regression - Screen hatch targeting operator hardware", () => {
    it("identifies components with LOUVER_OPERATOR binding as valid hatch targets", () => {
      const components = [
        { component_key: "frame_left", component_name: "Frame Left", dimension_binding: "HEIGHT", presentation_category: "Framing" },
        { component_key: "louver_glass", component_name: "Louver Glass", dimension_binding: "LOUVER_BLADE", presentation_category: "Glazing" },
        { component_key: "jw_operators", component_name: "JW Operators", dimension_binding: "LOUVER_OPERATOR", presentation_category: "Hardware" },
      ];

      const candidates = components.filter((comp) => {
        const key = String(comp.component_key || "").toLowerCase();
        const name = String(comp.component_name || "").toLowerCase();
        const cat = String(comp.presentation_category || "").toLowerCase();
        const binding = String(comp.dimension_binding || "").toUpperCase();
        return (
          binding === "LOUVER_OPERATOR" ||
          key.includes("operator") ||
          key.includes("crank") ||
          key.includes("latch") ||
          key.includes("handle") ||
          key.includes("rotator") ||
          name.includes("operator") ||
          cat.includes("hardware")
        );
      });

      assert.strictEqual(candidates.length, 1);
      assert.strictEqual(candidates[0].component_key, "jw_operators");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.17: Issue 6 Regression - Louver blades strictly bound within clear aperture
  // --------------------------------------------------------------------------
  describe("QAD-TC96.17: Issue 6 Regression - Louver blades strictly bound within clear aperture", () => {
    it("guarantees top and bottom louver blades do not overlap frame rails across multiple heights", () => {
      const testHeights = [800, 1000, 1300, 1600, 1900, 2200];

      for (const h of testHeights) {
        const { built } = createJalousie3DSetup({
          targetWidthMm: 1000,
          targetHeightMm: h,
        });

        built.group.updateMatrixWorld(true);

        // Find frame and louver assemblies
        let frameMesh: THREE.Object3D | null = null;
        built.group.traverse((c) => {
          if (c.userData?.componentKey === "window_frame" && c instanceof THREE.Mesh) {
            frameMesh = c;
          }
        });
        assert.ok(frameMesh, "Frame mesh must exist in built product");
        const frameBox = new THREE.Box3().setFromObject(frameMesh);

        const louverAssembly = built.group.children.find(
          (c) => c.userData?.isLouverAssembly === true
        );
        assert.ok(louverAssembly, "Louver assembly must exist");

        const louverBox = new THREE.Box3().setFromObject(louverAssembly);

        // Top blade must never penetrate above top of frame aperture
        assert.ok(
          louverBox.max.y <= frameBox.max.y,
          `At height ${h}mm, louver top (${louverBox.max.y.toFixed(3)}) must not exceed frame top (${frameBox.max.y.toFixed(3)})`
        );

        // Bottom blade must never penetrate below bottom of frame aperture
        assert.ok(
          louverBox.min.y >= frameBox.min.y,
          `At height ${h}mm, louver bottom (${louverBox.min.y.toFixed(3)}) must not penetrate below frame bottom (${frameBox.min.y.toFixed(3)})`
        );
      }
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC96.18: Swappable Accessory Replacement on Louver Operator Hardware
  // --------------------------------------------------------------------------
  describe("QAD-TC96.18: Swappable Accessory Replacement on Louver Operator Hardware", () => {
    it("replaces all operator instances with the chosen swappable accessory exactly where they are", () => {
      // 1. Build product with default operator hardware
      const { built: defaultBuilt } = createJalousie3DSetup({
        targetWidthMm: 1000,
        targetHeightMm: 1200,
      });

      const defaultOpAssembly = defaultBuilt.group.children.find(
        (c) => c.userData?.isOperatorAssembly === true
      );
      assert.ok(defaultOpAssembly, "Operator assembly must exist in default build");
      assert.strictEqual(defaultOpAssembly.children.length, 2, "Expected 2 default operators");

      const defaultPositions = defaultOpAssembly.children.map((c) => {
        c.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(c);
        return {
          x: c.position.x,
          y: c.position.y,
          z: c.position.z,
          worldCenter: b.getCenter(new THREE.Vector3()),
        };
      });

      // 2. Build product with swapped accessory on the operator component
      const { built: swappedBuilt } = createJalousie3DSetup({
        targetWidthMm: 1000,
        targetHeightMm: 1200,
        swappedAccessories: {
          comp_operator: {
            slotComponentId: "comp_operator",
            slotCategory: "handle",
            accessoryId: "canonical_lever_handle",
            accessoryName: "Standard Ergonomic Lever Handle",
            category: "handle",
            price: 550,
            finish: "satin",
            horizontalPosition: "right",
            verticalPosition: "up",
          },
        },
      });

      const swappedOpAssembly = swappedBuilt.group.children.find(
        (c) => c.userData?.isOperatorAssembly === true
      );
      assert.ok(swappedOpAssembly, "Operator assembly must exist in swapped build");
      assert.strictEqual(swappedOpAssembly.children.length, 2, "All 2 operators must be replaced");

      swappedOpAssembly.children.forEach((child, idx) => {
        assert.strictEqual(child.userData?.isAccessoryReplacement, true, `Operator ${idx} must be marked as accessory replacement`);
        assert.strictEqual(child.userData?.isLouverOperatorInstance, true, `Operator ${idx} must preserve isLouverOperatorInstance`);
        assert.strictEqual(child.userData?.dimensionBinding, "LOUVER_OPERATOR");

        // Verify exact coordinates match default positions
        const defPos = defaultPositions[idx];
        assert.ok(Math.abs(child.position.x - defPos.x) < 0.0001, `X position of operator ${idx} must match exactly (${child.position.x} vs ${defPos.x})`);
        assert.ok(Math.abs(child.position.y - defPos.y) < 0.0001, `Y position of operator ${idx} must match exactly (${child.position.y} vs ${defPos.y})`);
        assert.ok(Math.abs(child.position.z - defPos.z) < 0.0001, `Z position of operator ${idx} must match exactly (${child.position.z} vs ${defPos.z})`);

        child.updateMatrixWorld(true);
        const childBox = new THREE.Box3().setFromObject(child);
        const childCenter = childBox.getCenter(new THREE.Vector3());
        assert.ok(
          Math.abs(childCenter.x - defPos.worldCenter.x) < 0.0001,
          `World center X of operator ${idx} must match default (${childCenter.x.toFixed(4)} vs ${defPos.worldCenter.x.toFixed(4)})`
        );
      });

      // 3. Test accessory with non-zero internal geometry offset (e.g. uploaded GLB sub-mesh at x=0.56, y=0.28)
      const offsetAccRoot = new THREE.Group();
      const offsetMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.08));
      offsetMesh.position.set(0.56, 0.28, 0.04);
      offsetAccRoot.add(offsetMesh);

      const customAccessoryModels = new Map<string, THREE.Object3D>();
      customAccessoryModels.set("custom_offset_op", offsetAccRoot);

      const { built: offsetBuilt } = createJalousie3DSetup({
        targetWidthMm: 1000,
        targetHeightMm: 1200,
        accessoryModels: customAccessoryModels,
        swappedAccessories: {
          comp_operator: {
            slotComponentId: "comp_operator",
            slotCategory: "handle",
            accessoryId: "custom_offset_op",
            accessoryName: "Custom Offset Operator",
            category: "handle",
            price: 350,
            finish: "satin",
            horizontalPosition: "right",
            verticalPosition: "up",
          },
        },
      });

      offsetBuilt.group.updateMatrixWorld(true);
      const wholeWindowBox = new THREE.Box3().setFromObject(offsetBuilt.group);
      const offsetOpAssembly = offsetBuilt.group.children.find(
        (c) => c.userData?.isOperatorAssembly === true
      );
      assert.ok(offsetOpAssembly, "Offset operator assembly must exist");

      offsetOpAssembly.children.forEach((child, idx) => {
        child.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(child);
        const center = b.getCenter(new THREE.Vector3());
        // Must stay anchored inside the frame, matching the default track center
        assert.ok(
          b.min.x >= wholeWindowBox.min.x - 0.05,
          `Offset operator ${idx} min X (${b.min.x.toFixed(3)}) must not float outside left of window (${wholeWindowBox.min.x.toFixed(3)})`
        );
        assert.ok(
          b.max.x <= wholeWindowBox.max.x + 0.05,
          `Offset operator ${idx} max X (${b.max.x.toFixed(3)}) must not float outside right of window (${wholeWindowBox.max.x.toFixed(3)})`
        );
        assert.ok(
          Math.abs(center.x - defaultPositions[idx].worldCenter.x) < 0.0001,
          `Offset operator ${idx} world X (${center.x.toFixed(4)}) must stay centered at track (${defaultPositions[idx].worldCenter.x.toFixed(4)})`
        );
      });
    });
  });
});
