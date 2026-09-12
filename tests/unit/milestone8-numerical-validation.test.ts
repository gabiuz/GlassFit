import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculateStandardSeries798,
} from "../../src/lib/pricing/pricingEngine.js";
import {
  validateEngineeringGuardrails,
  UNIVERSAL_GLASS_DENSITY_FACTOR,
  SERIES_798_ROLLER_MAX_CAPACITY_KG,
} from "../../src/lib/visualization/guardrailEngine.js";
import {
  generateQuotationPdfHtml,
  formatBookingShareMessage,
} from "../../src/lib/pricing/quotationPdfGenerator.js";
import { autoDetectComponentSettings } from "../../src/lib/admin/products/autoDetection.js";

describe("Milestone 8: Automated Test Suites & Numerical Validation (QA Layer)", () => {
  // --------------------------------------------------------------------------
  // 1. Numerical Benchmark Scenario 1: Baseline 2-Panel Window (1.20m x 1.20m)
  // --------------------------------------------------------------------------
  describe("Numerical Benchmark Scenario 1: Baseline 2-Panel (1.20m W x 1.20m H, with Sill)", () => {
    it("should compute exact net manufacturing cost PHP 3,490.34 and final quotation PHP 4,362.93", () => {
      const result = calculateStandardSeries798({
        widthMm: 1200,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
      });

      // 1. Raw Aluminum Extrusions:
      // Head (1.20m * 90.00) = 108.00
      // Sill (1.20m * 110.00) = 132.00
      // Jambs (2.40m * 70.00) = 168.00
      // Sash Rails (4 * 0.60m * 72.00) = 172.80
      // Sash Stiles (4 * 1.20m * 78.00) = 374.40
      // Raw Subtotal = 955.20
      assert.strictEqual(result.rawFramingSubtotal, 955.20);

      // 2. Extrusions with 12% offcut scrap factor (955.20 * 1.12) = 1,069.82
      assert.strictEqual(result.scrapFramingSubtotal, 114.62);
      assert.strictEqual(result.effectiveFramingCost, 1069.82);

      // 3. Glazing Infill: 1.44 sqm * 780.00 PHP/sqm = 1,123.20
      assert.strictEqual(result.rawGlazingSubtotal, 1123.20);
      // Glazing with 10% scrap factor (1,123.20 * 1.10) = 1,235.52
      assert.strictEqual(result.scrapGlazingSubtotal, 112.32);
      assert.strictEqual(result.effectiveGlazingCost, 1235.52);

      // 4. Fixed Hardware (4 Rollers, 1 Lock, Guides, Fasteners) = 215.00
      assert.strictEqual(result.hardwareSubtotal, 215.00);

      // 5. Weathersealing Consumables (Silicone sealants + EPDM/Mohair) = 220.00
      assert.strictEqual(result.consumablesSubtotal, 220.00);

      // 6. Direct Materials Subtotal = 1,069.82 + 1,235.52 + 215.00 + 220.00 = 2,740.34
      assert.strictEqual(result.directMaterialsSubtotal, 2740.34);

      // 7. Workshop Fabrication Labor (Option A: max(750.00, 0.25 * 2,740.34 = 685.09)) = 750.00 (Floor active)
      assert.strictEqual(result.fabricationLaborCost, 750.00);

      // 8. Total Direct Manufacturing Cost = 2,740.34 + 750.00 = 3,490.34
      assert.strictEqual(result.totalDirectCost, 3490.34);

      // 9. Contractor Gross Margin (25%) = 3,490.34 * 0.25 = 872.59
      assert.strictEqual(result.contractorMargin, 872.59);

      // 10. Final Quotation Estimate = 3,490.34 + 872.59 = 4,362.93
      assert.strictEqual(result.finalQuotation, 4362.93);

      // 11. Effective unit rate validation
      const totalAreaSqm = result.widthM * result.heightM;
      const unitRatePerSqm = Math.round((result.finalQuotation / totalAreaSqm) * 100) / 100;
      assert.strictEqual(unitRatePerSqm, 3029.81);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Numerical Benchmark Scenario 2: Extended Width (1.80m x 1.20m, with Sill)
  // --------------------------------------------------------------------------
  describe("Numerical Benchmark Scenario 2: Extended Width (1.80m W x 1.20m H, with Sill)", () => {
    it("should compute exact net manufacturing cost PHP 4,536.59 and final quotation PHP 5,670.74", () => {
      const result = calculateStandardSeries798({
        widthMm: 1800,
        heightMm: 1200,
        panelCount: 2,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
      });

      // 1. Raw Aluminum Extrusions:
      // Head (1.80m * 90.00) = 162.00
      // Sill (1.80m * 110.00) = 198.00
      // Jambs (2.40m * 70.00) = 168.00
      // Sash Rails (4 * 0.90m * 72.00) = 259.20
      // Sash Stiles (4 * 1.20m * 78.00) = 374.40
      // Raw Subtotal = 1,161.60
      assert.strictEqual(result.rawFramingSubtotal, 1161.60);

      // 2. Extrusions with 12% scrap = 1,161.60 * 1.12 = 1,300.99
      assert.strictEqual(result.effectiveFramingCost, 1300.99);

      // 3. Glazing Infill: 2.16 sqm * 780.00 * 1.10 = 1,853.28
      assert.strictEqual(result.effectiveGlazingCost, 1853.28);

      // 4. Hardware & Consumables: 215.00 + 260.00 = 475.00
      assert.strictEqual(result.hardwareSubtotal + result.consumablesSubtotal, 475.00);

      // 5. Direct Materials Subtotal = 1,300.99 + 1,853.28 + 475.00 = 3,629.27
      assert.strictEqual(result.directMaterialsSubtotal, 3629.27);

      // 6. Labor (Option A: max(750.00, 0.25 * 3,629.27)) = 907.32 (Exceeds floor)
      assert.strictEqual(result.fabricationLaborCost, 907.32);

      // 7. Total Direct Cost = 3,629.27 + 907.32 = 4,536.59
      assert.strictEqual(result.totalDirectCost, 4536.59);

      // 8. Contractor Gross Margin = 4,536.59 * 0.25 = 1,134.15
      assert.strictEqual(result.contractorMargin, 1134.15);

      // 9. Final Quotation Estimate = 4,536.59 + 1,134.15 = 5,670.74
      assert.strictEqual(result.finalQuotation, 5670.74);

      // 10. Effective unit rate demonstrates economies of scale (2,625.34/sqm)
      const totalAreaSqm = result.widthM * result.heightM;
      const unitRatePerSqm = Math.round((result.finalQuotation / totalAreaSqm) * 100) / 100;
      assert.strictEqual(unitRatePerSqm, 2625.34);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Numerical Benchmark Scenario 3: Extended Width with Sill Removed (1.80m x 1.20m)
  // --------------------------------------------------------------------------
  describe("Numerical Benchmark Scenario 3: Extended Width, Sill Removed (1.80m W x 1.20m H, No Sill)", () => {
    it("should compute exact manufacturing cost PHP 4,228.14, quotation PHP 5,285.18, and net sill deduction PHP 385.56", () => {
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

      // Raw Extrusions without sill (Sill length = 0.00m, cost = 0.00)
      // Head (162.00) + Sill (0.00) + Jambs (168.00) + Rails (259.20) + Stiles (374.40) = 963.60
      assert.strictEqual(withoutSill.rawFramingSubtotal, 963.60);

      // Extrusions with 12% scrap = 963.60 * 1.12 = 1,079.23 (221.76 reduction from Scenario 2)
      assert.strictEqual(withoutSill.effectiveFramingCost, 1079.23);
      assert.strictEqual(
        Math.round((withSill.effectiveFramingCost - withoutSill.effectiveFramingCost) * 100) / 100,
        221.76
      );

      // Glazing Infill unchanged at 1,853.28
      assert.strictEqual(withoutSill.effectiveGlazingCost, 1853.28);

      // Consumables adjusted for reduced base weatherseal -> 450.00
      assert.strictEqual(withoutSill.hardwareSubtotal + withoutSill.consumablesSubtotal, 450.00);

      // Direct Materials Subtotal = 1,079.23 + 1,853.28 + 450.00 = 3,382.51
      assert.strictEqual(withoutSill.directMaterialsSubtotal, 3382.51);

      // Labor = max(750.00, 0.25 * 3,382.51) = 845.63
      assert.strictEqual(withoutSill.fabricationLaborCost, 845.63);

      // Total Direct Cost = 3,382.51 + 845.63 = 4,228.14
      assert.strictEqual(withoutSill.totalDirectCost, 4228.14);

      // Contractor Margin = 4,228.14 * 0.25 = 1,057.04
      assert.strictEqual(withoutSill.contractorMargin, 1057.04);

      // Final Quotation Estimate = 4,228.14 + 1,057.04 = 5,285.18
      assert.strictEqual(withoutSill.finalQuotation, 5285.18);

      // Exact Net Customer Sill Removal Deduction = 5,670.74 - 5,285.18 = PHP 385.56
      const netSillDeduction = Math.round((withSill.finalQuotation - withoutSill.finalQuotation) * 100) / 100;
      assert.strictEqual(netSillDeduction, 385.56);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Numerical Benchmark Scenario 4: Wide Span 3-Panel Transition (2.60m x 1.20m)
  // --------------------------------------------------------------------------
  describe("Numerical Benchmark Scenario 4: Wide Span 3-Panel Transition (2.60m W x 1.20m H, 3-Panel)", () => {
    it("should compute exact 6-rail 6-stile 6-roller BOM cost PHP 6,482.30 and quotation PHP 8,102.88", () => {
      const result = calculateStandardSeries798({
        widthMm: 2600,
        heightMm: 1200,
        panelCount: 3,
        hasSill: true,
        finishType: "Analok",
        glassType: "6mm_bronze",
      });

      // 1. Raw Aluminum Extrusions:
      // Head (2.60m * 90.00) = 234.00
      // Sill (2.60m * 110.00) = 286.00
      // Jambs (2.40m * 70.00) = 168.00
      // Sash Rails (6 cuts of span W/3 = 2 * 2.60m * 72.00) = 374.40
      // Sash Stiles (2 lockstiles + 4 interlockers = 6 * 1.20m * 78.00) = 561.60
      // Raw Subtotal = 1,624.00
      assert.strictEqual(result.rawFramingSubtotal, 1624.00);

      // 2. Extrusions with 12% scrap = 1,624.00 * 1.12 = 1,818.88
      assert.strictEqual(result.effectiveFramingCost, 1818.88);

      // 3. Glazing Infill (3.12 sqm total across 3 panes * 780.00 * 1.10) = 2,676.96
      assert.strictEqual(result.effectiveGlazingCost, 2676.96);

      // 4. Hardware & Consumables:
      // 6 Rollers (150.00) + 2 Locks (130.00) + Guides/Fasteners (70.00) + Consumables (340.00) = 690.00
      assert.strictEqual(result.hardwareSubtotal + result.consumablesSubtotal, 690.00);

      // 5. Direct Materials Subtotal = 1,818.88 + 2,676.96 + 690.00 = 5,185.84
      assert.strictEqual(result.directMaterialsSubtotal, 5185.84);

      // 6. Labor = max(750.00, 0.25 * 5,185.84) = 1,296.46
      assert.strictEqual(result.fabricationLaborCost, 1296.46);

      // 7. Total Direct Cost = 5,185.84 + 1,296.46 = 6,482.30
      assert.strictEqual(result.totalDirectCost, 6482.30);

      // 8. Contractor Gross Margin (25%) = 6,482.30 * 0.25 = 1,620.58
      assert.strictEqual(result.contractorMargin, 1620.58);

      // 9. Final Quotation Estimate = 6,482.30 + 1,620.58 = 8,102.88
      assert.strictEqual(result.finalQuotation, 8102.88);

      // 10. Effective unit rate = 2,597.08/sqm
      const totalAreaSqm = result.widthM * result.heightM;
      const unitRatePerSqm = Math.round((result.finalQuotation / totalAreaSqm) * 100) / 100;
      assert.strictEqual(unitRatePerSqm, 2597.08);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Dead-Load Multiplier Unit Validation (The Universal 2.5 Rule)
  // --------------------------------------------------------------------------
  describe("Dead-Load Multiplier Unit Tests (Universal 2.5 Metric Rule)", () => {
    it("should calculate exact 15.0 kg/m2 for 6mm glass and 30.0 kg/m2 for 12mm glass", () => {
      assert.strictEqual(6.0 * UNIVERSAL_GLASS_DENSITY_FACTOR, 15.0);
      assert.strictEqual(8.0 * UNIVERSAL_GLASS_DENSITY_FACTOR, 20.0);
      assert.strictEqual(10.0 * UNIVERSAL_GLASS_DENSITY_FACTOR, 25.0);
      assert.strictEqual(12.0 * UNIVERSAL_GLASS_DENSITY_FACTOR, 30.0);
    });

    it("should verify leaf dead load calculation formula against physical limits", () => {
      // 1.20m x 1.20m 2-panel window with 6mm glass:
      // Leaf area = 0.60m * 1.20m = 0.72 sqm
      // Glass dead load = 0.72 sqm * 15.0 kg/sqm = 10.8 kg
      // Total leaf dead load = 10.8 kg + 6.0 kg (sash frame) = 16.8 kg
      const safeCheck = validateEngineeringGuardrails({
        widthMm: 1200,
        heightMm: 1200,
        panelCount: 2,
        glassThicknessMm: 6.0,
      });

      assert.strictEqual(safeCheck.leafGlassDeadLoadKg, 10.8);
      assert.strictEqual(safeCheck.totalLeafDeadLoadKg, 16.8);
      assert.strictEqual(safeCheck.totalLeafDeadLoadKg <= SERIES_798_ROLLER_MAX_CAPACITY_KG, true);
      assert.strictEqual(safeCheck.isRollerOverloaded, false);
    });

    it("should detect dangerous roller overload (>40.0kg) when heavy 12mm glass is applied to large leaves", () => {
      const overloadCheck = validateEngineeringGuardrails({
        widthMm: 2400,
        heightMm: 2400,
        panelCount: 2,
        glassThicknessMm: 12.0,
      });

      // Leaf area = 1.20m * 2.40m = 2.88 sqm
      // Glass dead load = 2.88 sqm * 30 kg/sqm = 86.4 kg
      // Total leaf dead load = 86.4 kg + 6.0 kg = 92.4 kg (> 40.0kg limit)
      assert.strictEqual(overloadCheck.totalLeafDeadLoadKg, 92.4);
      assert.strictEqual(overloadCheck.isRollerOverloaded, true);
      assert.strictEqual(overloadCheck.requiresPromptModal, true);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Administrative Part Inspector Auto-Detection & Schema Validation
  // --------------------------------------------------------------------------
  describe("Admin Part Inspector Auto-Detection & Relational Binding", () => {
    it("should auto-detect sill component, mark as removable, and set toggle key", () => {
      const detection = autoDetectComponentSettings("series798_double_sill.glb");
      assert.strictEqual(detection.dimensionBinding, "WIDTH");
      assert.strictEqual(detection.spanRatio, 1.0);
      assert.strictEqual(detection.isRemovable, true);
      assert.strictEqual(detection.togglePropertyKey, "has_sill");
      assert.strictEqual(detection.presentationCategory, "Framing");
    });

    it("should auto-detect vertical stiles and assign full-span height driver", () => {
      const detection = autoDetectComponentSettings("sash_interlocker.glb");
      assert.strictEqual(detection.dimensionBinding, "HEIGHT");
      assert.strictEqual(detection.spanRatio, 1.0);
      assert.strictEqual(detection.isRemovable, false);
      assert.strictEqual(detection.presentationCategory, "Framing");
    });

    it("should auto-detect glass infill and assign area driver", () => {
      const detection = autoDetectComponentSettings("window_glass_pane_6mm.glb");
      assert.strictEqual(detection.dimensionBinding, "AREA");
      assert.strictEqual(detection.spanRatio, 1.0);
      assert.strictEqual(detection.presentationCategory, "Glazing");
      assert.strictEqual(detection.componentType, "Glass");
    });
  });

  // --------------------------------------------------------------------------
  // 7. Structural Guardrails, Prompt Modal (Behavior B), and Waiver Disclaimers
  // --------------------------------------------------------------------------
  describe("Structural Guardrails & Hybrid Confirmation Workflow", () => {
    it("should trigger Behavior B prompt modal when width >= 2400mm on 2-panel window", () => {
      const guardrail = validateEngineeringGuardrails({
        widthMm: 2500,
        heightMm: 1200,
        panelCount: 2,
      });

      assert.strictEqual(guardrail.isSpanLimitExceeded, true);
      assert.strictEqual(guardrail.requiresPromptModal, true);
      assert.strictEqual(guardrail.panelCount, 2);
      assert.ok(guardrail.warnings.some((w) => w.includes("Aperture width reaches or exceeds 2400mm")));
    });

    it("should resolve span limit warning when customer transitions to 3 panels", () => {
      const resolved = validateEngineeringGuardrails({
        widthMm: 2500,
        heightMm: 1200,
        panelCount: 3,
      });

      assert.strictEqual(resolved.isSpanLimitExceeded, false);
      assert.strictEqual(resolved.requiresPromptModal, false);
      assert.strictEqual(resolved.leafWidthMm, 833.33);
    });

    it("should embed legal NSCP 2015 Structural Waiver clause in PDF output when waiver is true", () => {
      const bomResult = calculateStandardSeries798({
        widthMm: 2500,
        heightMm: 1200,
        panelCount: 2,
        structuralWaiver: true,
      });

      const pdfHtml = generateQuotationPdfHtml({
        quotationNumber: "Q-2026-TEST",
        referenceCode: "CF-2026-WAIVER",
        customerName: "Maria Santos",
        customerPhone: "+63 917 555 0123",
        customerEmail: "maria@example.com",
        siteLocation: "Makati City, Metro Manila",
        createdAtFormatted: "September 9, 2026",
        validUntilFormatted: "September 23, 2026",
        hasSill: true,
        structuralWaiver: true,
        bomResult,
      });

      assert.ok(pdfHtml.includes("NSCP 2015 Structural Span Waiver Attached"));
      assert.ok(pdfHtml.includes("2-panel configuration exceeds standard Series 798 structural leaf recommendations"));
      assert.ok(pdfHtml.includes("wind-load deflection risks"));
    });

    it("should include structural waiver notice in Messenger/Viber booking messages", () => {
      const booking = formatBookingShareMessage({
        quotationNumber: "Q-2026-TEST",
        customerName: "Maria Santos",
        referenceLink: "https://glassfit.ph/q/CF-2026-WAIVER",
        productDescription: "Series 798 2-Panel Sliding Window (2500mm)",
        totalEstimatePhp: 8102.88,
        hasStructuralWaiver: true,
      });

      assert.ok(booking.messageText.includes("Structural waiver attached for aperture span >= 2400mm"));
      assert.ok(booking.messageText.includes("Maria Santos"));
      assert.ok(booking.messengerUrl.includes("m.me/rrdaluminumglass"));
      assert.ok(booking.viberUrl.includes("viber://forward"));
    });
  });
});
