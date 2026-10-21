/** IMP-MS54 / SDD-C5 / QAD-TC69. Image boundaries use [0,width] x [0,height]. */
import type { FiducialPaperStandard, Point2D, QuadrilateralCorners } from "./types";
import { PAPER_STANDARD_METRICS } from "./types";
import { computeHomographyMatrix, isValidQuadrilateral } from "./perspectiveTransform";

export type Matrix3 = [number, number, number, number, number, number, number, number, number];
export interface MetricFrame { imageId: string; width: number; height: number }
export interface MetricReference {
  version: "paper-plane-mm-v1";
  direction: "workspace_pixels_to_plane_mm";
  frame: MetricFrame;
  planeId: string;
  revision: number;
  paperStandard: FiducialPaperStandard;
  /** Edge 0->1 corresponds to this explicitly confirmed physical side. */
  firstEdge: "short" | "long";
  paperCorners: QuadrilateralCorners;
  matrix: Matrix3;
}
export interface GeometryPolicy {
  localizationUncertaintyPx: number;
  maxEdgeDisagreement: number;
  maxAngleCosine: number;
  maxRelativeSensitivity: number;
}
/** Provisional engineering rejection gates. MS57 must freeze annotation-derived values. */
export const PROVISIONAL_GEOMETRY_POLICY: GeometryPolicy = {
  localizationUncertaintyPx: 1, maxEdgeDisagreement: 0.1,
  maxAngleCosine: 0.15, maxRelativeSensitivity: 0.1,
};
export type GeometryRejection = "invalid_frame" | "invalid_paper" | "singular_transform" |
  "invalid_opening" | "horizon_crossing" | "non_rectangular" | "excessive_sensitivity" | "invalid_policy";
export type RejectedGeometry = { valid: false; reason: GeometryRejection; message: string };
export interface MetricMeasurement {
  valid: true;
  widthMm: number;
  heightMm: number;
  edgesMm: { top: number; bottom: number; left: number; right: number };
  disagreement: { width: number; height: number; angleCosine: number };
  metricCorners: QuadrilateralCorners;
  sensitivity: { widthRelative: number; heightRelative: number; uncertaintyPx: number; validated: false };
  revision: number;
  planeId: string;
}
export type MetricResult = MetricMeasurement | RejectedGeometry;
const reject = (reason: GeometryRejection, message: string): RejectedGeometry => ({ valid: false, reason, message });
const frameValid = (f: MetricFrame) => Boolean(f.imageId) && Number.isFinite(f.width) && f.width > 0 && Number.isFinite(f.height) && f.height > 0;
const inFrame = (q: QuadrilateralCorners, f: MetricFrame) => Array.isArray(q) && q.length === 4 && q.every(p => p &&
  Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x <= f.width && p.y <= f.height) && isValidQuadrilateral(q);
const dist = (a: Point2D, b: Point2D) => Math.hypot(a.x-b.x, a.y-b.y);

/** Normalize source coordinates before solving to avoid pixel-magnitude conditioning. */
function solve(corners: QuadrilateralCorners, widthMm: number, heightMm: number): Matrix3 | null {
  const cx = corners.reduce((s,p) => s+p.x/4, 0), cy = corners.reduce((s,p) => s+p.y/4, 0);
  const span = Math.max(...corners.map(p => Math.hypot(p.x-cx,p.y-cy)));
  if (!Number.isFinite(span) || span < 1e-6) return null;
  const source = corners.map(p => ({ x:(p.x-cx)/span, y:(p.y-cy)/span })) as QuadrilateralCorners;
  const h = computeHomographyMatrix(source, [{x:0,y:0},{x:widthMm,y:0},{x:widthMm,y:heightMm},{x:0,y:heightMm}]);
  if (!h || !h.every(Number.isFinite)) return null;
  const m: Matrix3 = [h[0]/span,h[1]/span,h[2]-(h[0]*cx+h[1]*cy)/span,
    h[3]/span,h[4]/span,h[5]-(h[3]*cx+h[4]*cy)/span,
    h[6]/span,h[7]/span,h[8]-(h[6]*cx+h[7]*cy)/span];
  const norm = Math.max(...m.map(Math.abs));
  return m.map(v => v/norm) as Matrix3;
}

export function createMetricReference(frame: MetricFrame, corners: QuadrilateralCorners,
  standard: FiducialPaperStandard, firstEdge: "short" | "long", revision = 1,
  planeId = `${frame.imageId}:reference-plane`): { valid: true; reference: MetricReference } | RejectedGeometry {
  if (!frameValid(frame) || !Number.isSafeInteger(revision) || revision < 1 || !planeId) return reject("invalid_frame", "Reopen the workspace image before reviewing the reference.");
  if (!inFrame(corners, frame)) return reject("invalid_paper", "Place four distinct paper corners inside the image in cyclic order.");
  const area = Math.abs(corners.reduce((s,p,i) => s+p.x*corners[(i+1)%4].y-p.y*corners[(i+1)%4].x,0))/2;
  if (area < 4 || corners.some((p,i) => dist(p,corners[(i+1)%4]) < 1)) return reject("invalid_paper", "Use a larger, clearer paper reference.");
  const size = PAPER_STANDARD_METRICS[standard];
  if (!size || !["short","long"].includes(firstEdge)) return reject("invalid_paper", "Confirm the paper format and physical edge correspondence.");
  const matrix = solve(corners, firstEdge === "short" ? size.widthMm : size.heightMm, firstEdge === "short" ? size.heightMm : size.widthMm);
  if (!matrix) return reject("singular_transform", "Retake the image with a less foreshortened reference.");
  return { valid: true, reference: { version:"paper-plane-mm-v1", direction:"workspace_pixels_to_plane_mm",
    frame: {...frame}, planeId, revision, paperStandard: standard, firstEdge,
    paperCorners: corners.map(p => ({...p})) as QuadrilateralCorners, matrix } };
}

/** Shared point projection also rejects a horizon between reference and opening. */
function projectRegion(matrix: Matrix3, points: QuadrilateralCorners, paper: QuadrilateralCorners): QuadrilateralCorners | null {
  const denominators = [...paper,...points].map(p => matrix[6]*p.x+matrix[7]*p.y+matrix[8]);
  const max = Math.max(...denominators.map(Math.abs));
  if (!Number.isFinite(max) || max === 0 || denominators.some(d => !Number.isFinite(d) || Math.abs(d)/max < 1e-8 || Math.sign(d) !== Math.sign(denominators[0]))) return null;
  const out = points.map((p,i) => ({ x:(matrix[0]*p.x+matrix[1]*p.y+matrix[2])/denominators[i+4], y:(matrix[3]*p.x+matrix[4]*p.y+matrix[5])/denominators[i+4] })) as QuadrilateralCorners;
  return out.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)) ? out : null;
}
function spans(p: QuadrilateralCorners) {
  const edgesMm = { top:dist(p[0],p[1]), bottom:dist(p[3],p[2]), left:dist(p[0],p[3]), right:dist(p[1],p[2]) };
  return { edgesMm, widthMm:(edgesMm.top+edgesMm.bottom)/2, heightMm:(edgesMm.left+edgesMm.right)/2 };
}

export function evaluateMetricOpening(reference: MetricReference | null | undefined, opening: QuadrilateralCorners,
  frame: MetricFrame, policy: GeometryPolicy = PROVISIONAL_GEOMETRY_POLICY): MetricResult {
  if (!reference || reference.version !== "paper-plane-mm-v1" || reference.direction !== "workspace_pixels_to_plane_mm" || !reference.frame ||
    !frameValid(frame) || reference.frame.imageId !== frame.imageId || reference.frame.width !== frame.width || reference.frame.height !== frame.height) return reject("invalid_frame", "Review the paper reference for this workspace image.");
  if (!Object.values(policy).every(v => Number.isFinite(v) && v > 0)) return reject("invalid_policy", "Use a positive, finite geometry quality policy.");
  // Rebuild from validated correspondence; never trust a persisted legacy or tampered matrix.
  const rebuilt = createMetricReference(frame,reference.paperCorners,reference.paperStandard,reference.firstEdge,reference.revision,reference.planeId);
  if (!rebuilt.valid) return rebuilt;
  const r = rebuilt.reference;
  if (!inFrame(opening,frame)) return reject("invalid_opening", "Fit all four corners to the installation perimeter inside the photo.");
  const metricCorners = projectRegion(r.matrix,opening,r.paperCorners);
  if (!metricCorners) return reject("horizon_crossing", "Retake the photo: the opening crosses an unstable projective region.");
  const base = spans(metricCorners);
  if (Math.min(...Object.values(base.edgesMm)) < 1e-6) return reject("invalid_opening", "The opening has a near-zero physical edge.");
  const angleCosine = Math.max(...metricCorners.map((p,i) => {
    const a=metricCorners[(i+3)%4], b=metricCorners[(i+1)%4];
    return Math.abs(((a.x-p.x)*(b.x-p.x)+(a.y-p.y)*(b.y-p.y))/(dist(a,p)*dist(b,p)));
  }));
  const disagreement = { width:Math.abs(base.edgesMm.top-base.edgesMm.bottom)/base.widthMm,
    height:Math.abs(base.edgesMm.left-base.edgesMm.right)/base.heightMm, angleCosine };
  if (disagreement.width > policy.maxEdgeDisagreement || disagreement.height > policy.maxEdgeDisagreement || angleCosine > policy.maxAngleCosine) return reject("non_rectangular", "Review the installation perimeter: opposite edges or right angles disagree in the paper plane.");
  let widthRelative=0, heightRelative=0;
  // Deterministic one-coordinate perturbations of all 16 input coordinates, both signs.
  // This is a sensitivity diagnostic, not a confidence interval or accuracy guarantee.
  for (let i=0;i<16;i++) for (const sign of [-1,1]) {
    const paper=r.paperCorners.map(p => ({...p})) as QuadrilateralCorners;
    const target=opening.map(p => ({...p})) as QuadrilateralCorners;
    const points=i<8 ? paper : target;
    points[Math.floor((i%8)/2)][i%2 === 0 ? "x" : "y"] += sign*policy.localizationUncertaintyPx;
    const size=PAPER_STANDARD_METRICS[r.paperStandard];
    const m=solve(paper,r.firstEdge === "short" ? size.widthMm : size.heightMm,r.firstEdge === "short" ? size.heightMm : size.widthMm);
    const projected=m && isValidQuadrilateral(paper) ? projectRegion(m,target,paper) : null;
    if (!projected) return reject("excessive_sensitivity", "Use a larger reference near the opening or enter manual dimensions.");
    const s=spans(projected);
    if (!Number.isFinite(s.widthMm) || !Number.isFinite(s.heightMm)) return reject("excessive_sensitivity", "Retake with a clearer reference near the opening.");
    widthRelative=Math.max(widthRelative,Math.abs(s.widthMm-base.widthMm)/base.widthMm);
    heightRelative=Math.max(heightRelative,Math.abs(s.heightMm-base.heightMm)/base.heightMm);
  }
  if (Math.max(widthRelative,heightRelative) > policy.maxRelativeSensitivity) return reject("excessive_sensitivity", "Corner uncertainty is amplified too much. Retake with a larger reference near the opening or enter manual dimensions.");
  return { valid:true, ...base, metricCorners, disagreement, revision:r.revision, planeId:r.planeId,
    sensitivity:{widthRelative,heightRelative,uncertaintyPx:policy.localizationUncertaintyPx,validated:false} };
}

/** Display points are in image-content pixels after offsets/pan/zoom are removed. */
export function displayToWorkspace(points: QuadrilateralCorners, content: { left:number; top:number; width:number; height:number }, frame: MetricFrame): QuadrilateralCorners {
  return points.map(p => ({ x:(p.x-content.left)*frame.width/content.width, y:(p.y-content.top)*frame.height/content.height })) as QuadrilateralCorners;
}
