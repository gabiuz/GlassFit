/**
 * IMP-MS60 / QAD-TC75: Perspective Unwarping Aspect Ratio Matcher,
 * Standard Auto-Suggestion, Side Correspondence, and Model Sizing Parity.
 *
 * Traceability:
 * - PRD-F4: CV Image Analysis Pipeline
 * - PRD-F5: Parametric 3D Visualization Canvas
 * - PRD-F10: Quotation Measurement Modal
 * - SDD-C3: CV Scene Analyzer
 * - SDD-C5: 3D Perspective Model Workspace
 * - QAD-TC75: Acceptance Test Catalog for MS60
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeUnwarpedAspectRatio,
  detectPrincipalOrientation,
  CANONICAL_PAPER_RATIOS,
  CANONICAL_PAPER_DIMENSIONS_MM,
  ASPECT_RATIO_TOLERANCE,
} from "../../src/lib/visualization/paperAspectMatcher.js";
import {
  createMetricReference,
  evaluateMetricOpening,
  type Matrix3,
} from "../../src/lib/visualization/metricGeometry.js";
import { recalculateMetricConfiguration } from "../../src/lib/visualization/scaleEstimation.js";
import { normalizeCorners } from "../../src/lib/visualization/perspectiveTransform.js";
import {
  quotationMeasurement,
  createMeasurementRecord,
} from "../../src/lib/visualization/measurementRecord.js";
import { QuotationDocumentDraftV1Schema } from "../../src/lib/pricing/quotationDocument.js";
import type {
  CalibrationMetadata,
  ProductConfigurationSnapshot,
  QuadrilateralCorners,
} from "../../src/lib/visualization/types.js";

const frame = { imageId: "room-ms60", width: 4000, height: 3000 };

/** Helper to construct quadrilateral corners */
function rect(x: number, y: number, w: number, h: number): QuadrilateralCorners {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

/** Project quadrilateral points through a 3x3 projective homography matrix */
function project(q: QuadrilateralCorners, h: Matrix3): QuadrilateralCorners {
  return q.map((p) => {
    const w = h[6] * p.x + h[7] * p.y + h[8];
    return {
      x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
      y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
    };
  }) as QuadrilateralCorners;
}

/** Synthetic 30-degree yaw perspective projection camera matrix */
const yaw30Camera: Matrix3 = [
  1.4, 0.15, 600,
  0.08, 1.55, 500,
  0.00028, 0.00012, 1.0,
];

describe("IMP-MS60 / QAD-TC75: Perspective Unwarping Aspect Ratio Matcher & Sizing Parity", () => {
  describe("QAD-TC75.1: Angled capture with A4 paper standard auto-suggestion", () => {
    it("rectifies perspective foreshortening, recovers true ratio ~1.414, and suggests A4 with >= 95% confidence", () => {
      // Physical A4 sheet: 210mm x 297mm upright in world coordinates
      const worldA4 = rect(100, 100, 210, 297);
      const projectedA4 = project(worldA4, yaw30Camera);

      // Raw 2D pixel aspect ratio is heavily distorted under yaw
      const dxTop = Math.hypot(projectedA4[1].x - projectedA4[0].x, projectedA4[1].y - projectedA4[0].y);
      const dyLeft = Math.hypot(projectedA4[3].x - projectedA4[0].x, projectedA4[3].y - projectedA4[0].y);
      const rawDistortedRatio = Math.max(dxTop, dyLeft) / Math.min(dxTop, dyLeft);

      // Assert that raw 2D pixel ratio exhibits noticeable foreshortening distortion
      assert.ok(
        Math.abs(rawDistortedRatio - CANONICAL_PAPER_RATIOS.a4) > 0.05,
        "Raw 2D ratio should differ significantly from true A4 ratio under 30-deg perspective"
      );

      // Unwarped aspect ratio matcher
      const matchResult = computeUnwarpedAspectRatio(projectedA4, frame.width, frame.height);

      assert.equal(matchResult.suggestedStandard, "a4");
      assert.ok(
        Math.abs(matchResult.unwarpedRatio - CANONICAL_PAPER_RATIOS.a4) / CANONICAL_PAPER_RATIOS.a4 <= ASPECT_RATIO_TOLERANCE,
        `Unwarped ratio ${matchResult.unwarpedRatio} must be within 3.5% of A4 ratio 1.4143`
      );
      assert.ok(
        matchResult.confidenceMatch >= 0.95,
        `Confidence match ${matchResult.confidenceMatch} must be >= 0.95`
      );
      assert.equal(matchResult.isAmbiguous, false);
      assert.equal(matchResult.detectedOrientation, "portrait");
      assert.equal(matchResult.recommendedFirstEdge, "short");
    });

    it("evaluates Short Bond and Long Bond accurately under perspective", () => {
      // Short Bond: 215.9 x 279.4 mm
      const worldShort = rect(150, 150, 215.9, 279.4);
      const projShort = project(worldShort, yaw30Camera);
      const resShort = computeUnwarpedAspectRatio(projShort, frame.width, frame.height);
      assert.equal(resShort.suggestedStandard, "short");
      assert.ok(resShort.confidenceMatch >= 0.95);

      // Long Bond: 215.9 x 330.2 mm
      const worldLong = rect(200, 200, 215.9, 330.2);
      const projLong = project(worldLong, yaw30Camera);
      const resLong = computeUnwarpedAspectRatio(projLong, frame.width, frame.height);
      assert.equal(resLong.suggestedStandard, "long");
      assert.ok(resLong.confidenceMatch >= 0.95);
    });

    it("flags ambiguous non-standard ratios as unclassified when outside tolerance envelope", () => {
      // Square or non-standard aspect ratio 1.0 (e.g. 200x200mm tile)
      const nonStandard = rect(200, 200, 200, 200);
      const projNonStd = project(nonStandard, yaw30Camera);
      const result = computeUnwarpedAspectRatio(projNonStd, frame.width, frame.height);
      assert.equal(result.suggestedStandard, null);
      assert.equal(result.isAmbiguous, true);
      assert.equal(result.confidenceMatch, 0.0);
    });
  });

  describe("QAD-TC75.2: Landscape-placed Short Bond paper side correspondence", () => {
    it("detects landscape placement and pairs long dimension horizontally and short vertically", () => {
      // Physical Short Bond placed horizontally: width 279.4mm, height 215.9mm
      const worldLandscapeShort = rect(300, 300, 279.4, 215.9);
      const projLandscape = project(worldLandscapeShort, yaw30Camera);

      const orientation = detectPrincipalOrientation(projLandscape, frame.width, frame.height);
      assert.equal(orientation.orientation, "landscape");
      assert.equal(orientation.recommendedFirstEdge, "long");

      const match = computeUnwarpedAspectRatio(projLandscape, frame.width, frame.height);
      assert.equal(match.suggestedStandard, "short");
      assert.equal(match.detectedOrientation, "landscape");
      assert.equal(match.recommendedFirstEdge, "long");

      // Verify canonical dimensions assignment
      const canonical = CANONICAL_PAPER_DIMENSIONS_MM.short;
      const horizontalAxisMm = match.detectedOrientation === "landscape" ? canonical.longMm : canonical.shortMm;
      const verticalAxisMm = match.detectedOrientation === "landscape" ? canonical.shortMm : canonical.longMm;

      assert.equal(horizontalAxisMm, 279.4);
      assert.equal(verticalAxisMm, 215.9);
    });
  });

  describe("QAD-TC75.3: User manual orientation toggle (Swap Width / Height)", () => {
    it("cleanly swaps width and height callouts when user toggles first edge correspondence", () => {
      const paperCorners = project(rect(0, 0, 210, 297), yaw30Camera);
      const openingCorners = project(rect(500, 400, 1500, 1200), yaw30Camera);

      // Reference configured with firstEdge: "short" (top edge corresponds to 210mm)
      const refShort = createMetricReference(frame, paperCorners, "a4", "short");
      assert.ok(refShort.valid);
      const evalShort = evaluateMetricOpening(refShort.reference, openingCorners, frame);
      assert.ok(evalShort.valid);

      // Reference configured with firstEdge: "long" (top edge corresponds to 297mm)
      const refLong = createMetricReference(frame, paperCorners, "a4", "long");
      assert.ok(refLong.valid);
      const evalLong = evaluateMetricOpening(refLong.reference, openingCorners, frame);
      assert.ok(evalLong.valid);

      // Toggling orientation must cleanly transpose width and height
      const ratioShortW = evalShort.widthMm;
      const ratioShortH = evalShort.heightMm;
      const ratioLongW = evalLong.widthMm;
      const ratioLongH = evalLong.heightMm;

      // The orthogonal swap transforms axes: W_long corresponds to H_short * scaleFactor
      assert.ok(
        Math.abs(ratioShortW - 1500) / 1500 < 0.01,
        `Width under short firstEdge should be ~1500mm, got ${ratioShortW}`
      );
      assert.ok(
        Math.abs(ratioShortH - 1200) / 1200 < 0.01,
        `Height under short firstEdge should be ~1200mm, got ${ratioShortH}`
      );

      // Under long firstEdge, the axes are rotated 90 degrees
      assert.ok(
        Math.abs(ratioLongW - (1500 * (297 / 210))) / (1500 * (297 / 210)) < 0.01,
        `Width under long firstEdge scaled correctly`
      );
      assert.ok(
        ratioLongH > 0 && Math.abs(ratioLongH - (1200 * (210 / 297))) / (1200 * (210 / 297)) < 0.01,
        `Height under long firstEdge scaled correctly`
      );
    });
  });

  describe("QAD-TC75.4: Real opening width and height accuracy within +/- 2.0%", () => {
    it("measures a 1500mm x 1200mm opening within +/- 2.0% relative error", () => {
      // Physical setup:
      // Paper reference: A4 (210 x 297 mm) at origin
      // Opening: 1500mm width x 1200mm height
      const paperWorld = rect(0, 0, 210, 297);
      const openingWorld = rect(800, 500, 1500, 1200);

      const paperProj = project(paperWorld, yaw30Camera);
      const openingProj = project(openingWorld, yaw30Camera);

      const refResult = createMetricReference(frame, paperProj, "a4", "short");
      assert.ok(refResult.valid, "Metric reference creation should succeed");

      const openingResult = evaluateMetricOpening(refResult.reference, openingProj, frame);
      assert.ok(openingResult.valid, "Metric opening evaluation should succeed");

      const widthErrorPct = Math.abs(openingResult.widthMm - 1500) / 1500;
      const heightErrorPct = Math.abs(openingResult.heightMm - 1200) / 1200;

      // Acceptance criterion: relative error <= 2.0%
      assert.ok(
        widthErrorPct <= 0.02,
        `Width relative error ${(widthErrorPct * 100).toFixed(2)}% must be <= 2.0% (measured: ${openingResult.widthMm.toFixed(1)}mm)`
      );
      assert.ok(
        heightErrorPct <= 0.02,
        `Height relative error ${(heightErrorPct * 100).toFixed(2)}% must be <= 2.0% (measured: ${openingResult.heightMm.toFixed(1)}mm)`
      );
    });
  });

  describe("QAD-TC75.5: Standard change invalidation and update", () => {
    it("updates height by +18.18% when switching from Short to Long Bond and recalculates atomically", () => {
      // Paper quadrilateral in perspective
      const paperProj = project(rect(0, 0, 215.9, 279.4), yaw30Camera);
      const openingProj = project(rect(600, 400, 1200, 1000), yaw30Camera);

      // Short Bond reference
      const refShort = createMetricReference(frame, paperProj, "short", "short");
      assert.ok(refShort.valid);
      const evalShort = evaluateMetricOpening(refShort.reference, openingProj, frame);
      assert.ok(evalShort.valid);

      // Long Bond reference with same physical quadrilateral
      const refLong = createMetricReference(frame, paperProj, "long", "short");
      assert.ok(refLong.valid);
      const evalLong = evaluateMetricOpening(refLong.reference, openingProj, frame);
      assert.ok(evalLong.valid);

      // Expected vertical scaling ratio: Long height (330.2mm) / Short height (279.4mm)
      const expectedRatio = 330.2 / 279.4; // 1.181818... (+18.18%)
      const observedHeightRatio = evalLong.heightMm / evalShort.heightMm;

      assert.ok(
        Math.abs(observedHeightRatio - expectedRatio) < 1e-4,
        `Height must scale by exactly Long/Short ratio ${expectedRatio.toFixed(4)}, observed: ${observedHeightRatio.toFixed(4)}`
      );

      // Width remains governed by 215.9mm on both Short and Long
      const observedWidthRatio = evalLong.widthMm / evalShort.widthMm;
      assert.ok(
        Math.abs(observedWidthRatio - 1.0) < 1e-4,
        `Width must remain identical (ratio 1.0) as both standards share 215.9mm short dimension, observed: ${observedWidthRatio.toFixed(4)}`
      );
    });
  });

  describe("QAD-TC75.6: Quotation provenance persistence", () => {
    it("persists planar_paper_estimate dimensionSource, click_guided referenceSource, and paper standard", () => {
      const paperProj = project(rect(0, 0, 210, 297), yaw30Camera);
      const openingProj = project(rect(500, 500, 1500.25, 1200.75), yaw30Camera);

      const refResult = createMetricReference(frame, paperProj, "a4", "short", 1, "front-wall");
      assert.ok(refResult.valid);

      const metadata: CalibrationMetadata = {
        mode: "paper_fiducial",
        paperStandard: "a4",
        suggested_paper_standard: "a4",
        aspect_ratio_match_confidence: 0.985,
        unwarped_aspect_ratio: 1.414,
        status: "verified_calibrated",
        confidence: 0.985,
        paperStandardConfirmed: true,
        samePlaneConfirmed: true,
        referenceSource: "click_guided",
        metricReference: refResult.reference,
        placementReview: {
          version: "plane-placement-v1",
          assessment: "user_confirmed_same_plane",
          riskReasons: [],
          targetPlaneId: "front-wall",
        },
      };

      const normalizedCorners = normalizeCorners(openingProj, frame.width, frame.height);
      const initialConfig: ProductConfigurationSnapshot = {
        widthCm: 150,
        heightCm: 120,
        quantity: 1,
        thicknessMm: 6,
        aluminumFinish: "white",
        glassAppearance: "clear",
        includeSill: true,
        yaw: 0,
        pitch: 0,
        rotateAngle: 0,
        isFlipped: false,
        targetPlaneId: "front-wall",
        perspectiveFitCorners: normalizedCorners,
        visualParameterValues: {},
      };

      // Recalculate metric configuration from calibration metadata
      const updatedConfig = recalculateMetricConfiguration(
        initialConfig,
        refResult.reference,
        frame,
        metadata
      );

      assert.ok(
        Math.abs(updatedConfig.widthCm * 10 - 1500.25) < 2.0,
        "Recalculated configuration preserves millimeter precision"
      );

      // Create measurement record and quotation measurement
      const record = createMeasurementRecord(metadata, normalizedCorners, frame, "front-wall");
      assert.ok(record, "Measurement record must be created");
      assert.equal(record.reference_source, "click_guided");
      assert.equal(record.paper_standard, "a4");

      const quotationDetails = quotationMeasurement(updatedConfig);
      assert.equal(quotationDetails.dimensionSource, "planar_paper_estimate");

      // Verify draft quotation schema validation
      const draftPayload = {
        schemaVersion: 1,
        customer: { name: "Test Client", phone: null, email: null, siteLocation: null },
        projectName: "Living Room Window",
        hasSill: true,
        structuralWaiver: false,
        items: [
          {
            itemId: "item-qad-tc75",
            productId: "prod-window-1",
            productName: "Sliding Window",
            productType: "Window",
            variantName: "Standard",
            specificationSummary: "Series 798 2-Track White",
            dimensionsFormatted: `${(updatedConfig.widthCm).toFixed(1)}cm x ${(updatedConfig.heightCm).toFixed(1)}cm`,
            widthMm: updatedConfig.widthCm * 10,
            heightMm: updatedConfig.heightCm * 10,
            panelCount: 2,
            hasSill: true,
            structuralWaiver: false,
            finishLabel: "White",
            glassLabel: "Clear",
            quantity: 1,
            unitPrice: 5000,
            calculatedSubtotal: 5000,
            imageSource: null,
            groups: [
              {
                groupName: "Frame",
                description: "Aluminum profile",
                quantity: 1,
                unit: "pc",
                unitPrice: 5000,
                subtotal: 5000,
              },
            ],
            ...quotationDetails,
          },
        ],
        pricing: {
          directMaterialsSubtotal: 3500,
          laborSubtotal: 1000,
          contractorMargin: 500,
          calculatedFinalPrice: 5000,
        },
      };

      const parsedQuotation = QuotationDocumentDraftV1Schema.parse(draftPayload);
      assert.equal(parsedQuotation.items[0].dimensionSource, "planar_paper_estimate");
      assert.ok(parsedQuotation.items[0].widthMm > 1400);
      assert.ok(parsedQuotation.items[0].heightMm > 1100);
    });
  });
});
