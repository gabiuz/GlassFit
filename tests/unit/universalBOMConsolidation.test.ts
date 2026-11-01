/** IMP-MS85 / PRD-F10 / SDD-C7 / QAD-TC100: fabrication quantity and price integrity. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateParametricBOM, consolidateBOMItems, type ComponentPricingInput } from "../../src/lib/pricing/pricingEngine";
import { BOMItemDetailSchema, type DynamicBayRole, type RawMaterial } from "../../src/lib/pricing/types";

const material: RawMaterial = {
  id: "profile", material_code: "PROFILE", description: "Aluminum Frame Profile",
  category: "Aluminum", finish_type: "Analok", billing_unit: "m", unit_price: 100,
  waste_allowance: 0.12, is_active: true,
};
function component(key: string, role: DynamicBayRole | null, dimensionBinding: ComponentPricingInput["dimensionBinding"], count = 4): ComponentPricingInput {
  return { componentKey: key, componentName: key, bayRole: role, dimensionBinding,
    baseQuantity: count, spanRatio: 1, isRemovable: role === "REMOVABLE_SILL",
    presentationCategory: "Framing", rawMaterial: material };
}
const perimeter = () => [
  component("Top Frame Rail", "OUTER_HEAD", "WIDTH"),
  component("Bottom Sill Rail", "OUTER_SILL", "WIDTH"),
  component("Left Jamb", "OUTER_JAMB_LEFT", "HEIGHT"),
  component("Right Jamb", "OUTER_JAMB_RIGHT", "HEIGHT"),
];
const dimensions = { widthMm: 1143, heightMm: 1193.8 };

describe("IMP-MS85 universal BOM integrity", () => {
  it("QAD-TC100.1/.3: polluted counts and four screen hatches cannot multiply host cuts", () => {
    const result = calculateParametricBOM([...perimeter(), component("Center Mullion", "BAY_DIVIDER", "HEIGHT")], { ...dimensions, hatchCount: 4 });
    assert.deepEqual(result.framingItems.map(i => i.quantity), [1.143, 1.143, 1.1938, 1.1938, 1.1938]);
    assert.equal(result.totalLinearMetersFraming, 5.87);
    assert.equal(result.framingItems[0].componentTrace?.pieceCount, 1);
  });
  it("QAD-TC100.2/.11/.12: consolidation preserves parts and exact original subtotals", () => {
    const result = calculateParametricBOM(perimeter(), dimensions);
    const items = consolidateBOMItems(result.framingItems, "Framing");
    assert.equal(items.length, 1);
    assert.equal(items[0].contributingComponents.length, 4);
    assert.equal(items[0].totalQuantity, 4.6736);
    assert.equal(items[0].subtotal, result.rawFramingSubtotal);
    assert.equal(BOMItemDetailSchema.parse(result.framingItems[0]).componentTrace?.unitCutLength, 1.143);
  });
  it("QAD-TC100.2: different finishes, units, rates and waste remain independent", () => {
    const item = calculateParametricBOM(perimeter(), dimensions).framingItems[0];
    const variants = [item, {...item, finish_type: "Mill"}, {...item, unit: "pc"}, {...item, unit_price: 99}, {...item, waste_factor: 0.2}];
    assert.equal(consolidateBOMItems(variants, "Framing").length, 5);
  });
  it("QAD-TC100.4/.5: permanent bottom rail survives optional projecting sill omission", () => {
    const result = calculateParametricBOM([...perimeter(), component("Projecting Sill", "REMOVABLE_SILL", "WIDTH")], { ...dimensions, hasSill: false });
    assert.equal(result.framingItems.length, 4);
    assert.equal(result.framingItems[1].componentTrace?.componentName, "Bottom Frame Rail");
  });
  it("QAD-TC100.1/.4: legacy perimeter mappings retain guardrails and permanent bottom rails", () => {
    const parts = [component("JW_Frame_Top", null, "WIDTH"), component("JW_Frame_Bottom", null, "WIDTH"), component("JW_Frame_Left", null, "HEIGHT")];
    parts[1].isRemovable = true;
    parts[1].togglePropertyKey = "has_sill";
    const result = calculateParametricBOM(parts, { ...dimensions, hasSill: false, removableStates: { has_sill: false } });
    assert.deepEqual(result.framingItems.map(i => i.quantity), [1.143, 1.143, 1.1938]);
  });
  it("QAD-TC100.8: sliding sash counts remain physical while outer frame is continuous", () => {
    const result = calculateParametricBOM([...perimeter(), {...component("Sash Stiles", null, "HEIGHT", 4)}, {...component("Sash Rails", null, "WIDTH", 4), spanRatio: 0.5}], { widthMm: 1800, heightMm: 1500, panelCount: 2 });
    assert.deepEqual(result.framingItems.map(i => i.quantity), [1.8, 1.8, 1.5, 1.5, 6, 3.6]);
  });
  it("QAD-TC100.9/.13: casement perimeter and cabinet subframe counts retain dimensional bindings", () => {
    const result = calculateParametricBOM([component("Casement Outer Frame", null, "PERIMETER", 1), component("Cabinet Plinths", null, "WIDTH", 2)], { widthMm: 1800, heightMm: 1500 });
    assert.deepEqual(result.framingItems.map(i => i.quantity), [6.6, 3.6]);
  });
  it("QAD-TC100.10: three bays create exactly two full-height dividers", () => {
    const result = calculateParametricBOM([...perimeter(), component("Center Mullion", "BAY_DIVIDER", "HEIGHT")], { widthMm: 1800, heightMm: 1200, dynamicBayConfig: {enabled: true, nominal_bay_pitch_mm: 600, primary_dimension: "WIDTH", default_bay_count: 2, expansion_anchor_mode: "symmetric", bay_infill_component_keys: [], bay_hardware_component_keys: []}, bayCount: 3 });
    assert.deepEqual(result.framingItems.map(i => i.quantity), [1.8, 1.8, 1.2, 1.2, 2.4]);
    assert.equal(result.framingItems[4].componentTrace?.pieceCount, 2);
  });
  it("QAD-TC100.14: merging never reapplies waste or explicitly configured margin", () => {
    const result = calculateParametricBOM(perimeter(), { ...dimensions, contractorMarginRate: 0.25 });
    const item = consolidateBOMItems(result.framingItems, "Framing")[0];
    assert.equal(item.subtotal, result.rawFramingSubtotal);
    assert.equal(result.scrapFramingSubtotal, Math.round(item.subtotal * 0.12 * 100) / 100);
    assert.equal(result.finalQuotation, Math.round(result.directMaterialsSubtotal * 1.25 * 100) / 100);
  });
});
