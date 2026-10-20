import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PaperDetectionConfirmationModal } from "../../src/features/visualization/components/PaperDetectionConfirmationModal";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validatePaperDetection, confirmPaperReference, skipPaperReference } from "../../src/lib/visualization/paperReference";
import { computeEstimatedDimensions } from "../../src/lib/visualization/scaleEstimation";
import type { SpaceImageSession } from "../../src/lib/imageApi";
import type { Point2D } from "../../src/lib/visualization/types";

const corners: [Point2D,Point2D,Point2D,Point2D] = [{x:100,y:100},{x:310,y:100},{x:310,y:397},{x:100,y:397}];
const candidate = { id: "candidate-1", corners: corners.map((p) => [p.x,p.y]), score: 0.9,
  score_components: { boundary_support: 0.95 }, rejection_reasons: [] };
const detection = { coordinate_space: "workspace", image_width: 1024, image_height: 768,
  detection_outcome: "candidate_found", candidates: [candidate], selected_candidate_id: candidate.id,
  paper_standard: null, paper_standard_confirmed: false };
const session = { sessionId:"ms54-test", workspaceImage: {url:"room.webp",width:1024,height:768},
  paperCalibration: validatePaperDetection(detection,1024,768) } as SpaceImageSession;
const review = { scaleCmPerPx: 99, confidence: 0.99, referenceSource: "candidate_selected" as const,
  selectedCandidateId: candidate.id, paperStandardConfirmed: true, samePlaneConfirmed: true, firstEdge: "short" as const, orientationConfirmed: true };

describe("IMP-MS53 / QAD-TC68 reference selection", () => {
  it("renders checkbox-free candidate choices and explicit declarations before allowing confirmation", () => {
    const markup = renderToStaticMarkup(React.createElement(PaperDetectionConfirmationModal, {
      backgroundImageUrl: "room.webp", canvasWidth: 1024, canvasHeight: 768,
      initialCorners: corners, candidates: session.paperCalibration?.candidates,
      selectedCandidateId: candidate.id, status: "detected",
      onConfirm: () => {}, onSkip: () => {}, onCancel: () => {},
    }));
    assert.match(markup, /Boundary evidence/);
    assert.match(markup, /Short Bond/);
    assert.match(markup, /Edge 1-2: Short/);
    assert.match(markup, /Flat on the installation wall/);
    assert.equal((markup.match(/type="checkbox"/g) ?? []).length, 0);
    assert.equal((markup.match(/type="radio"/g) ?? []).length, 0);
    assert.match(markup, /disabled=""/);
    assert.doesNotMatch(markup, /95%|millimeter-accurate/);
  });
  it("keeps a localized unknown format uncalibrated", () => {
    const paper = validatePaperDetection(detection,1024,768);
    assert.equal(paper.status,"detected");
    assert.equal(paper.paper_standard,null);
    assert.equal(paper.paper_standard_confirmed,false);
    assert.equal(paper.scale_cm_per_px,null);
  });
  it("rejects missing, malformed, or mismatched contracts without legacy promotion", () => {
    for (const input of [undefined, {status:"calibrated",scale_cm_per_px:0.1},
      {...detection,coordinate_space:"oriented_source"}, {...detection,image_width:1000},
      {...detection,candidates:[{...candidate,corners:[[0,0],[0,0],[0,0],[0,0]]}]},
      {...detection,candidates:[{...candidate,score:NaN}]}]) {
      assert.equal(validatePaperDetection(input,1024,768).status,"manual_pin_required");
    }
  });
  it("validates coordinate mapping version, shape, and image identity without accepting server metric matrices", () => {
    const mapping = { ...detection, geometry_contract_version: "paper-plane-mm-v1",
      coordinate_image_id: "ms54-test", oriented_source_to_workspace: [[0.5,0,0],[0,0.5,0],[0,0,1]] };
    const accepted = validatePaperDetection(mapping,1024,768,"ms54-test");
    assert.equal(accepted.coordinate_image_id,"ms54-test");
    assert.equal(accepted.homography_matrix,null);
    for (const invalid of [{...mapping,geometry_contract_version:"legacy-cm"},
      {...mapping,coordinate_image_id:"other"}, {...mapping,oriented_source_to_workspace:[[NaN]]}]) {
      assert.equal(validatePaperDetection(invalid,1024,768,"ms54-test").status,"manual_pin_required");
    }
  });
  it("requires explicit selection for ambiguous outlines", () => {
    const paper = validatePaperDetection({...detection,detection_outcome:"ambiguous",selected_candidate_id:null},1024,768);
    assert.equal(paper.detected_corners,null);
    assert.equal(paper.selected_candidate_id,null);
    assert.equal(paper.candidates?.length,1);
  });
  it("requires actual format and same-plane declaration", () => {
    assert.throws(() => confirmPaperReference(session,corners,{...review,paperStandardConfirmed:false},"a4"));
    assert.throws(() => confirmPaperReference(session,corners,{...review,samePlaneConfirmed:false},"a4"));
  });
  it("recomputes reviewed geometry, records source, and removes stale transforms", () => {
    const updated = confirmPaperReference(session,corners,review,"a4");
    assert.equal(updated.calibrationMeta?.referenceSource,"candidate_selected");
    assert.equal(updated.calibrationMeta?.selectedCandidateId,candidate.id);
    assert.equal(updated.calibrationMeta?.homographyMatrix,null);
    assert.equal(updated.scaleEstimation?.best_scale_cm_per_px,0.1);
    assert.equal(updated.scaleEstimation?.confidence,0);
    assert.equal(updated.scaleEstimation?.reference_confirmed,true);
    const dimensions = computeEstimatedDimensions(1000,1200,updated.scaleEstimation,false,120,null);
    assert.equal(dimensions.widthCm,100);
    assert.equal(dimensions.heightCm,120);
    assert.equal(dimensions.method,"default_heuristic");
    assert.equal(updated.calibrationMeta?.metricReference?.version,"paper-plane-mm-v1");
  });
  it("paper format or manual correction replaces prior geometry on both aliases", () => {
    const first = confirmPaperReference(session,corners,review,"a4");
    const revised = confirmPaperReference(first,corners,{...review,referenceSource:"manual_corners",selectedCandidateId:null},"long");
    assert.notEqual(first.scaleEstimation?.best_scale_cm_per_px,revised.scaleEstimation?.best_scale_cm_per_px);
    assert.equal(revised.paperCalibration,revised.paper_calibration);
    assert.equal(revised.paperCalibration?.reference_source,"manual_corners");
    assert.equal(revised.paperCalibration?.selected_candidate_id,null);
    assert.equal(revised.calibrationMeta?.homographyMatrix,null);
  });
  it("skip cannot retain a rejected reference in either alias or scale signal", () => {
    const updated = skipPaperReference(confirmPaperReference(session,corners,review,"a4"));
    assert.equal(updated.paperCalibration,undefined);
    assert.equal(updated.paper_calibration,undefined);
    assert.equal(updated.scaleEstimation?.best_scale_cm_per_px,null);
    assert.equal(updated.scale_estimation?.best_scale_cm_per_px,null);
    assert.equal(updated.calibrationMeta?.user_verified,false);
    assert.equal(updated.calibrationMeta?.verified_scale_cm_per_px,null);
  });
});
