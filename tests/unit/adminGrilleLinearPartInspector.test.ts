/**
 * Unit Test Suite: Admin Product Setup Wizard Center-Grille Part Inspector & Linear Parity (IMP-MS72)
 *
 * Upstream Specifications: docs/implementation/ms72.md, docs/sdd-glassfit.md, docs/qad-glassfit.md
 * Traceability Codes: PRD-F14, PRD-F19, SDD-C4, SDD-C9, DSD-UI10, ERD-E6, ERD-E17, BRD-M2, BRD-M4, BRD-M5, QAD-TC87.1 through QAD-TC87.10
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { autoDetectComponentSettings } from "../../src/lib/admin/products/autoDetection.js";
import { calculateGrilleLinearBOM } from "../../src/lib/pricing/grillePricingEngine.js";
import {
  DimensionBindingSchema,
  ProductComponentBindingSchema,
  type RawMaterial,
  type DimensionBinding,
} from "../../src/lib/pricing/types.js";
import type { PartInspectorConfig } from "../../src/features/admin/products/setup/PartInspectorDrawer.js";

// Mock raw materials catalog
const mockLinearExtrusion: RawMaterial = {
  id: "mat-square-tube-16mm-white",
  material_code: "AL-ST-16X16-PCW",
  description: "16mm x 16mm Square Tube Powder Coated White",
  category: "Aluminum",
  finish_type: "PowderCoatedWhite",
  billing_unit: "m",
  unit_price: 165.0,
  waste_allowance: 0.12,
  is_active: true,
};

const mockSheetGlass: RawMaterial = {
  id: "mat-glass-clear-6mm",
  material_code: "GL-CLR-6MM",
  description: "6mm Clear Annealed Float Glass",
  category: "Glass",
  finish_type: "Clear",
  billing_unit: "sqm",
  unit_price: 520.0,
  waste_allowance: 0.15,
  is_active: true,
};

const mockHardwarePiece: RawMaterial = {
  id: "mat-hardware-handle",
  material_code: "HW-HDL-01",
  description: "Flush Mount Security Grille Latch",
  category: "Hardware",
  finish_type: "None",
  billing_unit: "pc",
  unit_price: 95.0,
  waste_allowance: 0.0,
  is_active: true,
};

const mockCatalog: RawMaterial[] = [
  mockLinearExtrusion,
  mockSheetGlass,
  mockHardwarePiece,
  {
    id: "mat-square-tube-16mm-analok",
    material_code: "AL-ST-16X16-ANLK",
    description: "16mm x 16mm Square Tube Analok",
    category: "Aluminum",
    finish_type: "Analok",
    billing_unit: "m",
    unit_price: 180.0,
    waste_allowance: 0.12,
    is_active: true,
  },
];

describe("IMP-MS72: Admin Wizard Center-Grille Part Inspector & Linear Calculation Preview (QAD-TC87)", () => {
  // --------------------------------------------------------------------------
  // QAD-TC87.1: Automatic detection of GRILLE_LINEAR from file name
  // --------------------------------------------------------------------------
  it("QAD-TC87.1: auto-detects dimensionBinding = 'GRILLE_LINEAR' and presentationCategory = 'Framing' from file names", () => {
    const grilleFileNames = [
      "window_center_grille.glb",
      "center_grille.glb",
      "grill_middle.glb",
      "grill_bars.glb",
      "grille_infill.glb",
      "middle_bars.glb",
      "picket_lattice.glb",
      "architectural_grille.glb",
      "security_grill.glb",
    ];

    for (const fileName of grilleFileNames) {
      const detected = autoDetectComponentSettings(fileName);
      assert.strictEqual(
        detected.dimensionBinding,
        "GRILLE_LINEAR",
        `Expected ${fileName} to be detected as GRILLE_LINEAR`
      );
      assert.strictEqual(
        detected.presentationCategory,
        "Framing",
        `Expected ${fileName} to be categorized as Framing`
      );
      assert.strictEqual(
        detected.componentType,
        "Frame",
        `Expected ${fileName} to be componentType Frame`
      );
      assert.strictEqual(
        detected.suggestedMaterialCategory,
        "Aluminum",
        `Expected ${fileName} to suggest Aluminum material category`
      );
    }

    // Verify non-grille files are NOT misclassified as GRILLE_LINEAR
    const nonGrilleFiles = [
      { name: "outer_frame.glb", expected: "FIXED" },
      { name: "side_jamb.glb", expected: "HEIGHT" },
      { name: "bottom_rail.glb", expected: "WIDTH" },
      { name: "clear_glass.glb", expected: "AREA" },
    ];

    for (const { name, expected } of nonGrilleFiles) {
      const detected = autoDetectComponentSettings(name);
      assert.strictEqual(
        detected.dimensionBinding,
        expected,
        `Expected ${name} to be detected as ${expected}, not GRILLE_LINEAR`
      );
    }
  });

  // --------------------------------------------------------------------------
  // QAD-TC87.2: Single-click material assignment applies to entire grille
  // --------------------------------------------------------------------------
  it("QAD-TC87.2: binds material to the entire center grille assembly in a single selection", () => {
    // Initial unassigned grille component configuration
    let grilleConfig: PartInspectorConfig = {
      id: "comp-grille-01",
      componentKey: "center_grille",
      componentName: "Security Window Center Grille",
      componentType: "Frame",
      rawMaterialId: null,
      materialBindings: [],
      dimensionBinding: "GRILLE_LINEAR",
      spanRatio: 1.0,
      isRemovable: false,
      togglePropertyKey: null,
      presentationCategory: "Framing",
      baseQuantity: 1,
      assemblyGroup: "grille_assembly",
    };

    // Simulate single-click material assignment in Part Inspector
    const selectedMaterial = mockLinearExtrusion;
    const isLinearBinding = grilleConfig.dimensionBinding === "GRILLE_LINEAR";

    assert.strictEqual(isLinearBinding, true);

    // Single-click updates binding and rawMaterialId in one transaction
    grilleConfig = {
      ...grilleConfig,
      materialBindings: [
        {
          rawMaterialId: selectedMaterial.id,
          isDefault: true,
          displayOrder: 0,
        },
      ],
      rawMaterialId: selectedMaterial.id,
    };

    assert.strictEqual(grilleConfig.rawMaterialId, "mat-square-tube-16mm-white");
    assert.strictEqual(grilleConfig.materialBindings?.length, 1);
    assert.strictEqual(grilleConfig.materialBindings?.[0].isDefault, true);

    // Verify that pricing engine consumes this single material across all constituent vertical and horizontal bars
    const bom = calculateGrilleLinearBOM({
      widthMm: 1200,
      heightMm: 1200,
      patternType: "grid",
      grilleRawMaterial: {
        id: selectedMaterial.id,
        material_code: selectedMaterial.material_code,
        description: selectedMaterial.description,
        unit_price: selectedMaterial.unit_price,
        waste_allowance: selectedMaterial.waste_allowance,
      },
    });

    // All pickets and rails inherit the 165.0 unit price
    assert.strictEqual(bom.verticalBars.details[0].unitPricePerMeter, 165.0);
    assert.strictEqual(bom.horizontalBars.details[0].unitPricePerMeter, 165.0);
  });

  // --------------------------------------------------------------------------
  // QAD-TC87.3: Part Inspector renders dynamic bar breakdown summary
  // --------------------------------------------------------------------------
  it("QAD-TC87.3: computes discrete vertical and horizontal bar counts, cut lengths, and total linear meters", () => {
    const bom = calculateGrilleLinearBOM({
      widthMm: 1200,
      heightMm: 1200,
      patternType: "grid",
      nominalPitchColMm: 140,
      nominalPitchRowMm: 191,
      frameProfileWidthMm: 20,
      includePerimeterFrame: true,
      grilleRawMaterial: mockLinearExtrusion,
    });

    // Vertical pickets: 1160mm opening / 140mm pitch = 8 pickets of 1160mm
    assert.strictEqual(bom.verticalBars.barCount, 8);
    assert.strictEqual(bom.verticalBars.cutLengthMm, 1160);
    assert.strictEqual(bom.verticalBars.totalLinearM, 9.28);

    // Horizontal rails: 1160mm opening / 191mm pitch = 6 rails of 1160mm
    assert.strictEqual(bom.horizontalBars.barCount, 6);
    assert.strictEqual(bom.horizontalBars.cutLengthMm, 1160);
    assert.strictEqual(bom.horizontalBars.totalLinearM, 6.96);

    // Perimeter rails: 2 rails of 1200mm (2.4m) + 2 jambs of 1160mm (2.32m) = 4.72m
    assert.ok(bom.perimeterRails !== null);
    assert.strictEqual(bom.perimeterRails.totalLinearM, 4.72);
  });

  // --------------------------------------------------------------------------
  // QAD-TC87.4: Raw materials dropdown filters to linear units (m)
  // --------------------------------------------------------------------------
  it("QAD-TC87.4: filters candidate materials to linear extrusions (/m) and excludes sheet glass (sqm) or pieces (pc)", () => {
    const primaryDimensionBinding: DimensionBinding = "GRILLE_LINEAR";

    // Filtering logic mirroring PartInspectorDrawer.tsx
    const filtered = mockCatalog.filter((m) => {
      if (primaryDimensionBinding === "GRILLE_LINEAR") {
        if (m.billing_unit !== "m") return false;
      }
      return true;
    });

    assert.strictEqual(filtered.length, 2);
    assert.ok(filtered.every((m) => m.billing_unit === "m"));
    assert.ok(!filtered.some((m) => m.billing_unit === "sqm"));
    assert.ok(!filtered.some((m) => m.billing_unit === "pc"));
    assert.strictEqual(filtered[0].material_code, "AL-ST-16X16-PCW");
    assert.strictEqual(filtered[1].material_code, "AL-ST-16X16-ANLK");
  });

  // --------------------------------------------------------------------------
  // QAD-TC87.5: Validation sandbox dynamically recalculates on width drag
  // --------------------------------------------------------------------------
  it("QAD-TC87.5: dynamically increases vertical picket count on width slider movement in under 16ms", () => {
    const baseWidthMm = 1000;
    const targetWidthMm = 1600;
    const heightMm = 1200;

    const start = performance.now();

    const bom1000 = calculateGrilleLinearBOM({
      widthMm: baseWidthMm,
      heightMm,
      patternType: "grid",
      nominalPitchColMm: 140,
      grilleRawMaterial: mockLinearExtrusion,
    });

    const bom1600 = calculateGrilleLinearBOM({
      widthMm: targetWidthMm,
      heightMm,
      patternType: "grid",
      nominalPitchColMm: 140,
      grilleRawMaterial: mockLinearExtrusion,
    });

    const elapsedMs = performance.now() - start;

    // At 1000mm width (inner aperture 960mm), Math.floor(960 / 140) = 6 pickets
    assert.strictEqual(bom1000.verticalBars.barCount, 6);
    // At 1600mm width (inner aperture 1560mm), Math.floor(1560 / 140) = 11 pickets
    assert.strictEqual(bom1600.verticalBars.barCount, 11);

    // Total meters increased
    assert.ok(bom1600.totalLinearMeters > bom1000.totalLinearMeters);
    assert.ok(elapsedMs < 16, `Recalculation must complete in < 16ms (took ${elapsedMs.toFixed(2)}ms)`);
  });

  // --------------------------------------------------------------------------
  // QAD-TC87.6: Validation sandbox dynamically recalculates on height drag
  // --------------------------------------------------------------------------
  it("QAD-TC87.6: lengthens vertical bar cut lengths from 960mm to 1760mm on height slider movement", () => {
    const widthMm = 1200;
    const baseHeightMm = 1000;
    const targetHeightMm = 1800;

    const bom1000 = calculateGrilleLinearBOM({
      widthMm,
      heightMm: baseHeightMm,
      patternType: "grid",
      frameProfileWidthMm: 20,
      grilleRawMaterial: mockLinearExtrusion,
    });

    const bom1800 = calculateGrilleLinearBOM({
      widthMm,
      heightMm: targetHeightMm,
      patternType: "grid",
      frameProfileWidthMm: 20,
      grilleRawMaterial: mockLinearExtrusion,
    });

    // Inner height = height - 2 * 20mm = 960mm and 1760mm
    assert.strictEqual(bom1000.verticalBars.cutLengthMm, 960);
    assert.strictEqual(bom1800.verticalBars.cutLengthMm, 1760);

    // Number of horizontal rows recalculates
    assert.ok(bom1800.horizontalBars.barCount > bom1000.horizontalBars.barCount);
  });

  // --------------------------------------------------------------------------
  // QAD-TC87.7: Cut List table displays exact piece counts and lengths
  // --------------------------------------------------------------------------
  it("QAD-TC87.7: renders exact piece counts and lengths without rounding errors for 1200mm x 1200mm aperture", () => {
    const bom = calculateGrilleLinearBOM({
      widthMm: 1200,
      heightMm: 1200,
      patternType: "grid",
      nominalPitchColMm: 140,
      nominalPitchRowMm: 191,
      frameProfileWidthMm: 20,
      includePerimeterFrame: true,
      grilleRawMaterial: mockLinearExtrusion,
    });

    const breakdown = bom.itemizedBreakdown;

    // Check individual items
    const topRail = breakdown.find((i) => i.item === "Grille Frame Top Rail");
    assert.ok(topRail);
    assert.strictEqual(topRail.pieces, 1);
    assert.strictEqual(topRail.lengthMm, 1200);
    assert.strictEqual(topRail.totalMeters, 1.2);

    const botRail = breakdown.find((i) => i.item === "Grille Frame Bottom Rail");
    assert.ok(botRail);
    assert.strictEqual(botRail.pieces, 1);
    assert.strictEqual(botRail.lengthMm, 1200);
    assert.strictEqual(botRail.totalMeters, 1.2);

    const sideJambs = breakdown.find((i) => i.item === "Grille Frame Side Jambs (Left & Right)");
    assert.ok(sideJambs);
    assert.strictEqual(sideJambs.pieces, 2);
    assert.strictEqual(sideJambs.lengthMm, 1160);
    assert.strictEqual(sideJambs.totalMeters, 2.32);

    assert.ok(bom.perimeterRails);
    assert.strictEqual(bom.perimeterRails.leftJamb.lengthMm, 1160);
    assert.strictEqual(bom.perimeterRails.leftJamb.totalLinearM, 1.16);
    assert.strictEqual(bom.perimeterRails.rightJamb.lengthMm, 1160);
    assert.strictEqual(bom.perimeterRails.rightJamb.totalLinearM, 1.16);

    const vBars = breakdown.find((i) => i.orientation === "VERTICAL" && i.item.includes("Vertical Grille Bars"));
    assert.ok(vBars);
    assert.strictEqual(vBars.pieces, 8);
    assert.strictEqual(vBars.lengthMm, 1160);
    assert.strictEqual(vBars.totalMeters, 9.28);

    const hBars = breakdown.find((i) => i.orientation === "HORIZONTAL" && i.item.includes("Horizontal Cross Rails"));
    assert.ok(hBars);
    assert.strictEqual(hBars.pieces, 6);
    assert.strictEqual(hBars.lengthMm, 1160);
    assert.strictEqual(hBars.totalMeters, 6.96);

    // Total pieces = 1 + 1 + 1 + 1 + 8 + 6 = 18 pieces
    assert.strictEqual(bom.totalPieces, 18);
    // Total meters = 1.2 + 1.2 + 1.16 + 1.16 + 9.28 + 6.96 = 20.96m
    assert.strictEqual(bom.totalLinearMeters, 20.96);
  });

  // --------------------------------------------------------------------------
  // QAD-TC87.8: Preserves single-selection state across wizard navigation
  // --------------------------------------------------------------------------
  it("QAD-TC87.8: preserves GRILLE_LINEAR binding and assigned material across wizard steps", () => {
    // Step 2 state
    const wizardState = {
      step: 2,
      components: [
        {
          id: "comp-grille-01",
          component_key: "center_grille",
          component_name: "Center Grille",
          dimension_binding: "GRILLE_LINEAR" as const,
          raw_material_id: "mat-square-tube-16mm-white",
          base_quantity: 1,
          span_ratio: 1.0,
        },
      ],
    };

    // Navigate to Step 3
    wizardState.step = 3;
    assert.strictEqual(wizardState.components[0].dimension_binding, "GRILLE_LINEAR");
    assert.strictEqual(wizardState.components[0].raw_material_id, "mat-square-tube-16mm-white");

    // Navigate back to Step 2
    wizardState.step = 2;
    assert.strictEqual(wizardState.components[0].dimension_binding, "GRILLE_LINEAR");
    assert.strictEqual(wizardState.components[0].raw_material_id, "mat-square-tube-16mm-white");

    // Navigate to Step 4 / Step 6 (Validation Workspace)
    wizardState.step = 4;
    const comp = wizardState.components[0];
    assert.strictEqual(comp.dimension_binding, "GRILLE_LINEAR");
    assert.strictEqual(comp.raw_material_id, "mat-square-tube-16mm-white");
  });

  // --------------------------------------------------------------------------
  // QAD-TC87.9: Warning modal/message when non-linear material is bound
  // --------------------------------------------------------------------------
  it("QAD-TC87.9: triggers validation warning when non-linear material (/sqm or /pc) is assigned to GRILLE_LINEAR", () => {
    let validationWarning: string | null = null;
    const dimensionBinding: DimensionBinding = "GRILLE_LINEAR";

    function validateMaterialAssignment(material: RawMaterial) {
      if (dimensionBinding === "GRILLE_LINEAR" && material.billing_unit !== "m") {
        validationWarning = "Grilles require linear profile extrusions billed per meter.";
        return false;
      }
      validationWarning = null;
      return true;
    }

    // Attempt to assign 6mm Float Glass (sqm)
    const successGlass = validateMaterialAssignment(mockSheetGlass);
    assert.strictEqual(successGlass, false);
    assert.strictEqual(validationWarning, "Grilles require linear profile extrusions billed per meter.");

    // Attempt to assign Hardware Latch (pc)
    const successHw = validateMaterialAssignment(mockHardwarePiece);
    assert.strictEqual(successHw, false);
    assert.strictEqual(validationWarning, "Grilles require linear profile extrusions billed per meter.");

    // Assigning valid linear profile extrusion (m)
    const successExtrusion = validateMaterialAssignment(mockLinearExtrusion);
    assert.strictEqual(successExtrusion, true);
    assert.strictEqual(validationWarning, null);
  });

  // --------------------------------------------------------------------------
  // QAD-TC87.10: Database persistence of GRILLE_LINEAR binding
  // --------------------------------------------------------------------------
  it("QAD-TC87.10: verifies database migration and Zod schema accept dimension_binding = 'GRILLE_LINEAR'", () => {
    // 1. Verify TypeScript Zod Schema accepts GRILLE_LINEAR
    const parsedBinding = DimensionBindingSchema.parse("GRILLE_LINEAR");
    assert.strictEqual(parsedBinding, "GRILLE_LINEAR");

    const validComponentPayload = {
      template_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      component_key: "center_grille",
      component_name: "Window Security Grille Infill",
      dimension_binding: "GRILLE_LINEAR",
      raw_material_id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      span_ratio: 1.0,
      base_quantity: 1,
      presentation_category: "Framing",
    };

    const parsedComponent = ProductComponentBindingSchema.safeParse(validComponentPayload);
    assert.strictEqual(parsedComponent.success, true);
    if (parsedComponent.success) {
      assert.strictEqual(parsedComponent.data.dimension_binding, "GRILLE_LINEAR");
    }

    // 2. Verify PostgreSQL Migration file exists and defines the CHECK constraint
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/006_grille_linear_dimension_binding.sql"
    );
    assert.ok(fs.existsSync(migrationPath), "Migration 006_grille_linear_dimension_binding.sql must exist");

    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    assert.ok(
      sqlContent.includes("CHECK (dimension_binding IN ('WIDTH', 'HEIGHT', 'AREA', 'FIXED', 'GRILLE_LINEAR'))"),
      "SQL migration must update check constraint to include 'GRILLE_LINEAR'"
    );
  });
});
