/** IMP-MS77, QAD-TC92.6 through QAD-TC92.9: quotation accessory boundary. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateAccessoryQuotationSelections } from "../../src/lib/booking/accessorySelectionValidation.js";
import type { QuotationDocumentDraftV1 } from "../../src/lib/pricing/quotationDocument.js";

const hostId = "11111111-1111-4111-8111-111111111111";
const knobId = "22222222-2222-4222-8222-222222222222";
const lockId = "33333333-3333-4333-8333-333333333333";
const approvedId = "44444444-4444-4444-8444-444444444444";
const otherId = "55555555-5555-4555-8555-555555555555";

function draft(selections: Array<{ slotComponentId?: string; accessoryId: string; accessoryName?: string; unitPrice?: number }>, secondItem = false): QuotationDocumentDraftV1 {
  const accessoryTotal = selections.reduce((sum, selection) => sum + (selection.accessoryId === "default" ? 0 : 850), 0);
  const itemPrice = 1000 + accessoryTotal;
  const item = (itemId: string) => ({
    itemId, productId: hostId, productName: "Door", productType: "Door", variantName: "Standard",
    specificationSummary: "Door", dimensionsFormatted: "1000 x 2000 mm", widthMm: 1000,
    heightMm: 2000, panelCount: 1, hasSill: false, structuralWaiver: false,
    finishLabel: "Black", glassLabel: "Clear", quantity: 1, unitPrice: itemPrice, baseUnitPrice: 1000, accessoryPriceDelta: accessoryTotal,
    calculatedSubtotal: itemPrice, imageSource: null,
    groups: [{ groupName: "Door", description: "Base", quantity: 1, unit: "pc", unitPrice: itemPrice, subtotal: itemPrice }],
    swappedAccessories: selections.map((selection) => ({
      accessoryName: "Registered Hardware",
      unitPrice: selection.accessoryId === "default" ? 0 : 850,
      priceDelta: selection.accessoryId === "default" ? 0 : 850,
      ...selection,
    })),
  });
  return {
    schemaVersion: 1,
    customer: { name: "Test Customer", phone: null, email: null, siteLocation: null },
    projectName: "Test", hasSill: false, structuralWaiver: false,
    items: secondItem ? [item("first"), item("second")] : [item("first")],
    pricing: { directMaterialsSubtotal: 1000, laborSubtotal: 0, contractorMargin: 0, calculatedFinalPrice: itemPrice * (secondItem ? 2 : 1) },
  };
}

describe("IMP-MS77 quotation compatibility", () => {
  it("accepts the included default without a database lookup", async () => {
    let calls = 0;
    await validateAccessoryQuotationSelections(draft([{ slotComponentId: knobId, accessoryId: "default" }]), async () => {
      calls += 1;
      return null;
    });
    assert.equal(calls, 0);
  });

  it("accepts an approved component and accessory pair", async () => {
    const calls: string[] = [];
    await validateAccessoryQuotationSelections(draft([{ slotComponentId: knobId, accessoryId: approvedId }]), async (productId, componentId, accessoryId) => {
      calls.push(`${productId}:${componentId}:${accessoryId}`);
      return { productName: "Registered Hardware", basePrice: 850 };
    });
    assert.deepEqual(calls, [`${hostId}:${knobId}:${approvedId}`]);
  });

  it("rejects an unapproved or revoked replacement", async () => {
    await assert.rejects(
      validateAccessoryQuotationSelections(draft([{ slotComponentId: knobId, accessoryId: otherId }]), async () => null),
    );
  });

  it("rejects missing component identity and duplicate slot selections", async () => {
    const lookup = async () => ({ productName: "Registered Hardware", basePrice: 850 });
    await assert.rejects(validateAccessoryQuotationSelections(draft([{ accessoryId: approvedId }]), lookup));
    await assert.rejects(validateAccessoryQuotationSelections(draft([
      { slotComponentId: knobId, accessoryId: approvedId },
      { slotComponentId: knobId, accessoryId: otherId },
    ]), lookup));
  });

  it("rejects client-supplied name and price changes", async () => {
    const lookup = async () => ({ productName: "Registered Hardware", basePrice: 850 });
    await assert.rejects(validateAccessoryQuotationSelections(draft([{ slotComponentId: knobId, accessoryId: approvedId, accessoryName: "Fabricated Name" }]), lookup));
    await assert.rejects(validateAccessoryQuotationSelections(draft([{ slotComponentId: knobId, accessoryId: approvedId, unitPrice: 1 }]), lookup));
  });

  it("validates every item and binds the accessory to the selected slot", async () => {
    const calls: string[] = [];
    await validateAccessoryQuotationSelections(draft([
      { slotComponentId: knobId, accessoryId: approvedId },
      { slotComponentId: lockId, accessoryId: otherId },
    ], true), async (_host, component, accessory) => {
      calls.push(`${component}:${accessory}`);
      return { productName: "Registered Hardware", basePrice: 850 };
    });
    assert.equal(calls.length, 4);
    assert.ok(calls.includes(`${lockId}:${otherId}`));
  });
});
