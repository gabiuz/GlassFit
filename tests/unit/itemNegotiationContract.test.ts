import test from "node:test";
import assert from "node:assert/strict";
import { deriveQuotationPricingFromItems, QuotationDocumentSnapshotV1Schema, QuotationItemPriceOverridesV1Schema } from "../../src/lib/pricing/quotationDocument";

const item = (itemId: string, subtotal: number) => ({ itemId, productId: null, productName: itemId, productType: "Window", variantName: "Standard", specificationSummary: "Standard", dimensionsFormatted: "1000mm x 1000mm", widthMm: 1000, heightMm: 1000, panelCount: 2, hasSill: true, structuralWaiver: false, finishLabel: "Analok", glassLabel: "Clear", quantity: 1, unitPrice: subtotal, calculatedSubtotal: subtotal, imageSource: null, groups: [{ groupName: "Internal", description: "Internal BOM", quantity: 1, unit: "lot", unitPrice: subtotal, subtotal }] });
const snapshot = QuotationDocumentSnapshotV1Schema.parse({ schemaVersion: 1, quotationNumber: "Q-1", referenceCode: "CF-1", shareablePath: "/q/CF-1", createdAt: "2026-09-26T00:00:00.000Z", customer: { name: "Customer", phone: null, email: null, siteLocation: null }, projectName: "Project", snapshotObjectKey: null, hasSill: true, structuralWaiver: false, items: [item("a", 100), item("b", 200)], pricing: { directMaterialsSubtotal: 200, laborSubtotal: 40, contractorMargin: 60, calculatedFinalPrice: 300 } });

test("derives canonical item prices in centavos and preserves offsetting modification state", () => {
  const overrides = QuotationItemPriceOverridesV1Schema.parse({ schemaVersion: 1, entries: [
    { itemId: "a", negotiatedSubtotal: 90, negotiatedBy: "00000000-0000-4000-8000-000000000001", negotiatedAt: "2026-09-26T00:00:00.000Z" },
    { itemId: "b", negotiatedSubtotal: 210, negotiatedBy: "00000000-0000-4000-8000-000000000001", negotiatedAt: "2026-09-26T00:00:00.000Z" },
  ] });
  const pricing = deriveQuotationPricingFromItems(snapshot, overrides);
  assert.equal(pricing.effectiveFinalPrice, 300);
  assert.equal(pricing.negotiatedFinalPrice, 300);
  assert.equal(pricing.isPriceModified, true);
  assert.deepEqual(pricing.itemPricing.map((value) => value.effectiveSubtotal), [90, 210]);
});

test("rejects duplicate snapshot and override item identities", () => {
  assert.equal(QuotationDocumentSnapshotV1Schema.safeParse({ ...snapshot, items: [snapshot.items[0], snapshot.items[0]], pricing: { ...snapshot.pricing, calculatedFinalPrice: 200 } }).success, false);
  const entry = { itemId: "a", negotiatedSubtotal: 90, negotiatedBy: "00000000-0000-4000-8000-000000000001", negotiatedAt: "2026-09-26T00:00:00.000Z" };
  assert.equal(QuotationItemPriceOverridesV1Schema.safeParse({ schemaVersion: 1, entries: [entry, { ...entry, negotiatedSubtotal: 91 }] }).success, false);
});
