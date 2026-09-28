import { describe, it } from "node:test";
import assert from "node:assert";
import { calculateParametricBOM } from "../../src/lib/pricing/pricingEngine.js";
import { parseRawMaterialCsv } from "../../src/features/admin/materials/csvMaterialParser.js";
import type { ComponentPricingInput } from "../../src/lib/pricing/pricingEngine.js";

describe("QAD-TC38: Jalousie Glass Per-Piece Catalog & Ingestion (IMP-MS24)", () => {
  it("should calculate cost as quantity * unit_price directly for pc billing unit glass without area conversion or scrap", () => {
    const jalousieBladeQuantity = 8;
    const pricePerBlade = 45.00;

    const components: ComponentPricingInput[] = [
      {
        componentKey: "jalousie_frame",
        componentName: "Jalousie Window Perimeter Jamb & Head",
        dimensionBinding: "FIXED",
        spanRatio: 1.0,
        baseQuantity: 1,
        isRemovable: false,
        presentationCategory: "Framing",
        rawMaterial: {
          id: "11111111-1111-4111-8111-111111111111",
          material_code: "AL-JALFRAME-ANLK",
          description: "Jalousie Frame Profile",
          category: "Aluminum",
          finish_type: "Analok",
          billing_unit: "m",
          unit_price: 150.00,
          waste_allowance: 0.0,
          is_active: true,
        },
      },
      {
        componentKey: "jalousie_glass_blades",
        componentName: '4" x 24" Jalousie Glass Blade (Clear)',
        dimensionBinding: "FIXED",
        spanRatio: 1.0,
        baseQuantity: jalousieBladeQuantity,
        isRemovable: false,
        presentationCategory: "Glazing",
        rawMaterial: {
          id: "22222222-2222-4222-8222-222222222222",
          material_code: "GL-4X24BLADE-CLR",
          description: '4" x 24" Jalousie Glass Blade',
          category: "Glass",
          finish_type: "Clear",
          billing_unit: "pc",
          unit_price: pricePerBlade,
          waste_allowance: 0.0,
          is_active: true,
        },
      },
    ];

    const result = calculateParametricBOM(components, {
      widthMm: 600,
      heightMm: 900,
      panelCount: 1,
      hasSill: true,
    });

    // Framing: 150.00
    assert.strictEqual(result.rawFramingSubtotal, 150.00);
    assert.strictEqual(result.effectiveFramingCost, 150.00);

    // Glazing: 8 blades * 45.00 = 360.00 exactly (no scrap added when waste_factor is 0 or unit is pc)
    assert.strictEqual(result.rawGlazingSubtotal, 360.00);
    assert.strictEqual(result.scrapGlazingSubtotal, 0.00);
    assert.strictEqual(result.effectiveGlazingCost, 360.00);

    // Glazing items check
    const glassItem = result.glazingItems.find(g => g.code === "GL-4X24BLADE-CLR");
    assert.ok(glassItem);
    assert.strictEqual(glassItem.unit, "pc");
    assert.strictEqual(glassItem.quantity, 8);
    assert.strictEqual(glassItem.unit_price, 45.00);
    assert.strictEqual(glassItem.subtotal, 360.00);

    // Direct Materials Subtotal = 150.00 + 360.00 = 510.00
    assert.strictEqual(result.directMaterialsSubtotal, 510.00);
    assert.strictEqual(result.finalQuotation, 510.00);
  });

  it("should parse jalousie glass blade CSV entries into valid pc billing_unit raw materials", () => {
    const csvContent = [
      "Material Name,Category,Finish or Color,RRD Stock Price (PHP),Stock Size (e.g. 6m or 4x6ft),Notes",
      '4" x 24" Jalousie Glass Blade,Glass,Clear,45,1pc,Jalousie window louver slat',
      '6" x 30" Jalousie Glass Blade,Glass,Bronze,60,pc,Louver glass blade',
    ].join("\n");

    const parsed = parseRawMaterialCsv(csvContent);

    assert.strictEqual(parsed.summary.total, 2);
    assert.strictEqual(parsed.summary.errorCount, 0);

    const firstRow = parsed.rows[0];
    assert.strictEqual(firstRow.category, "Glass");
    assert.strictEqual(firstRow.billingUnit, "pc");
    assert.strictEqual(firstRow.unitPrice, 45.00);
    assert.strictEqual(firstRow.inputPayload?.billing_unit, "pc");
    assert.strictEqual(firstRow.inputPayload?.unit_price, 45.00);
    assert.strictEqual(firstRow.inputPayload?.waste_allowance, 0.0);
    assert.strictEqual(firstRow.inputPayload?.sheet_width_ft, undefined);
    assert.strictEqual(firstRow.inputPayload?.sheet_height_ft, undefined);

    const secondRow = parsed.rows[1];
    assert.strictEqual(secondRow.category, "Glass");
    assert.strictEqual(secondRow.billingUnit, "pc");
    assert.strictEqual(secondRow.unitPrice, 60.00);
    assert.strictEqual(secondRow.inputPayload?.billing_unit, "pc");
  });
});
