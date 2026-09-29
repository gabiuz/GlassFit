import { describe, it } from "node:test";
import assert from "node:assert";
import {
  getServerBaseUrl,
  getClientBaseUrl,
  generateBookingUrls,
  buildBookingUrls,
} from "../../src/lib/booking/urlResolver.js";
import {
  GenerateBookingLinkInputSchema,
  GeneratedBookingLinkResultSchema,
  PublicQuotationSummarySchema,
} from "../../src/lib/booking/types.js";
import { resolveSnapshotUrl } from "../../src/lib/booking/snapshotStorage.js";
import { formatBookingShareMessage } from "../../src/lib/pricing/quotationPdfGenerator.js";

describe("Milestone 13: Signed Consultation Reference Link Generation & Resolution (IMP-MS13)", () => {
  // --------------------------------------------------------------------------
  // TC-MS13-01: Dynamic Base URL Resolution across Environments
  // --------------------------------------------------------------------------
  describe("TC-MS13-01: Base URL Resolution", () => {
    it("should resolve localhost:3000 in local development fallback", async () => {
      const originalSite = process.env.NEXT_PUBLIC_SITE_URL;
      const originalApp = process.env.NEXT_PUBLIC_APP_URL;
      const originalEnv = process.env.NODE_ENV;

      try {
        delete process.env.NEXT_PUBLIC_SITE_URL;
        delete process.env.NEXT_PUBLIC_APP_URL;
        (process.env as Record<string, string | undefined>).NODE_ENV = "development";

        const serverUrl = await getServerBaseUrl();
        assert.strictEqual(serverUrl, "http://localhost:3000");

        const clientUrl = getClientBaseUrl();
        assert.strictEqual(clientUrl, "http://localhost:3000");
      } finally {
        if (originalSite) process.env.NEXT_PUBLIC_SITE_URL = originalSite;
        if (originalApp) process.env.NEXT_PUBLIC_APP_URL = originalApp;
        if (originalEnv) (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
      }
    });

    it("should resolve production domain when configured or NODE_ENV=production", async () => {
      const originalSite = process.env.NEXT_PUBLIC_SITE_URL;
      const originalEnv = process.env.NODE_ENV;

      try {
        delete process.env.NEXT_PUBLIC_SITE_URL;
        delete process.env.NEXT_PUBLIC_APP_URL;
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";

        const serverUrl = await getServerBaseUrl();
        assert.strictEqual(serverUrl, "https://glassfit.ph");

        process.env.NEXT_PUBLIC_SITE_URL = "https://custom-deploy.glassfit.ph/";
        const customUrl = await getServerBaseUrl();
        assert.strictEqual(customUrl, "https://custom-deploy.glassfit.ph");
      } finally {
        if (originalSite) process.env.NEXT_PUBLIC_SITE_URL = originalSite;
        else delete process.env.NEXT_PUBLIC_SITE_URL;
        if (originalEnv) (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
      }
    });
  });

  // --------------------------------------------------------------------------
  // TC-MS13-02: URL Assembly Contract (shareableUrl, displayBadge, tokenUrl)
  // --------------------------------------------------------------------------
  describe("TC-MS13-02: generateBookingUrls & buildBookingUrls formatting", () => {
    it("should format shareableUrl with protocol and displayBadge without protocol", () => {
      const refCode = "CF-2026-0457";
      const tokenHash = "d".repeat(64);
      const baseUrl = "http://localhost:3000";

      const urls = generateBookingUrls(refCode, tokenHash, baseUrl);

      assert.strictEqual(urls.shareableUrl, "http://localhost:3000/q/CF-2026-0457");
      assert.strictEqual(urls.displayBadge, "localhost:3000/q/cf-2026-0457");
      assert.strictEqual(urls.tokenUrl, `http://localhost:3000/q/${tokenHash}`);

      // Verify alias buildBookingUrls behaves identically
      const aliasUrls = buildBookingUrls(refCode, tokenHash, baseUrl);
      assert.deepStrictEqual(aliasUrls, urls);
    });

    it("should format production URLs correctly", () => {
      const refCode = "CF-2026-0999";
      const tokenHash = "e".repeat(64);
      const baseUrl = "https://glassfit.ph";

      const urls = generateBookingUrls(refCode, tokenHash, baseUrl);

      assert.strictEqual(urls.shareableUrl, "https://glassfit.ph/q/CF-2026-0999");
      assert.strictEqual(urls.displayBadge, "glassfit.ph/q/cf-2026-0999");
      assert.strictEqual(urls.tokenUrl, `https://glassfit.ph/q/${tokenHash}`);
    });
  });

  // --------------------------------------------------------------------------
  // TC-MS13-03: Domain Schemas with Snapshot and Link Lifecycle
  // --------------------------------------------------------------------------
  describe("TC-MS13-03: Booking Link Schemas Validation", () => {
    it("should parse GenerateBookingLinkInputSchema with finalSnapshotDataUrl", () => {
      const input = {
        widthMm: 2400,
        heightMm: 2100,
        panelCount: 2,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
        structuralWaiver: true,
        finalSnapshotDataUrl: "data:image/webp;base64,UklGRkAAAABXRUJQVlA4...",
      };

      const parsed = GenerateBookingLinkInputSchema.parse(input);
      assert.strictEqual(parsed.widthMm, 2400);
      assert.strictEqual(parsed.heightMm, 2100);
      assert.strictEqual(parsed.structuralWaiver, true);
      assert.strictEqual(parsed.finalSnapshotDataUrl, "data:image/webp;base64,UklGRkAAAABXRUJQVlA4...");
    });

    it("should validate GeneratedBookingLinkResultSchema containing shareableUrl and displayBadge", () => {
      const sampleResult = {
        linkId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        quotationId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
        quotationNumber: "Q-2026-0457",
        referenceCode: "CF-2026-0457",
        tokenHash: "f".repeat(64),
        signedUrl: "http://localhost:3000/q/" + "f".repeat(64),
        shareableUrl: "http://localhost:3000/q/CF-2026-0457",
        displayLink: "localhost:3000/q/cf-2026-0457",
        displayBadge: "localhost:3000/q/cf-2026-0457",
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        totalEstimatedAmount: 14500.5,
        hasStructuralWaiver: true,
      };

      const parsed = GeneratedBookingLinkResultSchema.parse(sampleResult);
      assert.strictEqual(parsed.shareableUrl, "http://localhost:3000/q/CF-2026-0457");
      assert.strictEqual(parsed.displayBadge, "localhost:3000/q/cf-2026-0457");
      assert.strictEqual(parsed.hasStructuralWaiver, true);
    });

    it("should validate PublicQuotationSummarySchema with isExpired and snapshotImageUrl", () => {
      const summary = {
        referenceCode: "CF-2026-0457",
        quotationNumber: "Q-2026-0457",
        customerName: "Juan Dela Cruz",
        productName: "Series 798 Sliding Window",
        productType: "Sliding Window",
        widthMm: 2400,
        heightMm: 2100,
        panelCount: 2,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
        structuralWaiver: true,
        totalEstimatedAmount: 14500.5,
        createdAtFormatted: "September 21, 2026 · 10:00 AM",
        expiresAtFormatted: "September 28, 2026 · 10:00 AM",
        isExpired: false,
        snapshotImageUrl: "https://assets.glassfit.ph/snapshots/user1/snap1.webp",
        status: "Active" as const,
        groups: [
          {
            item_group_name: "Aluminum Framing",
            quantity: 12.5,
            unit_label: "m",
            unit_price: 320,
            estimated_subtotal: 4000,
          },
        ],
      };

      const parsed = PublicQuotationSummarySchema.parse(summary);
      assert.strictEqual(parsed.isExpired, false);
      assert.strictEqual(parsed.snapshotImageUrl, "https://assets.glassfit.ph/snapshots/user1/snap1.webp");
    });

    it("should parse multi-product GenerateBookingLinkInputSchema (2 windows and 1 door)", () => {
      const multiInput = {
        widthMm: 1200,
        heightMm: 1200,
        productName: "3 Architectural Fixtures (3 Units)",
        productType: "Multi-Product Installation",
        finalSnapshotDataUrl: "data:image/webp;base64,AAA...",
        totalEstimatedAmount: 26500,
        items: [
          {
            itemId: "overlay-1",
            productName: "Series 798 Sliding Window",
            productType: "Window & Door",
            widthMm: 1200,
            heightMm: 1200,
            panelCount: 2,
            hasSill: true,
            structuralWaiver: false,
            finishType: "Analok",
            glassType: "6mm_bronze",
            quantity: 1,
            unitPrice: 6500,
            totalPrice: 6500,
          },
          {
            itemId: "overlay-2",
            productName: "Series 798 Sliding Window",
            productType: "Window & Door",
            widthMm: 1500,
            heightMm: 1200,
            panelCount: 2,
            hasSill: true,
            structuralWaiver: false,
            finishType: "Analok",
            glassType: "6mm_bronze",
            quantity: 1,
            unitPrice: 7500,
            totalPrice: 7500,
          },
          {
            itemId: "overlay-3",
            productName: "Heavy Duty Sliding Door",
            productType: "Window & Door",
            widthMm: 2400,
            heightMm: 2100,
            panelCount: 2,
            hasSill: false,
            structuralWaiver: true,
            finishType: "PowderCoatedWhite",
            glassType: "6mm_clear",
            quantity: 1,
            unitPrice: 12500,
            totalPrice: 12500,
          },
        ],
      };

      const parsed = GenerateBookingLinkInputSchema.parse(multiInput);
      assert.strictEqual(parsed.items?.length, 3);
      assert.strictEqual(parsed.totalEstimatedAmount, 26500);
      assert.strictEqual(parsed.items[2].structuralWaiver, true);
      assert.strictEqual(parsed.items[2].productName, "Heavy Duty Sliding Door");
    });

    it("should parse multi-product PublicQuotationSummarySchema with items and consolidated metrics", () => {
      const multiSummary = {
        referenceCode: "CF-2026-0888",
        quotationNumber: "Q-2026-0888",
        customerName: "Maria Santos",
        productName: "3 Architectural Fixtures (3 Units)",
        productType: "Multi-Product Installation",
        widthMm: 1200,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
        structuralWaiver: true,
        totalEstimatedAmount: 26500,
        createdAtFormatted: "September 21, 2026 · 10:00 AM",
        expiresAtFormatted: "September 28, 2026 · 10:00 AM",
        isExpired: false,
        snapshotImageUrl: "https://assets.glassfit.ph/snapshots/user1/multi_snap.webp",
        status: "Active" as const,
        isMultiProduct: true,
        items: [
          {
            itemId: "overlay-1",
            productName: "Series 798 Sliding Window",
            productType: "Window & Door",
            widthMm: 1200,
            heightMm: 1200,
            panelCount: 2,
            hasSill: true,
            structuralWaiver: false,
            finishType: "Analok",
            glassType: "6mm_bronze",
            quantity: 1,
            unitPrice: 6500,
            totalPrice: 6500,
          },
          {
            itemId: "overlay-2",
            productName: "Series 798 Sliding Window",
            productType: "Window & Door",
            widthMm: 1500,
            heightMm: 1200,
            panelCount: 2,
            hasSill: true,
            structuralWaiver: false,
            finishType: "Analok",
            glassType: "6mm_bronze",
            quantity: 1,
            unitPrice: 7500,
            totalPrice: 7500,
          },
          {
            itemId: "overlay-3",
            productName: "Heavy Duty Sliding Door",
            productType: "Window & Door",
            widthMm: 2400,
            heightMm: 2100,
            panelCount: 2,
            hasSill: false,
            structuralWaiver: true,
            finishType: "PowderCoatedWhite",
            glassType: "6mm_clear",
            quantity: 1,
            unitPrice: 12500,
            totalPrice: 12500,
          },
        ],
        consolidatedMetrics: {
          totalQuantity: 3,
          totalFramingMeters: 28.5,
          totalGlazingSqm: 8.64,
          totalLaborCost: 4500,
        },
        groups: [
          {
            item_group_name: "Aluminum Framing",
            quantity: 28.5,
            unit_label: "m",
            unit_price: 320,
            estimated_subtotal: 9120,
          },
          {
            item_group_name: "Glass Infill",
            quantity: 8.64,
            unit_label: "sqm",
            unit_price: 780,
            estimated_subtotal: 6739.2,
          },
        ],
      };

      const parsed = PublicQuotationSummarySchema.parse(multiSummary);
      assert.strictEqual(parsed.isMultiProduct, true);
      assert.strictEqual(parsed.items?.length, 3);
      assert.strictEqual(parsed.consolidatedMetrics?.totalQuantity, 3);
      assert.strictEqual(parsed.totalEstimatedAmount, 26500);
    });
  });

  // --------------------------------------------------------------------------
  // TC-MS13-04: Dual Lookup Code Resolution Logic
  // --------------------------------------------------------------------------
  describe("TC-MS13-04: Dual Code vs Token Hash Classification", () => {
    it("should classify 64-character hexadecimal strings as cryptographic token hashes", () => {
      const validHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      assert.strictEqual(/^[0-9a-fA-F]{64}$/.test(validHash), true);

      const invalidHash = "CF-2026-0457";
      assert.strictEqual(/^[0-9a-fA-F]{64}$/.test(invalidHash), false);
    });

    it("should normalize human reference codes to quotation numbers", () => {
      const normalize = (code: string) => {
        const clean = code.trim().toUpperCase();
        return clean.startsWith("CF-")
          ? clean.replace("CF-", "Q-")
          : clean.startsWith("Q-")
          ? clean
          : `Q-${clean}`;
      };

      assert.strictEqual(normalize("CF-2026-457"), "Q-2026-457");
      assert.strictEqual(normalize("cf-2026-457"), "Q-2026-457");
      assert.strictEqual(normalize("Q-2026-457"), "Q-2026-457");
      assert.strictEqual(normalize("2026-457"), "Q-2026-457");
    });
  });

  // --------------------------------------------------------------------------
  // TC-MS13-05: Expiration Lifecycle Check
  // --------------------------------------------------------------------------
  describe("TC-MS13-05: Expiration and Revocation Calculation", () => {
    it("should identify past dates as expired", () => {
      const pastExpires = new Date(Date.now() - 3600000).toISOString();
      const futureExpires = new Date(Date.now() + 86400000).toISOString();

      const isLinkExpired = (expiresAt: string, status: string) => {
        return new Date() > new Date(expiresAt) || status === "Expired";
      };

      assert.strictEqual(isLinkExpired(pastExpires, "Active"), true);
      assert.strictEqual(isLinkExpired(futureExpires, "Active"), false);
      assert.strictEqual(isLinkExpired(futureExpires, "Expired"), true);
    });
  });

  // --------------------------------------------------------------------------
  // TC-MS13-06: Pre-filled Messenger & Viber Message Workable Link
  // --------------------------------------------------------------------------
  describe("TC-MS13-06: Messaging Handoff Link Embedding", () => {
    it("should embed full workable shareableUrl in Messenger and Viber messages", () => {
      const message = formatBookingShareMessage({
        customerName: "Juan Dela Cruz",
        quotationNumber: "Q-2026-0457",
        referenceLink: "http://localhost:3000/q/CF-2026-0457",
        productDescription: "Series 798 2-Panel Sliding Window (Analok)",
        totalEstimatePhp: 12450,
        hasStructuralWaiver: true,
      });

      assert.ok(message.messageText.includes("http://localhost:3000/q/CF-2026-0457"));
      assert.ok(message.messageText.includes("12,450"));
      assert.ok(message.messageText.includes("Structural waiver attached"));
      assert.ok(message.messengerUrl.includes(encodeURIComponent("http://localhost:3000/q/CF-2026-0457")));
      assert.ok(message.viberUrl.includes(encodeURIComponent("http://localhost:3000/q/CF-2026-0457")));
    });
  });

  // --------------------------------------------------------------------------
  // TC-MS13-07: Snapshot Storage Key & URL Resolver
  // --------------------------------------------------------------------------
  describe("TC-MS13-07: Snapshot Key Format and Resolver", () => {
    it("should resolve full URLs and data URLs directly", () => {
      const dataUrl = "data:image/webp;base64,AAAA";
      assert.strictEqual(resolveSnapshotUrl(dataUrl), dataUrl);

      const httpUrl = "https://images.example.com/snapshot.webp";
      assert.strictEqual(resolveSnapshotUrl(httpUrl), httpUrl);

      assert.strictEqual(resolveSnapshotUrl(null), null);
      assert.strictEqual(resolveSnapshotUrl(undefined), null);
    });
  });
});
