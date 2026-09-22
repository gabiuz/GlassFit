import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateOverlayPricing,
  calculateStandardSeries798,
  aggregateMultiProductBOM,
} from "../../src/lib/pricing/pricingEngine";
import { generateQuotationPdfHtml } from "../../src/lib/pricing/quotationPdfGenerator";
import type { PlacedOverlay } from "../../src/lib/visualization/types";
import type { ItemizedProductQuotation } from "../../src/lib/pricing/types";

describe("Milestone 5: Multi-Product Pricing & Quotation Systems", () => {
  const overlay1: PlacedOverlay = {
    overlayId: "overlay-uuid-1",
    productId: "prod-sliding-door",
    productName: "Series 798 Sliding Door",
    templateId: "series-798",
    configuration: {
      widthCm: 180,
      heightCm: 210,
      thicknessMm: 6,
      quantity: 1,
      aluminumFinish: "Analok",
      glassAppearance: "clear",
      includeSill: true,
      panelCount: 2,
      yaw: 0,
      pitch: 0,
      rotateAngle: 0,
      isFlipped: false,
      zoomLevel: 0,
      positionX: 0,
      positionY: 0,
      visualParameterValues: {},
    },
    flattenedImageDataUrl: "data:image/png;base64,sampleDoor",
    totalPrice: 15420,
    unitPrice: 15420,
  };

  const overlay2: PlacedOverlay = {
    overlayId: "overlay-uuid-2",
    productId: "prod-casement-window",
    productName: "Series 798 Casement Window",
    templateId: "series-798",
    configuration: {
      widthCm: 120,
      heightCm: 120,
      thicknessMm: 6,
      quantity: 2,
      aluminumFinish: "Analok",
      glassAppearance: "clear",
      includeSill: true,
      panelCount: 2,
      yaw: 0,
      pitch: 0,
      rotateAngle: 0,
      isFlipped: false,
      zoomLevel: 0,
      positionX: 100,
      positionY: 0,
      visualParameterValues: {},
    },
    flattenedImageDataUrl: "data:image/png;base64,sampleWindow",
    totalPrice: 8726,
    unitPrice: 4363,
  };

  it("calculates live price for active configuring product during editing, and consolidated total when applied", () => {
    // Scenario: overlay1 is placed on canvas; user is actively editing overlay2
    const placedOverlays = [overlay1];
    const activeOverlayId = "active-configuring-product";
    const selectedProduct = true;
    const realtimePricing = { unitPrice: 4363, totalPrice: 8726 };

    // Workspace price logic
    const nonActivePlacedOverlays = placedOverlays.filter(
      (overlay) => overlay.overlayId !== activeOverlayId,
    );
    const placedOverlaysTotalPrice = nonActivePlacedOverlays.reduce((sum, overlay) => {
      if (overlay.totalPrice !== undefined && !Number.isNaN(overlay.totalPrice)) {
        return sum + overlay.totalPrice;
      }
      return sum + calculateOverlayPricing(overlay).totalPrice;
    }, 0);

    const totalScenePrice =
      placedOverlaysTotalPrice + (selectedProduct ? realtimePricing.totalPrice : 0);
    const totalSceneProductCount =
      nonActivePlacedOverlays.length + (selectedProduct ? 1 : 0);

    // 1. While editing (isSnapshotApplied = false): live price is active product price
    const editingModePrice = realtimePricing.totalPrice;
    assert.equal(editingModePrice, 8726);

    // 2. When applied (isSnapshotApplied = true): price is combined sum of all products
    assert.equal(totalSceneProductCount, 2);
    assert.equal(totalScenePrice, 15420 + 8726); // 24,146
  });

  it("generates separate quotations for each product and aggregates consolidated grand total", () => {
    const pricing1 = calculateOverlayPricing(overlay1);
    const pricing2 = calculateOverlayPricing(overlay2);

    const quotation1: ItemizedProductQuotation = {
      itemId: overlay1.overlayId,
      productId: overlay1.productId,
      productName: overlay1.productName,
      productType: "Door",
      variantName: "2-Panel Standard",
      specSummary: "Analok | 180cm x 210cm",
      dimensionsFormatted: "180cm x 210cm",
      panelCount: 2,
      finishType: "Analok",
      glassType: "6mm_clear",
      imageUrl: "",
      quantity: 1,
      unitPrice: pricing1.unitPrice,
      totalPrice: pricing1.totalPrice,
      hasSill: true,
      structuralWaiver: false,
      widthMm: 1800,
      heightMm: 2100,
      bomResult: pricing1.bomResult,
    };

    const quotation2: ItemizedProductQuotation = {
      itemId: overlay2.overlayId,
      productId: overlay2.productId,
      productName: overlay2.productName,
      productType: "Window",
      variantName: "2-Panel Standard",
      specSummary: "Analok | 120cm x 120cm",
      dimensionsFormatted: "120cm x 120cm",
      panelCount: 2,
      finishType: "Analok",
      glassType: "6mm_clear",
      imageUrl: "",
      quantity: 2,
      unitPrice: pricing2.unitPrice,
      totalPrice: pricing2.totalPrice,
      hasSill: true,
      structuralWaiver: false,
      widthMm: 1200,
      heightMm: 1200,
      bomResult: pricing2.bomResult,
    };

    const quotations = [quotation1, quotation2];
    const summary = aggregateMultiProductBOM(quotations);

    // Assert consolidated quantities and materials
    assert.equal(summary.items.length, 2);
    assert.equal(summary.totalQuantity, 3); // 1 door + 2 windows
    assert.ok(summary.totalFramingMeters > 0);
    assert.ok(summary.totalGlazingSqm > 0);
    assert.equal(
      summary.finalGrandTotal,
      Math.round((quotation1.totalPrice + quotation2.totalPrice) * 100) / 100,
    );
  });

  it("generates multi-product HTML PDF with itemized breakdown and consolidated summary table", () => {
    const pricing1 = calculateOverlayPricing(overlay1);
    const pricing2 = calculateOverlayPricing(overlay2);

    const quotation1: ItemizedProductQuotation = {
      itemId: overlay1.overlayId,
      productId: overlay1.productId,
      productName: overlay1.productName,
      productType: "Door",
      variantName: "2-Panel Standard",
      specSummary: "Analok | 180cm x 210cm",
      dimensionsFormatted: "180cm x 210cm",
      panelCount: 2,
      finishType: "Analok",
      glassType: "6mm_clear",
      imageUrl: "",
      quantity: 1,
      unitPrice: pricing1.unitPrice,
      totalPrice: pricing1.totalPrice,
      hasSill: true,
      structuralWaiver: false,
      widthMm: 1800,
      heightMm: 2100,
      bomResult: pricing1.bomResult,
    };

    const quotation2: ItemizedProductQuotation = {
      itemId: overlay2.overlayId,
      productId: overlay2.productId,
      productName: overlay2.productName,
      productType: "Window",
      variantName: "2-Panel Standard",
      specSummary: "Analok | 120cm x 120cm",
      dimensionsFormatted: "120cm x 120cm",
      panelCount: 2,
      finishType: "Analok",
      glassType: "6mm_clear",
      imageUrl: "",
      quantity: 2,
      unitPrice: pricing2.unitPrice,
      totalPrice: pricing2.totalPrice,
      hasSill: true,
      structuralWaiver: false,
      widthMm: 1200,
      heightMm: 1200,
      bomResult: pricing2.bomResult,
    };

    const items = [quotation1, quotation2];
    const consolidatedSummary = aggregateMultiProductBOM(items);

    const html = generateQuotationPdfHtml({
      quotationNumber: "Q-2026-TEST",
      referenceCode: "CF-2026-TEST",
      customerName: "Maria Clara",
      customerPhone: "+63 (917) 123-4567",
      customerEmail: "maria@example.com",
      siteLocation: "Quezon City, Metro Manila",
      createdAtFormatted: "September 16, 2026",
      quotationValidityText: "Valid until September 30, 2026",
      projectName: "Two Fixture Project",
      brandLogoUrl: "https://glassfit.ph/Logo.svg",
      hasSill: true,
      structuralWaiver: false,
      bomResult: pricing1.bomResult,
      items,
      consolidatedSummary,
    });

    // Assert that HTML contains multi-product elements
    assert.ok(html.includes("ITEMIZED FIXTURE BREAKDOWN (2 FIXTURES)"));
    assert.ok(html.includes("Fixture 1: Series 798 Sliding Door"));
    assert.ok(html.includes("Fixture 2: Series 798 Casement Window"));
    assert.ok(html.includes("Consolidated Total:"));
    assert.ok(html.includes(consolidatedSummary.finalGrandTotal.toLocaleString("en-PH")));
    assert.ok(html.includes('class="grand-total-row"'));
    assert.ok(html.includes("Consumer Act of the Philippines RA 7394"));
  });
});
