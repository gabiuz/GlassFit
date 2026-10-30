/** FIX-UI11-V4, PRD-F10, SDD-C7, QAD-TC18: no-glass BOM reconciliation. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { calculateParametricBOM, type ComponentPricingInput } from "../../src/lib/pricing/pricingEngine.js";
import type { RawMaterial } from "../../src/lib/pricing/types.js";

const material = (category: RawMaterial["category"], price: number): RawMaterial => ({
  id: "00000000-0000-4000-8000-000000000001",
  material_code: `TEST-${category}`,
  description: `${category} infill`,
  category,
  finish_type: "None",
  billing_unit: "sqm",
  unit_price: price,
  waste_allowance: 0,
  is_active: true,
});

const component = (category: RawMaterial["category"]): ComponentPricingInput => ({
  componentKey: "infill",
  componentName: "Infill panel",
  dimensionBinding: "AREA",
  spanRatio: 1,
  baseQuantity: 1,
  isRemovable: false,
  presentationCategory: "Glazing",
  rawMaterial: material(category, 100),
});

describe("FIX-UI11-V4 no-glass pricing", () => {
  it("keeps a non-glass infill charge but does not call it glass", () => {
    const bom = calculateParametricBOM([component("Consumable")], { widthMm: 1000, heightMm: 1000 });
    assert.equal(bom.glazingItems.length, 0);
    assert.equal(bom.effectiveGlazingCost, 0);
    assert.equal(bom.consumablesSubtotal, 100);
    assert.equal(bom.finalQuotation, 100);
    assert.equal(bom.glassType, "None");
    assert.equal(bom.frozenDetails.glass_type, "None");
    assert.equal(bom.bomSummary.groups.find(group => group.item_group_name === "Glass Infill")?.estimated_subtotal, 0);
    assert.equal(bom.bomSummary.groups.find(group => group.item_group_name === "Hardware & Accessories")?.estimated_subtotal, 100);
    assert.equal(bom.frozenDetails.items_breakdown[0]?.description, "Consumable infill");
  });

  it("preserves glass classification and its material scrap", () => {
    const glass = component("Glass");
    if (glass.rawMaterial) glass.rawMaterial.waste_allowance = 0.1;
    const bom = calculateParametricBOM([glass], { widthMm: 1000, heightMm: 1000 });
    assert.equal(bom.effectiveGlazingCost, 110);
    assert.equal(bom.finalQuotation, 110);
    assert.equal(bom.glazingItems.length, 1);
  });

  it("keeps an aluminum infill's material cost and offcut allowance in framing", () => {
    const aluminum = component("Aluminum");
    if (aluminum.rawMaterial) aluminum.rawMaterial.waste_allowance = 0.1;
    const bom = calculateParametricBOM([aluminum], { widthMm: 1000, heightMm: 1000 });
    assert.equal(bom.framingItems.length, 1);
    assert.equal(bom.effectiveFramingCost, 110);
    assert.equal(bom.effectiveGlazingCost, 0);
    assert.equal(bom.finalQuotation, 110);
    assert.equal(bom.bomSummary.groups.find(group => group.item_group_name === "Aluminum Framing")?.estimated_subtotal, 110);
  });
});
