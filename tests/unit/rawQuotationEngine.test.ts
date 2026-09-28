import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculateStandardSeries798,
} from "../../src/lib/pricing/pricingEngine.js";

describe("QAD-TC39: Raw Product Quotation Pricing Engine (IMP-MS24)", () => {
  it("should calculate strictly raw product fabrication cost with zero automated labor and contractor markups", () => {
    const result = calculateStandardSeries798({
      widthMm: 1200,
      heightMm: 1200,
      panelCount: 2,
      hasSill: true,
      finishType: "Analok",
      glassType: "6mm_bronze",
    });

    // Framing: Head (108.00) + Sill (132.00) + Jambs (168.00) + Rails (172.80) + Stiles (374.40) = 955.20
    // With 12% scrap = 1,069.82
    assert.strictEqual(result.effectiveFramingCost, 1069.82);

    // Glass: 1.44 sqm * 780.00 * 1.10 = 1,235.52
    assert.strictEqual(result.effectiveGlazingCost, 1235.52);

    // Hardware & Consumables = 215.00 + 220.00 = 435.00
    assert.strictEqual(result.hardwareSubtotal + result.consumablesSubtotal, 435.00);

    // Direct Materials Subtotal = 1069.82 + 1235.52 + 435.00 = 2,740.34
    assert.strictEqual(result.directMaterialsSubtotal, 2740.34);

    // Invariant under IMP-MS24: Zero automated labor surcharge in self-service customer quotation
    assert.strictEqual(result.fabricationLaborCost, 0.00);

    // Invariant under IMP-MS24: Zero automated contractor gross margin markup
    assert.strictEqual(result.contractorMargin, 0.00);

    // Final Quotation exactly equals Direct Materials Subtotal (Raw Product Price)
    assert.strictEqual(result.finalQuotation, 2740.34);
    assert.strictEqual(result.totalDirectCost, 2740.34);

    // Frozen pricing snapshot verification
    assert.strictEqual(result.frozenDetails.direct_material_subtotal, 2740.34);
    assert.strictEqual(result.frozenDetails.labor_cost, 0.00);
    assert.strictEqual(result.frozenDetails.contractor_margin, 0.00);
    assert.strictEqual(result.frozenDetails.margin_rate, 0.00);
    assert.strictEqual(result.frozenDetails.total_estimate, 2740.34);
  });

  it("should calculate 1.80m extended width raw product price without compounding markups", () => {
    const result = calculateStandardSeries798({
      widthMm: 1800,
      heightMm: 1200,
      panelCount: 2,
      hasSill: true,
      finishType: "Analok",
      glassType: "6mm_bronze",
    });

    // Framing with 12% scrap = 1,300.99
    assert.strictEqual(result.effectiveFramingCost, 1300.99);

    // Glass with 10% scrap = 1,853.28
    assert.strictEqual(result.effectiveGlazingCost, 1853.28);

    // Hardware & Consumables = 475.00
    assert.strictEqual(result.hardwareSubtotal + result.consumablesSubtotal, 475.00);

    // Direct Materials Subtotal = 1300.99 + 1853.28 + 475.00 = 3,629.27
    assert.strictEqual(result.directMaterialsSubtotal, 3629.27);
    assert.strictEqual(result.fabricationLaborCost, 0.00);
    assert.strictEqual(result.contractorMargin, 0.00);
    assert.strictEqual(result.finalQuotation, 3629.27);
  });
});
