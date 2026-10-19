import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  orderPaperCorners,
  computeScaleFromPaperCorners,
  computeEstimatedDimensions,
  getScaleAwareInitialDimensions,
} from "../../src/lib/visualization/scaleEstimation.js";
import type {
  Point2D,
  ScaleEstimationSignal,
  PlacedOverlay,
  MeasurementConfirmationEntry,
} from "../../src/lib/visualization/types.js";

describe("IMP-MS47: Interactive Fiducial Pin Fallback & Precision Dimension Grounding", () => {
  describe("1. Paper Corner Ordering & Canonical Sorting (orderPaperCorners)", () => {
    it("orders corners as [TL, TR, BR, BL] when provided in counter-clockwise order", () => {
      // Input in counter-clockwise order: TL, BL, BR, TR
      const input: Point2D[] = [
        { x: 100, y: 100 }, // TL (sum: 200, diff: 0)
        { x: 100, y: 397 }, // BL (sum: 497, diff: 297)
        { x: 310, y: 397 }, // BR (sum: 707, diff: 87)
        { x: 310, y: 100 }, // TR (sum: 410, diff: -210)
      ];

      const ordered = orderPaperCorners(input);
      assert.deepEqual(ordered[0], { x: 100, y: 100 }, "Corner 0 should be Top-Left");
      assert.deepEqual(ordered[1], { x: 310, y: 100 }, "Corner 1 should be Top-Right");
      assert.deepEqual(ordered[2], { x: 310, y: 397 }, "Corner 2 should be Bottom-Right");
      assert.deepEqual(ordered[3], { x: 100, y: 397 }, "Corner 3 should be Bottom-Left");
    });

    it("orders corners canonically when provided in shuffled order", () => {
      const input: Point2D[] = [
        { x: 310, y: 397 }, // BR
        { x: 100, y: 100 }, // TL
        { x: 100, y: 397 }, // BL
        { x: 310, y: 100 }, // TR
      ];

      const ordered = orderPaperCorners(input);
      assert.deepEqual(ordered[0], { x: 100, y: 100 });
      assert.deepEqual(ordered[1], { x: 310, y: 100 });
      assert.deepEqual(ordered[2], { x: 310, y: 397 });
      assert.deepEqual(ordered[3], { x: 100, y: 397 });
    });

    it("throws an error if input does not contain exactly 4 points", () => {
      assert.throws(() => {
        orderPaperCorners([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
      }, /Exactly 4 corner points are required/);
    });
  });

  describe("2. Client Scale Computation (computeScaleFromPaperCorners)", () => {
    it("computes exact 0.05 cm/px scale for upright A4 corners spanning 420x594 pixels", () => {
      // A4 is 210 x 297 mm -> 21.0 x 29.7 cm
      // 420 px width -> 21 / 420 = 0.05 cm/px
      // 594 px height -> 29.7 / 594 = 0.05 cm/px
      const a4Corners: [Point2D, Point2D, Point2D, Point2D] = [
        { x: 100, y: 100 },
        { x: 520, y: 100 },
        { x: 520, y: 694 },
        { x: 100, y: 694 },
      ];

      const result = computeScaleFromPaperCorners(a4Corners, "a4");
      assert.equal(result.scaleCmPerPx, 0.05);
      assert.equal(result.confidence, 0);
      assert.equal(result.orderedCorners.length, 4);
    });

    it("correctly detects landscape-taped paper via aspect ratio and maps dimensions", () => {
      // Landscape A4: 297 mm width x 210 mm height -> 29.7 cm x 21.0 cm
      // Spanning 594 px width x 420 px height
      // 29.7 / 594 = 0.05 cm/px, 21.0 / 420 = 0.05 cm/px
      const landscapeCorners: [Point2D, Point2D, Point2D, Point2D] = [
        { x: 50, y: 50 },
        { x: 644, y: 50 },
        { x: 644, y: 470 },
        { x: 50, y: 470 },
      ];

      const result = computeScaleFromPaperCorners(landscapeCorners, "a4");
      assert.equal(result.scaleCmPerPx, 0.05);
      assert.equal(result.confidence, 0);
    });

    it("computes accurate scale for Short Bond / Letter (215.9 x 279.4 mm)", () => {
      // Short Bond: 21.59 cm x 27.94 cm
      // At 215.9 px width and 279.4 px height -> 0.1 cm/px
      const shortCorners: [Point2D, Point2D, Point2D, Point2D] = [
        { x: 0, y: 0 },
        { x: 215.9, y: 0 },
        { x: 215.9, y: 279.4 },
        { x: 0, y: 279.4 },
      ];

      const result = computeScaleFromPaperCorners(shortCorners, "short");
      assert.equal(result.scaleCmPerPx, 0.1);
      assert.equal(result.confidence, 0);
    });

    it("computes accurate scale for Long Bond / Folio (215.9 x 330.2 mm)", () => {
      // Long Bond: 21.59 cm x 33.02 cm
      // At 431.8 px width x 660.4 px height -> 0.05 cm/px
      const longCorners: [Point2D, Point2D, Point2D, Point2D] = [
        { x: 10, y: 10 },
        { x: 441.8, y: 10 },
        { x: 441.8, y: 670.4 },
        { x: 10, y: 670.4 },
      ];

      const result = computeScaleFromPaperCorners(longCorners, "long");
      assert.equal(result.scaleCmPerPx, 0.05);
      assert.equal(result.confidence, 0);
    });
  });

  // IMP-MS54: exact metric cases moved to metricGeometry.test.ts; scalar-only inputs are approximate.
  describe("3. Precision Dimension Grounding in computeEstimatedDimensions", () => {
    it("MS54: paper scalar signals cannot claim metric status", () => {
      const calibratedSignal: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: 0.2, // 5 pixels per cm
        confidence: 0.95,
        method: "paper_fiducial_a4",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };



      const estimate = computeEstimatedDimensions(
        1000,
        800,
        calibratedSignal,
        false, // isDoor = false (heuristic would want 120cm)
        120,
        0.5, // depth value, should be ignored
      );

      assert.equal(estimate.method, "default_heuristic");
      assert.equal(estimate.confidence, 0);
      assert.equal(estimate.widthCm, 150);
      assert.equal(estimate.heightCm, 120);
    });

    it("MS54: non-paper anchors retain their approximate blending behavior", () => {
      const yoloSignal: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: 0.2,
        confidence: 0.8,
        method: "yolo_anchor",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };

      const estimate = computeEstimatedDimensions(
        1000,
        800,
        yoloSignal,
        false,
        120,
        null,
      );

      assert.equal(estimate.method, "yolo_anchor");

      assert.notEqual(estimate.heightCm, 160);
    });
  });

  describe("4. Precision Initial Dimension Grounding in getScaleAwareInitialDimensions", () => {
    it("MS54: paper previews retain explicit template defaults", () => {
      const paperSignal: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: 0.25, // 4 px per cm
        confidence: 0.95,
        method: "paper_fiducial_short",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };




      const initial = getScaleAwareInitialDimensions(
        paperSignal,
        210, // default width 210cm
        150, // default height 150cm
        600,
        400,
        1200,
        800,
        1200,
        800,
      );

      assert.equal(initial.method, "default_fallback");
      assert.equal(initial.widthCm, 210);
      assert.equal(initial.heightCm, 150);
    });
  });

  describe("5. Acceptance Scenarios (QAD-TC62)", () => {
    it("MS54: detected paper alone does not measure a preview", () => {
      const autoSignal: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: 0.05,
        confidence: 0.95,
        method: "paper_fiducial_a4",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };



      const dims = getScaleAwareInitialDimensions(
        autoSignal,
        210,
        150,
        500,
        400,
        1000,
        750,
        2000,
        1500,
      );

      assert.equal(dims.widthCm, 210);
      assert.equal(dims.heightCm, 150);
      assert.equal(dims.method, "default_fallback");
    });

    it("MS54: corner clamping retains workspace boundaries", () => {
      const canvasW = 800;
      const canvasH = 600;

      const rawUserPins: Point2D[] = [
        { x: -50, y: -20 },
        { x: 900, y: 0 },
        { x: 850, y: 700 },
        { x: -10, y: 650 },
      ];

      const clamped: [Point2D, Point2D, Point2D, Point2D] = [
        { x: Math.max(0, Math.min(canvasW, rawUserPins[0].x)), y: Math.max(0, Math.min(canvasH, rawUserPins[0].y)) },
        { x: Math.max(0, Math.min(canvasW, rawUserPins[1].x)), y: Math.max(0, Math.min(canvasH, rawUserPins[1].y)) },
        { x: Math.max(0, Math.min(canvasW, rawUserPins[2].x)), y: Math.max(0, Math.min(canvasH, rawUserPins[2].y)) },
        { x: Math.max(0, Math.min(canvasW, rawUserPins[3].x)), y: Math.max(0, Math.min(canvasH, rawUserPins[3].y)) },
      ];

      assert.equal(clamped[0].x, 0);
      assert.equal(clamped[0].y, 0);
      assert.equal(clamped[1].x, 800);
      assert.equal(clamped[1].y, 0);
      assert.equal(clamped[2].x, 800);
      assert.equal(clamped[2].y, 600);
      assert.equal(clamped[3].x, 0);
      assert.equal(clamped[3].y, 600);
    });

    it("MS54: manual paper review retains unknown physical accuracy", () => {


      const pins: [Point2D, Point2D, Point2D, Point2D] = [
        { x: 100, y: 100 },
        { x: 531.8, y: 100 },
        { x: 531.8, y: 658.8 },
        { x: 100, y: 658.8 },
      ];

      const { scaleCmPerPx, confidence } = computeScaleFromPaperCorners(pins, "short");
      assert.equal(scaleCmPerPx, 0.05);
      assert.equal(confidence, 0);
    });

    it("MS54: quad spans require projective corner evaluation", () => {
      const paperSignal: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: 0.1, // 10 px per cm
        confidence: 0.95,
        method: "paper_fiducial_a4",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };


      const estimate = computeEstimatedDimensions(
        1420,
        1210,
        paperSignal,
        false,
        120,
        null,
      );

      assert.equal(estimate.widthCm, 141);
      assert.equal(estimate.heightCm, 120);
      assert.equal(estimate.method, "default_heuristic");
    });

    it("QAD-TC62.5: Measurement confirmation propagates calibrated_visual dimension source", async () => {
      const { applyMeasurementOverridesToOverlays } = await import(
        "../../src/lib/visualization/measurementConfirmation.js"
      );

      const placedOverlay: PlacedOverlay = {
        overlayId: "ovl-1",
        productId: "prod-1",
        productName: "Sliding Window",
        templateId: "tpl-1",
        flattenedImageDataUrl: "data:image/png;base64,mock",
        configuration: {
          widthCm: 142,
          heightCm: 121,
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
        },
      };

      const confirmedEntry: MeasurementConfirmationEntry = {
        overlayId: "ovl-1",
        productId: "prod-1",
        productName: "Sliding Window",
        aluminumFinish: "white",
        previewGlbUrl: null,
        systemWidthCm: 142,
        systemHeightCm: 121,
        systemTotalPrice: 5000,
        structuralDefinition: null,
        overlayConfiguration: placedOverlay.configuration,
        isActiveProduct: false,
        override: {
          widthIn: 55.9,
          heightIn: 47.6,
          widthOverridden: false,
          heightOverridden: false,
          acknowledged: false,
        },
        recalculatedTotalPrice: null,
        dimensionSource: "calibrated_visual",
      };

      const result = applyMeasurementOverridesToOverlays([confirmedEntry], [placedOverlay]);
      assert.equal(
        result[0].configuration.visualParameterValues?.dimension_source,
        "calibrated_visual",
      );
    });

    it("QAD-TC62.6: Standard upload flow falls back safely to default heuristic", () => {
      const standardSignal: ScaleEstimationSignal = {
        anchors: [],
        best_scale_cm_per_px: null,
        confidence: 0,
        method: "none",
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };

      const estimate = computeEstimatedDimensions(
        1000,
        1000,
        standardSignal,
        false,
        120,
        null,
      );

      assert.equal(estimate.method, "default_heuristic");
      assert.equal(estimate.heightCm, 120);
      assert.equal(estimate.widthCm, 120);
    });
  });
});

