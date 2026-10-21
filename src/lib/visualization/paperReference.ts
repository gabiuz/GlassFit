/** IMP-MS53: review is required before a localized boundary becomes a reference. */
import type { SpaceImageSession } from "../imageApi";
import type { FiducialPaperStandard, PaperCalibrationResult, PaperReferenceSource, Point2D, PaperCandidateRecord } from "./types";
import { computeScaleFromPaperCorners } from "./scaleEstimation";
import { isValidQuadrilateral } from "./perspectiveTransform";
import { createMetricReference } from "./metricGeometry";

export type { PaperCandidateRecord };

export interface PaperReviewResult {
  placementAssessment?: import("./planeEligibility").PlacementAssessment;
  placementRiskReasons?: import("./planeEligibility").PlacementRisk[];
  firstEdge?: "short" | "long";
  orientationConfirmed?: boolean;
  scaleCmPerPx: number;
  confidence: number;
  referenceSource?: PaperReferenceSource;
  selectedCandidateId?: string | null;
  paperStandardConfirmed?: boolean;
  samePlaneConfirmed?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export interface ClickGuidedDetectionRequest {
  seedPoint: { x: number; y: number };
  paperStandard?: "short" | "a4" | "long" | "auto";
}

export interface ClickGuidedDetectionResponse {
  outcome: "candidate_found" | "ambiguous" | "not_found";
  candidate: import("./types").PaperCandidate | null;
  rejectionReasons: string[];
}

function distanceToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function isPointInsideOrNearPolygon(
  point: Point2D,
  polygon: Point2D[],
  tolerancePx: number = 12,
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  if (inside) return true;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (distanceToSegment(point, polygon[i], polygon[j]) <= tolerancePx) {
      return true;
    }
  }
  return false;
}

export function findSeedEnclosingCandidate(
  candidates: import("./types").PaperCandidate[],
  seedPoint: Point2D,
  diagonal: number,
): import("./types").PaperCandidate | null {
  const tolerance = Math.max(12, 0.015 * diagonal);
  for (const candidate of candidates) {
    if (candidate.rejection_reasons.includes("cropped_boundary")) continue;
    const pts = candidate.corners.map(([x, y]) => ({ x, y }));
    if (isPointInsideOrNearPolygon(seedPoint, pts, tolerance)) {
      return candidate;
    }
  }
  return null;
}

function buildCompatibleImageFile(
  blob: Blob,
  fallbackUrl?: string,
): File {
  let mimeType = (blob.type || "").toLowerCase().trim();
  let extension = ".png";

  if (mimeType === "image/webp") {
    extension = ".webp";
  } else if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    extension = ".jpg";
    mimeType = "image/jpeg";
  } else if (mimeType === "image/png") {
    extension = ".png";
  } else if (mimeType === "image/heic") {
    extension = ".heic";
  } else if (mimeType === "image/heif") {
    extension = ".heif";
  } else if (fallbackUrl) {
    const pathname = fallbackUrl.split("?")[0].toLowerCase();
    if (pathname.endsWith(".webp")) {
      extension = ".webp";
      mimeType = "image/webp";
    } else if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
      extension = ".jpg";
      mimeType = "image/jpeg";
    } else if (pathname.endsWith(".heic")) {
      extension = ".heic";
      mimeType = "image/heic";
    } else if (pathname.endsWith(".heif")) {
      extension = ".heif";
      mimeType = "image/heif";
    } else {
      extension = ".png";
      mimeType = "image/png";
    }
  } else {
    mimeType = "image/png";
    extension = ".png";
  }

  return new File([blob], `workspace${extension}`, { type: mimeType });
}

export async function requestClickGuidedPaperDetection(
  imageSource: File | Blob | string,
  seedPoint: { x: number; y: number },
  paperStandard?: FiducialPaperStandard | "auto",
  signal?: AbortSignal,
): Promise<ClickGuidedDetectionResponse> {
  const { analyzeImage } = await import("../imageApi");
  let file: File;
  if (typeof imageSource === "string") {
    const res = await fetch(imageSource, { signal });
    const blob = await res.blob();
    file = buildCompatibleImageFile(blob, imageSource);
  } else if (imageSource instanceof File) {
    file = imageSource;
  } else {
    file = buildCompatibleImageFile(imageSource);
  }

  const standard = paperStandard === "auto" || !paperStandard ? undefined : paperStandard;
  const session = await analyzeImage(
    file,
    { mode: "paper_fiducial", paperStandard: standard, seedPoint },
    signal,
  );

  const paperCalib = session.paperCalibration;
  const outcome = paperCalib?.detection_outcome ?? "not_found";
  const selected = paperCalib?.candidates?.find((c) => c.id === paperCalib.selected_candidate_id) ?? null;
  return {
    outcome,
    candidate: selected,
    rejectionReasons: paperCalib?.rejection_reasons ?? (outcome === "not_found" ? ["seed_point_outside_valid_boundary"] : []),
  };
}

export function validatePaperDetection(value: unknown, width: number, height: number, imageId?: string): PaperCalibrationResult {
  const fallback: PaperCalibrationResult = {
    status: "manual_pin_required", paper_standard: null, paper_standard_confirmed: false,
    detected_corners: null, scale_cm_per_px: null, confidence: 0, homography_matrix: null,
    detection_outcome: "not_found", candidates: [], selected_candidate_id: null,
    reference_source: null, coordinate_space: "workspace", image_width: width, image_height: height,
    rejection_reasons: [],
  };
  if (!isRecord(value) || value.coordinate_space !== "workspace" ||
      value.image_width !== width || value.image_height !== height ||
      !["candidate_found", "ambiguous", "not_found"].includes(String(value.detection_outcome)) ||
      !Array.isArray(value.candidates) || value.candidates.length > 8) return fallback;
  const mapping = value.oriented_source_to_workspace;
  const hasFrameContract = value.geometry_contract_version !== undefined;
  if (hasFrameContract && (value.geometry_contract_version !== "paper-plane-mm-v1" ||
    typeof value.coordinate_image_id !== "string" || (imageId && value.coordinate_image_id !== imageId) ||
    !Array.isArray(mapping) || mapping.length !== 3 ||
    !mapping.every(row => Array.isArray(row) && row.length === 3 && row.every(finite)))) return fallback;
  const candidates: NonNullable<PaperCalibrationResult["candidates"]> = [];
  for (const c of value.candidates) {
    if (!isRecord(c) || typeof c.id !== "string" || candidates.some((p) => p.id === c.id) ||
        !finite(c.score) || c.score < 0 || c.score > 1 || !Array.isArray(c.corners) || c.corners.length !== 4 ||
        !isRecord(c.score_components) || !Object.values(c.score_components).every((v) => finite(v) && v >= 0 && v <= 1) ||
        !Array.isArray(c.rejection_reasons) || !c.rejection_reasons.every((r) => typeof r === "string")) return fallback;
    const corners: [number, number][] = [];
    for (const point of c.corners) {
      if (!Array.isArray(point) || point.length !== 2 || !finite(point[0]) || !finite(point[1]) ||
          point[0] < 0 || point[1] < 0 || point[0] > width || point[1] > height) return fallback;
      corners.push([point[0], point[1]]);
    }
    if (!isValidQuadrilateral(corners.map(([x, y]) => ({ x, y })) as [Point2D, Point2D, Point2D, Point2D])) return fallback;
    candidates.push({ id: c.id, corners, score: c.score,
      score_components: c.score_components as Record<string, number>, rejection_reasons: c.rejection_reasons });
  }
  const selected = candidates.find((c) => c.id === value.selected_candidate_id && c.rejection_reasons.length === 0);
  const accepted = value.detection_outcome === "candidate_found" && Boolean(selected);
  const standard = value.paper_standard === "short" || value.paper_standard === "a4" || value.paper_standard === "long"
    ? value.paper_standard : null;
  const suggestedStandard = value.suggested_paper_standard === "short" || value.suggested_paper_standard === "a4" || value.suggested_paper_standard === "long"
    ? value.suggested_paper_standard : null;
  const matchConfidence = finite(value.aspect_ratio_match_confidence) ? value.aspect_ratio_match_confidence : 0;
  const unwarpedRatio = finite(value.unwarped_aspect_ratio) ? value.unwarped_aspect_ratio : null;
  const refSource = accepted
    ? (value.reference_source === "click_guided"
        ? "click_guided"
        : value.reference_source === "candidate_selected"
        ? "candidate_selected"
        : "auto_detected")
    : null;
  const rejectionReasons = Array.isArray(value.rejection_reasons)
    ? value.rejection_reasons.filter((r): r is string => typeof r === "string")
    : [];
  return { ...fallback, candidates, paper_standard: standard,
    suggested_paper_standard: suggestedStandard,
    aspect_ratio_match_confidence: matchConfidence,
    unwarped_aspect_ratio: unwarpedRatio,
    ...(hasFrameContract ? { geometry_contract_version: "paper-plane-mm-v1" as const,
      coordinate_image_id: value.coordinate_image_id as string,
      oriented_source_to_workspace: mapping as number[][] } : {}),
    paper_standard_confirmed: standard !== null && value.paper_standard_confirmed === true,
    detection_outcome: accepted ? "candidate_found" : candidates.length ? "ambiguous" : "not_found",
    status: accepted ? "detected" : "manual_pin_required",
    selected_candidate_id: accepted ? selected!.id : null,
    reference_source: refSource,
    detected_corners: accepted ? selected!.corners : null, confidence: accepted ? selected!.score : 0,
    rejection_reasons: rejectionReasons };
}

export function confirmPaperReference(session: SpaceImageSession,
  corners: [Point2D, Point2D, Point2D, Point2D], result: PaperReviewResult,
  standard: FiducialPaperStandard): SpaceImageSession {
  if (!result.paperStandardConfirmed || !result.samePlaneConfirmed ||
      (result.placementAssessment && result.placementAssessment !== "user_confirmed_same_plane") ||
      result.placementRiskReasons?.some(r => r !== "person_nearby") || !isValidQuadrilateral(corners)) {
    throw new Error("Confirm the actual paper format and same-plane placement first.");
  }
  if (!result.orientationConfirmed || !result.firstEdge) throw new Error("Confirm the physical side of edge 1 to 2.");
  const geometry = createMetricReference({ imageId: session.sessionId, width: session.workspaceImage.width,
    height: session.workspaceImage.height }, corners, standard, result.firstEdge,
    (session.calibrationMeta?.metricReference?.revision ?? 0) + 1);
  if (!geometry.valid) throw new Error(geometry.message);
  const scale = computeScaleFromPaperCorners(corners, standard).scaleCmPerPx;
  const meta = {
    mode: "paper_fiducial" as const, paperStandard: standard, status: "verified_calibrated" as const,
    confidence: 0, homographyMatrix: null, metricReference: geometry.reference, detectedCorners: corners.map((p): [number, number] => [p.x, p.y]),
    user_verified: true, verified_corners: corners, verified_scale_cm_per_px: scale,
    referenceSource: result.referenceSource ?? "manual_corners", selectedCandidateId: result.selectedCandidateId ?? null,
    paperStandardConfirmed: true, samePlaneConfirmed: true,
    placementReview: { version: "plane-placement-v1" as const, assessment: "user_confirmed_same_plane" as const,
      riskReasons: result.placementRiskReasons ?? [], targetPlaneId: geometry.reference.planeId },
  };
  const paper: PaperCalibrationResult = {
    ...session.paperCalibration, status: "verified_calibrated", paper_standard: standard,
    paper_standard_confirmed: true, reference_source: meta.referenceSource,
    selected_candidate_id: meta.selectedCandidateId, detected_corners: meta.detectedCorners,
    scale_cm_per_px: scale, confidence: 0, homography_matrix: null, metric_reference: geometry.reference,
    user_verified: true, verified_corners: corners, verified_scale_cm_per_px: scale,
  };
  const signal = { ...(session.scaleEstimation ?? session.scale_estimation),
    reference_confirmed: true, best_scale_cm_per_px: scale, confidence: 0, method: `paper_fiducial_${standard}`, anchors: [],
    exif_focal_length_mm: session.scaleEstimation?.exif_focal_length_mm ?? null,
    exif_focal_length_35mm: session.scaleEstimation?.exif_focal_length_35mm ?? null,
    exif_device_model: session.scaleEstimation?.exif_device_model ?? null };
  return { ...session, calibrationMeta: meta, paperCalibration: paper, paper_calibration: paper,
    scaleEstimation: signal, scale_estimation: signal };
}

export function skipPaperReference(session: SpaceImageSession, review?: PaperReviewResult): SpaceImageSession {
  const signal = { best_scale_cm_per_px: null, confidence: 0, method: "none", anchors: [],
    exif_focal_length_mm: null, exif_focal_length_35mm: null, exif_device_model: null };
  return { ...session, paperCalibration: undefined, paper_calibration: undefined,
    scaleEstimation: signal, scale_estimation: signal,
    calibrationMeta: { mode: "paper_fiducial", paperStandard: null, status: "heuristic_fallback", confidence: 0,
      homographyMatrix: null, detectedCorners: null, user_verified: false,
      verified_corners: null, verified_scale_cm_per_px: null, paperStandardConfirmed: false,
      samePlaneConfirmed: false, selectedCandidateId: null,
      placementReview: { version: "plane-placement-v1", assessment: review?.placementAssessment ?? "unknown",
        riskReasons: review?.placementRiskReasons ?? [], targetPlaneId: null } } };
}
