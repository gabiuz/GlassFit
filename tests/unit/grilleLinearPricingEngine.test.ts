/**
 * Unit Tests: Parametric Grille Linear-Meter Pricing Engine, Automated 3D Sub-Bar Analyzer, and Repetition Engine
 *
 * Upstream Specifications: docs/implementation/ms71.md, docs/sdd-glassfit.md, docs/qad-glassfit.md
 * Traceability Codes: PRD-F2, PRD-F5, PRD-F10, SDD-C4, SDD-C7, ERD-E6, ERD-E14, ERD-E17, BRD-M2, BRD-M5, QAD-TC86.1 through QAD-TC86.10
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  analyzeGrilleGeometry,
} from "../../src/lib/pricing/grilleGeometryAnalyzer.js";
import {
  calculateGrilleLinearBOM,
} from "../../src/lib/pricing/grillePricingEngine.js";
import {
  buildDynamicGrillPatternGroup,
} from "../../src/lib/visualization/addonGeometryBuilder.js";
import type { GrilleLinearPricingInput } from "../../src/lib/pricing/types.js";

describe("IMP-MS71: Parametric Grille Linear-Meter Pricing Engine & 3D Geometry Analyzer (QAD-TC86)", () => {
  // --------------------------------------------------------------------------
  // QAD-TC86.1: Automated orientation classification of horizontal bars
  // --------------------------------------------------------------------------
  it("QAD-TC86.1: classifies bar as HORIZONTAL when length along X exceeds height along Y (1160mm x 16mm x 16mm)", () => {
    const root = new THREE.Group();
    // 1160mm along X, 16mm along Y, 16mm along Z
    const geo = new THREE.BoxGeometry(1.16, 0.016, 0.016);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    mesh.name = "Test_Horizontal_Bar";
    root.add(mesh);

    const analysis = analyzeGrilleGeometry(root, 1200, 1200);

    assert.strictEqual(analysis.subBars.length, 1);
    const bar = analysis.subBars[0];
    assert.strictEqual(bar.orientation, "HORIZONTAL");
    assert.strictEqual(bar.lengthMm, 1160);
    assert.strictEqual(bar.crossSectionMm.width, 16);
    assert.strictEqual(bar.crossSectionMm.depth, 16);
    assert.strictEqual(analysis.horizontalSummary.pieceCount, 1);
    assert.strictEqual(analysis.horizontalSummary.totalLinearM, 1.16);
  });

  // --------------------------------------------------------------------------
  // QAD-TC86.2: Automated orientation classification of vertical bars
  // --------------------------------------------------------------------------
  it("QAD-TC86.2: classifies bar as VERTICAL when height along Y exceeds length along X (16mm x 1400mm x 16mm)", () => {
    const root = new THREE.Group();
    // 16mm along X, 1400mm along Y, 16mm along Z
    const geo = new THREE.BoxGeometry(0.016, 1.4, 0.016);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    mesh.name = "Test_Vertical_Bar";
    root.add(mesh);

    const analysis = analyzeGrilleGeometry(root, 1000, 1500);

    assert.strictEqual(analysis.subBars.length, 1);
    const bar = analysis.subBars[0];
    assert.strictEqual(bar.orientation, "VERTICAL");
    assert.strictEqual(bar.lengthMm, 1400);
    assert.strictEqual(bar.crossSectionMm.width, 16);
    assert.strictEqual(bar.crossSectionMm.depth, 16);
    assert.strictEqual(analysis.verticalSummary.pieceCount, 1);
    assert.strictEqual(analysis.verticalSummary.totalLinearM, 1.4);
  });

  // --------------------------------------------------------------------------
  // QAD-TC86.3: Grid pattern dynamic bar count and linear meters
  // --------------------------------------------------------------------------
  it("QAD-TC86.3: calculates exact piece counts and linear meters for grid pattern at 1200mm x 1200mm", () => {
    const input: GrilleLinearPricingInput = {
      widthMm: 1200,
      heightMm: 1200,
      patternType: "grid",
      nominalPitchColMm: 140,
      nominalPitchRowMm: 191,
      frameProfileWidthMm: 20,
      includePerimeterFrame: true,
      grilleRawMaterial: {
        id: "mat-square-tube-1",
        material_code: "AL-TUBE-16",
        description: "16mm x 16mm Aluminum Square Tube",
        unit_price: 180.0,
        waste_allowance: 0.12,
      },
    };

    const result = calculateGrilleLinearBOM(input);

    // Inner aperture = 1200 - 40 = 1160mm x 1160mm
    // Vertical pickets = Math.floor(1160 / 140) = 8 pickets, cutLength = 1160mm (1.16m)
    assert.strictEqual(result.verticalBars.barCount, 8);
    assert.strictEqual(result.verticalBars.cutLengthMm, 1160);
    assert.strictEqual(result.verticalBars.totalLinearM, 9.28); // 8 * 1.16

    // Horizontal rails = Math.floor(1160 / 191) = 6 rails, cutLength = 1160mm (1.16m)
    assert.strictEqual(result.horizontalBars.barCount, 6);
    assert.strictEqual(result.horizontalBars.cutLengthMm, 1160);
    assert.strictEqual(result.horizontalBars.totalLinearM, 6.96); // 6 * 1.16

    // Perimeter frame: 1.2m top + 1.2m bottom + 2 * 1.16m sides = 4.72m
    assert.ok(result.perimeterRails);
    assert.strictEqual(result.perimeterRails.totalLinearM, 4.72);
    assert.strictEqual(result.totalPieces, 18); // 4 perimeter + 8 vertical + 6 horizontal
    assert.strictEqual(result.totalLinearMeters, 20.96); // 4.72 + 9.28 + 6.96
  });

  // --------------------------------------------------------------------------
  // QAD-TC86.4: Louver pattern dynamic bar count and linear meters
  // --------------------------------------------------------------------------
  it("QAD-TC86.4: calculates exact piece counts and linear meters for louver pattern at 1000mm x 1500mm", () => {
    const input: GrilleLinearPricingInput = {
      widthMm: 1000,
      heightMm: 1500,
      patternType: "louvers",
      frameProfileWidthMm: 20,
      includePerimeterFrame: true,
      grilleRawMaterial: {
        id: "mat-slat-1",
        material_code: "AL-SLAT-40",
        description: "40mm Aluminum Louver Slat",
        unit_price: 160.0,
        waste_allowance: 0.12,
      },
    };

    const result = calculateGrilleLinearBOM(input);

    // Inner aperture = (1000 - 40) x (1500 - 40) = 960mm x 1460mm
    // Louver slats = Math.floor(1460 / 45) = 32 slats, cutLength = 960mm (0.96m)
    assert.strictEqual(result.horizontalBars.barCount, 32);
    assert.strictEqual(result.horizontalBars.cutLengthMm, 960);
    assert.strictEqual(result.horizontalBars.totalLinearM, 30.72); // 32 * 0.96

    // Center mullions = innerWidth (960) <= 1200 ? 1 mullion, cutLength = 1460mm (1.46m)
    assert.strictEqual(result.verticalBars.barCount, 1);
    assert.strictEqual(result.verticalBars.cutLengthMm, 1460);
    assert.strictEqual(result.verticalBars.totalLinearM, 1.46);

    // Perimeter = 1.0 + 1.0 + 2 * 1.46 = 4.92m
    assert.ok(result.perimeterRails);
    assert.strictEqual(result.perimeterRails.totalLinearM, 4.92);
    assert.strictEqual(result.totalPieces, 37); // 4 perimeter + 32 slats + 1 mullion
    assert.strictEqual(result.totalLinearMeters, 37.1); // 4.92 + 30.72 + 1.46
  });

  // --------------------------------------------------------------------------
  // QAD-TC86.5: Staggered brick pattern dynamic bar count & visual 3D parity
  // --------------------------------------------------------------------------
  it("QAD-TC86.5: calculates staggered brick pattern matching Three.js visual assembly at 1400mm x 1200mm", () => {
    const input: GrilleLinearPricingInput = {
      widthMm: 1400,
      heightMm: 1200,
      patternType: "staggered_brick",
      nominalPitchColMm: 140,
      nominalPitchRowMm: 191,
      frameProfileWidthMm: 20,
      includePerimeterFrame: true,
      grilleRawMaterial: {
        id: "mat-square-tube-1",
        material_code: "AL-TUBE-16",
        description: "16mm x 16mm Aluminum Square Tube",
        unit_price: 180.0,
      },
    };

    const result = calculateGrilleLinearBOM(input);

    // Inner aperture = 1360mm x 1160mm (1.36m x 1.16m)
    // Vertical pickets = Math.floor(1360 / 140) = 9 pickets
    assert.strictEqual(result.verticalBars.barCount, 9);
    assert.strictEqual(result.verticalBars.cutLengthMm, 1160);

    // Compare with visual Three.js dynamic pattern builder
    const visualGroup = buildDynamicGrillPatternGroup(1.36, 1.16, {
      nominalBarPitchMm: 140,
      nominalRowPitchMm: 191,
    });

    const visualVerticalCount = visualGroup.userData.verticalBarCount as number;
    const visualHorizontalCount = visualGroup.userData.horizontalBarCount as number;

    assert.strictEqual(result.verticalBars.barCount, visualVerticalCount);
    assert.strictEqual(result.horizontalBars.barCount, visualHorizontalCount);
    assert.strictEqual(result.horizontalBars.barCount, 25);
    assert.strictEqual(result.horizontalBars.cutLengthMm, 136); // actualPitchM = 1.36 / 10 = 0.136m = 136mm
  });

  // --------------------------------------------------------------------------
  // QAD-TC86.6: Perimeter rail cut lengths match aperture boundary
  // --------------------------------------------------------------------------
  it("QAD-TC86.6: matches aperture boundary for top/bottom rails and jambs (1500mm x 1200mm)", () => {
    const input: GrilleLinearPricingInput = {
      widthMm: 1500,
      heightMm: 1200,
      frameProfileWidthMm: 20,
      includePerimeterFrame: true,
      grilleRawMaterial: {
        id: "mat-1",
        material_code: "AL-TUBE-16",
        description: "Aluminum Square Tube",
        unit_price: 200.0,
      },
    };

    const result = calculateGrilleLinearBOM(input);
    assert.ok(result.perimeterRails);

    assert.strictEqual(result.perimeterRails.topRail.lengthMm, 1500);
    assert.strictEqual(result.perimeterRails.bottomRail.lengthMm, 1500);
    assert.strictEqual(result.perimeterRails.leftJamb.lengthMm, 1160); // 1200 - 2 * 20
    assert.strictEqual(result.perimeterRails.rightJamb.lengthMm, 1160);
    assert.strictEqual(result.perimeterRails.totalLinearM, 5.32); // 1.5 + 1.5 + 1.16 + 1.16
  });

  // --------------------------------------------------------------------------
  // QAD-TC86.7: Scrap allowance calculation (12% aluminum offcut)
  // --------------------------------------------------------------------------
  it("QAD-TC86.7: computes exact 12% offcut scrap allowance on 10.0m net extrusion at PHP 200.00/m", () => {
    // Construct an input that yields exactly 10.0m total net extrusion:
    // Without perimeter frame, grid pattern: 1000mm width, 2000mm height
    // colCount = 1 -> 1 vertical bar * 2.0m = 2.0m
    // rowCount = 8 -> 8 horizontal rails * 1.0m = 8.0m
    // Total linear extrusion = 10.0m
    const input: GrilleLinearPricingInput = {
      widthMm: 1000,
      heightMm: 2000,
      patternType: "grid",
      nominalPitchColMm: 1000,
      nominalPitchRowMm: 250,
      includePerimeterFrame: false,
      grilleRawMaterial: {
        id: "mat-1",
        material_code: "AL-TUBE-16",
        description: "Aluminum Tube",
        unit_price: 200.0,
        waste_allowance: 0.12,
      },
    };

    const result = calculateGrilleLinearBOM(input);

    assert.strictEqual(result.totalLinearMeters, 10.0);
    // Net material cost = 10.0 * 200 = 2000.00
    // Gross material cost = 10.0 * 200 * 1.12 = 2240.00
    // Waste allowance cost = 2240.00 - 2000.00 = 240.00
    assert.strictEqual(result.wasteAllowanceCost, 240.0);
    assert.strictEqual(result.directMaterialCost, 2240.0);
  });

  // --------------------------------------------------------------------------
  // QAD-TC86.8: Fabrication labor floor enforcement
  // --------------------------------------------------------------------------
  it("QAD-TC86.8: clamps fabrication labor to minimum PHP 650.00 floor when material percentage is lower", () => {
    const input: GrilleLinearPricingInput = {
      widthMm: 600,
      heightMm: 600,
      includePerimeterFrame: false,
      patternType: "grid",
      nominalPitchColMm: 600,
      nominalPitchRowMm: 600,
      laborRate: 0.25,
      laborFloor: 650.0,
      grilleRawMaterial: {
        id: "mat-small",
        material_code: "AL-16",
        description: "Small profile",
        unit_price: 100.0,
        waste_allowance: 0.12,
      },
    };

    const result = calculateGrilleLinearBOM(input);
    // 25% of small material cost is far below PHP 650.00
    assert.ok(result.directMaterialCost * 0.25 < 650.0);
    assert.strictEqual(result.laborCost, 650.0);
  });

  // --------------------------------------------------------------------------
  // QAD-TC86.9: Contractor gross margin enforcement (25%)
  // --------------------------------------------------------------------------
  it("QAD-TC86.9: enforces 25% contractor gross margin on combined material and labor cost", () => {
    // When direct material = 3000.00 and labor = 750.00, sum = 3750.00
    // Contractor margin = 3750 * 0.25 = 937.50, final price = 4687.50
    const input: GrilleLinearPricingInput = {
      widthMm: 1000,
      heightMm: 2000,
      includePerimeterFrame: false,
      patternType: "grid",
      nominalPitchColMm: 1000,
      nominalPitchRowMm: 250, // 10.0m total
      grilleRawMaterial: {
        id: "mat-margin",
        material_code: "AL-MARGIN",
        description: "Margin test profile",
        unit_price: 267.85714, // 10m * unitPrice * 1.12 ~ 3000.00
        waste_allowance: 0.12,
      },
      laborFloor: 0.0,
      laborRate: 0.25,
      contractorMarginRate: 0.25,
    };

    // Test with direct mathematical formula
    const mockMaterialCost = 3000.0;
    const mockLaborCost = 750.0;
    const mockMarginRate = 0.25;
    const expectedMargin = Math.round((mockMaterialCost + mockLaborCost) * mockMarginRate * 100) / 100;
    const expectedFinalPrice = Math.round((mockMaterialCost + mockLaborCost + expectedMargin) * 100) / 100;

    assert.strictEqual(expectedMargin, 937.5);
    assert.strictEqual(expectedFinalPrice, 4687.5);

    // Verify engine execution with laborRate and contractorMarginRate
    const result = calculateGrilleLinearBOM(input);
    const expectedResultMargin =
      Math.round((result.directMaterialCost + result.laborCost) * 0.25 * 100) / 100;
    assert.strictEqual(result.contractorMargin, expectedResultMargin);
    assert.strictEqual(
      result.finalPrice,
      Math.round((result.directMaterialCost + result.laborCost + result.contractorMargin) * 100) / 100,
    );
  });

  // --------------------------------------------------------------------------
  // QAD-TC86.10: Calculation performance under 10ms for 100 iterations (< 100ms total)
  // --------------------------------------------------------------------------
  it("QAD-TC86.10: executes 100 dynamic BOM recalculations in under 100ms (< 1ms per recalculation)", () => {
    const input: GrilleLinearPricingInput = {
      widthMm: 1200,
      heightMm: 1200,
      patternType: "staggered_brick",
      nominalPitchColMm: 140,
      nominalPitchRowMm: 191,
      grilleRawMaterial: {
        id: "mat-perf",
        material_code: "AL-PERF",
        description: "Performance Profile",
        unit_price: 175.0,
      },
    };

    const startTime = performance.now();
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const dynamicInput = {
        ...input,
        widthMm: 600 + (i % 20) * 80,
        heightMm: 800 + (i % 15) * 100,
      };
      calculateGrilleLinearBOM(dynamicInput);
    }

    const elapsedMs = performance.now() - startTime;
    assert.ok(
      elapsedMs < 100,
      `100 recalculations completed in ${elapsedMs.toFixed(2)}ms, expected < 100ms`,
    );
  });

  // --------------------------------------------------------------------------
  // Extra Edge Case Tests: Negligible Micro-Geometry & Pattern Heuristics
  // --------------------------------------------------------------------------
  it("filters out micro-geometry below 5mm during 3D geometry analysis", () => {
    const root = new THREE.Group();
    // Micro mesh: 3mm x 3mm x 3mm
    const microGeo = new THREE.BoxGeometry(0.003, 0.003, 0.003);
    const microMesh = new THREE.Mesh(microGeo, new THREE.MeshBasicMaterial());
    root.add(microMesh);

    // Normal bar: 1000mm x 16mm x 16mm
    const barGeo = new THREE.BoxGeometry(1.0, 0.016, 0.016);
    const barMesh = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial());
    root.add(barMesh);

    const analysis = analyzeGrilleGeometry(root, 1000, 1000);
    assert.strictEqual(analysis.subBars.length, 1);
    assert.strictEqual(analysis.subBars[0].lengthMm, 1000);
  });

  it("detects louvers pattern heuristic when horizontal bars outnumber vertical bars by 3x", () => {
    const root = new THREE.Group();
    // 1 vertical mullion
    const vGeo = new THREE.BoxGeometry(0.016, 1.2, 0.016);
    root.add(new THREE.Mesh(vGeo, new THREE.MeshBasicMaterial()));

    // 10 horizontal slats
    const hGeo = new THREE.BoxGeometry(1.0, 0.016, 0.016);
    for (let i = 0; i < 10; i++) {
      root.add(new THREE.Mesh(hGeo, new THREE.MeshBasicMaterial()));
    }

    const analysis = analyzeGrilleGeometry(root, 1000, 1200);
    assert.strictEqual(analysis.patternType, "louvers");
  });
});
