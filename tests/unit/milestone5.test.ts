import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculateStandardSeries798,
  generateQuotationSnapshot,
} from "../../src/lib/pricing/pricingEngine.js";
import {
  QuotationBOMSummarySchema,
  FrozenPricingDetailsSchema,
} from "../../src/lib/pricing/types.js";

describe("Milestone 5: Parametric Bill-of-Materials (BOM) Pricing Engine Core", () => {
  // --------------------------------------------------------------------------
  // 1. Scenario 1: Standard Baseline 2-Panel Window (1.20m W x 1.20m H, with Sill)
  // --------------------------------------------------------------------------
  describe("Scenario 1: Baseline 2-Panel Window (1.20m W x 1.20m H, with Sill)", () => {
    it("should compute exact extrusion subtotal, glass subtotal, labor floor, and final quotation PHP 4,362.93", () => {
      const result = calculateStandardSeries798({
        widthMm: 1200,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
      });

      // Framing: Head (108.00) + Sill (132.00) + Jambs (168.00) + Rails (172.80) + Stiles (374.40) = 955.20
      assert.strictEqual(result.rawFramingSubtotal, 955.20);
      // Framing with 12% offcut scrap = 955.20 * 1.12 = 1,069.82
      assert.strictEqual(result.scrapFramingSubtotal, 114.62);
      assert.strictEqual(result.effectiveFramingCost, 1069.82);

      // Glass: 1.44 sqm * 780.00 = 1,123.20
      assert.strictEqual(result.rawGlazingSubtotal, 1123.20);
      // Glass with 10% scrap = 1,123.20 * 1.10 = 1,235.52
      assert.strictEqual(result.scrapGlazingSubtotal, 112.32);
      assert.strictEqual(result.effectiveGlazingCost, 1235.52);

      // Hardware (215.00) + Consumables (220.00) = 435.00
      assert.strictEqual(result.hardwareSubtotal, 215.00);
      assert.strictEqual(result.consumablesSubtotal, 220.00);

      // Direct Materials Subtotal = 1069.82 + 1235.52 + 435.00 = 2,740.34
      assert.strictEqual(result.directMaterialsSubtotal, 2740.34);

      // Labor: max(750.00, 0.25 * 2740.34 = 685.09) = 750.00 (Labor Floor triggers)
      assert.strictEqual(result.fabricationLaborCost, 750.00);

      // Total Direct Cost = 2740.34 + 750.00 = 3,490.34
      assert.strictEqual(result.totalDirectCost, 3490.34);

      // Contractor Gross Margin (25%) = 3490.34 * 0.25 = 872.59
      assert.strictEqual(result.contractorMargin, 872.59);

      // Final Quotation = 3490.34 + 872.59 = 4,362.93
      assert.strictEqual(result.finalQuotation, 4362.93);

      // Aspect ratio check (1.20 / 0.60 = 2.0 -> > 1.2 crabbing check)
      assert.strictEqual(result.leafWidthM, 0.6);
      assert.strictEqual(result.aspectRatio, 2.0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Scenario 2: Extended Width (1.80m W x 1.20m H, with Sill)
  // --------------------------------------------------------------------------
  describe("Scenario 2: Extended Width (1.80m W x 1.20m H, with Sill)", () => {
    it("should compute exact scale response and quotation PHP 5,670.74 (labor exceeds floor)", () => {
      const result = calculateStandardSeries798({
        widthMm: 1800,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
      });

      // Raw Extrusions: Head (162.00) + Sill (198.00) + Jambs (168.00) + Rails (259.20) + Stiles (374.40) = 1,161.60
      assert.strictEqual(result.rawFramingSubtotal, 1161.60);
      assert.strictEqual(result.effectiveFramingCost, 1300.99);

      // Glass Infill: 2.16 sqm * 780.00 * 1.10 = 1,853.28
      assert.strictEqual(result.effectiveGlazingCost, 1853.28);

      // Hardware (215.00) + Consumables (260.00) = 475.00
      assert.strictEqual(result.hardwareSubtotal + result.consumablesSubtotal, 475.00);

      // Direct Materials Subtotal = 1300.99 + 1853.28 + 475.00 = 3,629.27
      assert.strictEqual(result.directMaterialsSubtotal, 3629.27);

      // Labor (Option A: max(750, 0.25 * 3629.27)) = 907.32 (Exceeds floor)
      assert.strictEqual(result.fabricationLaborCost, 907.32);

      // Total Direct Cost = 3629.27 + 907.32 = 4,536.59
      assert.strictEqual(result.totalDirectCost, 4536.59);

      // Contractor Margin = 4536.59 * 0.25 = 1,134.15
      assert.strictEqual(result.contractorMargin, 1134.15);

      // Final Quotation = 4536.59 + 1134.15 = 5,670.74
      assert.strictEqual(result.finalQuotation, 5670.74);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Scenario 3: Extended Width with Sill Removed (1.80m W x 1.20m H, No Sill)
  // --------------------------------------------------------------------------
  describe("Scenario 3: Extended Width with Sill Removed (1.80m W x 1.20m H, No Sill)", () => {
    it("should compute exact quotation PHP 5,285.18 and net sill removal deduction of PHP 385.56", () => {
      const withSill = calculateStandardSeries798({
        widthMm: 1800,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
      });

      const withoutSill = calculateStandardSeries798({
        widthMm: 1800,
        heightMm: 1200,
        panelCount: 2,
        hasSill: false,
      });

      // Raw Extrusions Subtotal without sill = 963.60
      assert.strictEqual(withoutSill.rawFramingSubtotal, 963.60);
      assert.strictEqual(withoutSill.effectiveFramingCost, 1079.23);

      // Glass Infill unchanged = 1,853.28
      assert.strictEqual(withoutSill.effectiveGlazingCost, 1853.28);

      // Hardware + Consumables adjusted = 450.00
      assert.strictEqual(withoutSill.hardwareSubtotal + withoutSill.consumablesSubtotal, 450.00);

      // Direct Materials Subtotal = 1079.23 + 1853.28 + 450.00 = 3,382.51
      assert.strictEqual(withoutSill.directMaterialsSubtotal, 3382.51);

      // Labor = max(750, 0.25 * 3382.51) = 845.63
      assert.strictEqual(withoutSill.fabricationLaborCost, 845.63);

      // Total Direct Cost = 3382.51 + 845.63 = 4,228.14
      assert.strictEqual(withoutSill.totalDirectCost, 4228.14);

      // Contractor Margin = 4228.14 * 0.25 = 1,057.04
      assert.strictEqual(withoutSill.contractorMargin, 1057.04);

      // Final Quotation = 4228.14 + 1057.04 = 5,285.18
      assert.strictEqual(withoutSill.finalQuotation, 5285.18);

      // Net deduction for customer = 5670.74 - 5285.18 = 385.56
      const netDeduction = Math.round((withSill.finalQuotation - withoutSill.finalQuotation) * 100) / 100;
      assert.strictEqual(netDeduction, 385.56);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Scenario 4: Wide Span Crossing Structural Threshold (2.60m W x 1.20m H, 3-Panel)
  // --------------------------------------------------------------------------
  describe("Scenario 4: Wide Span 3-Panel Transition (2.60m W x 1.20m H, 3-Panel)", () => {
    it("should compute exact 6-rail 6-stile 6-roller BOM cost PHP 6,482.30 and quote PHP 8,102.88", () => {
      const result = calculateStandardSeries798({
        widthMm: 2600,
        heightMm: 1200,
        panelCount: 3,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
      });

      // Raw Extrusions: Head (234.00) + Sill (286.00) + Jambs (168.00) + Rails (374.40) + Stiles (561.60) = 1,624.00
      assert.strictEqual(result.rawFramingSubtotal, 1624.00);
      assert.strictEqual(result.effectiveFramingCost, 1818.88);

      // Glass Infill: 3.12 sqm * 780.00 * 1.10 = 2,676.96
      assert.strictEqual(result.effectiveGlazingCost, 2676.96);

      // Hardware & Consumables: 6 Rollers (150.00) + 2 Locks (130.00) + Guides/Fasteners (70.00) + Consumables (340.00) = 690.00
      assert.strictEqual(result.hardwareSubtotal + result.consumablesSubtotal, 690.00);

      // Direct Materials Subtotal = 1818.88 + 2676.96 + 690.00 = 5,185.84
      assert.strictEqual(result.directMaterialsSubtotal, 5185.84);

      // Labor (Option A: max(750, 0.25 * 5185.84)) = 1,296.46
      assert.strictEqual(result.fabricationLaborCost, 1296.46);

      // Total Direct Cost = 5185.84 + 1296.46 = 6,482.30
      assert.strictEqual(result.totalDirectCost, 6482.30);

      // Contractor Margin = 6482.30 * 0.25 = 1,620.58
      assert.strictEqual(result.contractorMargin, 1620.58);

      // Final Quotation = 6482.30 + 1620.58 = 8,102.88
      assert.strictEqual(result.finalQuotation, 8102.88);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Powder Coated White and Safety Tempered Glass Variations
  // --------------------------------------------------------------------------
  describe("Finish & Glazing Variations", () => {
    it("should compute higher rates for Powder Coated White and 6mm Tempered Glass", () => {
      const pcwTempered = calculateStandardSeries798({
        widthMm: 1200,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
        finishType: "PowderCoatedWhite",
        glassType: "6mm_tempered",
      });

      // Head (1.2*105=126) + Sill (1.2*125=150) + Jambs (2.4*82=196.8) + Rails (2.4*84=201.6) + Stiles (4.8*90=432) = 1106.40
      assert.strictEqual(pcwTempered.rawFramingSubtotal, 1106.40);
      assert.strictEqual(pcwTempered.effectiveFramingCost, 1239.17);

      // 6mm Tempered: 1.44 sqm * 1650.00 * 1.05 = 2,494.80
      assert.strictEqual(pcwTempered.rawGlazingSubtotal, 2376.00);
      assert.strictEqual(pcwTempered.effectiveGlazingCost, 2494.80);

      assert.strictEqual(pcwTempered.finalQuotation > 4362.93, true);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Frozen Quotation Snapshot Generator Persistence Test
  // --------------------------------------------------------------------------
  describe("Frozen Quotation Snapshot Generator", () => {
    it("should generate a 4-group frozen snapshot conforming to PostgreSQL schema & Zod validators", () => {
      const calcResult = calculateStandardSeries798({
        widthMm: 1800,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
        structuralWaiver: false,
      });

      const quoteId = "550e8400-e29b-41d4-a716-446655440000";
      const snapshot = generateQuotationSnapshot(quoteId, calcResult, { structuralWaiver: false });

      // Validate top level snapshot
      assert.strictEqual(snapshot.quotation_id, quoteId);
      assert.strictEqual(snapshot.total_estimated_amount, 5670.74);
      assert.strictEqual(snapshot.currency, "PHP");
      assert.strictEqual(snapshot.has_sill, true);
      assert.strictEqual(snapshot.structural_waiver, false);
      assert.strictEqual(snapshot.groups.length, 4);

      // Validate grouped items
      const groupNames = snapshot.groups.map(g => g.item_group_name);
      assert.deepStrictEqual(groupNames, [
        "Aluminum Framing",
        "Glass Infill",
        "Hardware & Accessories",
        "Labor & Installation",
      ]);

      // Verify each group has valid frozen pricing details JSONB
      for (const grp of snapshot.groups) {
        assert.strictEqual(grp.pricing_details.total_estimate, 5670.74);
        assert.strictEqual(grp.pricing_details.margin_rate, 0.25);
        assert.strictEqual(grp.pricing_details.items_breakdown.length > 0, true);
        const parsedFrozen = FrozenPricingDetailsSchema.safeParse(grp.pricing_details);
        assert.strictEqual(parsedFrozen.success, true);
      }

      const parsedSummary = QuotationBOMSummarySchema.safeParse(snapshot);
      assert.strictEqual(parsedSummary.success, true);
    });

    it("should correctly propagate structural_waiver flag across snapshot groups", () => {
      const calcResult = calculateStandardSeries798({
        widthMm: 2600,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
      });

      const quoteId = "550e8400-e29b-41d4-a716-446655440001";
      const waiverSnapshot = generateQuotationSnapshot(quoteId, calcResult, { structuralWaiver: true });

      assert.strictEqual(waiverSnapshot.structural_waiver, true);
      for (const grp of waiverSnapshot.groups) {
        assert.strictEqual(grp.structural_waiver, true);
      }
    });
  });
});
