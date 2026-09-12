import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculateStandardSeries798,
} from "../../src/lib/pricing/pricingEngine.js";
import {
  generateQuotationPdfHtml,
  createQuotationPdfDocument,
  formatBookingShareMessage,
} from "../../src/lib/pricing/quotationPdfGenerator.js";

describe("Milestone 7: Quotation Summary & Consultation PDF Handoff", () => {
  // --------------------------------------------------------------------------
  // 1. Grouped 4-Item BOM Breakdown Generation
  // --------------------------------------------------------------------------
  describe("Grouped 4-Item BOM Presentation", () => {
    it("should compute and present the 4 standard BOM groups with exact subtotals", () => {
      const bomResult = calculateStandardSeries798({
        widthMm: 1200,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
      });

      assert.strictEqual(bomResult.finalQuotation, 4362.93);
      assert.strictEqual(bomResult.effectiveFramingCost, 1069.82);
      assert.strictEqual(bomResult.effectiveGlazingCost, 1235.52);
      assert.strictEqual(bomResult.hardwareSubtotal + bomResult.consumablesSubtotal, 435.00);
      assert.strictEqual(bomResult.fabricationLaborCost, 750.00);
      assert.strictEqual(bomResult.contractorMargin, 872.59);

      // Verify groups are present in bomSummary
      assert.strictEqual(bomResult.bomSummary.groups.length, 4);
      const groupNames = bomResult.bomSummary.groups.map(g => g.item_group_name);
      assert.deepStrictEqual(groupNames, [
        "Aluminum Framing",
        "Glass Infill",
        "Hardware & Accessories",
        "Labor & Installation",
      ]);
    });

    it("should correctly handle sill omission deduction in BOM presentation", () => {
      const withSill = calculateStandardSeries798({
        widthMm: 1800,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
      });

      const withoutSill = calculateStandardSeries798({
        widthMm: 1800,
        heightMm: 1200,
        panelCount: 2,
        hasSill: false,
      });

      assert.strictEqual(withSill.finalQuotation, 5670.74);
      assert.strictEqual(withoutSill.finalQuotation, 5285.18);
      
      const netSillDeduction = Math.round((withSill.finalQuotation - withoutSill.finalQuotation) * 100) / 100;
      assert.strictEqual(netSillDeduction, 385.56);
      assert.strictEqual(withoutSill.hasSill, false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Server-Side Consultation PDF Generator & Legal Compliance
  // --------------------------------------------------------------------------
  describe("Server-Side Consultation PDF Generator", () => {
    it("should render compliant HTML containing RA 7394 notice, customer info, and 4-part cost summary", () => {
      const bomResult = calculateStandardSeries798({
        widthMm: 1800,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
      });

      const metadata = {
        quotationNumber: "Q-2026-0482",
        referenceCode: "CF-2026-001",
        customerName: "Juan Dela Cruz",
        customerPhone: "+63 (917) 123-4567",
        customerEmail: "juan@example.com",
        siteLocation: "Quezon City, Metro Manila",
        createdAtFormatted: "May 21, 2026 · 3:42 PM",
        validUntilFormatted: "June 4, 2026",
        hasSill: true,
        structuralWaiver: false,
        bomResult,
      };

      const html = generateQuotationPdfHtml(metadata);

      // Check header & metadata
      assert.ok(html.includes("GlassFit Quotation Q-2026-0482"));
      assert.ok(html.includes("Juan Dela Cruz"));
      assert.ok(html.includes("CF-2026-001"));
      assert.ok(html.includes("W: 1800 mm × H: 1200 mm"));

      // Check 4 BOM items in HTML
      assert.ok(html.includes("1. Aluminum Framing Members"));
      assert.ok(html.includes("2. Glazing Infill Inset"));
      assert.ok(html.includes("3. Hardware, Fasteners &amp; Weatherseals") || html.includes("3. Hardware, Fasteners & Weatherseals"));
      assert.ok(html.includes("4. Workshop Fabrication &amp; Direct Labor") || html.includes("4. Workshop Fabrication & Direct Labor"));

      // Check statutory Consumer Act of the Philippines RA 7394 disclaimer
      assert.ok(html.includes("Consumer Act of the Philippines RA 7394"));
      assert.ok(html.includes("on-site ocular verification"));

      // Check waiver is NOT rendered when structuralWaiver is false
      assert.ok(!html.includes("NSCP 2015 Structural Span Waiver Attached"));

      // Verify PDF document object creation
      const pdfDoc = createQuotationPdfDocument(metadata);
      assert.strictEqual(pdfDoc.quotationNumber, "Q-2026-0482");
      assert.strictEqual(pdfDoc.fileName, "GlassFit_Quotation_Q-2026-0482.pdf");
      assert.strictEqual(pdfDoc.r2ObjectKey, "quotations/Q-2026-0482/GlassFit_Quotation_Q-2026-0482.pdf");
      assert.strictEqual(pdfDoc.hasStructuralWaiver, false);
      assert.strictEqual(pdfDoc.totalEstimatedAmount, 5670.74);
    });

    it("should embed explicit NSCP 2015 Structural Waiver clause when structuralWaiver is true", () => {
      const bomResult = calculateStandardSeries798({
        widthMm: 2600,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
        structuralWaiver: true,
      });

      const metadata = {
        quotationNumber: "Q-2026-0483",
        referenceCode: "CF-2026-002",
        customerName: "Maria Santos",
        createdAtFormatted: "May 21, 2026 · 4:00 PM",
        validUntilFormatted: "June 4, 2026",
        hasSill: true,
        structuralWaiver: true,
        bomResult,
      };

      const html = generateQuotationPdfHtml(metadata);

      // Verify structural waiver banner is prominently rendered
      assert.ok(html.includes("NSCP 2015 Structural Span Waiver Attached"));
      assert.ok(html.includes("exceeds standard Series 798 structural leaf recommendations"));
      assert.ok(html.includes("wind-load deflection risks"));

      const pdfDoc = createQuotationPdfDocument(metadata);
      assert.strictEqual(pdfDoc.hasStructuralWaiver, true);
    });

    it("should render sill omission badge when hasSill is false", () => {
      const bomResult = calculateStandardSeries798({
        widthMm: 1800,
        heightMm: 1200,
        panelCount: 2,
        hasSill: false,
      });

      const metadata = {
        quotationNumber: "Q-2026-0484",
        referenceCode: "CF-2026-003",
        customerName: "Pedro Penduko",
        createdAtFormatted: "May 21, 2026 · 4:15 PM",
        validUntilFormatted: "June 4, 2026",
        hasSill: false,
        structuralWaiver: false,
        bomResult,
      };

      const html = generateQuotationPdfHtml(metadata);
      assert.ok(html.includes("Bottom Sill Omitted"));
      assert.ok(html.includes("Net material reduction applied"));
    });
  });

  // --------------------------------------------------------------------------
  // 3. Signed Booking Handoff Deep Link Integration
  // --------------------------------------------------------------------------
  describe("Signed Booking Handoff Integration", () => {
    it("should format Messenger and Viber deep links containing reference code and formatted price", () => {
      const booking = formatBookingShareMessage({
        customerName: "Juan Dela Cruz",
        quotationNumber: "Q-2026-0482",
        referenceLink: "glassfit.ph/q/cf-2026-001",
        productDescription: "Series 798 2-Panel Sliding Window (Analok)",
        totalEstimatePhp: 5670.74,
        hasStructuralWaiver: false,
      });

      assert.ok(booking.messageText.includes("Q-2026-0482"));
      assert.ok(booking.messageText.includes("Php 5,671") || booking.messageText.includes("5,670.74") || booking.messageText.includes("5,671"));
      assert.ok(booking.messageText.includes("glassfit.ph/q/cf-2026-001"));
      assert.ok(booking.messageText.includes("Juan Dela Cruz"));
      assert.ok(!booking.messageText.includes("Structural waiver attached"));

      // Check deep link formats
      assert.ok(booking.messengerUrl.startsWith("https://m.me/rrdaluminumglass?text="));
      assert.ok(booking.viberUrl.startsWith("viber://forward?text="));
    });

    it("should append structural waiver notice to booking message when waiver is active", () => {
      const booking = formatBookingShareMessage({
        customerName: "Maria Santos",
        quotationNumber: "Q-2026-0483",
        referenceLink: "glassfit.ph/q/cf-2026-002",
        productDescription: "Series 798 2-Panel Sliding Window (2600mm Wide)",
        totalEstimatePhp: 8102.88,
        hasStructuralWaiver: true,
      });

      assert.ok(booking.messageText.includes("Structural waiver attached for aperture span >= 2400mm"));
      assert.ok(booking.messengerUrl.includes(encodeURIComponent("Structural waiver attached")));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Booking Domain Schemas & Token Hash Validation
  // --------------------------------------------------------------------------
  describe("Booking Domain Schemas & Token Hash Validation", () => {
    it("should validate GenerateBookingLinkInputSchema and default options", async () => {
      const { GenerateBookingLinkInputSchema } = await import("../../src/lib/booking/types.js");

      const parsed = GenerateBookingLinkInputSchema.parse({
        widthMm: 1800,
        heightMm: 1200,
      });

      assert.strictEqual(parsed.widthMm, 1800);
      assert.strictEqual(parsed.heightMm, 1200);
      assert.strictEqual(parsed.panelCount, 2);
      assert.strictEqual(parsed.hasSill, true);
      assert.strictEqual(parsed.finishType, "Analok");
      assert.strictEqual(parsed.structuralWaiver, false);
    });

    it("should validate GeneratedBookingLinkResultSchema with 64-hex SHA-256 token hash", async () => {
      const { GeneratedBookingLinkResultSchema } = await import("../../src/lib/booking/types.js");

      const validResult = {
        linkId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        quotationId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
        quotationNumber: "Q-2026-0482",
        referenceCode: "CF-2026-001",
        tokenHash: "a".repeat(64),
        signedUrl: "https://glassfit.ph/q/" + "a".repeat(64),
        displayLink: "glassfit.ph/q/cf-2026-001",
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        totalEstimatedAmount: 5670.74,
        hasStructuralWaiver: false,
      };

      const parsed = GeneratedBookingLinkResultSchema.parse(validResult);
      assert.strictEqual(parsed.referenceCode, "CF-2026-001");
      assert.strictEqual(parsed.tokenHash.length, 64);
    });

    it("should validate RecordBookingRequestInputSchema and UpdateBookingStatusInputSchema", async () => {
      const { RecordBookingRequestInputSchema, UpdateBookingStatusInputSchema } = await import("../../src/lib/booking/types.js");

      const recordInput = RecordBookingRequestInputSchema.parse({
        linkId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        platform: "Messenger",
      });
      assert.strictEqual(recordInput.platform, "Messenger");

      const updateInput = UpdateBookingStatusInputSchema.parse({
        bookingRequestId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        status: "Done",
      });
      assert.strictEqual(updateInput.status, "Done");
    });
  });
});

