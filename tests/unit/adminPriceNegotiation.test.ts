import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  UpdateNegotiatedPriceInputSchema,
  UpdateItemNegotiatedPriceInputSchema,
  areTimestampsEquivalent,
  type BookingRequestWithRelationsRow,
} from "../../src/lib/booking/types.js";
import { mapAdminBookingRow } from "../../src/features/admin/bookings/adminBookingMapper.js";
import {
  QuotationDocumentSnapshotV1Schema,
  QuotationItemPriceOverridesV1Schema,
  deriveQuotationPricingFromItems,
} from "../../src/lib/pricing/quotationDocument.js";

describe("QAD-TC41: Single-Product Quotation Price Negotiation Parity & ISO Datetime Normalization (IMP-MS25)", () => {
  const validUuid = "11111111-1111-4111-8111-111111111111";

  describe("QAD-TC41.1: ISO Datetime Offset Tolerance in Zod Input Schemas", () => {
    it("accepts ISO datetime strings with timezone offsets and UTC Z in UpdateNegotiatedPriceInputSchema", () => {
      const timestamps = [
        "2026-09-28T15:19:50.247571+00:00",
        "2026-09-28T15:19:50.247Z",
        "2026-09-28T15:19:50+08:00",
        "2026-09-28T15:19:50-05:00",
      ];

      for (const ts of timestamps) {
        const payload = {
          quotationId: validUuid,
          negotiatedAmount: 4500.0,
          expectedUpdatedAt: ts,
        };
        const result = UpdateNegotiatedPriceInputSchema.safeParse(payload);
        assert.strictEqual(result.success, true, `Expected valid for timestamp: ${ts}`);
      }
    });

    it("accepts ISO datetime strings with timezone offsets and UTC Z in UpdateItemNegotiatedPriceInputSchema", () => {
      const timestamps = [
        "2026-09-28T15:19:50.247571+00:00",
        "2026-09-28T15:19:50.247Z",
        "2026-09-28T15:19:50+08:00",
      ];

      for (const ts of timestamps) {
        const payload = {
          quotationId: validUuid,
          itemId: "item-1",
          negotiatedSubtotal: 3200.5,
          expectedUpdatedAt: ts,
        };
        const result = UpdateItemNegotiatedPriceInputSchema.safeParse(payload);
        assert.strictEqual(result.success, true, `Expected valid for timestamp: ${ts}`);
      }
    });

    it("rejects invalid non-ISO datetime strings", () => {
      const invalidTimestamps = [
        "not-a-datetime",
        "2026/09/28",
        "yesterday",
        "123456789",
      ];

      for (const ts of invalidTimestamps) {
        const payload = {
          quotationId: validUuid,
          negotiatedAmount: 4500.0,
          expectedUpdatedAt: ts,
        };
        const result = UpdateNegotiatedPriceInputSchema.safeParse(payload);
        assert.strictEqual(result.success, false, `Expected failure for invalid timestamp: ${ts}`);
      }
    });
  });

  describe("QAD-TC41.4: Optimistic Concurrency Timestamp Equivalence", () => {
    it("recognizes equivalent moments serialized with different offset / precision representations", () => {
      assert.strictEqual(
        areTimestampsEquivalent(
          "2026-09-28T15:19:50.247Z",
          "2026-09-28T15:19:50.247+00:00"
        ),
        true
      );
      assert.strictEqual(
        areTimestampsEquivalent(
          "2026-09-28T15:19:50.000Z",
          "2026-09-28T23:19:50.000+08:00"
        ),
        true
      );
    });

    it("rejects genuinely differing timestamps", () => {
      assert.strictEqual(
        areTimestampsEquivalent(
          "2026-09-28T15:19:50.247Z",
          "2026-09-28T15:19:51.247Z"
        ),
        false
      );
      assert.strictEqual(
        areTimestampsEquivalent(
          "2026-09-28T15:19:50.247Z",
          "2026-09-29T15:19:50.247Z"
        ),
        false
      );
    });

    it("handles identical strings immediately without date parsing overhead", () => {
      const ts = "2026-09-28T15:19:50.247571+00:00";
      assert.strictEqual(areTimestampsEquivalent(ts, ts), true);
    });
  });

  describe("QAD-TC41.2 & QAD-TC41.3: Single-Product Quotation Mapping & Negotiation Parity", () => {
    const singleProductSnapshot = QuotationDocumentSnapshotV1Schema.parse({
      schemaVersion: 1,
      quotationNumber: "Q-2026-001",
      referenceCode: "CF-2026-001",
      shareablePath: "/q/CF-2026-001",
      createdAt: "2026-09-28T10:00:00.000Z",
      customer: {
        name: "Maria Santos",
        phone: "09171234567",
        email: "maria@example.com",
        siteLocation: "Quezon City",
      },
      projectName: "Series 798 Sliding Window",
      snapshotObjectKey: null,
      hasSill: true,
      structuralWaiver: false,
      items: [
        {
          itemId: "single-item-1",
          productId: "prod-window-1",
          productName: "Series 798 Sliding Window",
          productType: "Sliding Window",
          variantName: "2-Panel Standard",
          specificationSummary: "Analok | 6mm Bronze",
          dimensionsFormatted: "120cm × 120cm",
          widthMm: 1200,
          heightMm: 1200,
          panelCount: 2,
          hasSill: true,
          structuralWaiver: false,
          finishLabel: "Analok",
          glassLabel: "6mm Bronze",
          quantity: 1,
          unitPrice: 5400.0,
          calculatedSubtotal: 5400.0,
          imageSource: null,
          groups: [
            {
              groupName: "Aluminum Framing",
              description: "Outer Frame & Sash",
              quantity: 1,
              unit: "lot",
              unitPrice: 3400.0,
              subtotal: 3400.0,
            },
            {
              groupName: "Glass Infill",
              description: "6mm Bronze Float Glass",
              quantity: 1,
              unit: "lot",
              unitPrice: 2000.0,
              subtotal: 2000.0,
            },
          ],
        },
      ],
      pricing: {
        directMaterialsSubtotal: 3800.0,
        laborSubtotal: 800.0,
        contractorMargin: 800.0,
        calculatedFinalPrice: 5400.0,
      },
    });

    it("evaluates supportsItemNegotiation as true and populates itemPricing for single-product snapshot", () => {
      const row: BookingRequestWithRelationsRow = {
        booking_request_id: "booking-sp-1",
        status: "Pending",
        created_at: "2026-09-28T10:05:00.000Z",
        selected_platform: "Messenger",
        customer: {
          full_name: "Maria Santos",
          email: "maria@example.com",
          contact_number: "09171234567",
        },
        booking_link: {
          quotation: {
            quotation_id: "q-sp-1",
            quotation_number: "Q-2026-001",
            pdf_r2_object_key: "quotations/Q-2026-001/doc.pdf",
            created_at: "2026-09-28T10:00:00.000Z",
            updated_at: "2026-09-28T10:00:00.000+00:00",
            total_estimated_amount: 5400.0,
            negotiated_amount: null,
            negotiated_by: null,
            negotiated_at: null,
            quotation_document_snapshot: singleProductSnapshot,
            item_price_overrides: null,
            quotation_items: [],
          },
        },
      };

      const mapped = mapAdminBookingRow(row);
      assert.strictEqual(mapped.quotation.supportsItemNegotiation, true);
      assert.strictEqual(mapped.quotation.quotationSource, "canonical-v1");
      assert.ok(Array.isArray(mapped.quotation.itemPricing));
      assert.strictEqual(mapped.quotation.itemPricing.length, 1);
      assert.strictEqual(mapped.quotation.itemPricing[0].itemId, "single-item-1");
      assert.strictEqual(mapped.quotation.itemPricing[0].productName, "Series 798 Sliding Window");
      assert.strictEqual(mapped.quotation.itemPricing[0].calculatedSubtotal, 5400.0);
      assert.strictEqual(mapped.quotation.itemPricing[0].effectiveSubtotal, 5400.0);
      assert.strictEqual(mapped.quotation.itemPricing[0].isPriceModified, false);
    });

    it("applies item price overrides accurately to single-product quotation", () => {
      const overrides = QuotationItemPriceOverridesV1Schema.parse({
        schemaVersion: 1,
        entries: [
          {
            itemId: "single-item-1",
            negotiatedSubtotal: 5000.0,
            negotiatedBy: validUuid,
            negotiatedAt: "2026-09-28T10:30:00.000Z",
          },
        ],
      });

      const pricing = deriveQuotationPricingFromItems(singleProductSnapshot, overrides);
      assert.strictEqual(pricing.calculatedFinalPrice, 5400.0);
      assert.strictEqual(pricing.negotiatedFinalPrice, 5000.0);
      assert.strictEqual(pricing.effectiveFinalPrice, 5000.0);
      assert.strictEqual(pricing.isPriceModified, true);
      assert.strictEqual(pricing.itemPricing[0].isPriceModified, true);
      assert.strictEqual(pricing.itemPricing[0].effectiveSubtotal, 5000.0);
    });

    it("enables supportsItemNegotiation for reconstructable single-fixture legacy quotation", () => {
      const legacyRow: BookingRequestWithRelationsRow = {
        booking_request_id: "booking-legacy-sp",
        status: "Ongoing",
        created_at: "2026-09-28T10:00:00+00:00",
        selected_platform: "Viber",
        customer: {
          full_name: "Juan Dela Cruz",
          email: "juan@example.com",
          contact_number: "09181234567",
        },
        booking_link: {
          quotation: {
            quotation_id: "q-legacy-sp",
            quotation_number: "Q-2026-002",
            pdf_r2_object_key: "quotations/Q-2026-002/doc.pdf",
            created_at: "2026-09-28T10:00:00+00:00",
            updated_at: "2026-09-28T10:00:00+00:00",
            total_estimated_amount: 3200.0,
            negotiated_amount: null,
            negotiated_by: null,
            negotiated_at: null,
            quotation_document_snapshot: null,
            item_price_overrides: null,
            quotation_items: [
              {
                item_name: "Framing",
                item_group_name: "Aluminum Framing",
                quantity: 4.5,
                unit: "m",
                unit_price: 400.0,
                estimated_subtotal: 1800.0,
                pricing_details: {
                  item_id: "legacy-item-1",
                  product_name: "Awning Window",
                  item_quantity: 1,
                  item_total_price: 3200.0,
                  width_mm: 800,
                  height_mm: 600,
                },
              },
              {
                item_name: "Glass",
                item_group_name: "Glass Infill",
                quantity: 1,
                unit: "lot",
                unit_price: 1400.0,
                estimated_subtotal: 1400.0,
                pricing_details: {
                  item_id: "legacy-item-1",
                  product_name: "Awning Window",
                  item_quantity: 1,
                  item_total_price: 3200.0,
                  width_mm: 800,
                  height_mm: 600,
                },
              },
            ],
          },
        },
      };

      const mapped = mapAdminBookingRow(legacyRow);
      assert.strictEqual(mapped.quotation.supportsItemNegotiation, true);
      assert.strictEqual(mapped.quotation.quotationSource, "legacy-reconstructed");
      assert.ok(Array.isArray(mapped.quotation.itemPricing));
      assert.strictEqual(mapped.quotation.itemPricing.length, 1);
      assert.strictEqual(mapped.quotation.itemPricing[0].productName, "Awning Window");
      assert.strictEqual(mapped.quotation.itemPricing[0].calculatedSubtotal, 3200.0);
    });
  });

  describe("QAD-TC41.5: Multi-Product Quotation Regression Check", () => {
    it("preserves multi-product per-item negotiation behavior", () => {
      const multiSnapshot = QuotationDocumentSnapshotV1Schema.parse({
        schemaVersion: 1,
        quotationNumber: "Q-2026-MULTI",
        referenceCode: "CF-2026-MULTI",
        shareablePath: "/q/CF-2026-MULTI",
        createdAt: "2026-09-28T10:00:00.000Z",
        customer: {
          name: "Architect Santos",
          phone: null,
          email: null,
          siteLocation: null,
        },
        projectName: "Multi-Fixture Fenestration",
        snapshotObjectKey: null,
        hasSill: true,
        structuralWaiver: false,
        items: [
          {
            itemId: "multi-item-1",
            productId: "prod-1",
            productName: "Sliding Window",
            productType: "Window",
            variantName: "Standard",
            specificationSummary: "Analok",
            dimensionsFormatted: "120cm × 120cm",
            widthMm: 1200,
            heightMm: 1200,
            panelCount: 2,
            hasSill: true,
            structuralWaiver: false,
            finishLabel: "Analok",
            glassLabel: "Clear",
            quantity: 1,
            unitPrice: 4000.0,
            calculatedSubtotal: 4000.0,
            imageSource: null,
            groups: [
              {
                groupName: "Frame",
                description: "Profiles",
                quantity: 1,
                unit: "lot",
                unitPrice: 4000.0,
                subtotal: 4000.0,
              },
            ],
          },
          {
            itemId: "multi-item-2",
            productId: "prod-2",
            productName: "Sliding Door",
            productType: "Door",
            variantName: "Standard",
            specificationSummary: "Powder Coated",
            dimensionsFormatted: "180cm × 210cm",
            widthMm: 1800,
            heightMm: 2100,
            panelCount: 2,
            hasSill: true,
            structuralWaiver: false,
            finishLabel: "Powder Coated",
            glassLabel: "Clear",
            quantity: 1,
            unitPrice: 8000.0,
            calculatedSubtotal: 8000.0,
            imageSource: null,
            groups: [
              {
                groupName: "Frame",
                description: "Profiles",
                quantity: 1,
                unit: "lot",
                unitPrice: 8000.0,
                subtotal: 8000.0,
              },
            ],
          },
        ],
        pricing: {
          directMaterialsSubtotal: 8000.0,
          laborSubtotal: 2000.0,
          contractorMargin: 2000.0,
          calculatedFinalPrice: 12000.0,
        },
      });

      const overrides = QuotationItemPriceOverridesV1Schema.parse({
        schemaVersion: 1,
        entries: [
          {
            itemId: "multi-item-1",
            negotiatedSubtotal: 3800.0,
            negotiatedBy: validUuid,
            negotiatedAt: "2026-09-28T11:00:00.000Z",
          },
        ],
      });

      const pricing = deriveQuotationPricingFromItems(multiSnapshot, overrides);
      assert.strictEqual(pricing.calculatedFinalPrice, 12000.0);
      assert.strictEqual(pricing.effectiveFinalPrice, 11800.0);
      assert.strictEqual(pricing.isPriceModified, true);
      assert.strictEqual(pricing.itemPricing[0].effectiveSubtotal, 3800.0);
      assert.strictEqual(pricing.itemPricing[0].isPriceModified, true);
      assert.strictEqual(pricing.itemPricing[1].effectiveSubtotal, 8000.0);
      assert.strictEqual(pricing.itemPricing[1].isPriceModified, false);
    });
  });
});
