import { describe, it } from "node:test";
import assert from "node:assert";
import {
  BookingPlatformSchema,
  BookingRequestStatusSchema,
  SignedLinkStatusSchema,
  GenerateBookingLinkInputSchema,
  GeneratedBookingLinkResultSchema,
  RecordBookingRequestInputSchema,
  PublicQuotationSummarySchema,
  UpdateBookingStatusInputSchema,
  type GenerateBookingLinkInput,
} from "../../src/lib/booking/types.js";

describe("Booking Domain: Consultation Schemas & Booking Validation", () => {
  // --------------------------------------------------------------------------
  // 1. Platform & Status Enums
  // --------------------------------------------------------------------------
  describe("Booking Platform & Status Enums", () => {
    it("should accept valid platforms: Messenger and Viber", () => {
      assert.strictEqual(BookingPlatformSchema.safeParse("Messenger").success, true);
      assert.strictEqual(BookingPlatformSchema.safeParse("Viber").success, true);
      assert.strictEqual(BookingPlatformSchema.safeParse("WhatsApp").success, false);
      assert.strictEqual(BookingPlatformSchema.safeParse("SMS").success, false);
    });

    it("should accept valid booking request lifecycle statuses", () => {
      const validStatuses = ["Pending", "Ongoing", "Done", "Cancelled"];
      for (const status of validStatuses) {
        assert.strictEqual(BookingRequestStatusSchema.safeParse(status).success, true);
      }
      assert.strictEqual(BookingRequestStatusSchema.safeParse("Rejected").success, false);
      assert.strictEqual(BookingRequestStatusSchema.safeParse("Draft").success, false);
    });

    it("should accept valid signed link lifecycle statuses", () => {
      const validStatuses = ["Active", "Expired", "Revoked", "Used"];
      for (const status of validStatuses) {
        assert.strictEqual(SignedLinkStatusSchema.safeParse(status).success, true);
      }
      assert.strictEqual(SignedLinkStatusSchema.safeParse("Pending").success, false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. GenerateBookingLinkInputSchema Validation
  // --------------------------------------------------------------------------
  describe("GenerateBookingLinkInputSchema", () => {
    it("should validate a standard booking link generation input", () => {
      const input: GenerateBookingLinkInput = {
        productName: "Series 798 Sliding Window",
        productType: "Sliding Window",
        widthMm: 1800,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
        structuralWaiver: false,
      };

      const result = GenerateBookingLinkInputSchema.safeParse(input);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.widthMm, 1800);
        assert.strictEqual(result.data.heightMm, 1200);
        assert.strictEqual(result.data.panelCount, 2);
        assert.strictEqual(result.data.hasSill, true);
      }
    });

    it("should apply correct defaults for optional fields", () => {
      const minimalInput = {
        widthMm: 1200,
        heightMm: 1200,
      };

      const result = GenerateBookingLinkInputSchema.safeParse(minimalInput);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.panelCount, 2);
        assert.strictEqual(result.data.hasSill, true);
        assert.strictEqual(result.data.finishType, "Analok");
        assert.strictEqual(result.data.glassType, "6mm_bronze");
        assert.strictEqual(result.data.structuralWaiver, false);
        assert.strictEqual(result.data.productName, "Series 798 Sliding Window");
      }
    });

    it("should reject non-positive dimensional inputs", () => {
      const zeroWidth = { widthMm: 0, heightMm: 1200 };
      const negativeHeight = { widthMm: 1200, heightMm: -100 };

      assert.strictEqual(GenerateBookingLinkInputSchema.safeParse(zeroWidth).success, false);
      assert.strictEqual(GenerateBookingLinkInputSchema.safeParse(negativeHeight).success, false);
    });

    it("should reject non-positive or non-integer panel counts", () => {
      const zeroPanels = { widthMm: 1200, heightMm: 1200, panelCount: 0 };
      const fractionalPanels = { widthMm: 1200, heightMm: 1200, panelCount: 2.5 };

      assert.strictEqual(GenerateBookingLinkInputSchema.safeParse(zeroPanels).success, false);
      assert.strictEqual(GenerateBookingLinkInputSchema.safeParse(fractionalPanels).success, false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. GeneratedBookingLinkResultSchema (SHA-256 Token Validation)
  // --------------------------------------------------------------------------
  describe("GeneratedBookingLinkResultSchema", () => {
    it("should validate a completed signed booking link result", () => {
      const validResult = {
        linkId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        quotationId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
        quotationNumber: "Q-2026-1001",
        referenceCode: "CF-2026-1001",
        tokenHash: "a".repeat(64), // Valid 64-char hex SHA-256 hash
        signedUrl: "http://localhost:3000/q/CF-2026-1001?token=sample",
        displayLink: "glassfit.ph/q/CF-2026-1001",
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        totalEstimatedAmount: 5670.74,
        hasStructuralWaiver: false,
      };

      const parsed = GeneratedBookingLinkResultSchema.safeParse(validResult);
      assert.strictEqual(parsed.success, true);
    });

    it("should reject invalid token hashes (non-64 hex)", () => {
      const invalidToken = {
        linkId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        quotationId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
        quotationNumber: "Q-2026-1001",
        referenceCode: "CF-2026-1001",
        tokenHash: "short-token", // Invalid
        signedUrl: "http://localhost:3000/q/CF-2026-1001",
        displayLink: "glassfit.ph/q/CF-2026-1001",
        expiresAt: new Date().toISOString(),
        totalEstimatedAmount: 5670.74,
        hasStructuralWaiver: false,
      };

      const parsed = GeneratedBookingLinkResultSchema.safeParse(invalidToken);
      assert.strictEqual(parsed.success, false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Public Reference View Schema (/q/[code])
  // --------------------------------------------------------------------------
  describe("PublicQuotationSummarySchema", () => {
    it("should validate public summary with 4-item groups", () => {
      const summary = {
        referenceCode: "CF-2026-1001",
        quotationNumber: "Q-2026-1001",
        customerName: "Juan Dela Cruz",
        productName: "Series 798 Sliding Window",
        productType: "Sliding Window",
        widthMm: 1800,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
        structuralWaiver: false,
        totalEstimatedAmount: 5670.74,
        createdAtFormatted: "March 9, 2026",
        expiresAtFormatted: "March 16, 2026",
        snapshotImageUrl: "https://r2.glassfit.ph/snapshots/sample.webp",
        status: "Active" as const,
        groups: [
          {
            item_group_name: "Aluminum Framing",
            quantity: 1,
            unit_label: "lot",
            unit_price: 1300.99,
            estimated_subtotal: 1300.99,
          },
          {
            item_group_name: "Glass Infill",
            quantity: 1,
            unit_label: "lot",
            unit_price: 1853.28,
            estimated_subtotal: 1853.28,
          },
        ],
      };

      const parsed = PublicQuotationSummarySchema.safeParse(summary);
      assert.strictEqual(parsed.success, true);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Admin Status Update Schema
  // --------------------------------------------------------------------------
  describe("UpdateBookingStatusInputSchema", () => {
    it("should accept valid admin status mutations", () => {
      const input = {
        bookingRequestId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        status: "Ongoing" as const,
      };

      const parsed = UpdateBookingStatusInputSchema.safeParse(input);
      assert.strictEqual(parsed.success, true);
    });

    it("should reject invalid UUIDs or unknown statuses", () => {
      assert.strictEqual(
        UpdateBookingStatusInputSchema.safeParse({
          bookingRequestId: "not-a-uuid",
          status: "Ongoing",
        }).success,
        false
      );

      assert.strictEqual(
        UpdateBookingStatusInputSchema.safeParse({
          bookingRequestId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
          status: "Archived",
        }).success,
        false
      );
    });
  });
});
