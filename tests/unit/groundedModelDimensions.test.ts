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

  // IMP-MS54: exact metric cases moved to metricGeometry.test.ts; scalar-only inputs are approximate.
  describe("1. Direct Coplanar Scale Application (computeEstimatedDimensions)", () => {
    it("MS54: scalar paper spans retain the template height and unknown confidence", () => {


      const estimate = computeEstimatedDimensions(
        2000,
        2400,
        calibratedSignalA4,
        false,
        150, // template height should be completely bypassed
        0.5, // depth value should be completely bypassed
      );

      assert.equal(estimate.widthCm, 125);
      assert.equal(estimate.heightCm, 150);
      assert.equal(estimate.confidence, 0);
      assert.equal(estimate.method, "default_heuristic");
    });

    it("MS54: scalar window spans cannot replace template dimensions", () => {


      const windowEst = computeEstimatedDimensions(
        1600,
        3000,
        calibratedSignalA4,
        false, // window product
        120,   // template default height
        null,
      );

      assert.equal(windowEst.widthCm, 64);
      assert.equal(windowEst.heightCm, 120);
    });

    it("MS54: scalar door spans cannot replace template dimensions", () => {


      const doorEst = computeEstimatedDimensions(
        1200,
        1600,
        calibratedSignalA4,
        true, // door product
        210,  // template default height
        null,
      );

      assert.equal(doorEst.widthCm, 158);
      assert.equal(doorEst.heightCm, 210);
    });

    it("MS54: scalar extremes remain approximate previews", () => {


      const hugeEst = computeEstimatedDimensions(
        15000,
        10000,
        calibratedSignalA4,
        false,
        null,
        null,
      );

      assert.equal(hugeEst.widthCm, 180);
      assert.equal(hugeEst.heightCm, 120);


      const tinyEst = computeEstimatedDimensions(
        100,
        100,
        calibratedSignalA4,
        false,
        null,
        null,
      );

      assert.equal(tinyEst.widthCm, 120);
      assert.equal(tinyEst.heightCm, 120);
    });
  });

  describe("2. Scale-Aware Initial Sizing (getScaleAwareInitialDimensions)", () => {
    it("MS54: paper reference alone retains template preview dimensions", () => {


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

      assert.equal(initial.widthCm, 210);
      assert.equal(initial.heightCm, 150);
      assert.equal(initial.method, "default_fallback");
    });

    it("MS54: missing photo dimensions cannot establish a paper measurement", () => {

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

      assert.equal(initial.widthCm, 210);
      assert.equal(initial.heightCm, 150);
      assert.equal(initial.method, "default_fallback");
    });

    it("MS54: canvas resize cannot turn a scalar preview into a measurement", () => {



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

      assert.equal(initial.widthCm, 210);
      assert.equal(initial.heightCm, 150);
    });
  });

  describe("3. Perspective Quad Fit Direct Grounding (QAD-TC65.2)", () => {
    it("MS54: perspective spans without locations remain approximate", () => {

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

      assert.equal(estimate.widthCm, 150);
      assert.equal(estimate.heightCm, 120);
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
