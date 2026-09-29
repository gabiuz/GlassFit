import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { BookingRequestWithRelationsRow } from "../../src/lib/booking/types.js";
import { mapAdminBookingRow } from "../../src/features/admin/bookings/adminBookingMapper.js";
import {
  deriveQuotationPricingFromItems,
  createQuotationDocumentViewModel,
  type QuotationDocumentSnapshotV1,
  type QuotationItemPriceOverridesV1,
} from "../../src/lib/pricing/quotationDocument.js";
import { generateQuotationPdfHtml } from "../../src/lib/pricing/quotationPdfGenerator.js";

describe("QAD-TC42: Administrative Labor Fee Decoupling and Quotation Grand Total Integrity (IMP-MS26)", () => {
  const sampleSnapshot: QuotationDocumentSnapshotV1 = {
    schemaVersion: 1,
    quotationNumber: "Q-2026-0929-TEST",
    referenceCode: "CF-2026-0929-TEST",
    shareablePath: "/q/CF-2026-0929-TEST",
    createdAt: "2026-09-29T08:00:00.000Z",
    customer: {
      name: "Juan Dela Cruz",
      phone: "09171234567",
      email: "juan@example.com",
      siteLocation: "Manila",
    },
    projectName: "Series 798 Sliding Window",
    snapshotObjectKey: null,
    hasSill: true,
    structuralWaiver: false,
    items: [
      {
        itemId: "fixture-1",
        productId: "11111111-1111-4111-8111-111111111111",
        productName: "Series 798 Sliding Window",
        productType: "Sliding Window",
        variantName: "2-Panel Standard",
        specificationSummary: "Analok | 120cm × 120cm",
        dimensionsFormatted: "120cm × 120cm",
        widthMm: 1200,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
        structuralWaiver: false,
        finishLabel: "Analok",
        glassLabel: "6mm Clear Glass",
        quantity: 1,
        unitPrice: 2844.58,
        calculatedSubtotal: 2844.58,
        imageSource: null,
        groups: [
          {
            groupName: "Aluminum Framing",
            description: "Extrusions",
            quantity: 4.8,
            unit: "m",
            unitPrice: 400.0,
            subtotal: 1920.0,
          },
          {
            groupName: "Glass Infill",
            description: "Glass Sheets",
            quantity: 1.44,
            unit: "sqm",
            unitPrice: 601.14,
            subtotal: 865.64,
          },
          {
            groupName: "Labor & Installation",
            description: "Shop fabrication labor",
            quantity: 1,
            unit: "lot",
            unitPrice: 58.94,
            subtotal: 58.94,
          },
        ],
      },
    ],
    pricing: {
      directMaterialsSubtotal: 2785.64,
      laborSubtotal: 58.94,
      contractorMargin: 0,
      calculatedFinalPrice: 2844.58,
    },
  };

  describe("QAD-TC42.2: Product Price Negotiation + Labor Addition Arithmetic Decoupling", () => {
    it("derives exact 3,400.00 grand total when product is negotiated to 2,800.00 and labor is 600.00", () => {
      const overrides: QuotationItemPriceOverridesV1 = {
        schemaVersion: 1,
        entries: [
          {
            itemId: "fixture-1",
            negotiatedSubtotal: 2800.0,
            negotiatedBy: "22222222-2222-4222-8222-222222222222",
            negotiatedAt: "2026-09-29T08:15:00.000Z",
          },
        ],
      };

      const pricing = deriveQuotationPricingFromItems(sampleSnapshot, overrides, 600.0);

      assert.strictEqual(pricing.calculatedFinalPrice, 2844.58);
      assert.strictEqual(pricing.effectiveProductSubtotal, 2800.0);
      assert.strictEqual(pricing.adminLaborCharge, 600.0);
      assert.strictEqual(pricing.negotiatedFinalPrice, 3400.0);
      assert.strictEqual(pricing.effectiveFinalPrice, 3400.0);
      assert.strictEqual(pricing.isPriceModified, true);
    });
  });

  describe("QAD-TC42.3: Labor Addition + Subsequent Product Modification Commutativity", () => {
    it("preserves labor fee and correctly updates grand total when product price is edited subsequently", () => {
      // Step 1: Initial labor entry with no item overrides
      const step1Pricing = deriveQuotationPricingFromItems(sampleSnapshot, null, 600.0);
      assert.strictEqual(step1Pricing.effectiveProductSubtotal, 2844.58);
      assert.strictEqual(step1Pricing.adminLaborCharge, 600.0);
      assert.strictEqual(step1Pricing.effectiveFinalPrice, 3444.58);

      // Step 2: Administrator updates fixture negotiated price to 2,800.00 while preserving 600.00 labor
      const overrides: QuotationItemPriceOverridesV1 = {
        schemaVersion: 1,
        entries: [
          {
            itemId: "fixture-1",
            negotiatedSubtotal: 2800.0,
            negotiatedBy: "22222222-2222-4222-8222-222222222222",
            negotiatedAt: "2026-09-29T08:20:00.000Z",
          },
        ],
      };

      const step2Pricing = deriveQuotationPricingFromItems(sampleSnapshot, overrides, 600.0);
      assert.strictEqual(step2Pricing.effectiveProductSubtotal, 2800.0);
      assert.strictEqual(step2Pricing.adminLaborCharge, 600.0);
      assert.strictEqual(step2Pricing.effectiveFinalPrice, 3400.0);
      assert.strictEqual(step2Pricing.negotiatedFinalPrice, 3400.0);
    });
  });

  describe("QAD-TC42.4: PDF Generation Numerical Integrity & No Direct Material Distortion", () => {
    it("renders effective product subtotal 2,800.00, labor 600.00, and grand total 3,400.00 with no BOM artifacts", () => {
      const overrides: QuotationItemPriceOverridesV1 = {
        schemaVersion: 1,
        entries: [
          {
            itemId: "fixture-1",
            negotiatedSubtotal: 2800.0,
            negotiatedBy: "22222222-2222-4222-8222-222222222222",
            negotiatedAt: "2026-09-29T08:15:00.000Z",
          },
        ],
      };

      const viewModel = createQuotationDocumentViewModel(sampleSnapshot, {
        brandLogoUrl: "http://localhost:3000/Logo.svg",
        shareableUrl: "http://localhost:3000/q/CF-2026-0929-TEST",
        snapshotImageUrl: null,
        allowedImageOrigins: ["http://localhost:3000"],
        negotiatedAmount: 3400.0,
        adminLaborCharge: 600.0,
        itemPriceOverrides: overrides,
      });

      assert.strictEqual(viewModel.effectiveProductSubtotal, 2800.0);
      assert.strictEqual(viewModel.adminLaborCharge, 600.0);
      assert.strictEqual(viewModel.effectiveFinalPrice, 3400.0);

      const html = generateQuotationPdfHtml(viewModel);

      // Verify the PDF table contains the exact decoupled values
      assert.match(
        html,
        /<td>Raw product fabrication subtotal<\/td>\s*<td>\s*₱\s*2,800\.00<\/td>/
      );
      assert.match(
        html,
        /<td>Professional Installation &amp; Site Labor \(Admin Confirmed\)<\/td>\s*<td>\s*₱\s*600\.00<\/td>/
      );
      assert.match(
        html,
        /<tr class="grand-total-row"><td>Grand total<\/td>\s*<td>\s*₱\s*3,400\.00<\/td><\/tr>/
      );

      // Verify distorted artifacts (2,785.64 direct materials or 658.94 synthetic labor) are NEVER rendered
      assert.doesNotMatch(html, /₱\s*2,785\.64/);
      assert.doesNotMatch(html, /₱\s*658\.94/);
      assert.doesNotMatch(html, /₱\s*3,444\.58/);
    });
  });

  describe("QAD-TC42.5: Zero / Null Labor Reset", () => {
    it("resets labor charge to unconfirmed notice and keeps product fabrication subtotal as grand total", () => {
      const overrides: QuotationItemPriceOverridesV1 = {
        schemaVersion: 1,
        entries: [
          {
            itemId: "fixture-1",
            negotiatedSubtotal: 2800.0,
            negotiatedBy: "22222222-2222-4222-8222-222222222222",
            negotiatedAt: "2026-09-29T08:15:00.000Z",
          },
        ],
      };

      const pricingNullLabor = deriveQuotationPricingFromItems(sampleSnapshot, overrides, null);
      assert.strictEqual(pricingNullLabor.effectiveProductSubtotal, 2800.0);
      assert.strictEqual(pricingNullLabor.adminLaborCharge, null);
      assert.strictEqual(pricingNullLabor.effectiveFinalPrice, 2800.0);

      const viewModel = createQuotationDocumentViewModel(sampleSnapshot, {
        brandLogoUrl: "http://localhost:3000/Logo.svg",
        shareableUrl: "http://localhost:3000/q/CF-2026-0929-TEST",
        snapshotImageUrl: null,
        allowedImageOrigins: ["http://localhost:3000"],
        negotiatedAmount: 2800.0,
        adminLaborCharge: null,
        itemPriceOverrides: overrides,
      });

      const html = generateQuotationPdfHtml(viewModel);

      assert.match(
        html,
        /<td>Installation &amp; Site Labor<\/td><td style="font-style:italic;color:#64748b;">To be assessed upon consultation<\/td>/
      );
      assert.match(
        html,
        /<tr class="grand-total-row"><td>Grand total<\/td>\s*<td>\s*₱\s*2,800\.00<\/td><\/tr>/
      );
    });
  });

  describe("QAD-TC42.6: Admin Booking Row Mapper with Decoupled Labor Charge", () => {
    it("maps database row with admin_labor_charge and item overrides correctly into AdminBookingItem quotation", () => {
      const dbRow: BookingRequestWithRelationsRow = {
        booking_request_id: "33333333-3333-4333-8333-333333333333",
        status: "Pending",
        created_at: "2026-09-29T08:00:00.000Z",
        selected_platform: "Messenger",
        customer: {
          full_name: "Juan Dela Cruz",
          email: "juan@example.com",
          contact_number: "09171234567",
        },
        booking_link: {
          quotation: {
            quotation_id: "44444444-4444-4444-8444-444444444444",
            quotation_number: "Q-2026-0929-TEST",
            pdf_r2_object_key: "quotations/Q-2026-0929-TEST.pdf",
            created_at: "2026-09-29T08:00:00.000Z",
            updated_at: "2026-09-29T08:25:00.000Z",
            total_estimated_amount: 2844.58,
            negotiated_amount: 3400.0,
            negotiated_by: "22222222-2222-4222-8222-222222222222",
            negotiated_at: "2026-09-29T08:25:00.000Z",
            admin_labor_charge: 600.0,
            item_price_overrides: {
              schemaVersion: 1,
              entries: [
                {
                  itemId: "fixture-1",
                  negotiatedSubtotal: 2800.0,
                  negotiatedBy: "22222222-2222-4222-8222-222222222222",
                  negotiatedAt: "2026-09-29T08:15:00.000Z",
                },
              ],
            },
            quotation_document_snapshot: sampleSnapshot,
            quotation_items: [],
          },
        },
      };

      const mapped = mapAdminBookingRow(dbRow);

      assert.strictEqual(mapped.quotation.calculatedFinalPrice, 2844.58);
      assert.strictEqual(mapped.quotation.effectiveProductSubtotal, 2800.0);
      assert.strictEqual(mapped.quotation.adminLaborCharge, 600.0);
      assert.strictEqual(mapped.quotation.effectiveFinalPrice, 3400.0);
      assert.strictEqual(mapped.quotation.negotiatedFinalPrice, 3400.0);
      assert.strictEqual(mapped.quotation.isPriceModified, true);
    });
  });
});
