import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimateDimensionsFromCorners,
} from "../../src/lib/visualization/perspectiveTransform";
import {
  computeEstimatedDimensions,
  getScaleAwareInitialDimensions,
  computePhotoGroundedCm,
} from "../../src/lib/visualization/scaleEstimation";
import type { QuadrilateralCorners, ScaleEstimationSignal } from "../../src/lib/visualization/types";

describe("IMP-MS10: Measurement Estimation Engine", () => {
  const perfectRectangle: QuadrilateralCorners = [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 250 },
    { x: 100, y: 250 },
  ];

  // Perspective trapezoid: top is farther away (narrower), bottom is closer (wider)
  const perspectiveQuad: QuadrilateralCorners = [
    { x: 150, y: 100 }, // top-left
    { x: 250, y: 100 }, // top-right (width = 100)
    { x: 300, y: 300 }, // bottom-right
    { x: 100, y: 300 }, // bottom-left (width = 200)
  ];

  describe("Cross-Ratio Geometry Invariant", () => {
    it("preserves exact rectangular aspect ratio", () => {
      const { widthRatio, heightRatio } = estimateDimensionsFromCorners(perfectRectangle);
      // Width = 200, Height = 150
      assert.equal(widthRatio, 200);
      assert.equal(heightRatio, 150);
      assert.equal(widthRatio / heightRatio, 200 / 150);
    });

    it("corrects for perspective foreshortening using geometric mean", () => {
      const { widthRatio, heightRatio } = estimateDimensionsFromCorners(perspectiveQuad);
      // topWidth = 100, bottomWidth = 200 -> geometric mean = sqrt(20000) ~= 141.42
      // leftHeight = sqrt(50^2 + 200^2) = sqrt(42500) ~= 206.155
      // rightHeight = sqrt(50^2 + 200^2) = sqrt(42500) ~= 206.155
      // verticalProduct = 42500 -> geometric mean = 206.155
      assert.ok(Math.abs(widthRatio - Math.sqrt(20000)) < 1e-3);
      assert.ok(Math.abs(heightRatio - Math.sqrt(42500)) < 1e-3);
    });

    it("preserves return signature { widthRatio, heightRatio }", () => {
      const res = estimateDimensionsFromCorners(perfectRectangle);
      assert.equal(typeof res.widthRatio, "number");
      assert.equal(typeof res.heightRatio, "number");
    });
  });

  describe("Scale Estimation Ensemble Blending", () => {
    it("falls back to default heuristic when scaleSignal is null", () => {
      const estimate = computeEstimatedDimensions(200, 150, null, false, 120, null);
      assert.equal(estimate.method, "default_heuristic");
      assert.equal(estimate.confidence, 0);
      // Aspect 200/150 = 1.333 -> height 120, width 160
      assert.equal(estimate.heightCm, 120);
      assert.equal(estimate.widthCm, 160);
    });

    it("falls back to default heuristic when confidence is < 0.1", () => {
      const lowConfidenceSignal: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: 0.5,
        confidence: 0.05,
        method: "low_conf",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };
      const estimate = computeEstimatedDimensions(200, 150, lowConfidenceSignal, false, 120, null);
      assert.equal(estimate.method, "default_heuristic");
      assert.equal(estimate.confidence, 0);
    });

    it("applies door default height (210cm) vs window default height (120cm)", () => {
      const doorEst = computeEstimatedDimensions(100, 200, null, true, null, null);
      assert.equal(doorEst.heightCm, 210);
      assert.equal(doorEst.widthCm, 105);

      const winEst = computeEstimatedDimensions(100, 100, null, false, null, null);
      assert.equal(winEst.heightCm, 120);
      assert.equal(winEst.widthCm, 120);
    });

    it("uses scale signal when confidence is high", () => {
      const highConfidenceSignal: ScaleEstimationSignal = {
        anchors: [
          {
            label: "person",
            bbox_height_px: 400,
            reference_height_cm: 163,
            scale_cm_per_px: 0.4075,
            confidence: 0.85,
            depth_correction: 0.8,
          },
        ],
        best_scale_cm_per_px: 0.4075,
        confidence: 0.85,
        method: "yolo_anchor",
        exif_focal_length_mm: 4.2,
        exif_focal_length_35mm: 26,
        exif_device_model: "Test Model",
      };

      // Quad 300px width, 200px height
      // Raw scale: 300 * 0.4075 = 122.25 cm width, 200 * 0.4075 = 81.5 cm height
      // Default (win 120cm): aspect 1.5 -> default width = 180, default height = 120
      // Blend w = 0.85:
      // Width: 0.85 * 122 + 0.15 * 180 = 103.7 + 27 = 131
      // Height: 0.85 * 82 + 0.15 * 120 = 69.7 + 18 = 88
      const estimate = computeEstimatedDimensions(300, 200, highConfidenceSignal, false, 120, null);
      assert.equal(estimate.method, "yolo_anchor");
      assert.equal(estimate.confidence, 0.85);
      assert.ok(estimate.widthCm > 120 && estimate.widthCm < 140);
      assert.ok(estimate.heightCm > 80 && estimate.heightCm < 95);
    });

    it("depth correction adjusts scale factor for distance differences", () => {
      const signalWithDepth: ScaleEstimationSignal = {
        anchors: [
          {
            label: "person",
            bbox_height_px: 400,
            reference_height_cm: 163,
            scale_cm_per_px: 0.5,
            confidence: 0.85,
            depth_correction: 0.8, // anchor was at depth 0.8 (closer)
          },
        ],
        best_scale_cm_per_px: 0.5,
        confidence: 0.85,
        method: "yolo_anchor_depth_corrected",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };

      // Target opening is farther (depth = 0.4).
      // Effective scale should increase by factor (0.8 / 0.4) = 2.0.
      const nearQuadEst = computeEstimatedDimensions(200, 200, signalWithDepth, false, 120, 0.8);
      const farQuadEst = computeEstimatedDimensions(200, 200, signalWithDepth, false, 120, 0.4);

      assert.ok(farQuadEst.widthCm > nearQuadEst.widthCm);
    });

    it("clamps output dimensions to architectural limits (30-600cm W, 30-400cm H)", () => {
      const extremeScaleSignal: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: 50.0, // huge scale
        confidence: 0.9,
        method: "extreme",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };

      const hugeEst = computeEstimatedDimensions(500, 500, extremeScaleSignal, false, 120, null);
      assert.equal(hugeEst.widthCm, 600);
      assert.equal(hugeEst.heightCm, 400);

      const tinyScaleSignal: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: 0.001,
        confidence: 0.9,
        method: "tiny",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };

      const tinyEst = computeEstimatedDimensions(10, 10, tinyScaleSignal, false, 120, null);
      assert.ok(tinyEst.widthCm >= 30);
      assert.ok(tinyEst.heightCm >= 30);
    });

    it("auto-detects tall openings (aspect < 0.65) as door-scale (210cm) even when isDoor is false", () => {
      // 80px width, 200px height -> aspect 0.40
      const tallOpeningEst = computeEstimatedDimensions(80, 200, null, false, null, null);
      assert.equal(tallOpeningEst.heightCm, 210);
      assert.equal(tallOpeningEst.widthCm, 84);
    });
  });
});

describe("IMP-MS11: Scale-Aware Manual Workspace Dimension Tracking", () => {
  describe("Scale-Aware Initial Dimensions", () => {
    it("returns hardcoded defaults when scaleSignal is null", () => {
      const result = getScaleAwareInitialDimensions(
        null,
        210,
        150,
        540,
        385,
        1080,
        720,
        1080,
        720,
      );
      assert.equal(result.method, "default_fallback");
      assert.equal(result.widthCm, 210);
      assert.equal(result.heightCm, 150);
    });

    it("returns hardcoded defaults when confidence is < 0.2", () => {
      const lowConfSignal: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: 0.4,
        confidence: 0.15,
        method: "low_confidence",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };
      const result = getScaleAwareInitialDimensions(
        lowConfSignal,
        210,
        150,
        540,
        385,
        1080,
        720,
        1080,
        720,
      );
      assert.equal(result.method, "default_fallback");
      assert.equal(result.widthCm, 210);
      assert.equal(result.heightCm, 150);
    });

    it("computes photo-grounded dimensions when confidence is high (0.8)", () => {
      const signal: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: 0.4,
        confidence: 0.8,
        method: "yolo_anchor",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };
      // Overlay 540px wide on a 1080px canvas displaying a 2160px photo
      // Ratio = 2160 / 1080 = 2.0
      // Overlay in photo = 540 * 2 = 1080px
      // Estimated width = 1080 * 0.4 = 432cm
      // Confidence capped at 0.7 -> blend 0.7 * 432 + 0.3 * 210 = 302.4 + 63 = 365.4 -> 365cm
      const result = getScaleAwareInitialDimensions(
        signal,
        210,
        150,
        540,
        385,
        1080,
        720,
        2160,
        1440,
      );
      assert.equal(result.method, "scale_aware_initial");
      assert.equal(result.widthCm, 365);
      // Height: 385 * 2 = 770 photo px -> 770 * 0.4 = 308cm -> blend 0.7 * 308 + 0.3 * 150 = 215.6 + 45 = 261
      assert.equal(result.heightCm, 261);
    });

    it("clamps output to 30-600cm width and 30-400cm height", () => {
      const extremeSignal: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: 100.0,
        confidence: 0.9,
        method: "extreme",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };
      const clampedLarge = getScaleAwareInitialDimensions(
        extremeSignal,
        210,
        150,
        540,
        385,
        1080,
        720,
        1080,
        720,
      );
      assert.equal(clampedLarge.widthCm, 600);
      assert.equal(clampedLarge.heightCm, 400);

      const tinySignal: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: 0.0001,
        confidence: 0.9,
        method: "tiny",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };
      const clampedSmall = getScaleAwareInitialDimensions(
        tinySignal,
        210,
        150,
        10,
        10,
        1080,
        720,
        1080,
        720,
      );
      assert.ok(clampedSmall.widthCm >= 30);
      assert.ok(clampedSmall.heightCm >= 30);
    });

    it("caps confidence contribution at 0.7 even when confidence is 1.0", () => {
      const fullConfSignal: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: 0.5,
        confidence: 1.0,
        method: "perfect",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };
      // 540px * 1.0 ratio * 0.5 = 270cm estimated width
      // Capped weight w = 0.7: 0.7 * 270 + 0.3 * 210 = 189 + 63 = 252
      const result = getScaleAwareInitialDimensions(
        fullConfSignal,
        210,
        150,
        540,
        385,
        1080,
        720,
        1080,
        720,
      );
      assert.equal(result.widthCm, 252);
    });
  });

  describe("Photo-Grounded Drag-Resize Conversion", () => {
    it("correctly maps overlay px to photo px to cm with known scale factor", () => {
      // 500 overlay px on 1000 canvas px displaying 2000 photo px -> ratio = 2
      // overlay in photo px = 1000
      // scale = 0.3 cm/px -> 300 cm
      const result = computePhotoGroundedCm(500, 300, 1000, 600, 2000, 1200, 0.3);
      assert.equal(result.widthCm, 300);
      assert.equal(result.heightCm, 180);
    });

    it("handles zero canvas dimensions gracefully without NaN or divide by zero", () => {
      const result = computePhotoGroundedCm(500, 300, 0, 0, 1000, 600, 0.3);
      assert.ok(!Number.isNaN(result.widthCm));
      assert.ok(!Number.isNaN(result.heightCm));
      assert.ok(result.widthCm >= 1);
      assert.ok(result.heightCm >= 1);
    });

    it("returns accurate values when canvas is half the photo width (2x ratio)", () => {
      const result = computePhotoGroundedCm(250, 200, 500, 400, 1000, 800, 0.25);
      // 250 * 2 = 500 photo px * 0.25 cm/px = 125 cm
      // 200 * 2 = 400 photo px * 0.25 cm/px = 100 cm
      assert.equal(result.widthCm, 125);
      assert.equal(result.heightCm, 100);
    });

    it("blends proportional and photo-grounded resize values properly", () => {
      const proportionalWidthCm = 150;
      const photoGrounded = { widthCm: 200, heightCm: 160 };
      const confidence = 0.8;
      const photoWeight = Math.min(confidence * 0.4, 0.35); // 0.32
      const blendedWidthCm = Math.round(
        (1 - photoWeight) * proportionalWidthCm + photoWeight * photoGrounded.widthCm,
      );
      // 0.68 * 150 + 0.32 * 200 = 102 + 64 = 166
      assert.equal(blendedWidthCm, 166);
    });
  });
});

