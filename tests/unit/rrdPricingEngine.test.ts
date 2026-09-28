/**
 * Unit Test Suite: R.R.D. Client Pricing Engine & Single-Application Multipliers (MS-21)
 *
 * Upstream Specifications: docs/plans/pricing_model.md, docs/implementation/ms21.md
 * Traceability Codes: PRD-F10, SDD-C7, ERD-E14, ERD-E17, BRD-M5, QAD-TC18, QAD-TC35, BAN-TYPE-05
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isSpecialAluminumColor,
  getAluminumColorMultiplier,
  isGlassTypePremium,
  isGlassColorPremium,
  isGlassOverallPremium,
  getGlassPremiumMultiplier,
  getThicknessSurcharge,
  calculateAluminumProfileCost,
  deriveGlassRatePerSqFt,
  deriveGlassRatePerSqm,
  calculateRrdProductPrice,
  SPECIAL_ALUMINUM_COLORS,
} from "@/lib/pricing/rrdPricingEngine";

describe("MS-21: R.R.D. Client Pricing Engine (QAD-TC35)", () => {
  describe("Aluminum Pricing & Special Color Multipliers", () => {
    it("should correctly derive linear meter rate from 6-meter stock price", () => {
      // 1" x 1": ₱720 / 6m = ₱120.00/m
      const cost1x1 = calculateAluminumProfileCost(2.5, 720);
      assert.equal(cost1x1, 300.0); // 2.5m * 120 = 300

      // 1" x 2": ₱1,040 / 6m = ₱173.33/m
      const cost1x2 = calculateAluminumProfileCost(6.0, 1040);
      assert.equal(cost1x2, 1040.0);

      // 1" x 3": ₱1,600 / 6m = ₱266.67/m
      const cost1x3 = calculateAluminumProfileCost(1.5, 1600);
      assert.equal(cost1x3, 400.0);
    });

    it("should treat White and Analok as standard finishes with 1.0x multiplier", () => {
      assert.equal(isSpecialAluminumColor("White"), false);
      assert.equal(isSpecialAluminumColor("Analok"), false);
      assert.equal(getAluminumColorMultiplier("White"), 1.0);
      assert.equal(getAluminumColorMultiplier("Analok"), 1.0);
    });

    it("should treat special powder-coated colors as 2.0x multiplier", () => {
      assert.equal(isSpecialAluminumColor("AL 1009"), true);
      assert.equal(getAluminumColorMultiplier("AL 1009"), 2.0);
      assert.equal(getAluminumColorMultiplier("Champagne Gold"), 2.0);
      assert.equal(getAluminumColorMultiplier("Peacock Blue"), 2.0);

      // Verify all approved AL codes from docs/plans/pricing_model.md trigger 2.0x
      for (const col of SPECIAL_ALUMINUM_COLORS) {
        assert.equal(isSpecialAluminumColor(col.code), true);
        assert.equal(getAluminumColorMultiplier(col.code), 2.0);
      }
    });
  });

  describe("Glass Classification & Single-Application Multiplier Invariant", () => {
    it("should correctly classify Standard vs Premium glass types", () => {
      assert.equal(isGlassTypePremium("Regular"), false);
      assert.equal(isGlassTypePremium("Frosted"), false);
      assert.equal(isGlassTypePremium("Mirror"), false);
      assert.equal(isGlassTypePremium("Tempered"), true);
      assert.equal(isGlassTypePremium("Reflective"), true);
    });

    it("should correctly classify Standard vs Premium glass colors", () => {
      assert.equal(isGlassColorPremium("Clear"), false);
      assert.equal(isGlassColorPremium("Bronze"), false);
      assert.equal(isGlassColorPremium("Silver"), true);
      assert.equal(isGlassColorPremium("Blue"), true);
    });

    it("should enforce the Single-Application x2 multiplier invariant across all combinations", () => {
      // Combination 1: Standard Type + Standard Color -> 1.0x
      assert.equal(isGlassOverallPremium("Regular", "Clear"), false);
      assert.equal(getGlassPremiumMultiplier("Regular", "Clear"), 1.0);

      // Combination 2: Premium Type + Standard Color -> 2.0x
      assert.equal(isGlassOverallPremium("Tempered", "Clear"), true);
      assert.equal(getGlassPremiumMultiplier("Tempered", "Clear"), 2.0);

      // Combination 3: Standard Type + Premium Color -> 2.0x
      assert.equal(isGlassOverallPremium("Regular", "Silver"), true);
      assert.equal(getGlassPremiumMultiplier("Regular", "Silver"), 2.0);

      // Combination 4: Premium Type + Premium Color -> STRICTLY 2.0x, NEVER 4.0x
      assert.equal(isGlassOverallPremium("Tempered", "Silver"), true);
      assert.equal(getGlassPremiumMultiplier("Tempered", "Silver"), 2.0);

      // Combination 5: Reflective + Blue -> STRICTLY 2.0x, NEVER 4.0x
      assert.equal(isGlassOverallPremium("Reflective", "Blue"), true);
      assert.equal(getGlassPremiumMultiplier("Reflective", "Blue"), 2.0);
    });
  });

  describe("Glass Thickness Surcharge Matrix", () => {
    it("should charge +₱0 for 6mm standard and premium glass", () => {
      assert.equal(getThicknessSurcharge(6, false), 0);
      assert.equal(getThicknessSurcharge(6, true), 0);
    });

    it("should charge +₱400 for 8mm standard glass and +₱600 for 8mm premium glass", () => {
      assert.equal(getThicknessSurcharge(8, false), 400);
      assert.equal(getThicknessSurcharge(8, true), 600);
    });

    it("should charge +₱1,000 for 12mm standard glass and +₱1,200 for 12mm premium glass", () => {
      assert.equal(getThicknessSurcharge(12, false), 1000);
      assert.equal(getThicknessSurcharge(12, true), 1200);
    });

    it("should prohibit and throw deterministic error for 3mm glass", () => {
      assert.throws(
        () => getThicknessSurcharge(3, false),
        /3mm glass is banned and prohibited/
      );
    });

    it("should throw error for unsupported thicknesses", () => {
      assert.throws(
        () => getThicknessSurcharge(10, false),
        /Unsupported glass thickness: 10mm/
      );
    });
  });

  describe("Whole Glass Sheet Rate Derivations", () => {
    it("should derive square-foot and square-meter rates accurately from 4x6ft sheet price", () => {
      // ₱864 for 4x6ft (24 sqft) = ₱36.00 / sqft
      const rateSqFt = deriveGlassRatePerSqFt(864, 4.0, 6.0);
      assert.equal(rateSqFt, 36.0);

      // ₱36.00 * 10.7639104 = ₱387.50 / sqm
      const rateSqm = deriveGlassRatePerSqm(864, 4.0, 6.0);
      assert.equal(rateSqm, 387.5);
    });
  });

  describe("End-to-End Benchmark Scenarios from docs/plans/pricing_model.md", () => {
    it("Scenario A: Standard Base Price (₱4,000) + Special Color (Black AL 1009) + 6mm Clear -> ₱8,000.00", () => {
      const result = calculateRrdProductPrice({
        baseProductPrice: 4000,
        aluminumColor: "AL 1009",
        glassType: "Regular",
        glassColor: "Clear",
        thicknessMm: 6,
      });

      assert.equal(result.finalPrice, 8000.0);
      assert.equal(result.audit.aluminumColor.isSpecial, true);
      assert.equal(result.audit.aluminumColor.multiplier, 2.0);
      assert.equal(result.audit.glassConfig.thicknessSurcharge, 0);
    });

    it("Scenario B: Standard Base Price (₱5,000) + Analok + Tempered Silver (Premium) + 8mm -> ₱10,600.00", () => {
      const result = calculateRrdProductPrice({
        baseProductPrice: 5000,
        aluminumColor: "Analok",
        glassType: "Tempered",
        glassColor: "Silver",
        thicknessMm: 8,
      });

      // Step 1: Base ₱5,000
      // Step 2: Glass is Premium (Tempered + Silver) -> ₱5,000 * 2.0 = ₱10,000
      // Step 3: 8mm Premium Surcharge -> +₱600
      // Total: ₱10,600
      assert.equal(result.finalPrice, 10600.0);
      assert.equal(result.audit.glassConfig.isTypePremium, true);
      assert.equal(result.audit.glassConfig.isColorPremium, true);
      assert.equal(result.audit.glassConfig.isOverallPremium, true);
      assert.equal(result.audit.glassConfig.multiplierApplied, 2.0);
      assert.equal(result.audit.glassConfig.thicknessSurcharge, 600);
    });

    it("Scenario C: Standard Base Price (₱5,000) + White + Regular Clear (Standard) + 12mm -> ₱6,000.00", () => {
      const result = calculateRrdProductPrice({
        baseProductPrice: 5000,
        aluminumColor: "White",
        glassType: "Regular",
        glassColor: "Clear",
        thicknessMm: 12,
      });

      // Step 1: Base ₱5,000
      // Step 2: Standard Color + Standard Glass -> 1.0x
      // Step 3: 12mm Standard Surcharge -> +₱1,000
      // Total: ₱6,000
      assert.equal(result.finalPrice, 6000.0);
      assert.equal(result.audit.glassConfig.isOverallPremium, false);
      assert.equal(result.audit.glassConfig.multiplierApplied, 1.0);
      assert.equal(result.audit.glassConfig.thicknessSurcharge, 1000);
    });
  });
});
