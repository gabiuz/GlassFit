import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimateDimensionsFromCorners,
} from "../../src/lib/visualization/perspectiveTransform";
import {
  computeEstimatedDimensions,
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
  });
});
