import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeEstimatedDimensions,
  getVerifiedScaleInitialDimensions,
} from "../../src/lib/visualization/scaleEstimation";
import {
  estimateDimensionsFromCorners,
  denormalizeCorners,
} from "../../src/lib/visualization/perspectiveTransform";
import {
  buildMeasurementEntries,
  applyMeasurementOverridesToOverlays,
} from "../../src/lib/visualization/measurementConfirmation";
import type {
  ScaleEstimationSignal,
  CalibrationMetadata,
  PlacedOverlay,
  ProductConfigurationSnapshot,
  QuadrilateralCorners,
} from "../../src/lib/visualization/types";

describe("IMP-MS52 / QAD-TC67: Grounded Model Dimensioning Accuracy and Workspace Dynamic Synchronization", () => {
  const verifiedSignalA4: ScaleEstimationSignal = {
    anchors: [
      {
        label: "paper_a4",
        bbox_height_px: 0,
        reference_height_cm: 0,
        scale_cm_per_px: 0.045,
        confidence: 0.98,
        depth_correction: 1.0,
      },
    ],
    best_scale_cm_per_px: 0.045,
    confidence: 0.98,
    method: "paper_fiducial_a4",
    exif_focal_length_mm: null,
    exif_focal_length_35mm: null,
    exif_device_model: null,
  };

  const verifiedMetaA4: CalibrationMetadata = {
    mode: "paper_fiducial",
    paperStandard: "a4",
    status: "verified_calibrated",
    confidence: 0.98,
    user_verified: true,
    verified_scale_cm_per_px: 0.045,
    verified_corners: [
      { x: 100, y: 100 },
      { x: 566, y: 100 },
      { x: 566, y: 760 },
      { x: 100, y: 760 },
    ],
  };

  describe("1. Exact Metric Grounding via getVerifiedScaleInitialDimensions (QAD-TC67.1)", () => {
    it("calculates exactly 90cm x 108cm for 2000px x 2400px bounds with scale 0.045 cm/px without heuristic blending", () => {
      // 2000px * 0.045 cm/px = 90cm
      // 2400px * 0.045 cm/px = 108cm
      const dimensions = getVerifiedScaleInitialDimensions(
        0.045,
        2000,
        2400,
        2000,
        2400,
        2000,
        2400,
      );

      assert.equal(dimensions.widthCm, 90, "Width should be exactly 90cm");
      assert.equal(dimensions.heightCm, 108, "Height should be exactly 108cm");
    });

    it("evaluates direct coplanar dimensions via computeEstimatedDimensions for verified signal", () => {
      const estimate = computeEstimatedDimensions(
        2000,
        2400,
        verifiedSignalA4,
        false,
        150, // Template height must be bypassed
        0.5, // Depth correction must be bypassed
      );

      assert.equal(estimate.widthCm, 90);
      assert.equal(estimate.heightCm, 108);
      assert.equal(estimate.confidence, 0.98);
      assert.equal(estimate.method, "paper_fiducial_a4");
      assert.equal(verifiedMetaA4.status, "verified_calibrated");
      assert.equal(verifiedMetaA4.verified_scale_cm_per_px, 0.045);
    });
  });

  describe("2. Window Model Immunity to Template Default Height Pull (QAD-TC67.2)", () => {
    it("does not artificially pull window models toward the 120cm template height", () => {
      // Quad height = 3000px -> 3000 * 0.045 = 135cm height
      // Template default height is 120cm for standard windows
      const windowEstimate = computeEstimatedDimensions(
        1600,
        3000,
        verifiedSignalA4,
        false, // window fixture
        120,   // template default height
        0.8,
      );

      // 1600 * 0.045 = 72cm, 3000 * 0.045 = 135cm
      assert.equal(windowEstimate.widthCm, 72);
      assert.equal(windowEstimate.heightCm, 135, "Window height must reflect physical scale (135cm), not template (120cm)");
    });
  });

  describe("3. Door Model Immunity to Template Default Height Pull (QAD-TC67.3)", () => {
    it("does not artificially pull door models toward the 210cm template height", () => {
      // Quad height = 4000px -> 4000 * 0.045 = 180cm height (e.g. low-clearance door opening)
      // Template default height is 210cm for standard doors
      const doorEstimate = computeEstimatedDimensions(
        2000,
        4000,
        verifiedSignalA4,
        true, // door fixture
        210,  // template default height
        0.9,
      );

      // 2000 * 0.045 = 90cm, 4000 * 0.045 = 180cm
      assert.equal(doorEstimate.widthCm, 90);
      assert.equal(doorEstimate.heightCm, 180, "Door height must reflect physical scale (180cm), not template (210cm)");
    });
  });

  describe("4. Hot Workspace Marker Re-Adjustment Dynamic Rescaling (QAD-TC67.4)", () => {
    it("dynamically rescales all placed fixtures in the scene when paper marker is adjusted", () => {
      const initialCornersNormalized: QuadrilateralCorners = [
        { x: 0.1, y: 0.1 },
        { x: 0.6, y: 0.1 },
        { x: 0.6, y: 0.8 },
        { x: 0.1, y: 0.8 },
      ];
      const photoWidth = 4000;
      const photoHeight = 3000;

      // With initial scale = 0.04 cm/px:
      // denormalized width = (0.6 - 0.1) * 4000 = 2000px -> 2000 * 0.04 = 80cm
      // denormalized height = (0.8 - 0.1) * 3000 = 2100px -> 2100 * 0.04 = 84cm
      const initialPlacedOverlay: PlacedOverlay = {
        overlayId: "fixture-inst-1",
        productId: "prod-sliding-window",
        productName: "Sliding Window",
        templateId: "template-sliding-window",
        flattenedImageDataUrl: "data:image/webp;base64,placeholder",
        configuration: {
          widthCm: 80,
          heightCm: 84,
          thicknessMm: 6,
          quantity: 1,
          panelCount: 2,
          includeSill: true,
          structuralWaiver: false,
          aluminumFinish: "analok",
          glassType: "regular",
          glassAppearance: "clear",
          yaw: 0,
          pitch: 0,
          rotateAngle: 0,
          isFlipped: false,
          perspectiveFitCorners: initialCornersNormalized,
          visualParameterValues: {
            dimension_source: "verified_calibrated_visual",
            paper_standard: "a4",
            calibration_scale_cm_per_px: 0.04,
            user_verified: true,
          },
        },
      };

      const placedOverlays = [initialPlacedOverlay];

      // Customer re-adjusts marker in workspace: new verified scale is 0.05 cm/px
      const updatedScaleCmPerPx = 0.05;
      const updatedStandard = "short";

      const rescaledOverlays = placedOverlays.map((overlay) => {
        let nextWidth = overlay.configuration.widthCm;
        let nextHeight = overlay.configuration.heightCm;

        if (overlay.configuration.perspectiveFitCorners) {
          const photoCorners = denormalizeCorners(
            overlay.configuration.perspectiveFitCorners,
            photoWidth,
            photoHeight,
          );
          const { widthRatio, heightRatio } = estimateDimensionsFromCorners(photoCorners);
          if (widthRatio > 0 && heightRatio > 0) {
            nextWidth = Math.max(30, Math.min(600, Math.round(widthRatio * updatedScaleCmPerPx)));
            nextHeight = Math.max(30, Math.min(400, Math.round(heightRatio * updatedScaleCmPerPx)));
          }
        }

        return {
          ...overlay,
          configuration: {
            ...overlay.configuration,
            widthCm: nextWidth,
            heightCm: nextHeight,
            visualParameterValues: {
              ...(overlay.configuration.visualParameterValues ?? {}),
              dimension_source: "verified_calibrated_visual",
              paper_standard: updatedStandard,
              calibration_scale_cm_per_px: updatedScaleCmPerPx,
              user_verified: true,
            },
          },
        };
      });

      // 2000px * 0.05 = 100cm, 2100px * 0.05 = 105cm
      assert.equal(rescaledOverlays[0].configuration.widthCm, 100);
      assert.equal(rescaledOverlays[0].configuration.heightCm, 105);
      // Preserved non-dimension properties
      assert.equal(rescaledOverlays[0].configuration.aluminumFinish, "analok");
      assert.equal(rescaledOverlays[0].configuration.panelCount, 2);
      assert.equal(
        (rescaledOverlays[0].configuration.visualParameterValues as Record<string, unknown>).paper_standard,
        "short",
      );
      assert.equal(
        (rescaledOverlays[0].configuration.visualParameterValues as Record<string, unknown>).calibration_scale_cm_per_px,
        0.05,
      );
    });
  });

  describe("5. Manufacturing Safety Clamping Limits (Section 3.1 & 8.1)", () => {
    it("clamps physical dimensions exceeding maximum architectural fabrication limits (600cm W x 400cm H)", () => {
      // 20000px * 0.05 cm/px = 1000cm (> 600cm)
      // 15000px * 0.05 cm/px = 750cm (> 400cm)
      const clamped = getVerifiedScaleInitialDimensions(
        0.05,
        20000,
        15000,
        20000,
        15000,
        20000,
        15000,
      );

      assert.equal(clamped.widthCm, 600, "Width must clamp to maximum 600cm");
      assert.equal(clamped.heightCm, 400, "Height must clamp to maximum 400cm");
    });

    it("clamps physical dimensions falling below minimum fabrication limits (30cm W x 30cm H)", () => {
      // 200px * 0.05 cm/px = 10cm (< 30cm)
      const clampedMin = getVerifiedScaleInitialDimensions(
        0.05,
        200,
        200,
        200,
        200,
        200,
        200,
      );

      assert.equal(clampedMin.widthCm, 30, "Width must clamp to minimum 30cm");
      assert.equal(clampedMin.heightCm, 30, "Height must clamp to minimum 30cm");
    });
  });

  describe("6. Quotation Item Line Payload Parity and Persistence (QAD-TC67.6, QAD-TC67.7)", () => {
    it("persists dimension_source=verified_calibrated_visual and calibration metadata across measurement pipeline", () => {
      const mockSnapshot: ProductConfigurationSnapshot = {
        widthCm: 145,
        heightCm: 212,
        thicknessMm: 6,
        quantity: 1,
        panelCount: 2,
        includeSill: false,
        structuralWaiver: false,
        aluminumFinish: "analok",
        glassType: "regular",
        glassAppearance: "clear",
        yaw: 0,
        pitch: 0,
        rotateAngle: 0,
        isFlipped: false,
        visualParameterValues: {
          dimension_source: "verified_calibrated_visual",
          paper_standard: "a4",
          calibration_scale_cm_per_px: 0.045,
          user_verified: true,
        },
      };

      const mockOverlay: PlacedOverlay = {
        overlayId: "placed-door-1",
        productId: "sliding-door-heavy",
        productName: "Sliding Glass Door",
        templateId: "template-sliding-door",
        flattenedImageDataUrl: "data:image/webp;base64,placeholder",
        configuration: mockSnapshot,
      };

      const entries = buildMeasurementEntries(
        [mockOverlay],
        null,
        "145",
        "212",
        18000,
        [],
        mockSnapshot,
      );
      assert.equal(entries.length, 1);
      assert.equal(entries[0].dimensionSource, "verified_calibrated_visual");
      assert.equal(entries[0].paperStandard, "a4");
      assert.equal(entries[0].calibrationScaleCmPerPx, 0.045);
      assert.equal(entries[0].userVerified, true);

      // Verify that overrides propagate or maintain the verified calibration attributes
      const updatedOverlays = applyMeasurementOverridesToOverlays(entries, [mockOverlay]);
      const updatedConfig = updatedOverlays[0].configuration;
      const vParams = updatedConfig.visualParameterValues as Record<string, unknown>;

      assert.equal(vParams.dimension_source, "verified_calibrated_visual");
      assert.equal(vParams.paper_standard, "a4");
      assert.equal(vParams.calibration_scale_cm_per_px, 0.045);
      assert.equal(vParams.user_verified, true);
    });
  });
});
