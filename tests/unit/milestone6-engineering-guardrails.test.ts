import { describe, it } from "node:test";
import assert from "node:assert";
import {
  validateEngineeringGuardrails,
  UNIVERSAL_GLASS_DENSITY_FACTOR,
  SERIES_798_ROLLER_MAX_CAPACITY_KG,
} from "../../src/lib/visualization/guardrailEngine.js";

describe("Milestone 6: Engineering Guardrails & Hybrid Confirmation Modal", () => {
  // --------------------------------------------------------------------------
  // 1. Universal 2.5 Metric Rule Glass Dead Load Verification
  // --------------------------------------------------------------------------
  describe("Glass Dead Load Calculations (Universal 2.5 Rule)", () => {
    it("should calculate exact 15.0 kg/sqm for 6mm glass and 30.0 kg/sqm for 12mm glass", () => {
      assert.strictEqual(6.0 * UNIVERSAL_GLASS_DENSITY_FACTOR, 15.0);
      assert.strictEqual(12.0 * UNIVERSAL_GLASS_DENSITY_FACTOR, 30.0);
    });

    it("should compute exact dead load for a standard 1.20m x 1.20m 2-panel window with 6mm glass", () => {
      // Opening: 1200mm W x 1200mm H -> 2 panels -> each leaf: 0.60m W x 1.20m H = 0.72 sqm
      // Glass weight: 0.72 sqm * (6mm * 2.5 kg/m2 = 15.0 kg/m2) = 10.80 kg
      // Leaf dead load: 10.80 kg (glass) + 6.00 kg (frame) = 16.80 kg
      const result = validateEngineeringGuardrails({
        widthMm: 1200,
        heightMm: 1200,
        panelCount: 2,
        glassThicknessMm: 6.0,
        sashFrameWeightKg: 6.0,
      });

      assert.strictEqual(result.leafWidthMm, 600);
      assert.strictEqual(result.leafHeightMm, 1200);
      assert.strictEqual(result.leafAreaSqm, 0.72);
      assert.strictEqual(result.totalAreaSqm, 1.44);
      assert.strictEqual(result.glassWeightPerSqmKg, 15.0);
      assert.strictEqual(result.leafGlassDeadLoadKg, 10.8);
      assert.strictEqual(result.totalLeafDeadLoadKg, 16.8);
      assert.strictEqual(result.isRollerOverloaded, false);
      assert.strictEqual(result.isRollerNearCapacity, false);
      assert.strictEqual(result.isSpanLimitExceeded, false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Aspect Ratio & Crabbing Monitoring
  // --------------------------------------------------------------------------
  describe("Aspect Ratio & Sash Crabbing Limits", () => {
    it("should flag crabbing risk when aspect ratio (H / Leaf W) exceeds 1.2:1", () => {
      // Width: 1200mm (Leaf: 600mm = 0.60m), Height: 1200mm (1.20m) -> Ratio = 1.20 / 0.60 = 2.0:1
      const result = validateEngineeringGuardrails({
        widthMm: 1200,
        heightMm: 1200,
        panelCount: 2,
      });

      assert.strictEqual(result.aspectRatio, 2.0);
      assert.strictEqual(result.isCrabbingRisk, true);
      assert.ok(result.warnings.some((w) => w.includes("Aspect ratio")));
    });

    it("should not flag crabbing risk when leaf width is wide relative to height", () => {
      // Width: 2000mm (Leaf: 1000mm = 1.0m), Height: 1000mm (1.0m) -> Ratio = 1.0:1 <= 1.2
      const result = validateEngineeringGuardrails({
        widthMm: 2000,
        heightMm: 1000,
        panelCount: 2,
      });

      assert.strictEqual(result.aspectRatio, 1.0);
      assert.strictEqual(result.isCrabbingRisk, false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Roller Load Capacity Checks (Series 798 POM 40kg limit)
  // --------------------------------------------------------------------------
  describe("Roller Load Capacity Checks (Series 798 POM 40kg limit)", () => {
    it("should detect roller near capacity (>30kg) and overload (>40kg)", () => {
      // Overload Scenario: 2-panel window, 2.40m W x 2.40m H (Leaf: 1.20m x 2.40m = 2.88 sqm), 12mm glass
      // Glass weight: 2.88 sqm * 30 kg/m2 = 86.4 kg + 6.0 kg frame = 92.4 kg (> 40kg)
      const overloaded = validateEngineeringGuardrails({
        widthMm: 2400,
        heightMm: 2400,
        panelCount: 2,
        glassThicknessMm: 12.0,
      });

      assert.strictEqual(overloaded.isRollerOverloaded, true);
      assert.strictEqual(overloaded.isRollerNearCapacity, true);
      assert.strictEqual(overloaded.requiresPromptModal, true);
      assert.ok(overloaded.warnings.some((w) => w.includes("exceeds the certified Series 798 POM roller limit")));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Span Limit Threshold & Behavior B Prompt Modal Trigger (W >= 2400mm)
  // --------------------------------------------------------------------------
  describe("Span Limit Threshold (W >= 2400mm) & Hybrid Modal (Behavior B)", () => {
    it("should trigger span limit guardrail when W >= 2400mm on a 2-panel configuration", () => {
      const result = validateEngineeringGuardrails({
        widthMm: 2400,
        heightMm: 1200,
        panelCount: 2,
      });

      assert.strictEqual(result.isSpanLimitExceeded, true);
      assert.strictEqual(result.requiresPromptModal, true);
      assert.ok(result.warnings.some((w) => w.includes("Aperture width reaches or exceeds 2400mm")));
    });

    it("should not trigger span limit guardrail if customer switched to 3 panels for W = 2600mm", () => {
      const result = validateEngineeringGuardrails({
        widthMm: 2600,
        heightMm: 1200,
        panelCount: 3,
        glassThicknessMm: 6.0,
      });

      // Single leaf width = 2600 / 3 = 866.67mm < 1200mm limit
      assert.strictEqual(result.panelCount, 3);
      assert.strictEqual(result.isSpanLimitExceeded, false);
      assert.strictEqual(result.isRollerOverloaded, false);
      // Dead load for 3-panel: Leaf area = 0.8667 * 1.2 = 1.04 sqm * 15kg/m2 = 15.6kg + 6kg = 21.6kg
      assert.strictEqual(result.totalLeafDeadLoadKg < SERIES_798_ROLLER_MAX_CAPACITY_KG, true);
    });

    it("should retain span limit within safe range for W = 1800mm (2-panel)", () => {
      const result = validateEngineeringGuardrails({
        widthMm: 1800,
        heightMm: 1200,
        panelCount: 2,
      });

      assert.strictEqual(result.isSpanLimitExceeded, false);
      assert.strictEqual(result.requiresPromptModal, false);
    });
  });
});
