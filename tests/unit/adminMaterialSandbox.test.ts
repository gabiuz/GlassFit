/**
 * Unit Test Suite: Admin Pre-Activation Validation Sandbox & Material Simulation (IMP-MS65)
 *
 * Upstream Specifications: docs/implementation/ms65.md
 * Acceptance Catalog: QAD-TC80.1 through QAD-TC80.8
 * Traceability Codes: PRD-F10, PRD-F14, SDD-C4, SDD-C7, SDD-C9, ERD-E6, ERD-E17, DSD-UI10
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as THREE from "three";
import {
  calculateParametricBOM,
  type ComponentPricingInput,
} from "../../src/lib/pricing/pricingEngine";
import {
  resolvePBRProperties,
  applyPBRToMesh,
} from "../../src/lib/visualization/materialClassifier";
import type { RawMaterial } from "../../src/lib/pricing/types";
import type { ProductComponentDefinition } from "../../src/lib/visualization/types";

// Mock raw materials catalog
const mockMaterials: RawMaterial[] = [
  {
    id: "mat-al-head-anlk",
    material_code: "AL-798-DH-ANLK",
    description: "Series 798 Double Head (Analok)",
    category: "Aluminum",
    finish_type: "Analok",
    billing_unit: "m",
    unit_price: 90.0,
    waste_allowance: 0.12,
    is_active: true,
  },
  {
    id: "mat-al-head-pcw",
    material_code: "AL-798-DH-PCW",
    description: "Series 798 Double Head (Powder Coated White)",
    category: "Aluminum",
    finish_type: "PowderCoatedWhite",
    billing_unit: "m",
    unit_price: 105.0,
    waste_allowance: 0.12,
    is_active: true,
  },
  {
    id: "mat-al-sill-anlk",
    material_code: "AL-798-DS-ANLK",
    description: "Series 798 Double Sill (Analok)",
    category: "Aluminum",
    finish_type: "Analok",
    billing_unit: "m",
    unit_price: 110.0,
    waste_allowance: 0.12,
    is_active: true,
  },
  {
    id: "mat-al-sill-pcw",
    material_code: "AL-798-DS-PCW",
    description: "Series 798 Double Sill (Powder Coated White)",
    category: "Aluminum",
    finish_type: "PowderCoatedWhite",
    billing_unit: "m",
    unit_price: 125.0,
    waste_allowance: 0.12,
    is_active: true,
  },
  {
    id: "mat-al-jamb-anlk",
    material_code: "AL-798-DJ-ANLK",
    description: "Series 798 Double Jamb (Analok)",
    category: "Aluminum",
    finish_type: "Analok",
    billing_unit: "m",
    unit_price: 70.0,
    waste_allowance: 0.12,
    is_active: true,
  },
  {
    id: "mat-al-jamb-pcw",
    material_code: "AL-798-DJ-PCW",
    description: "Series 798 Double Jamb (Powder Coated White)",
    category: "Aluminum",
    finish_type: "PowderCoatedWhite",
    billing_unit: "m",
    unit_price: 85.0,
    waste_allowance: 0.12,
    is_active: true,
  },
  {
    id: "mat-gl-6mm-clear",
    material_code: "GL-6MM-CLR",
    description: "6mm Clear Float Glass",
    category: "Glass",
    finish_type: "Clear",
    billing_unit: "sqm",
    unit_price: 680.0,
    waste_allowance: 0.1,
    is_active: true,
  },
  {
    id: "mat-gl-6mm-bronze",
    material_code: "GL-6MM-BRZ",
    description: "6mm Tinted Bronze Float Glass",
    category: "Glass",
    finish_type: "Bronze",
    billing_unit: "sqm",
    unit_price: 780.0,
    waste_allowance: 0.1,
    is_active: true,
  },
  {
    id: "mat-hw-roller",
    material_code: "HW-798-ROL",
    description: "Series 798 POM Roller",
    category: "Hardware",
    finish_type: "None",
    billing_unit: "pc",
    unit_price: 25.0,
    waste_allowance: 0.0,
    is_active: true,
  },
];

// Helper to construct mock product components with multi-material bindings
function createMockComponents(): ProductComponentDefinition[] {
  return [
    {
      componentId: "c-head",
      componentKey: "frame-top",
      componentName: "Series 798 Double Head",
      componentType: "Frame",
      baseQuantity: 1,
      rawMaterialId: "mat-al-head-anlk",
      allowedMaterials: [
        { rawMaterialId: "mat-al-head-anlk", isDefault: true, displayOrder: 0 },
        { rawMaterialId: "mat-al-head-pcw", isDefault: false, displayOrder: 1 },
      ],
      defaultRawMaterialId: "mat-al-head-anlk",
      dimensionBinding: "WIDTH",
      spanRatio: 1.0,
      isRemovable: false,
      presentationCategory: "Framing",
      componentData: {},
      model: {
        assetId: "a-head",
        r2ObjectKey: "models/head.glb",
        url: "http://localhost/models/head.glb",
        fileName: "head.glb",
        sourceDimensionsMm: null,
      },
    },
    {
      componentId: "c-sill",
      componentKey: "frame-bottom",
      componentName: "Series 798 Double Sill",
      componentType: "Frame",
      baseQuantity: 1,
      rawMaterialId: "mat-al-sill-anlk",
      allowedMaterials: [
        { rawMaterialId: "mat-al-sill-anlk", isDefault: true, displayOrder: 0 },
        { rawMaterialId: "mat-al-sill-pcw", isDefault: false, displayOrder: 1 },
      ],
      defaultRawMaterialId: "mat-al-sill-anlk",
      dimensionBinding: "WIDTH",
      spanRatio: 1.0,
      isRemovable: true,
      togglePropertyKey: "has_sill",
      presentationCategory: "Framing",
      componentData: {},
      model: {
        assetId: "a-sill",
        r2ObjectKey: "models/sill.glb",
        url: "http://localhost/models/sill.glb",
        fileName: "sill.glb",
        sourceDimensionsMm: null,
      },
    },
    {
      componentId: "c-jamb",
      componentKey: "frame-left",
      componentName: "Series 798 Double Jamb",
      componentType: "Frame",
      baseQuantity: 2,
      rawMaterialId: "mat-al-jamb-anlk",
      allowedMaterials: [
        { rawMaterialId: "mat-al-jamb-anlk", isDefault: true, displayOrder: 0 },
        { rawMaterialId: "mat-al-jamb-pcw", isDefault: false, displayOrder: 1 },
      ],
      defaultRawMaterialId: "mat-al-jamb-anlk",
      dimensionBinding: "HEIGHT",
      spanRatio: 1.0,
      isRemovable: false,
      presentationCategory: "Framing",
      componentData: {},
      model: {
        assetId: "a-jamb",
        r2ObjectKey: "models/jamb.glb",
        url: "http://localhost/models/jamb.glb",
        fileName: "jamb.glb",
        sourceDimensionsMm: null,
      },
    },
    {
      componentId: "c-glass",
      componentKey: "glass-panel",
      componentName: "6mm Glazing Infill",
      componentType: "Glass",
      baseQuantity: 2,
      rawMaterialId: "mat-gl-6mm-clear",
      allowedMaterials: [
        { rawMaterialId: "mat-gl-6mm-clear", isDefault: true, displayOrder: 0 },
        { rawMaterialId: "mat-gl-6mm-bronze", isDefault: false, displayOrder: 1 },
      ],
      defaultRawMaterialId: "mat-gl-6mm-clear",
      dimensionBinding: "AREA",
      spanRatio: 1.0,
      isRemovable: false,
      presentationCategory: "Glazing",
      componentData: {},
      model: {
        assetId: "a-glass",
        r2ObjectKey: "models/glass.glb",
        url: "http://localhost/models/glass.glb",
        fileName: "glass.glb",
        sourceDimensionsMm: null,
      },
    },
    {
      componentId: "c-roller",
      componentKey: "roller-hw",
      componentName: "POM Roller Assembly",
      componentType: "Hardware",
      baseQuantity: 4,
      rawMaterialId: "mat-hw-roller",
      allowedMaterials: [
        { rawMaterialId: "mat-hw-roller", isDefault: true, displayOrder: 0 },
      ],
      defaultRawMaterialId: "mat-hw-roller",
      dimensionBinding: "FIXED",
      spanRatio: 1.0,
      isRemovable: false,
      presentationCategory: "Hardware",
      componentData: {},
      model: {
        assetId: "a-roller",
        r2ObjectKey: "models/roller.glb",
        url: "http://localhost/models/roller.glb",
        fileName: "roller.glb",
        sourceDimensionsMm: null,
      },
    },
  ];
}

function buildPricingInputs(
  components: ProductComponentDefinition[],
  materialOverrides: Record<string, string>,
  materialsList: RawMaterial[]
): ComponentPricingInput[] {
  return components.map((comp) => {
    const activeMatId =
      materialOverrides[comp.componentKey] ||
      comp.allowedMaterials?.find((m) => m.isDefault)?.rawMaterialId ||
      comp.rawMaterialId;

    const boundMat =
      materialsList.find((m) => m.id === activeMatId) ||
      (comp.rawMaterialId ? materialsList.find((m) => m.id === comp.rawMaterialId) : null) ||
      comp.rawMaterial ||
      null;

    return {
      componentKey: comp.componentKey,
      componentName: comp.componentName,
      dimensionBinding: comp.dimensionBinding || "FIXED",
      spanRatio: comp.spanRatio ?? 1.0,
      baseQuantity: comp.baseQuantity ?? 1,
      isRemovable: comp.isRemovable ?? false,
      togglePropertyKey: comp.togglePropertyKey,
      presentationCategory: comp.presentationCategory || "Framing",
      rawMaterial: boundMat,
    };
  });
}

describe("IMP-MS65: Admin Pre-Activation Validation Sandbox & Material Simulation (QAD-TC80)", () => {
  // --------------------------------------------------------------------------
  // QAD-TC80.1: Step 6 material state initialization
  // --------------------------------------------------------------------------
  it("QAD-TC80.1: Initializing material overrides sets each part to its Step 4 default material", () => {
    const components = createMockComponents();
    const initialOverrides: Record<string, string> = {};

    components.forEach((comp) => {
      const defaultMat =
        comp.allowedMaterials?.find((m) => m.isDefault)?.rawMaterialId ||
        comp.rawMaterialId ||
        "";
      initialOverrides[comp.componentKey] = defaultMat;
    });

    assert.strictEqual(initialOverrides["frame-top"], "mat-al-head-anlk");
    assert.strictEqual(initialOverrides["frame-bottom"], "mat-al-sill-anlk");
    assert.strictEqual(initialOverrides["frame-left"], "mat-al-jamb-anlk");
    assert.strictEqual(initialOverrides["glass-panel"], "mat-gl-6mm-clear");
    assert.strictEqual(initialOverrides["roller-hw"], "mat-hw-roller");

    const inputs = buildPricingInputs(components, initialOverrides, mockMaterials);
    const bom = calculateParametricBOM(inputs, {
      widthMm: 1200,
      heightMm: 1200,
      panelCount: 2,
      hasSill: true,
    });

    assert.ok(bom.finalQuotation > 0);
    assert.strictEqual(bom.aspectRatio, 2.0);
    assert.strictEqual(bom.isCrabbingRisk, true);
  });

  // --------------------------------------------------------------------------
  // QAD-TC80.2: Interactive material swap recalculates price with sub-50ms latency
  // --------------------------------------------------------------------------
  it("QAD-TC80.2: Switching head extrusion from Analok (PHP 90/m) to White (PHP 105/m) recalculates in < 50ms", () => {
    const components = createMockComponents();
    const overrides: Record<string, string> = {
      "frame-top": "mat-al-head-anlk",
      "frame-bottom": "mat-al-sill-anlk",
      "frame-left": "mat-al-jamb-anlk",
      "glass-panel": "mat-gl-6mm-clear",
      "roller-hw": "mat-hw-roller",
    };

    const initialInputs = buildPricingInputs(components, overrides, mockMaterials);
    const initialBOM = calculateParametricBOM(initialInputs, {
      widthMm: 1200,
      heightMm: 1200,
      panelCount: 2,
      hasSill: true,
    });

    // Measure recalculation latency upon material switch
    const startTime = performance.now();
    overrides["frame-top"] = "mat-al-head-pcw";
    const updatedInputs = buildPricingInputs(components, overrides, mockMaterials);
    const updatedBOM = calculateParametricBOM(updatedInputs, {
      widthMm: 1200,
      heightMm: 1200,
      panelCount: 2,
      hasSill: true,
    });
    const duration = performance.now() - startTime;

    assert.ok(duration < 50, `Calculation took ${duration.toFixed(2)}ms, exceeding 50ms threshold`);
    assert.ok(
      updatedBOM.finalQuotation > initialBOM.finalQuotation,
      "Price should increase when selecting higher-rate material"
    );

    // Verify framing subtotal delta
    assert.ok(
      updatedBOM.effectiveFramingCost > initialBOM.effectiveFramingCost,
      "Framing effective cost should increase"
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC80.3: Real-time Three.js 3D PBR shader update without geometry reload
  // --------------------------------------------------------------------------
  it("QAD-TC80.3: resolvePBRProperties correctly resolves optical attributes and updates mesh in place", () => {
    // 1. Verify aluminum PBR attributes
    const analokMat = mockMaterials.find((m) => m.id === "mat-al-head-anlk")!;
    const whiteMat = mockMaterials.find((m) => m.id === "mat-al-head-pcw")!;
    const pbrAnalok = resolvePBRProperties(analokMat);
    const pbrWhite = resolvePBRProperties(whiteMat);

    assert.strictEqual(pbrAnalok.metalness, 0.65);
    assert.strictEqual(pbrAnalok.roughness, 0.35);
    assert.strictEqual(pbrWhite.metalness, 0.05);
    assert.strictEqual(pbrWhite.roughness, 0.45);

    // 2. Verify glass PBR attributes
    const clearGlass = mockMaterials.find((m) => m.id === "mat-gl-6mm-clear")!;
    const bronzeGlass = mockMaterials.find((m) => m.id === "mat-gl-6mm-bronze")!;
    const pbrClear = resolvePBRProperties(clearGlass);
    const pbrBronze = resolvePBRProperties(bronzeGlass);

    assert.strictEqual(pbrClear.transmission, 0.92);
    assert.strictEqual(pbrClear.opacity, 0.25);
    assert.strictEqual(pbrClear.transparent, true);

    assert.strictEqual(pbrBronze.transmission, 0.75);
    assert.strictEqual(pbrBronze.opacity, 0.65);
    assert.strictEqual(pbrBronze.transparent, true);

    // 3. Verify in-place mesh mutation without geometry recreation
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const originalGeometryUuid = geometry.uuid;
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffffff),
    });
    const mesh = new THREE.Mesh(geometry, material);

    applyPBRToMesh(mesh, bronzeGlass);

    // Geometry UUID must remain identical (zero reload)
    assert.strictEqual(mesh.geometry.uuid, originalGeometryUuid);
    assert.strictEqual((mesh.material as THREE.MeshPhysicalMaterial).transmission, 0.75);
    assert.strictEqual(mesh.castShadow, false);
    assert.strictEqual(mesh.receiveShadow, true);
  });

  // --------------------------------------------------------------------------
  // QAD-TC80.4: Reset to defaults restoration
  // --------------------------------------------------------------------------
  it("QAD-TC80.4: Reset to Defaults restores material overrides and BOM matches initial baseline", () => {
    const components = createMockComponents();
    const defaultOverrides: Record<string, string> = {
      "frame-top": "mat-al-head-anlk",
      "frame-bottom": "mat-al-sill-anlk",
      "frame-left": "mat-al-jamb-anlk",
      "glass-panel": "mat-gl-6mm-clear",
      "roller-hw": "mat-hw-roller",
    };

    const initialInputs = buildPricingInputs(components, defaultOverrides, mockMaterials);
    const baselineBOM = calculateParametricBOM(initialInputs, {
      widthMm: 1200,
      heightMm: 1200,
      panelCount: 2,
      hasSill: true,
    });

    // Admin tests non-default materials
    const modifiedOverrides = {
      ...defaultOverrides,
      "frame-top": "mat-al-head-pcw",
      "glass-panel": "mat-gl-6mm-bronze",
    };
    const modifiedInputs = buildPricingInputs(components, modifiedOverrides, mockMaterials);
    const modifiedBOM = calculateParametricBOM(modifiedInputs, {
      widthMm: 1200,
      heightMm: 1200,
      panelCount: 2,
      hasSill: true,
    });
    assert.notStrictEqual(modifiedBOM.finalQuotation, baselineBOM.finalQuotation);

    // Trigger Reset to Defaults
    const resetOverrides: Record<string, string> = {};
    components.forEach((comp) => {
      const defMat =
        comp.allowedMaterials?.find((m) => m.isDefault)?.rawMaterialId ||
        comp.rawMaterialId ||
        "";
      resetOverrides[comp.componentKey] = defMat;
    });

    const restoredInputs = buildPricingInputs(components, resetOverrides, mockMaterials);
    const restoredBOM = calculateParametricBOM(restoredInputs, {
      widthMm: 1200,
      heightMm: 1200,
      panelCount: 2,
      hasSill: true,
    });

    assert.strictEqual(
      restoredBOM.finalQuotation,
      baselineBOM.finalQuotation,
      "Restored BOM final quotation must match initial baseline"
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC80.5: Symmetrical group material synchronization
  // --------------------------------------------------------------------------
  it("QAD-TC80.5: Applying finish to all framing updates all framing components in a single gesture", () => {
    const components = createMockComponents();
    const overrides: Record<string, string> = {
      "frame-top": "mat-al-head-anlk",
      "frame-bottom": "mat-al-sill-anlk",
      "frame-left": "mat-al-jamb-anlk",
      "glass-panel": "mat-gl-6mm-clear",
      "roller-hw": "mat-hw-roller",
    };

    // Apply PowderCoatedWhite to all framing
    const targetFinish = "PowderCoatedWhite".toLowerCase();
    components.forEach((comp) => {
      if (comp.presentationCategory === "Framing") {
        const allowedList = comp.allowedMaterials || [];
        const matchingBinding = allowedList.find((b) => {
          const mat = mockMaterials.find((m) => m.id === b.rawMaterialId);
          return (mat?.finish_type || "").toLowerCase() === targetFinish;
        });
        if (matchingBinding) {
          overrides[comp.componentKey] = matchingBinding.rawMaterialId;
        }
      }
    });

    assert.strictEqual(overrides["frame-top"], "mat-al-head-pcw");
    assert.strictEqual(overrides["frame-bottom"], "mat-al-sill-pcw");
    assert.strictEqual(overrides["frame-left"], "mat-al-jamb-pcw");
    // Glass and hardware remain untouched
    assert.strictEqual(overrides["glass-panel"], "mat-gl-6mm-clear");
    assert.strictEqual(overrides["roller-hw"], "mat-hw-roller");
  });

  // --------------------------------------------------------------------------
  // QAD-TC80.6: Pre-activation readiness validation passes
  // --------------------------------------------------------------------------
  it("QAD-TC80.6: Pre-activation readiness passes when all parts have valid materials and positive rates", () => {
    const components = createMockComponents();
    const overrides: Record<string, string> = {
      "frame-top": "mat-al-head-anlk",
      "frame-bottom": "mat-al-sill-anlk",
      "frame-left": "mat-al-jamb-anlk",
      "glass-panel": "mat-gl-6mm-clear",
      "roller-hw": "mat-hw-roller",
    };

    const unassigned: string[] = [];
    const zeroRate: string[] = [];

    components.forEach((comp) => {
      const activeMatId =
        overrides[comp.componentKey] ||
        comp.allowedMaterials?.find((m) => m.isDefault)?.rawMaterialId ||
        comp.rawMaterialId;
      const boundMat = mockMaterials.find((m) => m.id === activeMatId);

      if (!boundMat) {
        unassigned.push(comp.componentKey);
      } else if (boundMat.unit_price <= 0) {
        zeroRate.push(comp.componentKey);
      }
    });

    const isReady = unassigned.length === 0 && zeroRate.length === 0;
    assert.strictEqual(isReady, true);
    assert.strictEqual(unassigned.length, 0);
    assert.strictEqual(zeroRate.length, 0);
  });

  // --------------------------------------------------------------------------
  // QAD-TC80.7: Pre-activation blocked on unassigned parts
  // --------------------------------------------------------------------------
  it("QAD-TC80.7: Pre-activation is blocked when any component has zero materials assigned", () => {
    const components = createMockComponents();
    // Intentionally add an unassigned component
    components.push({
      componentId: "c-unassigned",
      componentKey: "custom-trim",
      componentName: "Custom Aluminum Trim",
      componentType: "Frame",
      baseQuantity: 1,
      rawMaterialId: null,
      allowedMaterials: [],
      dimensionBinding: "WIDTH",
      spanRatio: 1.0,
      isRemovable: false,
      presentationCategory: "Framing",
      componentData: {},
      model: {
        assetId: "a-trim",
        r2ObjectKey: "models/trim.glb",
        url: "http://localhost/models/trim.glb",
        fileName: "trim.glb",
        sourceDimensionsMm: null,
      },
    });

    const overrides: Record<string, string> = {
      "frame-top": "mat-al-head-anlk",
      "frame-bottom": "mat-al-sill-anlk",
      "frame-left": "mat-al-jamb-anlk",
      "glass-panel": "mat-gl-6mm-clear",
      "roller-hw": "mat-hw-roller",
      "custom-trim": "",
    };

    const unassigned: string[] = [];
    components.forEach((comp) => {
      const activeMatId =
        overrides[comp.componentKey] ||
        comp.allowedMaterials?.find((m) => m.isDefault)?.rawMaterialId ||
        comp.rawMaterialId;
      const boundMat = mockMaterials.find((m) => m.id === activeMatId);
      if (!boundMat) {
        unassigned.push(comp.componentKey);
      }
    });

    const isReady = unassigned.length === 0;
    assert.strictEqual(isReady, false);
    assert.strictEqual(unassigned.length, 1);
    assert.strictEqual(unassigned[0], "custom-trim");
  });

  // --------------------------------------------------------------------------
  // QAD-TC80.8: Mathematical parity with pricing engine
  // --------------------------------------------------------------------------
  it("QAD-TC80.8: Step 6 BOM calculation achieves exact centavo parity with standalone calculateParametricBOM", () => {
    const components = createMockComponents();
    const mixedOverrides: Record<string, string> = {
      "frame-top": "mat-al-head-pcw", // PHP 105/m
      "frame-bottom": "mat-al-sill-anlk", // PHP 110/m
      "frame-left": "mat-al-jamb-pcw", // PHP 85/m
      "glass-panel": "mat-gl-6mm-bronze", // PHP 780/sqm
      "roller-hw": "mat-hw-roller", // PHP 25/pc
    };

    // Dimension: 1800mm width x 1500mm height
    const widthMm = 1800;
    const heightMm = 1500;
    const panelCount = 2;
    const hasSill = true;

    // Simulation calculation inside Step 6
    const step6Inputs = buildPricingInputs(components, mixedOverrides, mockMaterials);
    const step6Result = calculateParametricBOM(step6Inputs, {
      widthMm,
      heightMm,
      panelCount,
      hasSill,
    });

    // Standalone reference calculation
    const referenceInputs: ComponentPricingInput[] = [
      {
        componentKey: "frame-top",
        componentName: "Series 798 Double Head",
        dimensionBinding: "WIDTH",
        spanRatio: 1.0,
        baseQuantity: 1,
        isRemovable: false,
        presentationCategory: "Framing",
        rawMaterial: mockMaterials.find((m) => m.id === "mat-al-head-pcw")!,
      },
      {
        componentKey: "frame-bottom",
        componentName: "Series 798 Double Sill",
        dimensionBinding: "WIDTH",
        spanRatio: 1.0,
        baseQuantity: 1,
        isRemovable: true,
        togglePropertyKey: "has_sill",
        presentationCategory: "Framing",
        rawMaterial: mockMaterials.find((m) => m.id === "mat-al-sill-anlk")!,
      },
      {
        componentKey: "frame-left",
        componentName: "Series 798 Double Jamb",
        dimensionBinding: "HEIGHT",
        spanRatio: 1.0,
        baseQuantity: 2,
        isRemovable: false,
        presentationCategory: "Framing",
        rawMaterial: mockMaterials.find((m) => m.id === "mat-al-jamb-pcw")!,
      },
      {
        componentKey: "glass-panel",
        componentName: "6mm Glazing Infill",
        dimensionBinding: "AREA",
        spanRatio: 1.0,
        baseQuantity: 2,
        isRemovable: false,
        presentationCategory: "Glazing",
        rawMaterial: mockMaterials.find((m) => m.id === "mat-gl-6mm-bronze")!,
      },
      {
        componentKey: "roller-hw",
        componentName: "POM Roller Assembly",
        dimensionBinding: "FIXED",
        spanRatio: 1.0,
        baseQuantity: 4,
        isRemovable: false,
        presentationCategory: "Hardware",
        rawMaterial: mockMaterials.find((m) => m.id === "mat-hw-roller")!,
      },
    ];

    const referenceResult = calculateParametricBOM(referenceInputs, {
      widthMm,
      heightMm,
      panelCount,
      hasSill,
    });

    assert.strictEqual(
      step6Result.finalQuotation,
      referenceResult.finalQuotation,
      "Final quotation must match with 0.00 PHP discrepancy"
    );
    assert.strictEqual(
      step6Result.effectiveFramingCost,
      referenceResult.effectiveFramingCost,
      "Framing effective cost must match exactly"
    );
    assert.strictEqual(
      step6Result.effectiveGlazingCost,
      referenceResult.effectiveGlazingCost,
      "Glazing effective cost must match exactly"
    );
    assert.strictEqual(
      step6Result.fabricationLaborCost,
      referenceResult.fabricationLaborCost,
      "Fabrication labor must match exactly"
    );
    assert.strictEqual(
      step6Result.contractorMargin,
      referenceResult.contractorMargin,
      "Contractor margin must match exactly"
    );
  });
});
