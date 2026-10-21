import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMetricReference, evaluateMetricOpening, displayToWorkspace, type Matrix3, type MetricReference } from "../../src/lib/visualization/metricGeometry";
import { confirmPaperReference } from "../../src/lib/visualization/paperReference";
import { computeEstimatedDimensions, getScaleAwareInitialDimensions, recalculateMetricConfiguration } from "../../src/lib/visualization/scaleEstimation";
import { normalizeCorners, denormalizeCorners } from "../../src/lib/visualization/perspectiveTransform";
import type { QuadrilateralCorners, ProductConfigurationSnapshot } from "../../src/lib/visualization/types";
import type { SpaceImageSession } from "../../src/lib/imageApi";

const rect = (x:number,y:number,w:number,h:number): QuadrilateralCorners => [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const project = (q:QuadrilateralCorners,h:Matrix3):QuadrilateralCorners => q.map(p => ({
  x:(h[0]*p.x+h[1]*p.y+h[2])/(h[6]*p.x+h[7]*p.y+h[8]),
  y:(h[3]*p.x+h[4]*p.y+h[5])/(h[6]*p.x+h[7]*p.y+h[8]),
})) as QuadrilateralCorners;
const camera:Matrix3=[1.5,0.2,500,0.1,1.6,450,0.00025,0.00015,1];
const frame={imageId:"room-54",width:4000,height:3000};
function reference(paper=project(rect(0,0,210,297),camera),firstEdge:"short"|"long"="short"):MetricReference {
  const result=createMetricReference(frame,paper,"a4",firstEdge);
  if (!result.valid) throw new Error(result.message);
  return result.reference;
}
const near=(actual:number,expected:number) => assert.ok(Math.abs(actual-expected)/expected <= 1e-6, `${actual} vs ${expected}`);

describe("IMP-MS54 / QAD-TC69 metric plane geometry", () => {
  it("recovers a known perspective opening at several positions without scalar position bias", () => {
    const ref=reference();
    for (const [x,y] of [[0,0],[500,200],[1200,700]]) {
      const m=evaluateMetricOpening(ref,project(rect(x,y,950.1234,1250.5678),camera),frame);
      assert.equal(m.valid,true);
      if (!m.valid) continue;
      near(m.widthMm,950.1234); near(m.heightMm,1250.5678);
      near(m.edgesMm.top,950.1234); near(m.edgesMm.right,1250.5678);
      assert.equal(m.sensitivity.validated,false);
    }
  });
  it("preserves coordinate identity under anisotropic resize, crop, and rotation", () => {
    const paper=project(rect(0,0,210,297),camera), opening=project(rect(350,250,1000,850),camera);
    const mappings:Matrix3[]=[[0.6,0,-100,0,0.8,-120,0,0,1],[0,-0.5,1800,0.7,0,40,0,0,1]];
    for (const transform of mappings) {
      const m=evaluateMetricOpening(reference(project(paper,transform)),project(opening,transform),frame);
      assert.equal(m.valid,true);
      if (m.valid) { near(m.widthMm,1000); near(m.heightMm,850); }
    }
  });
  it("removes letterboxing, pan, zoom, and DPR before projecting and preserves normalized storage", () => {
    const opening=project(rect(300,250,1000,850),camera);
    for (const dpr of [1,2,3]) {
      const content={left:50*dpr,top:80*dpr,width:1200*dpr,height:900*dpr};
      const display=opening.map(p => ({x:p.x/frame.width*content.width+content.left,y:p.y/frame.height*content.height+content.top})) as QuadrilateralCorners;
      const points=displayToWorkspace(display,content,frame);
      const restored=denormalizeCorners(normalizeCorners(points,frame.width,frame.height),frame.width,frame.height);
      const m=evaluateMetricOpening(reference(),restored,frame);
      assert.equal(m.valid,true);
      if(m.valid) { near(m.widthMm,1000); near(m.heightMm,850); }
    }
  });
  it("uses explicit landscape side correspondence", () => {
    const paper=project(rect(0,0,297,210),camera);
    const opening=project(rect(200,200,900,1000),camera);
    const m=evaluateMetricOpening(reference(paper,"long"),opening,frame);
    assert.equal(m.valid,true);
    if(m.valid) { near(m.widthMm,900); near(m.heightMm,1000); }
  });
  it("rejects malformed, duplicate, crossed, off-image, collinear, and tiny paper", () => {
    const inputs=[rect(1,1,0,20),rect(1,1,0.01,0.01),rect(-1,1,210,297),
      [{x:0,y:0},{x:10,y:10},{x:20,y:20},{x:30,y:30}],
      [{x:0,y:0},{x:210,y:297},{x:210,y:0},{x:0,y:297}],rect(NaN,0,210,297)] as QuadrilateralCorners[];
    for(const q of inputs) assert.equal(createMetricReference(frame,q,"a4","short").valid,false);
  });
  it("rejects horizon crossings between the reference and opening", () => {
    const ref=reference(rect(0,0,210,297));
    // The observed trapezoid defines a horizon on the right, outside the reference.
    const h:Matrix3=[1,0,100,0,1,100,0.002,0,1];
    const r=reference(project(rect(0,0,210,297),h));
    assert.equal(evaluateMetricOpening(r,rect(600,200,300,300),frame).valid,false);
    assert.equal(evaluateMetricOpening(ref,rect(Infinity,1,20,20),frame).valid,false);
  });
  it("rejects inconsistent metric edges and non-right angles", () => {
    const r=reference(rect(0,0,210,297));
    const m=evaluateMetricOpening(r,[{x:100,y:100},{x:1500,y:100},{x:1000,y:1000},{x:100,y:1000}],frame);
    assert.equal(m.valid,false);
    if(!m.valid) assert.equal(m.reason,"non_rectangular");
  });
  it("rejects excessive extrapolation sensitivity from a tiny distant reference", () => {
    const r=reference(rect(100,100,12,17));
    const m=evaluateMetricOpening(r,rect(500,500,1000,1416.6666666667),frame);
    assert.equal(m.valid,false);
    if(!m.valid) assert.equal(m.reason,"excessive_sensitivity");
  });
  it("does not clamp an out-of-fabrication-range physical measurement", () => {
    const bigFrame={...frame,width:200000,height:200000};
    const r=createMetricReference(bigFrame,rect(100,100,2100,2970),"a4","short");
    assert.equal(r.valid,true);
    if(!r.valid) return;
    const m=evaluateMetricOpening(r.reference,rect(100,100,80000,90000),bigFrame);
    assert.equal(m.valid,true);
    if(m.valid) { near(m.widthMm,8000); near(m.heightMm,9000); }
  });
  it("rejects stale image identity, legacy cm matrices, and invalid policies", () => {
    const r=reference();
    assert.equal(evaluateMetricOpening(r,rect(100,100,200,300),{...frame,imageId:"other"}).valid,false);
    assert.equal(evaluateMetricOpening({...r,version:"legacy-cm"} as unknown as MetricReference,rect(100,100,200,300),frame).valid,false);
    assert.equal(evaluateMetricOpening(r,rect(100,100,200,300),frame,{localizationUncertaintyPx:NaN,maxEdgeDisagreement:1,maxAngleCosine:1,maxRelativeSensitivity:1}).valid,false);
  });
  it("manual and automatic review produce identical geometry and increment revisions", () => {
    const session={sessionId:frame.imageId,workspaceImage:{url:"room.webp",width:frame.width,height:frame.height}} as SpaceImageSession;
    const paper=project(rect(0,0,210,297),camera);
    const review={scaleCmPerPx:999,confidence:1,paperStandardConfirmed:true,samePlaneConfirmed:true,firstEdge:"short" as const,orientationConfirmed:true};
    const auto=confirmPaperReference(session,paper,{...review,referenceSource:"auto_detected"},"a4");
    const manual=confirmPaperReference(auto,paper,{...review,referenceSource:"manual_corners"},"a4");
    assert.deepEqual(auto.calibrationMeta?.metricReference?.matrix,manual.calibrationMeta?.metricReference?.matrix);
    assert.equal(manual.calibrationMeta?.metricReference?.revision,2);
    assert.throws(() => confirmPaperReference(session,paper,{...review,orientationConfirmed:false},"a4"));
  });
  it("scalar-only paper signals cannot establish metric measurements or size previews", () => {
    const signal={best_scale_cm_per_px:0.045,confidence:1,method:"paper_fiducial_a4",anchors:[],exif_focal_length_mm:null,exif_focal_length_35mm:null,exif_device_model:null};
    assert.equal(computeEstimatedDimensions(2000,2400,signal,false,150,null).method,"default_heuristic");
    assert.deepEqual(getScaleAwareInitialDimensions(signal,120,150,1000,1000,1000,1000,4000,3000),{widthCm:120,heightCm:150,method:"default_fallback"});
  });
  it("recalculates saved openings through the same evaluator and invalidates prior acceptance on failure", () => {
    const config:ProductConfigurationSnapshot={widthCm:120,heightCm:150,thicknessMm:6,quantity:1,
      aluminumFinish:"white",glassAppearance:"clear",includeSill:true,yaw:0,pitch:0,rotateAngle:0,isFlipped:false,
      visualParameterValues:{},perspectiveFitCorners:normalizeCorners(project(rect(300,200,950.1234,1200.5678),camera),frame.width,frame.height)};
    const reviewed = confirmPaperReference({sessionId:frame.imageId,workspaceImage:{url:"room.webp",width:frame.width,height:frame.height}} as SpaceImageSession,
      reference().paperCorners, {scaleCmPerPx:0,confidence:0,paperStandardConfirmed:true,samePlaneConfirmed:true,
        firstEdge:"short",orientationConfirmed:true,placementAssessment:"user_confirmed_same_plane"},"a4");
    config.targetPlaneId = reviewed.calibrationMeta!.metricReference!.planeId;
    const measured=recalculateMetricConfiguration(config,reviewed.calibrationMeta!.metricReference,frame,reviewed.calibrationMeta);
    near(measured.widthCm,95.01234); near(measured.heightCm,120.05678);
    assert.equal(measured.visualParameterValues.dimension_source,"planar_paper_estimate");
    assert.ok(measured.visualParameterValues.metric_measurement);
    const stale=recalculateMetricConfiguration(measured,null,frame);
    assert.equal(stale.widthCm,measured.widthCm);
    assert.equal(stale.visualParameterValues.dimension_source,"heuristic");
    assert.equal(stale.visualParameterValues.metric_measurement,null);
    const preview=recalculateMetricConfiguration({...config,perspectiveFitCorners:null},reference(),frame);
    assert.equal(preview.widthCm,120);
    assert.equal(preview.visualParameterValues.dimension_source,"heuristic");
  });
});
