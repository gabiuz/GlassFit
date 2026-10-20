import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { evaluatePlaneEligibility, evaluateConfigurationEligibility } from "../../src/lib/visualization/planeEligibility";
import { confirmPaperReference, skipPaperReference } from "../../src/lib/visualization/paperReference";
import { recalculateMetricConfiguration } from "../../src/lib/visualization/scaleEstimation";
import { createMeasurementRecord } from "../../src/lib/visualization/measurementRecord";
import { normalizeCorners } from "../../src/lib/visualization/perspectiveTransform";
import { validateSessionPlaneEligibility } from "../../src/lib/visualization/visualizationSession";
import { PaperDetectionConfirmationModal } from "../../src/features/visualization/components/PaperDetectionConfirmationModal";
import type { CalibrationMetadata, ProductConfigurationSnapshot, QuadrilateralCorners, VisualizationSessionState } from "../../src/lib/visualization/types";
import type { SpaceImageSession } from "../../src/lib/imageApi";

const frame = { imageId: "ms55-room", width: 2000, height: 1800 };
const paper: QuadrilateralCorners = [{x:100,y:100},{x:520,y:100},{x:520,y:694},{x:100,y:694}];
const opening: QuadrilateralCorners = [{x:700,y:100},{x:1500,y:100},{x:1500,y:1100},{x:700,y:1100}];
const session = { sessionId: frame.imageId, workspaceImage: { url:"room.webp", width: frame.width, height: frame.height } } as SpaceImageSession;
const review = { scaleCmPerPx: 0.05, confidence: 0, paperStandardConfirmed: true, samePlaneConfirmed: true,
  firstEdge: "short" as const, orientationConfirmed: true, placementAssessment: "user_confirmed_same_plane" as const };
const confirmed = confirmPaperReference(session, paper, review, "a4");
const meta = confirmed.calibrationMeta!;
const plane = meta.metricReference!.planeId;
const config: ProductConfigurationSnapshot = { widthCm: 40, heightCm: 50, thicknessMm: 6, quantity: 1,
  aluminumFinish: "white", glassAppearance: "clear", includeSill: true, yaw: 0, pitch: 0, rotateAngle: 0, isFlipped: false,
  targetPlaneId: plane, perspectiveFitCorners: normalizeCorners(opening, frame.width, frame.height),
  visualParameterValues: { dimension_source:"heuristic" } };
const evaluate = (m: CalibrationMetadata | null = meta, target: string | null = plane) => evaluatePlaneEligibility(m, target, opening, frame);

describe("IMP-MS55 / QAD-TC70 plane eligibility and recovery", () => {
  it("requires placement separately from corners, size, confidence, and legacy approval", () => {
    for (const m of [null, {...meta,placementReview:undefined}, {...meta,placementReview:{...meta.placementReview!,assessment:"unknown" as const}}]) {
      assert.notEqual(evaluate(m).status,"eligible_planar_estimate");
    }
    assert.equal(evaluate({...meta,confidence:1,user_verified:true,status:"verified_calibrated",placementReview:undefined}).status,"needs_placement_confirmation");
    assert.equal(evaluate({...meta,paperStandardConfirmed:false}).status,"needs_size");
  });
  it("blocks handheld placement even with perfect automatically or manually reviewed corners (70.1-2)", () => {
    for (const source of ["auto_detected","manual_corners"] as const) {
      const mismatch: CalibrationMetadata = {...meta,referenceSource:source,placementReview:{...meta.placementReview!,assessment:"mismatch_reported",riskReasons:["handheld_or_offset"]}};
      assert.equal(evaluate(mismatch).status,"plane_mismatch");
      assert.equal(createMeasurementRecord(mismatch,config.perspectiveFitCorners!,frame,plane),null);
      assert.equal(recalculateMetricConfiguration(config,mismatch.metricReference,frame,mismatch).visualParameterValues.dimension_source,"heuristic");
      assert.throws(() => confirmPaperReference(confirmed,paper,{...review,placementAssessment:"mismatch_reported"},"a4"));
    }
  });
  it("permits an explicitly assigned valid planar estimate (70.3)", () => {
    assert.equal(evaluate().status,"eligible_planar_estimate");
    const fitted = recalculateMetricConfiguration(config,meta.metricReference,frame,meta);
    assert.equal(fitted.widthCm,40); assert.equal(fitted.heightCm,50);
    assert.equal(fitted.visualParameterValues.dimension_source,"planar_paper_estimate");
    assert.equal(evaluateConfigurationEligibility(fitted,meta).status,"eligible_planar_estimate");
  });
  it("person overlap alone is advisory (70.4)", () => {
    assert.equal(evaluate({...meta,placementReview:{...meta.placementReview!,riskReasons:["person_nearby"]}}).status,"eligible_planar_estimate");
    assert.equal(evaluate({...meta,placementReview:{...meta.placementReview!,assessment:"unknown",riskReasons:["person_nearby"]}}).status,"needs_placement_confirmation");
  });
  it("does not assign a reference to an added or different-wall product (70.5)", () => {
    assert.equal(evaluate(meta,null).status,"needs_placement_confirmation");
    assert.equal(evaluate(meta,"other-wall").status,"plane_mismatch");
    const secondary = recalculateMetricConfiguration({...config,targetPlaneId:"other-wall"},meta.metricReference,frame,meta);
    assert.equal(secondary.visualParameterValues.metric_measurement,null);
    assert.equal(secondary.visualParameterValues.dimension_source,"heuristic");
  });
  it("retains both manually supplied dimensions and manual provenance (70.6)", () => {
    const manual = {...config,widthCm:88,heightCm:121,visualParameterValues:{dimension_source:"manual_tape"}};
    const result = recalculateMetricConfiguration(manual,meta.metricReference,frame,meta);
    assert.equal(result.widthCm,88); assert.equal(result.heightCm,121);
    assert.equal(result.visualParameterValues.dimension_source,"manual_tape");
    assert.equal(result.visualParameterValues.calibration_provenance,null);
  });
  it("keeps unsure and skip usable as approximate preview with auditable placement (70.7)", () => {
    const skipped = skipPaperReference(confirmed,{...review,placementAssessment:"mismatch_reported",placementRiskReasons:["handheld_or_offset"]});
    assert.equal(skipped.calibrationMeta?.placementReview?.assessment,"mismatch_reported");
    assert.equal(skipped.scaleEstimation?.best_scale_cm_per_px,null);
    assert.equal(evaluate(skipped.calibrationMeta).status,"plane_mismatch");
    assert.notEqual(evaluate(skipPaperReference(confirmed).calibrationMeta).status,"eligible_planar_estimate");
  });
  it("does not promote curled, occluded, offset, or malformed placement metadata", () => {
    for (const risk of ["warped_paper","occluded_boundary","adjacent_surface","unknown_offset"] as const) {
      assert.notEqual(evaluate({...meta,placementReview:{...meta.placementReview!,riskReasons:[risk]}}).status,"eligible_planar_estimate");
    }
    assert.notEqual(evaluate({...meta,placementReview:{...meta.placementReview!,riskReasons:null} as unknown as NonNullable<CalibrationMetadata["placementReview"]>}).status,"eligible_planar_estimate");
  });
  it("rejects invalid geometry, stale image identity, and changed dimensions", () => {
    assert.equal(evaluatePlaneEligibility(meta,plane,opening,{...frame,imageId:"replaced"}).status,"geometry_invalid");
    assert.equal(evaluatePlaneEligibility(meta,plane,[paper[0],paper[0],paper[0],paper[0]],frame).status,"geometry_invalid");
    assert.equal(evaluateConfigurationEligibility({...config,widthCm:41},meta).status,"geometry_invalid");
  });
  it("invalidates legacy restored records and comparison layers without changing the scene", () => {
    const legacy = {...config,visualParameterValues:{dimension_source:"verified_calibrated_visual",metric_measurement:{valid:true}}};
    const state = {spaceImageSession:{...confirmed,calibrationMeta:{...meta,placementReview:undefined}},
      productConfiguration:legacy,placedOverlays:[{overlayId:"one",configuration:legacy}],comparisonOverlays:[{overlayId:"two",configuration:legacy}]} as unknown as VisualizationSessionState;
    const restored = validateSessionPlaneEligibility(state);
    assert.equal(restored.productConfiguration?.widthCm,40);
    assert.equal(restored.productConfiguration?.visualParameterValues.dimension_source,"heuristic");
    assert.equal(restored.placedOverlays[0].configuration.visualParameterValues.metric_measurement,null);
    assert.equal(restored.comparisonOverlays[0].configuration.visualParameterValues.metric_measurement,null);
  });
  it("offers explicit placement choices, retake, manual recovery guidance, and approximate preview", () => {
    const markup = renderToStaticMarkup(React.createElement(PaperDetectionConfirmationModal,{
      backgroundImageUrl:"room.webp",canvasWidth:frame.width,canvasHeight:frame.height,initialCorners:paper,
      onConfirm:()=>{},onSkip:()=>{},onCancel:()=>{},
    }));
    for (const text of [/Held or offset/,/Unsure/,/Retake Photo/,/both tape-measured/,/Skip Calibration/,/curled/]) assert.match(markup,text);
    assert.equal((markup.match(/type="checkbox"/g) ?? []).length, 0);
    assert.equal((markup.match(/type="radio"/g) ?? []).length, 0);
    assert.match(markup,/disabled=""/);
  });
});
