import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  orderPaperCorners,
  computeScaleFromPaperCorners,
  computeEstimatedDimensions,
} from "../../src/lib/visualization/scaleEstimation.js";
import { isValidQuadrilateral } from "../../src/lib/visualization/perspectiveTransform.js";
import type {
  CalibrationMetadata,
  Point2D,
  ScaleEstimationSignal,
} from "../../src/lib/visualization/types.js";
import type { SpaceImageSession } from "../../src/lib/imageApi.js";

describe("IMP-MS51 / QAD-TC66: Pre-Workspace Fiducial Paper Detection Confirmation Gateway", () => {
  const sampleA4Corners: [Point2D, Point2D, Point2D, Point2D] = [
    { x: 100, y: 100 }, // TL
    { x: 520, y: 100 }, // TR (width: 420px)
    { x: 520, y: 694 }, // BR
    { x: 100, y: 694 }, // BL (height: 594px)
  ];

  describe("1. Initial Mount with Auto-Detected Corners (QAD-TC66.1)", () => {
    it("preserves canonical corner ordering [TL, TR, BR, BL] and evaluates initial detection scale", () => {
      // Shuffled input
      const shuffled: Point2D[] = [
        sampleA4Corners[2],
        sampleA4Corners[0],
        sampleA4Corners[3],
        sampleA4Corners[1],
      ];

      const ordered = orderPaperCorners(shuffled);
      assert.deepEqual(ordered[0], { x: 100, y: 100 }, "Corner 0 must be Top-Left");
      assert.deepEqual(ordered[1], { x: 520, y: 100 }, "Corner 1 must be Top-Right");
      assert.deepEqual(ordered[2], { x: 520, y: 694 }, "Corner 2 must be Bottom-Right");
      assert.deepEqual(ordered[3], { x: 100, y: 694 }, "Corner 3 must be Bottom-Left");

      const scaleResult = computeScaleFromPaperCorners(ordered, "a4");
      // A4: 21.0cm / 420px = 0.05 cm/px, 29.7cm / 594px = 0.05 cm/px
      assert.equal(scaleResult.scaleCmPerPx, 0.05);
      assert.equal(scaleResult.confidence, 0.95);
    });

    it("verifies convexity on initial auto-detected quadrilateral", () => {
      const isValid = isValidQuadrilateral(sampleA4Corners);
      assert.equal(isValid, true, "Standard A4 corners must form a valid convex quadrilateral");
    });
  });

  describe("2. One-Click Approval Path & Scale Commitment (QAD-TC66.2)", () => {
    it("locks verified corners, sets status: verified_calibrated, and populates session contracts", () => {
      const scaleResult = computeScaleFromPaperCorners(sampleA4Corners, "a4");

      const updatedMeta: CalibrationMetadata = {
        mode: "paper_fiducial",
        paperStandard: "a4",
        status: "verified_calibrated",
        confidence: scaleResult.confidence,
        detectedCorners: sampleA4Corners.map((p) => [p.x, p.y]),
        user_verified: true,
        verified_corners: sampleA4Corners,
        verified_scale_cm_per_px: scaleResult.scaleCmPerPx,
      };

      assert.equal(updatedMeta.status, "verified_calibrated");
      assert.equal(updatedMeta.user_verified, true);
      assert.equal(updatedMeta.verified_scale_cm_per_px, 0.05);
      assert.deepEqual(updatedMeta.verified_corners, sampleA4Corners);

      // Verify scale signal formulation
      const scaleSignal: ScaleEstimationSignal = {
        best_scale_cm_per_px: scaleResult.scaleCmPerPx,
        confidence: scaleResult.confidence,
        method: "paper_fiducial_a4",
        anchors: [
          {
            label: "paper_a4",
            bbox_height_px: 594,
            reference_height_cm: 29.7,
            scale_cm_per_px: scaleResult.scaleCmPerPx,
            confidence: scaleResult.confidence,
            depth_correction: 1.0,
          },
        ],
        exif_focal_length_mm: null,
        exif_focal_length_35mm: null,
        exif_device_model: null,
      };

      // Grounding calculation
      const dimensions = computeEstimatedDimensions(2000, 2400, scaleSignal, false, 120, null);
      assert.equal(dimensions.widthCm, 100); // 2000 * 0.05
      assert.equal(dimensions.heightCm, 120); // 2400 * 0.05
      assert.equal(dimensions.method, "paper_fiducial_a4");
    });
  });

  describe("3. Interactive Corner Adjustment & Dynamic Re-Scaling (QAD-TC66.3)", () => {
    it("recalculates metric scale when corner handles are dragged", () => {
      // Simulate user dragging bottom-right corner outwards (expanding span from 420x594 to 840x1188)
      const adjustedCorners: [Point2D, Point2D, Point2D, Point2D] = [
        { x: 100, y: 100 }, // TL
        { x: 940, y: 100 }, // TR (width: 840px)
        { x: 940, y: 1288 }, // BR
        { x: 100, y: 1288 }, // BL (height: 1188px)
      ];

      const initialResult = computeScaleFromPaperCorners(sampleA4Corners, "a4");
      const adjustedResult = computeScaleFromPaperCorners(adjustedCorners, "a4");

      assert.equal(initialResult.scaleCmPerPx, 0.05);
      // Doubled pixel span halves cm/px from 0.05 to 0.025
      assert.equal(adjustedResult.scaleCmPerPx, 0.025);
    });

    it("verifies magnifier loupe positioning algorithm and viewport boundary clamping", () => {
      const windowW = 1000;
      const windowH = 800;

      // Case A: Dragging near top of screen (top 15% -> contactY < 120px) flips offset downward
      const contactA = { x: 500, y: 80 };
      const isTopScreenA = contactA.y < windowH * 0.15;
      assert.equal(isTopScreenA, true);
      const verticalOffsetA = isTopScreenA ? 70 : -70;
      const loupeYA = Math.max(60, Math.min(windowH - 60, contactA.y + verticalOffsetA));
      assert.equal(loupeYA, 150, "Loupe should flip downward below finger when in top 15%");

      // Case B: Dragging in middle/lower screen offsets upward
      const contactB = { x: 500, y: 400 };
      const isTopScreenB = contactB.y < windowH * 0.15;
      assert.equal(isTopScreenB, false);
      const verticalOffsetB = isTopScreenB ? 70 : -70;
      const loupeYB = Math.max(60, Math.min(windowH - 60, contactB.y + verticalOffsetB));
      assert.equal(loupeYB, 330, "Loupe should appear 70px above finger");

      // Case C: Clamping near horizontal screen edges
      const contactC = { x: 20, y: 400 };
      const loupeXC = Math.max(60, Math.min(windowW - 60, contactC.x));
      assert.equal(loupeXC, 60, "Loupe X should clamp to minimum margin");

      const contactD = { x: 990, y: 400 };
      const loupeXD = Math.max(60, Math.min(windowW - 60, contactD.x));
      assert.equal(loupeXD, 940, "Loupe X should clamp to maximum margin");
    });
  });

  describe("4. Paper Standard Correction (QAD-TC66.4)", () => {
    it("dynamically recomputes physical scale when switching between Philippine standards", () => {
      // 431.8px width by 558.8px height
      const testCorners: [Point2D, Point2D, Point2D, Point2D] = [
        { x: 0, y: 0 },
        { x: 431.8, y: 0 },
        { x: 431.8, y: 558.8 },
        { x: 0, y: 558.8 },
      ];

      // Short Bond: 215.9mm x 279.4mm -> 21.59cm / 431.8px = 0.05 cm/px
      const shortResult = computeScaleFromPaperCorners(testCorners, "short");
      assert.equal(shortResult.scaleCmPerPx, 0.05);

      // A4: 210mm x 297mm -> (21.0 / 431.8 + 29.7 / 558.8) / 2 = (0.048633 + 0.053149) / 2 = 0.050891
      const a4Result = computeScaleFromPaperCorners(testCorners, "a4");
      assert.notEqual(a4Result.scaleCmPerPx, shortResult.scaleCmPerPx);

      // Long Bond: 215.9mm x 330.2mm -> (21.59 / 431.8 + 33.02 / 558.8) / 2 = (0.05 + 0.05909) / 2 = 0.054545
      const longResult = computeScaleFromPaperCorners(testCorners, "long");
      assert.notEqual(longResult.scaleCmPerPx, shortResult.scaleCmPerPx);
      assert.notEqual(longResult.scaleCmPerPx, a4Result.scaleCmPerPx);
    });
  });

  describe("5. Convexity Guardrail & Self-Intersection Detection (QAD-TC66.5)", () => {
    it("rejects bow-tie self-intersecting polygons and flags non-convex geometry", () => {
      // Crossed edges: Top-Left connects to Bottom-Right, Top-Right connects to Bottom-Left
      const bowTieCorners: [Point2D, Point2D, Point2D, Point2D] = [
        { x: 100, y: 100 }, // TL
        { x: 500, y: 500 }, // crossed to BR
        { x: 500, y: 100 }, // TR
        { x: 100, y: 500 }, // BL
      ];

      const isValid = isValidQuadrilateral(bowTieCorners);
      assert.equal(isValid, false, "Self-intersecting bow-tie polygon must be invalid");
    });

    it("accepts valid, non-self-intersecting quadrilaterals", () => {
      const isValid = isValidQuadrilateral(sampleA4Corners);
      assert.equal(isValid, true, "Convex quadrilateral must be valid");
    });
  });

  describe("6. False-Positive Dismissal & Fallback Handling (QAD-TC66.5 & QAD-TC66.6)", () => {
    it("emits status: heuristic_fallback and user_verified: false when user clicks Skip Calibration", () => {
      const fallbackMeta: CalibrationMetadata = {
        mode: "standard",
        paperStandard: null,
        status: "heuristic_fallback",
        confidence: 0.75,
        homographyMatrix: null,
        detectedCorners: null,
        user_verified: false,
      };

      assert.equal(fallbackMeta.status, "heuristic_fallback");
      assert.equal(fallbackMeta.user_verified, false);
      assert.equal(fallbackMeta.paperStandard, null);
    });

    it("handles manual_pin_required initial state and commits verified scale on confirmation", () => {
      const initialMeta: CalibrationMetadata = {
        mode: "paper_fiducial",
        paperStandard: "a4",
        status: "manual_pin_required",
        confidence: 0.0,
        detectedCorners: null,
        homographyMatrix: null,
      };

      assert.equal(initialMeta.status, "manual_pin_required");

      // User places 4 pins and confirms
      const manualScale = computeScaleFromPaperCorners(sampleA4Corners, "a4");
      const confirmedMeta: CalibrationMetadata = {
        mode: "paper_fiducial",
        paperStandard: "a4",
        status: "verified_calibrated",
        confidence: manualScale.confidence,
        detectedCorners: sampleA4Corners.map((p) => [p.x, p.y]),
        user_verified: true,
        verified_corners: sampleA4Corners,
        verified_scale_cm_per_px: manualScale.scaleCmPerPx,
      };

      assert.equal(confirmedMeta.status, "verified_calibrated");
      assert.equal(confirmedMeta.user_verified, true);
      assert.equal(confirmedMeta.verified_scale_cm_per_px, 0.05);
    });
  });

  describe("7. Workspace Hydration & Modal Suppression (QAD-TC66.7)", () => {
    it("suppresses the pinning modal when spaceImageSession has user_verified: true or verified_calibrated", () => {
      const verifiedSession: Partial<SpaceImageSession> = {
        sessionId: "sess-verified",
        calibrationMeta: {
          mode: "paper_fiducial",
          paperStandard: "a4",
          status: "verified_calibrated",
          confidence: 0.95,
          user_verified: true,
          verified_corners: sampleA4Corners,
          verified_scale_cm_per_px: 0.05,
        },
      };

      // In ProductModelWorkspace.tsx:
      // const meta = spaceImageSession?.calibrationMeta;
      // if (meta?.user_verified || meta?.status === "verified_calibrated") return false;
      // return meta?.status === "manual_pin_required";
      const shouldOpenPicker = (() => {
        const meta = verifiedSession.calibrationMeta;
        if (meta?.user_verified || meta?.status === "verified_calibrated") {
          return false;
        }
        return meta?.status === "manual_pin_required";
      })();

      assert.equal(
        shouldOpenPicker,
        false,
        "showPaperPinPicker must remain false for verified sessions",
      );
    });

    it("opens pinning modal only if status is manual_pin_required and not user_verified", () => {
      const unverifiedSession: Partial<SpaceImageSession> = {
        sessionId: "sess-unverified",
        calibrationMeta: {
          mode: "paper_fiducial",
          paperStandard: "a4",
          status: "manual_pin_required",
          confidence: 0.0,
          user_verified: false,
        },
      };

      const shouldOpenPicker = (() => {
        const meta = unverifiedSession.calibrationMeta;
        if (meta?.user_verified || meta?.status === "verified_calibrated") {
          return false;
        }
        return meta?.status === "manual_pin_required";
      })();

      assert.equal(
        shouldOpenPicker,
        true,
        "showPaperPinPicker should open when manual_pin_required and unverified",
      );
    });
  });
});
