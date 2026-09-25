import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateStandardSeries798 } from "../../src/lib/pricing/pricingEngine.js";
import { createQuotationDocumentSnapshotV1, createQuotationDocumentViewModel, deriveQuotationPricing, QuotationDocumentSnapshotV1Schema } from "../../src/lib/pricing/quotationDocument.js";
import { generateQuotationPdfHtml } from "../../src/lib/pricing/quotationPdfGenerator.js";

describe("IMP-MS16 canonical quotation document", () => {
  const bom = calculateStandardSeries798({ widthMm: 1200, heightMm: 1200, panelCount: 2 });
  const draft = createQuotationDocumentSnapshotV1({ customer: { name: "Client", phone: null, email: null, siteLocation: null }, projectName: "Custom Window", items: [], fallbackBom: bom, hasSill: true, structuralWaiver: false });
  const snapshot = QuotationDocumentSnapshotV1Schema.parse({ ...draft, quotationNumber: "Q-2026-1000", referenceCode: "CF-2026-1000", shareablePath: "/q/CF-2026-1000", createdAt: "2026-09-25T00:00:00.000Z", snapshotObjectKey: null });

  it("freezes BOM groups and derives negotiated pricing", () => {
    assert.equal(snapshot.items[0].groups[0].description, bom.framingItems[0].description);
    assert.deepEqual(deriveQuotationPricing(100.1, 90), { calculatedFinalPrice: 100.1, negotiatedFinalPrice: 90, effectiveFinalPrice: 90, isPriceModified: true });
    assert.equal(deriveQuotationPricing(100.1, 100.1).negotiatedFinalPrice, null);
  });

  it("renders groups and negotiation transparency", () => {
    const view = createQuotationDocumentViewModel(snapshot, { brandLogoUrl: "https://glassfit.test/Logo.svg", shareableUrl: "https://glassfit.test/q/CF-2026-1000", snapshotImageUrl: null, allowedImageOrigins: ["https://glassfit.test"], negotiatedAmount: snapshot.pricing.calculatedFinalPrice - 100 });
    const html = generateQuotationPdfHtml(view);
    assert.match(html, /Original system-calculated estimate/);
    assert.match(html, /Final price adjusted by an authorized administrator/);
    assert.ok(html.includes(bom.framingItems[0].description));
  });
});
