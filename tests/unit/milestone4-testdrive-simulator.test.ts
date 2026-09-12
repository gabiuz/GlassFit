import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculateParametricBOM,
  calculateStandardSeries798,
} from "../../src/lib/pricing/pricingEngine.js";

describe("Milestone 4: Interactive Test-Drive Simulator & Parametric BOM Engine", () => {
  // --------------------------------------------------------------------------
  // 1. Numerical Benchmark Scenario 1: Standard Baseline 2-Panel (1.20m x 1.20m, with Sill)
  // --------------------------------------------------------------------------
  describe("Scenario 1: Baseline 2-Panel Window (1.20m W x 1.20m H, with Sill)", () => {
    it("should compute exact BOM manufacturing subtotal and final quotation of PHP 4,362.93", () => {
      const result = calculateStandardSeries798({
        widthMm: 1200,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
      });

      // Aluminum Extrusions:
      // Head (1.20m * 90) = 108.00
      // Sill (1.20m * 110) = 132.00
      // Jambs (2.40m * 70) = 168.00
      // Rails (4 * 0.60m * 72) = 172.80
      // Stiles (4 * 1.20m * 78) = 374.40
      // Raw Extrusions Subtotal = 955.20
      assert.strictEqual(result.rawFramingSubtotal, 955.20);

      // Extrusions with 12% scrap = 955.20 * 1.12 = 1,069.82
      assert.strictEqual(result.effectiveFramingCost, 1069.82);

      // Glass Infill: 1.44 sqm * 780.00 = 1,123.20
      assert.strictEqual(result.rawGlazingSubtotal, 1123.20);
      // Glass with 10% scrap = 1,123.20 * 1.10 = 1,235.52
      assert.strictEqual(result.effectiveGlazingCost, 1235.52);

      // Hardware & Consumables = 215.00 + 220.00 = 435.00
      assert.strictEqual(result.hardwareSubtotal + result.consumablesSubtotal, 435.00);

      // Direct Materials Subtotal = 1069.82 + 1235.52 + 435.00 = 2,740.34
      assert.strictEqual(result.directMaterialsSubtotal, 2740.34);

      // Labor (Option A: max(750, 0.25 * 2740.34 = 685.09)) = 750.00
      assert.strictEqual(result.fabricationLaborCost, 750.00);

      // Total Direct Manufacturing Cost = 2740.34 + 750.00 = 3,490.34
      assert.strictEqual(result.totalDirectCost, 3490.34);

      // Contractor Gross Margin (25%) = 3490.34 * 0.25 = 872.59
      assert.strictEqual(result.contractorMargin, 872.59);

      // Final Quotation Estimate = 3490.34 + 872.59 = 4,362.93
      assert.strictEqual(result.finalQuotation, 4362.93);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Numerical Benchmark Scenario 2: Extended Width (1.80m x 1.20m, with Sill)
  // --------------------------------------------------------------------------
  describe("Scenario 2: Extended Width (1.80m W x 1.20m H, with Sill)", () => {
    it("should compute exact BOM manufacturing subtotal and final quotation of PHP 5,670.74", () => {
      const result = calculateStandardSeries798({
        widthMm: 1800,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
      });

      // Raw Extrusions Subtotal = 1,161.60
      assert.strictEqual(result.rawFramingSubtotal, 1161.60);
      // Extrusions with 12% scrap = 1,161.60 * 1.12 = 1,300.99
      assert.strictEqual(result.effectiveFramingCost, 1300.99);

      // Glass Infill (2.16 sqm * 780 * 1.10) = 1,853.28
      assert.strictEqual(result.effectiveGlazingCost, 1853.28);

      // Hardware & Consumables = 475.00
      assert.strictEqual(result.hardwareSubtotal + result.consumablesSubtotal, 475.00);

      // Direct Materials Subtotal = 1300.99 + 1853.28 + 475.00 = 3,629.27
      assert.strictEqual(result.directMaterialsSubtotal, 3629.27);

      // Labor (Option A: max(750, 0.25 * 3629.27)) = 907.32
      assert.strictEqual(result.fabricationLaborCost, 907.32);

      // Total Direct Cost = 3629.27 + 907.32 = 4,536.59
      assert.strictEqual(result.totalDirectCost, 4536.59);

      // Contractor Margin (25%) = 4536.59 * 0.25 = 1,134.15
      assert.strictEqual(result.contractorMargin, 1134.15);

      // Final Quotation Estimate = 4536.59 + 1134.15 = 5,670.74
      assert.strictEqual(result.finalQuotation, 5670.74);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Numerical Benchmark Scenario 3: Extended Width with Sill Removed (1.80m x 1.20m, No Sill)
  // --------------------------------------------------------------------------
  describe("Scenario 3: Extended Width with Sill Removed (1.80m W x 1.20m H, No Sill)", () => {
    it("should compute exact quotation of PHP 5,285.18 and net sill deduction of PHP 385.56", () => {
      const result = calculateStandardSeries798({
        widthMm: 1800,
        heightMm: 1200,
        panelCount: 2,
        hasSill: false,
        finishType: "Analok",
        glassType: "6mm_bronze",
      });

      // Raw Extrusions Subtotal = 963.60 (Sill 198.00 omitted)
      assert.strictEqual(result.rawFramingSubtotal, 963.60);
      // Extrusions with 12% scrap = 1,079.23
      assert.strictEqual(result.effectiveFramingCost, 1079.23);

      // Direct Materials Subtotal = 1079.23 + 1853.28 + 450.00 = 3,382.51
      assert.strictEqual(result.directMaterialsSubtotal, 3382.51);

      // Labor (Option A: max(750, 0.25 * 3382.51)) = 845.63
      assert.strictEqual(result.fabricationLaborCost, 845.63);

      // Total Direct Cost = 3382.51 + 845.63 = 4,228.14
      assert.strictEqual(result.totalDirectCost, 4228.14);

      // Contractor Margin = 4228.14 * 0.25 = 1,057.04
      assert.strictEqual(result.contractorMargin, 1057.04);

      // Final Quotation = 4228.14 + 1057.04 = 5,285.18
      assert.strictEqual(result.finalQuotation, 5285.18);

      // Net customer reduction compared to Scenario 2 (5,670.74 - 5,285.18 = 385.56)
      const netDeduction = 5670.74 - result.finalQuotation;
      assert.ok(Math.abs(netDeduction - 385.56) < 0.01);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Numerical Benchmark Scenario 4: Wide Span Crossing Structural Threshold (2.60m x 1.20m, 3-Panel)
  // --------------------------------------------------------------------------
  describe("Scenario 4: Wide Span 3-Panel Window (2.60m W x 1.20m H, 3 Panels)", () => {
    it("should compute exact BOM manufacturing cost of PHP 6,482.30 and final quotation of PHP 8,102.88", () => {
      const result = calculateStandardSeries798({
        widthMm: 2600,
        heightMm: 1200,
        panelCount: 3,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
      });

      // Raw Extrusions Subtotal = 1,624.00 (Includes 6 rails and 6 stiles)
      assert.strictEqual(result.rawFramingSubtotal, 1624.00);
      // Extrusions with 12% scrap = 1,624.00 * 1.12 = 1,818.88
      assert.strictEqual(result.effectiveFramingCost, 1818.88);

      // Glass Infill (3.12 sqm * 780 * 1.10) = 2,676.96
      assert.strictEqual(result.effectiveGlazingCost, 2676.96);

      // Hardware & Consumables (6 rollers, 2 locks, fasteners, silicone) = 690.00
      assert.strictEqual(result.hardwareSubtotal + result.consumablesSubtotal, 690.00);

      // Direct Materials Subtotal = 1818.88 + 2676.96 + 690.00 = 5,185.84
      assert.strictEqual(result.directMaterialsSubtotal, 5185.84);

      // Labor (Option A: max(750, 0.25 * 5185.84)) = 1,296.46
      assert.strictEqual(result.fabricationLaborCost, 1296.46);

      // Total Direct Cost = 5185.84 + 1296.46 = 6,482.30
      assert.strictEqual(result.totalDirectCost, 6482.30);

      // Contractor Gross Margin = 6482.30 * 0.25 = 1,620.58
      assert.strictEqual(result.contractorMargin, 1620.58);

      // Final Quotation Estimate = 6482.30 + 1620.58 = 8,102.88
      assert.strictEqual(result.finalQuotation, 8102.88);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Aspect Ratio & Span Limit Engineering Checks
  // --------------------------------------------------------------------------
  describe("Aspect Ratio & Physical Engineering Checks", () => {
    it("should flag crabbing risk when aspect ratio Height / Leaf Width exceeds 1.2:1", () => {
      // 1000mm width / 2 panels = 500mm leaf width. Height = 1200mm. Ratio = 1.2 / 0.5 = 2.4:1
      const narrowResult = calculateStandardSeries798({
        widthMm: 1000,
        heightMm: 1200,
        panelCount: 2,
      });

      assert.strictEqual(narrowResult.isCrabbingRisk, true);
      assert.strictEqual(narrowResult.aspectRatio, 2.4);
    });

    it("should flag span limit exceeded when width >= 2400mm on a 2-panel configuration", () => {
      const wide2P = calculateParametricBOM([], {
        widthMm: 2400,
        heightMm: 1200,
        panelCount: 2,
      });

      assert.strictEqual(wide2P.isSpanLimitExceeded, true);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Frozen Quotation Snapshot Generation
  // --------------------------------------------------------------------------
  describe("Quotation Frozen Snapshot Serializer", () => {
    it("should produce 4 grouped summary items with frozen pricing details", () => {
      const result = calculateStandardSeries798({
        widthMm: 1200,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
      });

      assert.strictEqual(result.bomSummary.groups.length, 4);
      assert.strictEqual(result.bomSummary.groups[0].item_group_name, "Aluminum Framing");
      assert.strictEqual(result.bomSummary.groups[1].item_group_name, "Glass Infill");
      assert.strictEqual(result.bomSummary.groups[2].item_group_name, "Hardware & Accessories");
      assert.strictEqual(result.bomSummary.groups[3].item_group_name, "Labor & Installation");
      assert.strictEqual(result.bomSummary.total_estimated_amount, 4362.93);
    });
  });
});
