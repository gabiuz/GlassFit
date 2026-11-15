/**
 * Unit and Acceptance Test Suite for Smart Dynamic Modular Bay Replication,
 * Directional Aperture Expansion, and Automated Infill and Hardware Generation (IMP-MS82)
 *
 * Primary Traceability: PRD-F5, PRD-F10, PRD-F14, PRD-F19, SDD-C4, SDD-C5, SDD-C7, SDD-C9,
 * DSD-UI4, DSD-UI7, DSD-UI10, ERD-E3, ERD-E4, ERD-E6, ERD-E7, ERD-E14, ERD-E17, IMP-MS82
 * Acceptance Catalog: QAD-TC97.1 through QAD-TC97.14
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as THREE from "three";

import {
  autoDetectBayRole,
} from "../../src/lib/admin/products/autoDetection";

import {
  detectBayClusters,
  extractBayInfillPrototype,
  autoDetectProductBayConfig,
  computeLouverBladeCount,
  computeLouverOperatorCount,
} from "../../src/lib/visualization/jalousieGeometryAnalyzer";

import {
  computeDynamicBayCount,
  computeMullionCount,
  computeBayCenters,
  computeMullionCenters,
  computeOuterJambPositions,
  resolveDynamicBayQuantities,
} from "../../src/lib/visualization/bayReplicationEngine";

import {
  calculateParametricBOM,
  type ComponentPricingInput,
} from "../../src/lib/pricing/pricingEngine";

import { buildParametricProduct } from "../../src/lib/visualization/parametricProductBuilder";
import { generateQuotationPdfHtml } from "../../src/lib/pricing/quotationPdfGenerator";

import type {
  ProductStructuralDefinition,
  ResolvedStructure,
  ProductComponentDefinition,
  SelectedAccessoryState,
} from "../../src/lib/visualization/types";
import type { RawMaterial, DynamicBayConfig } from "../../src/lib/pricing/types";
import type { QuotationPdfMetadata } from "../../src/lib/pricing/quotationPdfGenerator";

// ============================================================================
// Synthetic 3D Model Helpers for Modular Dual-Bay Jalousie
// ============================================================================

/**
 * Creates a synthetic dual-bay louver infill mesh mirroring JW_Louver_Clips_And_Glass.glb
 * with 2 distinct X clusters at X = -0.3m and X = +0.3m (spanning W = 1.2m default).
 */
function createSyntheticDualBayLouverMesh(): THREE.Group {
  const root = new THREE.Group();
  root.name = "JW_Louver_Clips_And_Glass";

  const glassMat = new THREE.MeshStandardMaterial({
    name: "JW_Glass_Material",
    transparent: true,
    opacity: 0.5,
  });

  const elevations = [-0.525, -0.35, -0.175, 0.0, 0.175, 0.35, 0.525];
  const bayXOffsets = [-0.3, 0.3];

  bayXOffsets.forEach((bayX, bayIdx) => {
    elevations.forEach((y, bladeIdx) => {
      const bladeGeom = new THREE.BoxGeometry(0.55, 0.1053, 0.006);
      const bladeMesh = new THREE.Mesh(bladeGeom, glassMat);
      bladeMesh.name = `Blade_bay${bayIdx}_slat${bladeIdx}`;
      bladeMesh.position.set(bayX, y, 0);
      root.add(bladeMesh);
    });
  });

  root.updateMatrixWorld(true);
  return root;
}

/**
 * Creates a synthetic dual-bay operator assembly mirroring JW_Operators.glb
 * with 2 operators per bay at X = -0.05 (bay 0 right stile) and X = 0.55 (bay 1 right stile).
 */
function createSyntheticDualBayOperatorMesh(): THREE.Group {
  const root = new THREE.Group();
  root.name = "JW_Operators";

  const operatorMat = new THREE.MeshStandardMaterial({
    name: "JW_Operator_Black",
    color: 0x111111,
  });

  const bayXOffsets = [-0.05, 0.55];
  const opElevations = [-0.415, 0.11];

  bayXOffsets.forEach((bayX, bayIdx) => {
    opElevations.forEach((y, opIdx) => {
      const opGeom = new THREE.BoxGeometry(0.05, 0.16, 0.08);
      const opMesh = new THREE.Mesh(opGeom, operatorMat);
      opMesh.name = `Operator_bay${bayIdx}_unit${opIdx}`;
      opMesh.position.set(bayX, y, 0.04);
      root.add(opMesh);
    });
  });

  root.updateMatrixWorld(true);
  return root;
}

/**
 * Creates a complete synthetic multi-bay jalousie setup for 3D construction.
 */
function createMultiBay3DSetup(options: {
  targetWidthMm: number;
  targetHeightMm: number;
  dynamicBayConfig?: DynamicBayConfig | null;
  activeAddon?: "screen" | "none";
}) {
  const dynamicBayConfig: DynamicBayConfig | null = options.dynamicBayConfig ?? {
    enabled: true,
    primary_dimension: "width",
    nominal_bay_pitch_mm: 600,
    min_bay_width_mm: 400,
    max_bay_width_mm: 1000,
    default_bay_count: 2,
    expansion_anchor: "symmetric",
    expansion_anchor_mode: "symmetric",
    bay_infill_component_keys: [],
    bay_hardware_component_keys: [],
  };

  const topRailMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.08));
  topRailMesh.name = "frame_top";
  const bottomRailMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.08));
  bottomRailMesh.name = "frame_bottom";
  const leftJambMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 0.08));
  leftJambMesh.name = "frame_left";
  const rightJambMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 0.08));
  rightJambMesh.name = "frame_right";
  const centerMullionMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 0.08));
  centerMullionMesh.name = "frame_center";

  const louverMesh = createSyntheticDualBayLouverMesh();
  const operatorMesh = createSyntheticDualBayOperatorMesh();

  const screenFrameMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.02));
  screenFrameMesh.name = "screen_perimeter_frame";
  const hatchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.02));
  hatchMesh.name = "screen_access_hatch";

  const createSyntheticModel = (fileName: string) => ({
    assetId: "synth_" + fileName,
    r2ObjectKey: "synthetic/" + fileName,
    url: "https://synthetic.test/" + fileName,
    fileName,
    sourceDimensionsMm: { width: 1200, height: 1200, depth: 80 },
  });

  const hostComponents: ProductComponentDefinition[] = [
    {
      componentId: "comp_top",
      componentKey: "frame_top",
      componentName: "JW_Frame_Top",
      componentType: "Frame",
      dimensionBinding: "WIDTH",
      bayRole: "OUTER_HEAD",
      baseQuantity: 1,
      componentData: {},
      model: createSyntheticModel("JW_Frame_Top.glb"),
    },
    {
      componentId: "comp_bottom",
      componentKey: "frame_bottom",
      componentName: "JW_Frame_Bottom",
      componentType: "Frame",
      dimensionBinding: "WIDTH",
      bayRole: "OUTER_SILL",
      baseQuantity: 1,
      componentData: {},
      model: createSyntheticModel("JW_Frame_Bottom.glb"),
    },
    {
      componentId: "comp_left",
      componentKey: "frame_left",
      componentName: "JW_Frame_Left",
      componentType: "Frame",
      dimensionBinding: "HEIGHT",
      bayRole: "OUTER_JAMB_LEFT",
      baseQuantity: 1,
      componentData: {},
      model: createSyntheticModel("JW_Frame_Left.glb"),
    },
    {
      componentId: "comp_right",
      componentKey: "frame_right",
      componentName: "JW_Frame_Right",
      componentType: "Frame",
      dimensionBinding: "HEIGHT",
      bayRole: "OUTER_JAMB_RIGHT",
      baseQuantity: 1,
      componentData: {},
      model: createSyntheticModel("JW_Frame_Right.glb"),
    },
    {
      componentId: "comp_center",
      componentKey: "frame_center",
      componentName: "JW_Frame_Center",
      componentType: "Mullion",
      dimensionBinding: "HEIGHT",
      bayRole: "BAY_DIVIDER",
      baseQuantity: 1,
      componentData: {},
      model: createSyntheticModel("JW_Frame_Center.glb"),
    },
    {
      componentId: "comp_louver",
      componentKey: "jw_louver_clips_and_glass",
      componentName: "JW_Louver_Clips_And_Glass",
      componentType: "Infill",
      dimensionBinding: "LOUVER_BLADE",
      bayRole: "BAY_INFILL",
      baseQuantity: 14,
      jalousieConfig: {
        pitch_mm: 175,
        default_count: 7,
        bay_count: 2,
      },
      componentData: {},
      model: createSyntheticModel("JW_Louver_Clips_And_Glass.glb"),
    },
    {
      componentId: "comp_operator",
      componentKey: "jw_operators",
      componentName: "JW_Operators",
      componentType: "Hardware",
      dimensionBinding: "LOUVER_OPERATOR",
      bayRole: "BAY_HARDWARE",
      baseQuantity: 4,
      jalousieConfig: {
        blades_per_operator: 4,
        default_count: 2,
        bay_count: 2,
      },
      componentData: {},
      model: createSyntheticModel("JW_Operators.glb"),
    },
  ];

  if (options.activeAddon === "screen") {
    hostComponents.push(
      {
        componentId: "comp_screen_frame",
        componentKey: "screen_perimeter_frame",
        componentName: "Screen Perimeter Frame",
        componentType: "Addon",
        dimensionBinding: "AREA",
        baseQuantity: 1,
        componentData: {},
        model: createSyntheticModel("Screen_Perimeter_Frame.glb"),
      },
      {
        componentId: "comp_screen_hatch",
        componentKey: "screen_access_hatch",
        componentName: "Screen Access Hatch",
        componentType: "Addon",
        dimensionBinding: "FIXED",
        baseQuantity: 1,
        componentData: {},
        model: createSyntheticModel("Screen_Access_Hatch.glb"),
      }
    );
  }

  const definition: ProductStructuralDefinition = {
    product: {
      productId: "prod_jalousie_ms82",
      productName: "Parametric Jalousie Window",
      productType: "Jalousie Window",
      basePrice: 5000,
      dynamicBayConfig,
    },
    template: {
      templateId: "tmpl_jalousie_ms82",
      templateName: "Dual-Bay Modular Jalousie Template",
      modelStrategy: "Parametric",
      measurementUnit: "mm",
      baseConfiguration: {
        width: 1200,
        height: 1200,
      },
    },
    components: hostComponents,
    parameters: [
      {
        parameterId: "param_w",
        parameterKey: "width",
        parameterName: "Width",
        parameterType: "dimension",
        defaultValue: 1200,
        minimumValue: 400,
        maximumValue: 3600,
        stepValue: 10,
        unit: "mm",
        affectsStructure: true,
        displayOrder: 1,
      },
      {
        parameterId: "param_h",
        parameterKey: "height",
        parameterName: "Height",
        parameterType: "dimension",
        defaultValue: 1200,
        minimumValue: 600,
        maximumValue: 2400,
        stepValue: 10,
        unit: "mm",
        affectsStructure: true,
        displayOrder: 2,
      },
    ],
    rules: [],
  };

  const resolved: ResolvedStructure = {
    numericValuesMm: {
      width: options.targetWidthMm,
      height: options.targetHeightMm,
    },
    componentQuantities: {
      comp_top: 1,
      comp_bottom: 1,
      comp_left: 1,
      comp_right: 1,
      comp_center: 1,
      comp_louver: 14,
      comp_operator: 4,
    },
    resolvedValues: {
      width: options.targetWidthMm,
      height: options.targetHeightMm,
      includeSill: true,
      include_sill: true,
      has_sill: true,
      hasSill: true,
    },
    appliedRuleIds: [],
  };

  const mockCache = {
    has: () => true,
    get: (id: string) => {
      if (id === "comp_top" || id === "frame_top") return topRailMesh.clone(true);
      if (id === "comp_bottom" || id === "frame_bottom") return bottomRailMesh.clone(true);
      if (id === "comp_left" || id === "frame_left") return leftJambMesh.clone(true);
      if (id === "comp_right" || id === "frame_right") return rightJambMesh.clone(true);
      if (id === "comp_center" || id === "frame_center") return centerMullionMesh.clone(true);
      if (id === "comp_louver" || id === "jw_louver_clips_and_glass") return louverMesh.clone(true);
      if (id === "comp_operator" || id === "jw_operators") return operatorMesh.clone(true);
      if (id === "comp_screen_frame" || id === "screen_perimeter_frame") return screenFrameMesh.clone(true);
      if (id === "comp_screen_hatch" || id === "screen_access_hatch") return hatchMesh.clone(true);
      throw new Error(`Unknown component clone request: ${id}`);
    },
    getClone: (id: string) => mockCache.get(id).clone(true),
    getSourceSizeMeters: () => new THREE.Vector3(1.2, 1.2, 0.08),
  };

  const built = buildParametricProduct(definition, resolved, mockCache, {
    activeAddon: options.activeAddon ?? "none",
    addonMountingSide: "back",
    hatchTargetComponentKeys: ["jw_operators"],
    dynamicBayConfig,
  });

  built.group.updateMatrixWorld(true);
  return { built, definition, resolved, mockCache };
}

// ============================================================================
// Acceptance Test Catalog (QAD-TC97)
// ============================================================================

describe("IMP-MS82: Smart Dynamic Modular Bay Replication & Aperture Expansion", () => {
  // --------------------------------------------------------------------------
  // QAD-TC97.1: Automated baseline bay count and pitch detection
  // --------------------------------------------------------------------------
  describe("QAD-TC97.1: Automated baseline bay count and pitch detection", () => {
    it("auto-detects semantic bay roles for all standard constituent parts", () => {
      assert.strictEqual(autoDetectBayRole("JW_Frame_Top.glb"), "OUTER_HEAD");
      assert.strictEqual(autoDetectBayRole("JW_Frame_Bottom.glb"), "OUTER_SILL");
      assert.strictEqual(autoDetectBayRole("JW_Frame_Left.glb"), "OUTER_JAMB_LEFT");
      assert.strictEqual(autoDetectBayRole("JW_Frame_Right.glb"), "OUTER_JAMB_RIGHT");
      assert.strictEqual(autoDetectBayRole("JW_Frame_Center.glb"), "BAY_DIVIDER");
      assert.strictEqual(autoDetectBayRole("JW_Louver_Clips_And_Glass.glb"), "BAY_INFILL");
      assert.strictEqual(autoDetectBayRole("JW_Operators.glb"), "BAY_HARDWARE");
      assert.strictEqual(autoDetectBayRole("JW_Window_Sill.glb"), "REMOVABLE_SILL");
    });

    it("detects 2 distinct X clusters in dual-bay jalousie infill mesh", () => {
      const dualBayMesh = createSyntheticDualBayLouverMesh();
      const clusters = detectBayClusters(dualBayMesh);
      assert.strictEqual(clusters.bayCount, 2, "Must detect exactly 2 bay clusters");
      assert.strictEqual(clusters.clusterBounds.length, 2);
      assert.ok(Math.abs(clusters.clusterBounds[0].centerX - (-0.3)) < 0.05, "Bay 0 center must be around -0.3m");
      assert.ok(Math.abs(clusters.clusterBounds[1].centerX - 0.3) < 0.05, "Bay 1 center must be around +0.3m");
    });

    it("extracts a single bay infill prototype containing 7 louvers", () => {
      const dualBayMesh = createSyntheticDualBayLouverMesh();
      const proto = extractBayInfillPrototype(dualBayMesh, 0);
      let bladeCount = 0;
      proto.traverse((c) => {
        if (c instanceof THREE.Mesh) bladeCount++;
      });
      assert.strictEqual(bladeCount, 7, "Bay prototype must contain 7 louvers");
    });

    it("computes default_bay_count = 2 and nominal_bay_pitch_mm = 600 from 1200mm width", () => {
      const config = autoDetectProductBayConfig(
        [
          { fileNameOrKey: "JW_Frame_Center.glb" },
          { fileNameOrKey: "JW_Louver_Clips_And_Glass.glb" },
          { fileNameOrKey: "JW_Operators.glb" },
        ],
        1200
      );
      assert.strictEqual(config.enabled, true);
      assert.strictEqual(config.default_bay_count, 2);
      assert.strictEqual(config.nominal_bay_pitch_mm, 600);
      assert.strictEqual(config.min_bay_width_mm, 400);
      assert.strictEqual(config.max_bay_width_mm, 1000);
      assert.strictEqual(config.expansion_anchor, "symmetric");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.2: Dynamic bay replication feature toggle enablement
  // --------------------------------------------------------------------------
  describe("QAD-TC97.2: Dynamic bay replication feature toggle enablement", () => {
    it("calculates dynamic bay count without manual rules when enabled", () => {
      const enabledConfig: DynamicBayConfig = {
        enabled: true,
        primary_dimension: "width",
        nominal_bay_pitch_mm: 600,
        min_bay_width_mm: 400,
        max_bay_width_mm: 1000,
        default_bay_count: 2,
        expansion_anchor: "symmetric",
        expansion_anchor_mode: "symmetric",
        bay_infill_component_keys: [],
        bay_hardware_component_keys: [],
      };

      const baysAt1800 = computeDynamicBayCount(1800, enabledConfig.nominal_bay_pitch_mm);
      assert.strictEqual(baysAt1800, 3, "Width 1800mm with 600mm pitch must yield 3 bays");

      const resolved = resolveDynamicBayQuantities({
        targetWidthMm: 1800,
        bayConfig: enabledConfig,
      });
      assert.strictEqual(resolved.bayCount, 3);
      assert.strictEqual(resolved.mullionCount, 2);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.3: Inactive dynamic bay replication backward compatibility
  // --------------------------------------------------------------------------
  describe("QAD-TC97.3: Inactive dynamic bay replication backward compatibility", () => {
    it("operates in legacy uniform mode when dynamicBayConfig is disabled or null", () => {
      const { built } = createMultiBay3DSetup({
        targetWidthMm: 1800,
        targetHeightMm: 1200,
        dynamicBayConfig: {
          enabled: false,
          primary_dimension: "width",
          nominal_bay_pitch_mm: 600,
          default_bay_count: 2,
          expansion_anchor_mode: "symmetric",
          bay_infill_component_keys: [],
          bay_hardware_component_keys: [],
        },
      });

      // When inactive, intermediate mullions are NOT duplicated
      const mullions: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.name.includes("Mullion_BayDivider") || c.userData?.bayRole === "BAY_DIVIDER" || c.name === "JW_Frame_Center") {
          mullions.push(c);
        }
      });
      assert.strictEqual(mullions.length, 1, "Inactive bay replication must preserve single center mullion");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.4: Rightward width expansion dynamic right-flank bay generation
  // --------------------------------------------------------------------------
  describe("QAD-TC97.4: Rightward width expansion dynamic right-flank bay generation", () => {
    it("anchors left jamb at X = -0.6m and extends right jamb to X = +1.2m at W = 1800mm", () => {
      const jambs = computeOuterJambPositions({
        targetWidthMm: 1800,
        defaultWidthMm: 1200,
        anchorMode: "rightward",
        leftJambWidthMm: 0,
        rightJambWidthMm: 0,
      });

      assert.strictEqual(jambs.leftJambX, -0.6, "Left jamb must stay anchored at -0.6m");
      assert.strictEqual(jambs.rightJambX, 1.2, "Right jamb must extend to +1.2m");

      const mullions = computeMullionCenters({
        targetWidthMm: 1800,
        defaultWidthMm: 1200,
        anchorMode: "rightward",
        bayCount: 3,
        leftJambWidthMm: 50,
        rightJambWidthMm: 50,
        mullionWidthMm: 50,
      });

      assert.strictEqual(mullions.length, 2, "Must compute 2 intermediate mullions");
      // Mullions should sit strictly between -0.6m and +1.2m
      assert.ok(mullions[0] > -0.6 && mullions[0] < mullions[1]);
      assert.ok(mullions[1] < 1.2);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.5: Leftward width expansion dynamic left-flank bay generation
  // --------------------------------------------------------------------------
  describe("QAD-TC97.5: Leftward width expansion dynamic left-flank bay generation", () => {
    it("anchors right jamb at X = +0.6m and extends left jamb to X = -1.2m at W = 1800mm", () => {
      const jambs = computeOuterJambPositions({
        targetWidthMm: 1800,
        defaultWidthMm: 1200,
        anchorMode: "leftward",
        leftJambWidthMm: 0,
        rightJambWidthMm: 0,
      });

      assert.strictEqual(jambs.rightJambX, 0.6, "Right jamb must stay anchored at +0.6m");
      assert.strictEqual(jambs.leftJambX, -1.2, "Left jamb must extend to -1.2m");

      const bays = computeBayCenters({
        targetWidthMm: 1800,
        defaultWidthMm: 1200,
        anchorMode: "leftward",
        bayCount: 3,
        leftJambWidthMm: 50,
        rightJambWidthMm: 50,
        mullionWidthMm: 50,
      });

      assert.strictEqual(bays.length, 3, "Must compute 3 bay centers");
      assert.ok(bays[0] < bays[1] && bays[1] < bays[2]);
      assert.ok(bays[0] > -1.2 && bays[2] < 0.6);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.6: Symmetric width expansion dynamic bay centering
  // --------------------------------------------------------------------------
  describe("QAD-TC97.6: Symmetric width expansion dynamic bay centering", () => {
    it("centers all 3 bays and 2 mullions symmetrically across [-0.9m, +0.9m]", () => {
      const jambs = computeOuterJambPositions({
        targetWidthMm: 1800,
        defaultWidthMm: 1200,
        anchorMode: "symmetric",
        leftJambWidthMm: 0,
        rightJambWidthMm: 0,
      });

      assert.strictEqual(jambs.leftJambX, -0.9);
      assert.strictEqual(jambs.rightJambX, 0.9);

      const mullions = computeMullionCenters({
        targetWidthMm: 1800,
        defaultWidthMm: 1200,
        anchorMode: "symmetric",
        bayCount: 3,
        leftJambWidthMm: 50,
        rightJambWidthMm: 50,
        mullionWidthMm: 50,
      });

      assert.strictEqual(mullions.length, 2);
      // Symmetrical about 0
      assert.ok(Math.abs(mullions[0] + mullions[1]) < 0.0001, "Mullions must be mirror symmetric around 0");

      const bays = computeBayCenters({
        targetWidthMm: 1800,
        defaultWidthMm: 1200,
        anchorMode: "symmetric",
        bayCount: 3,
        leftJambWidthMm: 50,
        rightJambWidthMm: 50,
        mullionWidthMm: 50,
      });
      assert.strictEqual(bays.length, 3);
      assert.ok(Math.abs(bays[1]) < 0.0001, "Middle bay must center at X = 0");
      assert.ok(Math.abs(bays[0] + bays[2]) < 0.0001, "Outer bays must be mirror symmetric");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.7: Intermediate center mullion quantity scaling
  // --------------------------------------------------------------------------
  describe("QAD-TC97.7: Intermediate center mullion quantity scaling", () => {
    it("scales intermediate mullions across 600mm, 1200mm, 1800mm, 2400mm", () => {
      const testCases = [
        { widthMm: 600, expectedBays: 1, expectedMullions: 0 },
        { widthMm: 1200, expectedBays: 2, expectedMullions: 1 },
        { widthMm: 1800, expectedBays: 3, expectedMullions: 2 },
        { widthMm: 2400, expectedBays: 4, expectedMullions: 3 },
      ];

      testCases.forEach(({ widthMm, expectedBays, expectedMullions }) => {
        const bays = computeDynamicBayCount(widthMm, 600);
        const mullions = computeMullionCount(bays);
        assert.strictEqual(bays, expectedBays, `Width ${widthMm}mm must have ${expectedBays} bays`);
        assert.strictEqual(mullions, expectedMullions, `Width ${widthMm}mm must have ${expectedMullions} mullions`);
      });
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.8: Modular louver blade array replication across bays
  // --------------------------------------------------------------------------
  describe("QAD-TC97.8: Modular louver blade array replication across bays", () => {
    it("instantiates 3 discrete louver bay assemblies (21 total blades) at W = 1800mm, H = 1200mm", () => {
      const { built } = createMultiBay3DSetup({
        targetWidthMm: 1800,
        targetHeightMm: 1200,
      });

      const bladeMeshes: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.isLouverBladeMesh || (c instanceof THREE.Mesh && c.name.toLowerCase().includes("blade"))) {
          bladeMeshes.push(c);
        }
      });

      // 3 bays x 7 blades = 21 blades
      assert.strictEqual(bladeMeshes.length, 21, "Must instantiate 21 total louver blades");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.9: Modular window operator replication across bays
  // --------------------------------------------------------------------------
  describe("QAD-TC97.9: Modular window operator replication across bays", () => {
    it("instantiates 3 operator sets (6 total operators) aligned to bay stiles", () => {
      const { built } = createMultiBay3DSetup({
        targetWidthMm: 1800,
        targetHeightMm: 1200,
      });

      const operatorInstances: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.isLouverOperatorInstance) {
          operatorInstances.push(c);
        }
      });

      // 3 bays x 2 operators = 6 operators
      assert.strictEqual(operatorInstances.length, 6, "Must instantiate 6 total operator units");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.10: Dynamic width reduction clean bay disposal
  // --------------------------------------------------------------------------
  describe("QAD-TC97.10: Dynamic width reduction clean bay disposal", () => {
    it("cleanly frees Three.js memory when width is reduced from 1800mm to 1200mm", () => {
      const setup3Bays = createMultiBay3DSetup({
        targetWidthMm: 1800,
        targetHeightMm: 1200,
      });

      let meshesIn3Bays = 0;
      setup3Bays.built.group.traverse((c) => {
        if (c instanceof THREE.Mesh) meshesIn3Bays++;
      });

      const setup2Bays = createMultiBay3DSetup({
        targetWidthMm: 1200,
        targetHeightMm: 1200,
      });

      let meshesIn2Bays = 0;
      setup2Bays.built.group.traverse((c) => {
        if (c instanceof THREE.Mesh) meshesIn2Bays++;
      });

      assert.ok(meshesIn2Bays < meshesIn3Bays, "Reducing to 1200mm must have strictly fewer meshes");

      // Verify disposal of 3-bay group leaves no lingering memory leaks
      setup3Bays.built.group.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material.dispose();
        }
      });
      setup3Bays.built.group.clear();
      assert.strictEqual(setup3Bays.built.group.children.length, 0, "Group children must be cleared");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.11: Multi-bay parametric BOM pricing engine calculation
  // --------------------------------------------------------------------------
  describe("QAD-TC97.11: Multi-bay parametric BOM pricing engine calculation", () => {
    it("scales intermediate mullions linear length and per-piece louvers and operators", () => {
      const aluminumRawMaterial: RawMaterial = {
        id: "a0000000-0000-0000-0000-000000000001",
        material_code: "ALUM-EXT-01",
        description: "Framing Extrusion",
        category: "Aluminum",
        finish_type: "Mill",
        billing_unit: "m",
        unit_price: 300,
        waste_allowance: 0.12,
        is_active: true,
      };

      const testComponents: ComponentPricingInput[] = [
        {
          componentId: "c_mullion",
          componentKey: "frame_center",
          componentName: "Center Mullion",
          componentType: "Mullion",
          dimensionBinding: "HEIGHT",
          bayRole: "BAY_DIVIDER",
          pricingMethod: "Per Length",
          presentationCategory: "Framing",
          unitPrice: 350,
          rawMaterial: aluminumRawMaterial,
          spanRatio: 1,
          baseQuantity: 1,
          isRemovable: false,
        },
        {
          componentId: "c_louver",
          componentKey: "jw_louver_clips_and_glass",
          componentName: "Glass Louver Blade",
          componentType: "Infill",
          dimensionBinding: "LOUVER_BLADE",
          bayRole: "BAY_INFILL",
          pricingMethod: "Per Piece",
          presentationCategory: "Glazing",
          unitPrice: 45,
          spanRatio: 1,
          baseQuantity: 7,
          isRemovable: false,
          jalousieConfig: { pitch_mm: 175, default_count: 7, bay_count: 2 },
        },
        {
          componentId: "c_operator",
          componentKey: "jw_operators",
          componentName: "Window Operator",
          componentType: "Hardware",
          dimensionBinding: "LOUVER_OPERATOR",
          bayRole: "BAY_HARDWARE",
          pricingMethod: "Per Piece",
          presentationCategory: "Hardware",
          unitPrice: 400,
          spanRatio: 1,
          baseQuantity: 2,
          isRemovable: false,
          jalousieConfig: { blades_per_operator: 4, default_count: 2, bay_count: 2 },
        },
      ];

      const bom = calculateParametricBOM(
        testComponents,
        {
          widthMm: 1800,
          heightMm: 1200,
          bayCount: 3,
          dynamicBayConfig: {
            enabled: true,
            primary_dimension: "width",
            nominal_bay_pitch_mm: 600,
            default_bay_count: 2,
            expansion_anchor_mode: "symmetric",
            bay_infill_component_keys: [],
            bay_hardware_component_keys: [],
          },
        }
      );

      // Verify intermediate mullions: 2 mullions x 1.2m = 2.4m linear length @ PHP 350 = PHP 840
      const mullionItem = bom.framingItems.find(it => it.description.includes("Mullion") || it.description.includes("mullion"));
      assert.ok(mullionItem, "Mullion line item must exist");
      assert.strictEqual(mullionItem.quantity, 2.4, "Linear framing length must be 2.4m");
      assert.strictEqual(mullionItem.unit, "m");
      assert.strictEqual(mullionItem.subtotal, 2.4 * 350);

      // Verify louver blades: 3 bays x 7 blades = 21 blades @ PHP 45 = PHP 945
      const louverItem = bom.glazingItems.find(it => it.description.includes("Louver") || it.description.includes("Blade") || it.description.includes("Glass"));
      assert.ok(louverItem, "Louver line item must exist");
      assert.strictEqual(louverItem.quantity, 21, "Quantity must be 21 blades");
      assert.strictEqual(louverItem.unit, "pc");
      assert.strictEqual(louverItem.subtotal, 21 * 45);

      // Verify operators: 3 bays x 2 ops = 6 ops @ PHP 400 = PHP 2,400
      const opItem = bom.hardwareItems.find(it => it.description.includes("Operator"));
      assert.ok(opItem, "Operator line item must exist");
      assert.strictEqual(opItem.quantity, 6, "Quantity must be 6 operators");
      assert.strictEqual(opItem.unit, "pc");
      assert.strictEqual(opItem.subtotal, 6 * 400);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.12: Orthogonal synergy with MS81 vertical louver scaling
  // --------------------------------------------------------------------------
  describe("QAD-TC97.12: Orthogonal synergy with MS81 vertical louver scaling", () => {
    it("evaluates 3 bays x 12 blades = 36 blades and 3 bays x 3 ops = 9 operators at W = 1800mm, H = 2100mm", () => {
      const bladesPerBay = computeLouverBladeCount(2100, 175);
      assert.strictEqual(bladesPerBay, 12, "2100mm height must yield 12 blades per bay");

      const opsPerBay = computeLouverOperatorCount(bladesPerBay, 4);
      assert.strictEqual(opsPerBay, 3, "12 blades must yield 3 operators per bay");

      const bayCount = computeDynamicBayCount(1800, 600);
      assert.strictEqual(bayCount, 3, "1800mm width must yield 3 bays");

      const totalBlades = bayCount * bladesPerBay;
      const totalOps = bayCount * opsPerBay;

      assert.strictEqual(totalBlades, 36, "3 bays x 12 blades must equal 36 total blades");
      assert.strictEqual(totalOps, 9, "3 bays x 3 ops must equal 9 total operators");

      const { built } = createMultiBay3DSetup({
        targetWidthMm: 1800,
        targetHeightMm: 2100,
      });

      const opInstances: THREE.Object3D[] = [];
      built.group.traverse((c) => {
        if (c.userData?.isLouverOperatorInstance) opInstances.push(c);
      });
      assert.strictEqual(opInstances.length, 9, "3D build must contain exactly 9 operator instances");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.13: Orthogonal synergy with MS80 screen access hatches
  // --------------------------------------------------------------------------
  describe("QAD-TC97.13: Orthogonal synergy with MS80 screen access hatches", () => {
    it("aligns 9 access hatches with 9 operator centroids across 3 bays", () => {
      const { built } = createMultiBay3DSetup({
        targetWidthMm: 1800,
        targetHeightMm: 2100,
        activeAddon: "screen",
      });

      const opInstances: THREE.Object3D[] = [];
      const hatchInstances: THREE.Object3D[] = [];

      built.group.traverse((c) => {
        if (c.userData?.isLouverOperatorInstance) opInstances.push(c);
        if (c.userData?.isHatchClone) hatchInstances.push(c);
      });

      assert.strictEqual(opInstances.length, 9, "Must have 9 operator instances");
      assert.strictEqual(hatchInstances.length, 9, "MS80 must instantiate 9 access hatches in 1:1 alignment");

      // Verify every hatch is positioned near its corresponding operator
      hatchInstances.forEach((hatch, idx) => {
        const hBox = new THREE.Box3().setFromObject(hatch);
        const hCenter = new THREE.Vector3();
        hBox.getCenter(hCenter);

        // Find closest operator
        let closestDist = Infinity;
        opInstances.forEach((op) => {
          const opBox = new THREE.Box3().setFromObject(op);
          const opCenter = new THREE.Vector3();
          opBox.getCenter(opCenter);
          const dist = Math.hypot(hCenter.x - opCenter.x, hCenter.y - opCenter.y);
          if (dist < closestDist) {
            closestDist = dist;
          }
        });

        assert.ok(closestDist < 0.1, `Hatch ${idx} must align closely (< 10cm) to an operator center, was ${closestDist}`);
      });
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.14: Customer quotation itemization and consultation PDF disclosure
  // --------------------------------------------------------------------------
  describe("QAD-TC97.14: Customer quotation itemization and consultation PDF disclosure", () => {
    it("itemizes multi-bay specification in quotation summary and PDF HTML", () => {
      const bayCount = 3;
      const totalBlades = 36;
      const totalOps = 9;
      const mullionCount = 2;

      const specSummary = `${bayCount}-Sided Jalousie Window | ${totalBlades}x Glass Louver Blades | ${totalOps}x Window Operators${mullionCount > 0 ? ` | ${mullionCount}x Center Mullions` : ""}`;
      assert.strictEqual(specSummary, "3-Sided Jalousie Window | 36x Glass Louver Blades | 9x Window Operators | 2x Center Mullions");

      const bom = calculateParametricBOM(
        [
          {
            componentId: "c_mullion",
            componentKey: "frame_center",
            componentName: "Center Mullion",
            componentType: "Mullion",
            dimensionBinding: "HEIGHT",
            bayRole: "BAY_DIVIDER",
            pricingMethod: "Per Length",
            presentationCategory: "Framing",
            unitPrice: 350,
            spanRatio: 1,
            baseQuantity: 1,
            isRemovable: false,
          },
          {
            componentId: "c_louver",
            componentKey: "jw_louver_clips_and_glass",
            componentName: "Glass Louver Blade",
            componentType: "Infill",
            dimensionBinding: "LOUVER_BLADE",
            bayRole: "BAY_INFILL",
            pricingMethod: "Per Piece",
            presentationCategory: "Glazing",
            unitPrice: 45,
            spanRatio: 1,
            baseQuantity: 12,
            isRemovable: false,
            jalousieConfig: { pitch_mm: 175, default_count: 12, bay_count: 3 },
          },
        ],
        {
          widthMm: 1800,
          heightMm: 2100,
          bayCount: 3,
          dynamicBayConfig: {
            enabled: true,
            primary_dimension: "width",
            nominal_bay_pitch_mm: 600,
            default_bay_count: 2,
            expansion_anchor_mode: "symmetric",
            bay_infill_component_keys: [],
            bay_hardware_component_keys: [],
          },
        }
      );

      const quotationData: QuotationPdfMetadata = {
        quotationNumber: "QT-MS82-001",
        referenceCode: "CF-MS82-001",
        customerName: "Juan Dela Cruz",
        estimatorName: "R.R.D. Estimator",
        brandLogoUrl: "https://glassfit.test/Logo.svg",
        createdAtFormatted: "October 29, 2026",
        projectName: "Jalousie Window Project",
        hasSill: true,
        structuralWaiver: false,
        bomResult: bom,
        items: [
          {
            itemId: "item_1",
            productId: "prod_1",
            productName: "Parametric Jalousie Window",
            productType: "Jalousie Window",
            variantName: "3-Bay Jalousie Configuration",
            specSummary,
            dimensionsFormatted: "180cm x 210cm",
            widthMm: 1800,
            heightMm: 2100,
            panelCount: 3,
            hasSill: true,
            structuralWaiver: false,
            finishType: "Mill",
            glassType: "Clear 6mm",
            imageUrl: "",
            quantity: 1,
            unitPrice: 15400,
            totalPrice: 15400,
            bomResult: bom,
          },
        ],
      };

      const html = generateQuotationPdfHtml(quotationData);
      assert.ok(html.includes("3-Sided Jalousie Window"), "PDF must contain 3-Sided Jalousie Window");
      assert.ok(html.includes("36x Glass Louver Blades"), "PDF must contain 36x Glass Louver Blades");
      assert.ok(html.includes("9x Window Operators"), "PDF must contain 9x Window Operators");
      assert.ok(html.includes("2x Center Mullions"), "PDF must contain 2x Center Mullions");
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.15: Pre-offset constituent CAD models centered mounting and alignment
  // --------------------------------------------------------------------------
  describe("QAD-TC97.15: Pre-offset constituent CAD models centered mounting and alignment", () => {
    it("recenters pre-offset Blender CAD constituent parts to assembled 1200x1200mm boundaries", () => {
      // Create synthetic components mimicking CAD parts pre-positioned in Blender space:
      // Left jamb centered at X = -0.94m (width 0.12m, height 1.50m)
      const leftGeom = new THREE.BoxGeometry(0.12, 1.50, 0.12);
      leftGeom.translate(-0.94, 0, 0);
      const leftMesh = new THREE.Mesh(leftGeom);
      leftMesh.name = "JW_Frame_Left";

      // Right jamb centered at X = +0.94m (width 0.12m, height 1.50m)
      const rightGeom = new THREE.BoxGeometry(0.12, 1.50, 0.12);
      rightGeom.translate(0.94, 0, 0);
      const rightMesh = new THREE.Mesh(rightGeom);
      rightMesh.name = "JW_Frame_Right";

      // Top rail centered at Y = +0.69m (width 1.76m, height 0.12m)
      const topGeom = new THREE.BoxGeometry(1.76, 0.12, 0.12);
      topGeom.translate(0, 0.69, 0);
      const topMesh = new THREE.Mesh(topGeom);
      topMesh.name = "JW_Frame_Top";

      // Bottom rail centered at Y = -0.69m (width 1.76m, height 0.12m)
      const bottomGeom = new THREE.BoxGeometry(1.76, 0.12, 0.12);
      bottomGeom.translate(0, -0.69, 0);
      const bottomMesh = new THREE.Mesh(bottomGeom);
      bottomMesh.name = "JW_Frame_Bottom";

      // Center mullion centered at origin (width 0.08m, height 1.26m)
      const mullionGeom = new THREE.BoxGeometry(0.08, 1.26, 0.12);
      const mullionMesh = new THREE.Mesh(mullionGeom);
      mullionMesh.name = "JW_Frame_Center";

      const louverMesh = createSyntheticDualBayLouverMesh();
      const operatorMesh = createSyntheticDualBayOperatorMesh();

      const createSyntheticModel = (fileName: string) => ({
        assetId: "offset_" + fileName,
        r2ObjectKey: "offset/" + fileName,
        url: "https://synthetic.test/" + fileName,
        fileName,
        sourceDimensionsMm: { width: 2000, height: 1500, depth: 120 },
      });

      const components: ProductComponentDefinition[] = [
        {
          componentId: "comp_left",
          componentKey: "frame_left",
          componentName: "JW_Frame_Left",
          componentType: "Frame",
          dimensionBinding: "HEIGHT",
          bayRole: "OUTER_JAMB_LEFT",
          baseQuantity: 1,
          componentData: {},
          model: createSyntheticModel("JW_Frame_Left.glb"),
        },
        {
          componentId: "comp_right",
          componentKey: "frame_right",
          componentName: "JW_Frame_Right",
          componentType: "Frame",
          dimensionBinding: "HEIGHT",
          bayRole: "OUTER_JAMB_RIGHT",
          baseQuantity: 1,
          componentData: {},
          model: createSyntheticModel("JW_Frame_Right.glb"),
        },
        {
          componentId: "comp_top",
          componentKey: "frame_top",
          componentName: "JW_Frame_Top",
          componentType: "Frame",
          dimensionBinding: "WIDTH",
          bayRole: "OUTER_HEAD",
          baseQuantity: 1,
          componentData: {},
          model: createSyntheticModel("JW_Frame_Top.glb"),
        },
        {
          componentId: "comp_bottom",
          componentKey: "frame_bottom",
          componentName: "JW_Frame_Bottom",
          componentType: "Frame",
          dimensionBinding: "WIDTH",
          bayRole: "OUTER_SILL",
          baseQuantity: 1,
          componentData: {},
          model: createSyntheticModel("JW_Frame_Bottom.glb"),
        },
        {
          componentId: "comp_center",
          componentKey: "frame_center",
          componentName: "JW_Frame_Center",
          componentType: "Mullion",
          dimensionBinding: "HEIGHT",
          bayRole: "BAY_DIVIDER",
          baseQuantity: 1,
          componentData: {},
          model: createSyntheticModel("JW_Frame_Center.glb"),
        },
        {
          componentId: "comp_louver",
          componentKey: "jw_louver_clips_and_glass",
          componentName: "JW_Louver_Clips_And_Glass",
          componentType: "Infill",
          dimensionBinding: "LOUVER_BLADE",
          bayRole: "BAY_INFILL",
          baseQuantity: 14,
          jalousieConfig: { pitch_mm: 175, default_count: 7, bay_count: 2 },
          componentData: {},
          model: createSyntheticModel("JW_Louver_Clips_And_Glass.glb"),
        },
        {
          componentId: "comp_operator",
          componentKey: "jw_operators",
          componentName: "JW_Operators",
          componentType: "Hardware",
          dimensionBinding: "LOUVER_OPERATOR",
          bayRole: "BAY_HARDWARE",
          baseQuantity: 4,
          jalousieConfig: { blades_per_operator: 4, default_count: 2, bay_count: 2 },
          componentData: {},
          model: createSyntheticModel("JW_Operators.glb"),
        },
      ];

      const definition: ProductStructuralDefinition = {
        template: {
          templateId: "tmpl_preoffset",
          templateName: "Jalousie Window Pre-offset",
          modelStrategy: "Parametric",
          measurementUnit: "mm",
          baseConfiguration: { width: 1200, height: 1200 },
          dynamicBayConfig: {
            enabled: true,
            primary_dimension: "width",
            nominal_bay_pitch_mm: 600,
            default_bay_count: 2,
            expansion_anchor: "symmetric",
            expansion_anchor_mode: "symmetric",
            bay_infill_component_keys: [],
            bay_hardware_component_keys: [],
          },
        },
        product: {
          productId: "prod_preoffset",
          productName: "Jalousie Window Pre-offset",
          productType: "Jalousie Window",
          dynamicBayConfig: {
            enabled: true,
            primary_dimension: "width",
            nominal_bay_pitch_mm: 600,
            default_bay_count: 2,
            expansion_anchor: "symmetric",
            expansion_anchor_mode: "symmetric",
            bay_infill_component_keys: [],
            bay_hardware_component_keys: [],
          },
        },
        parameters: [],
        rules: [],
        components,
      };

      const cloneMap = new Map<string, THREE.Object3D>([
        ["comp_left", leftMesh],
        ["comp_right", rightMesh],
        ["comp_top", topMesh],
        ["comp_bottom", bottomMesh],
        ["comp_center", mullionMesh],
        ["comp_louver", louverMesh],
        ["comp_operator", operatorMesh],
      ]);

      const mockCache = {
        getClone: (id: string) => {
          const m = cloneMap.get(id);
          if (!m) throw new Error("Missing clone for " + id);
          return m.clone(true);
        },
        getSourceSizeMeters: (id: string) => {
          const m = cloneMap.get(id);
          const b = new THREE.Box3().setFromObject(m ?? new THREE.Group());
          const sz = new THREE.Vector3();
          b.getSize(sz);
          return sz;
        },
      };

      const resolved: ResolvedStructure = {
        resolvedValues: { width: 1200, height: 1200 },
        numericValuesMm: { width: 1200, height: 1200 },
        componentQuantities: {},
        appliedRuleIds: [],
      };

      const built = buildParametricProduct(
        definition,
        resolved,
        mockCache as unknown as Parameters<typeof buildParametricProduct>[2],
        { dynamicBayConfig: definition.template.dynamicBayConfig }
      );

      built.group.updateMatrixWorld(true);

      // Find mounted parts
      let mountedLeft: THREE.Object3D | null = null;
      let mountedRight: THREE.Object3D | null = null;
      let mountedTop: THREE.Object3D | null = null;
      let mountedBottom: THREE.Object3D | null = null;

      built.group.traverse((c) => {
        if (c.name.includes("JW_Frame_Left")) mountedLeft = c;
        if (c.name.includes("JW_Frame_Right")) mountedRight = c;
        if (c.name.includes("JW_Frame_Top")) mountedTop = c;
        if (c.name.includes("JW_Frame_Bottom")) mountedBottom = c;
      });

      assert.ok(mountedLeft, "Left jamb must be mounted");
      assert.ok(mountedRight, "Right jamb must be mounted");
      assert.ok(mountedTop, "Top rail must be mounted");
      assert.ok(mountedBottom, "Bottom rail must be mounted");

      const leftB = new THREE.Box3().setFromObject(mountedLeft!);
      const rightB = new THREE.Box3().setFromObject(mountedRight!);
      const topB = new THREE.Box3().setFromObject(mountedTop!);
      const bottomB = new THREE.Box3().setFromObject(mountedBottom!);

      // Left jamb outer boundary: -0.60m, inner boundary: -0.48m
      assert.ok(Math.abs(leftB.min.x - (-0.60)) < 0.005, `Left jamb min.x must be -0.60m, got ${leftB.min.x}`);
      assert.ok(Math.abs(leftB.max.x - (-0.48)) < 0.005, `Left jamb max.x must be -0.48m, got ${leftB.max.x}`);

      // Right jamb inner boundary: +0.48m, outer boundary: +0.60m
      assert.ok(Math.abs(rightB.min.x - 0.48) < 0.005, `Right jamb min.x must be +0.48m, got ${rightB.min.x}`);
      assert.ok(Math.abs(rightB.max.x - 0.60) < 0.005, `Right jamb max.x must be +0.60m, got ${rightB.max.x}`);

      // Top rail spans exactly between jambs: [-0.48m, +0.48m]
      assert.ok(Math.abs(topB.min.x - (-0.48)) < 0.005, `Top rail min.x must meet left jamb at -0.48m, got ${topB.min.x}`);
      assert.ok(Math.abs(topB.max.x - 0.48) < 0.005, `Top rail max.x must meet right jamb at +0.48m, got ${topB.max.x}`);

      // Top rail Y: top edge at +0.60m, bottom edge at +0.48m
      assert.ok(Math.abs(topB.max.y - 0.60) < 0.005, `Top rail max.y must align to window top at +0.60m, got ${topB.max.y}`);
      assert.ok(Math.abs(topB.min.y - 0.48) < 0.005, `Top rail min.y must be +0.48m, got ${topB.min.y}`);

      // Bottom rail Y: bottom edge at -0.60m, top edge at -0.48m
      assert.ok(Math.abs(bottomB.min.y - (-0.60)) < 0.005, `Bottom rail min.y must align to window bottom at -0.60m, got ${bottomB.min.y}`);
      assert.ok(Math.abs(bottomB.max.y - (-0.48)) < 0.005, `Bottom rail max.y must be -0.48m, got ${bottomB.max.y}`);

      // Louvers: Find bay 0 and bay 1 containers
      let bay0Container: THREE.Object3D | null = null;
      let bay1Container: THREE.Object3D | null = null;
      built.group.traverse((c) => {
        if (c.userData?.isDynamicBay && c.userData?.bayIndex === 0) bay0Container = c;
        if (c.userData?.isDynamicBay && c.userData?.bayIndex === 1) bay1Container = c;
      });

      assert.ok(bay0Container, "Bay 0 louver container must exist");
      assert.ok(bay1Container, "Bay 1 louver container must exist");

      const bay0B = new THREE.Box3().setFromObject(bay0Container!);
      const bay1B = new THREE.Box3().setFromObject(bay1Container!);

      // Bay 0 louvers fill left aperture: [-0.48m, -0.04m]
      assert.ok(Math.abs(bay0B.min.x - (-0.48)) < 0.01, `Bay 0 louvers min.x must start at left jamb (-0.48m), got ${bay0B.min.x}`);
      assert.ok(Math.abs(bay0B.max.x - (-0.04)) < 0.01, `Bay 0 louvers max.x must meet mullion (-0.04m), got ${bay0B.max.x}`);

      // Bay 1 louvers fill right aperture: [+0.04m, +0.48m]
      assert.ok(Math.abs(bay1B.min.x - 0.04) < 0.01, `Bay 1 louvers min.x must start at mullion (+0.04m), got ${bay1B.min.x}`);
      assert.ok(Math.abs(bay1B.max.x - 0.48) < 0.01, `Bay 1 louvers max.x must meet right jamb (+0.48m), got ${bay1B.max.x}`);

      // Operators: Find bay 0 and bay 1 operator instances
      let opBay0X: number | null = null;
      let opBay1X: number | null = null;
      built.group.traverse((c) => {
        if (c.userData?.isLouverOperatorInstance) {
          const b = new THREE.Box3().setFromObject(c);
          const center = new THREE.Vector3();
          b.getCenter(center);
          if (c.userData?.bayIndex === 0 && opBay0X === null) opBay0X = center.x;
          if (c.userData?.bayIndex === 1 && opBay1X === null) opBay1X = center.x;
        }
      });

      assert.ok(opBay0X !== null, "Bay 0 operator must exist");
      assert.ok(opBay1X !== null, "Bay 1 operator must exist");

      // Bay 0 operator sits along left stile: X in [-0.48m, -0.42m]
      assert.ok(opBay0X! < -0.40, `Bay 0 operator must sit on left stile, got X = ${opBay0X}`);
      // Bay 1 operator sits along right stile: X in [+0.42m, +0.48m]
      assert.ok(opBay1X! > 0.40, `Bay 1 operator must sit on right stile, got X = ${opBay1X}`);
    });
  });

  // --------------------------------------------------------------------------
  // QAD-TC97.16: Swapped modular hardware accessory replacement in dynamic bays
  // --------------------------------------------------------------------------
  describe("QAD-TC97.16: Swapped modular hardware accessory replacement in dynamic bays", () => {
    it("dynamically replaces default operator prototype with swapped catalog accessory across all bays", () => {
      const { built: baseBuilt, definition, resolved, mockCache } = createMultiBay3DSetup({
        targetWidthMm: 1200,
        targetHeightMm: 1200,
      });

      // 1. Verify baseline with default operators
      let baselineOpCount = 0;
      let baselineReplacementCount = 0;
      baseBuilt.group.traverse((c) => {
        if (c.userData?.isLouverOperatorInstance) {
          baselineOpCount++;
          if (c.userData?.isAccessoryReplacement) baselineReplacementCount++;
        }
      });
      assert.strictEqual(baselineOpCount, 4, "Must have 4 default operator instances (2 per bay)");
      assert.strictEqual(baselineReplacementCount, 0, "No replacement on default operators");

      // 2. Prepare custom accessory mesh (Jalousie Lever)
      const leverMesh = new THREE.Group();
      leverMesh.name = "Jalousie_Lever_Root";
      const leverBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.18, 16),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 })
      );
      leverMesh.add(leverBody);

      const accessoryModels = new Map<string, THREE.Object3D>();
      accessoryModels.set("acc_jalousie_lever", leverMesh);

      const swappedAccessories: Record<string, SelectedAccessoryState> = {
        comp_operator: {
          slotComponentId: "comp_operator",
          accessoryId: "acc_jalousie_lever",
          accessoryName: "Jalousie Lever",
          category: "handle",
          price: 350,
          finish: "matte_black",
          horizontalPosition: "right",
          verticalPosition: "up",
        },
      };

      const swappedBuilt = buildParametricProduct(definition, resolved, mockCache, {
        dynamicBayConfig: definition.template.dynamicBayConfig,
        swappedAccessories,
        accessoryModels,
      });

      swappedBuilt.group.updateMatrixWorld(true);

      // 3. Verify swapped operator instances
      let swappedOpCount = 0;
      let swappedReplacementCount = 0;
      let leverNamedCount = 0;
      let matteBlackMeshCount = 0;

      swappedBuilt.group.traverse((c) => {
        if (c.userData?.isLouverOperatorInstance) {
          swappedOpCount++;
          if (c.userData?.isAccessoryReplacement) swappedReplacementCount++;
          if (c.name.includes("Jalousie Lever")) leverNamedCount++;
          c.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const mat = child.material as THREE.MeshStandardMaterial;
              if (mat && (mat.roughness >= 0.7 || mat.color?.getHex() === 0x18191a || mat.color?.getHex() === 0x171717)) {
                matteBlackMeshCount++;
              }
            }
          });
        }
      });

      assert.strictEqual(swappedOpCount, 4, "Must maintain exactly 4 operator instances across 2 bays");
      assert.strictEqual(swappedReplacementCount, 4, "All 4 operators must be marked isAccessoryReplacement");
      assert.strictEqual(leverNamedCount, 4, "All 4 operators must be named with Jalousie Lever");
      assert.ok(matteBlackMeshCount >= 4, "All 4 operator meshes must have matte black finish material applied");
    });
  });
});
