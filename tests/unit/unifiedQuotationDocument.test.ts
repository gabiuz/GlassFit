import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateStandardSeries798 } from "../../src/lib/pricing/pricingEngine.js";
import { createQuotationDocumentSnapshotV1, createQuotationDocumentViewModel, deriveQuotationPricing, QuotationDocumentSnapshotV1Schema, reconstructLegacyQuotationDocument } from "../../src/lib/pricing/quotationDocument.js";
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

  it("renders simplified final item prices without internal cost disclosure", () => {
    const view = createQuotationDocumentViewModel(snapshot, { brandLogoUrl: "https://glassfit.test/Logo.svg", shareableUrl: "https://glassfit.test/q/CF-2026-1000", snapshotImageUrl: null, allowedImageOrigins: ["https://glassfit.test"], negotiatedAmount: snapshot.pricing.calculatedFinalPrice - 100 });
    const html = generateQuotationPdfHtml(view);
    assert.match(html, /Final item price/);
    assert.match(html, /Grand total/);
    assert.doesNotMatch(html, /Original system-calculated estimate|Final price adjusted|Component group|Unit rate/);
    assert.ok(!html.includes(bom.framingItems[0].description));
  });

  it("parses createdAt with timezone offsets and normalizes PostgreSQL timestamps", () => {
    const snapshotWithOffset = QuotationDocumentSnapshotV1Schema.parse({
      ...snapshot,
      createdAt: "2026-09-21T17:52:27.857527+00:00",
    });
    assert.equal(snapshotWithOffset.createdAt, "2026-09-21T17:52:27.857527+00:00");

    const reconstructed = reconstructLegacyQuotationDocument({
      quotationNumber: "Q-2026-5329",
      referenceCode: "CF-2026-5329",
      createdAt: "2026-09-21 17:52:27.857527+00",
      customer: { name: "Client", phone: null, email: null, siteLocation: null },
      totalEstimatedAmount: 2054.21,
      snapshotObjectKey: null,
      rows: [
        {
          item_name: "Screen Door (Aluminum Framing)",
          item_group_name: "Aluminum Framing",
          quantity: 8.76,
          unit: "m",
          unit_price: 86.5,
          estimated_subtotal: 757.75,
          pricing_details: {
            product_name: "Screen Door",
            item_id: "item-1",
            item_quantity: 1,
            item_total_price: 2054.21,
            width_mm: 390,
            height_mm: 1200,
          },
        },
      ],
    });
    assert.ok(reconstructed !== null);
    assert.equal(reconstructed.createdAt, "2026-09-21T17:52:27.857Z");
    assert.equal(reconstructed.quotationNumber, "Q-2026-5329");
  });

  it("safely returns null when legacy rows cannot be reconstructed", () => {
    const invalid = reconstructLegacyQuotationDocument({
      quotationNumber: "Q-2026-0000",
      referenceCode: "CF-2026-0000",
      createdAt: "invalid-date",
      customer: { name: "Client", phone: null, email: null, siteLocation: null },
      totalEstimatedAmount: 100,
      snapshotObjectKey: null,
      rows: [],
    });
    assert.equal(invalid, null);
  });
});

