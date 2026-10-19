import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeEstimatedDimensions,
  getScaleAwareInitialDimensions,
} from "../../src/lib/visualization/scaleEstimation";
import {
  estimateDimensionsFromCorners,
} from "../../src/lib/visualization/perspectiveTransform";
import {
  applyMeasurementOverridesToOverlays,
  buildMeasurementEntries,
} from "../../src/lib/visualization/measurementConfirmation";
import type {
  QuadrilateralCorners,
  ScaleEstimationSignal,
  PlacedOverlay,
  ProductConfigurationSnapshot,
  MeasurementConfirmationEntry,
} from "../../src/lib/visualization/types";

describe("IMP-MS50 / QAD-TC65: Grounded Real-World 3D Model Sizing and Quotation Parity", () => {
  const calibratedSignalA4: ScaleEstimationSignal = {
    anchors: [],
    best_scale_cm_per_px: 0.05,
    confidence: 0.95,
    method: "paper_fiducial_a4",
    exif_focal_length_mm: null,
    exif_focal_length_35mm: null,
    exif_device_model: null,
  };

  describe("1. Direct Coplanar Scale Application (computeEstimatedDimensions)", () => {
    it("returns exactly 100cm x 120cm for 2000px x 2400px quad without heuristic blending (QAD-TC65.1)", () => {
      // 2000px * 0.05 cm/px = 100 cm
      // 2400px * 0.05 cm/px = 120 cm
      const estimate = computeEstimatedDimensions(
        2000,
        2400,
        calibratedSignalA4,
        false,
        150, // template height should be completely bypassed
        0.5, // depth value should be completely bypassed
      );

      assert.equal(estimate.widthCm, 100);
      assert.equal(estimate.heightCm, 120);
      assert.equal(estimate.confidence, 0.95);
      assert.equal(estimate.method, "paper_fiducial_a4");
    });

    it("does not artificially pull window models toward the 120cm template height", () => {
      // Quad height = 3000px -> 3000 * 0.05 = 150cm height
      // Template default height is 120cm for windows
      const windowEst = computeEstimatedDimensions(
        1600,
        3000,
        calibratedSignalA4,
        false, // window product
        120,   // template default height
        null,
      );

      // Should be 80cm width x 150cm height (not pulled to 120cm)
      assert.equal(windowEst.widthCm, 80);
      assert.equal(windowEst.heightCm, 150);
    });

    it("does not artificially pull door models toward the 210cm template height", () => {
      // Quad height = 1600px -> 1600 * 0.05 = 80cm height (short custom hatch)
      // Door default height is 210cm
      const doorEst = computeEstimatedDimensions(
        1200,
        1600,
        calibratedSignalA4,
        true, // door product
        210,  // template default height
        null,
      );

      // Should be 60cm width x 80cm height (not pulled to 210cm)
      assert.equal(doorEst.widthCm, 60);
      assert.equal(doorEst.heightCm, 80);
    });

    it("safely clamps dimensions exceeding 600cm width or 400cm height", () => {
      // Huge opening: 15,000px width x 10,000px height at 0.05 cm/px
      // Raw: 750cm width x 500cm height
      const hugeEst = computeEstimatedDimensions(
        15000,
        10000,
        calibratedSignalA4,
        false,
        null,
        null,
      );

      assert.equal(hugeEst.widthCm, 600);
      assert.equal(hugeEst.heightCm, 400);

      // Tiny opening: 100px width x 100px height at 0.05 cm/px
      // Raw: 5cm width x 5cm height -> clamped to 30cm minimum
      const tinyEst = computeEstimatedDimensions(
        100,
        100,
        calibratedSignalA4,
        false,
        null,
        null,
      );

      assert.equal(tinyEst.widthCm, 30);
      assert.equal(tinyEst.heightCm, 30);
    });
  });

  describe("2. Scale-Aware Initial Sizing (getScaleAwareInitialDimensions)", () => {
    it("converts overlay pixel bounds into accurate real-world centimeters (QAD-TC65.3)", () => {
      // Overlay 1200px width x 800px height at 0.05 cm/px
      // 1200 * 0.05 = 60cm, 800 * 0.05 = 40cm
      const initial = getScaleAwareInitialDimensions(
        calibratedSignalA4,
        210, // fallback default width
        150, // fallback default height
        1200,
        800,
        1920,
        1080,
        1920,
        1080,
      );

      assert.equal(initial.widthCm, 60);
      assert.equal(initial.heightCm, 40);
      assert.equal(initial.method, "paper_fiducial_a4");
    });

    it("supports optional photo dimensions while preserving physical scale calculation", () => {
      // Canvas 1000px x 800px, overlay 800px x 600px at 0.1 cm/px
      const signalShort: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: 0.1,
        confidence: 0.95,
        method: "paper_fiducial_short",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };

      const initial = getScaleAwareInitialDimensions(
        signalShort,
        210,
        150,
        800,
        600,
        1000,
        800,
      );

      assert.equal(initial.widthCm, 80);
      assert.equal(initial.heightCm, 60);
      assert.equal(initial.method, "paper_fiducial_short");
    });

    it("scales starting dimensions across canvas-to-photo resolution differences", () => {
      // Canvas is 960x540, Photo is 1920x1080 (2x ratio)
      // Overlay is 400x300 on canvas -> 800x600 in photo
      // Scale: 0.05 cm/px -> 800 * 0.05 = 40cm width, 600 * 0.05 = 30cm height
      const initial = getScaleAwareInitialDimensions(
        calibratedSignalA4,
        210,
        150,
        400,
        300,
        960,
        540,
        1920,
        1080,
      );

      assert.equal(initial.widthCm, 40);
      assert.equal(initial.heightCm, 30);
    });
  });

  describe("3. Perspective Quad Fit Direct Grounding (QAD-TC65.2)", () => {
    it("converts 4-point perspective corners directly to physical centimeters", () => {
      // Perspective quadrilateral spanning 2000px wide x 1600px tall
      const corners: QuadrilateralCorners = [
        { x: 200, y: 100 },
        { x: 2200, y: 100 },
        { x: 2200, y: 1700 },
        { x: 200, y: 1700 },
      ];

      const { widthRatio, heightRatio } = estimateDimensionsFromCorners(corners);
      assert.equal(widthRatio, 2000);
      assert.equal(heightRatio, 1600);

      const estimate = computeEstimatedDimensions(
        widthRatio,
        heightRatio,
        calibratedSignalA4,
        false,
        null,
        null,
      );

      // 2000 * 0.05 = 100cm, 1600 * 0.05 = 80cm
      assert.equal(estimate.widthCm, 100);
      assert.equal(estimate.heightCm, 80);
    });
  });

  describe("4. Quotation Audit Trust Badges & Dimension Source Persistence (QAD-TC65.4, QAD-TC65.5)", () => {
    const baseConfig: ProductConfigurationSnapshot = {
      widthCm: 100,
      heightCm: 120,
      thicknessMm: 6,
      quantity: 1,
      aluminumFinish: "white",
      glassAppearance: "clear",
      includeSill: true,
      yaw: 0,
      pitch: 0,
      rotateAngle: 0,
      isFlipped: false,
      visualParameterValues: {},
    };

    const mockOverlay: PlacedOverlay = {
      overlayId: "overlay-calibrated-1",
      productId: "sliding-door-1",
      productName: "Sliding Glass Door",
      templateId: "template-1",
      configuration: baseConfig,
      flattenedImageDataUrl: "data:image/png;base64,placeholder",
      totalPrice: 18000,
      unitPrice: 18000,
    };

    it("persists dimension_source = 'calibrated_visual' and calibration metadata when confirmed without overrides (QAD-TC65.5)", () => {
      const entry: MeasurementConfirmationEntry = {
        overlayId: "overlay-calibrated-1",
        productId: "sliding-door-1",
        productName: "Sliding Glass Door",
        aluminumFinish: "white",
        previewGlbUrl: null,
        systemWidthCm: 100,
        systemHeightCm: 120,
        systemTotalPrice: 18000,
        structuralDefinition: null,
        overlayConfiguration: baseConfig,
        isActiveProduct: false,
        override: {
          widthIn: 39.4,
          heightIn: 47.2,
          widthOverridden: false,
          heightOverridden: false,
          acknowledged: false,
        },
        recalculatedTotalPrice: null,
        dimensionSource: "calibrated_visual",
        calibrationMethod: "paper_fiducial_a4",
        calibrationConfidence: 0.95,
      };

      const patched = applyMeasurementOverridesToOverlays([entry], [mockOverlay]);
      assert.equal(patched.length, 1);
      const params = patched[0].configuration.visualParameterValues;
      assert.equal(params?.dimension_source, "calibrated_visual");
      assert.equal(params?.calibration_method, "paper_fiducial_a4");
      assert.equal(params?.calibration_confidence, 0.95);
    });

    it("persists dimension_source = 'manual_tape' when customer overrides dimensions", () => {
      const overriddenEntry: MeasurementConfirmationEntry = {
        overlayId: "overlay-calibrated-1",
        productId: "sliding-door-1",
        productName: "Sliding Glass Door",
        aluminumFinish: "white",
        previewGlbUrl: null,
        systemWidthCm: 100,
        systemHeightCm: 120,
        systemTotalPrice: 18000,
        structuralDefinition: null,
        overlayConfiguration: baseConfig,
        isActiveProduct: false,
        override: {
          widthIn: 45.0, // 45 inches = ~114 cm
          heightIn: 47.2,
          widthOverridden: true,
          heightOverridden: false,
          acknowledged: true,
        },
        recalculatedTotalPrice: 19500,
        dimensionSource: "manual_tape",
        calibrationMethod: "paper_fiducial_a4",
        calibrationConfidence: 0.95,
      };

      const patched = applyMeasurementOverridesToOverlays([overriddenEntry], [mockOverlay]);
      assert.equal(patched.length, 1);
      assert.equal(patched[0].configuration.widthCm, 114);
      const params = patched[0].configuration.visualParameterValues;
      assert.equal(params?.dimension_source, "manual_tape");
      assert.equal(params?.width, 1140);
    });

    it("retains existing standard estimate source for uncalibrated flows (QAD-TC65.6)", () => {
      const uncalibratedConfig: ProductConfigurationSnapshot = {
        ...baseConfig,
        visualParameterValues: {
          dimension_source: "heuristic",
        },
      };

      const uncalibratedOverlay: PlacedOverlay = {
        ...mockOverlay,
        overlayId: "overlay-uncalibrated-1",
        configuration: uncalibratedConfig,
      };

      const entries = buildMeasurementEntries(
        [uncalibratedOverlay],
        null,
        "100",
        "120",
        18000,
        [],
      );

      assert.equal(entries.length, 1);
      assert.equal(entries[0].dimensionSource, "heuristic");
      assert.equal(entries[0].calibrationMethod, null);
    });
  });
});
