/** IMP-MS55 / PRD-F6 / PRD-F10 / SDD-C5 / QAD-TC70. Placement is a user declaration, not accuracy validation. */
import type { CalibrationMetadata, ProductConfigurationSnapshot, QuadrilateralCorners } from "./types";
import { evaluateMetricOpening, type MetricFrame, type MetricMeasurement } from "./metricGeometry";
import { denormalizeCorners } from "./perspectiveTransform";

export type PlacementAssessment = "unknown" | "user_confirmed_same_plane" | "mismatch_reported";
export type PlacementRisk = "handheld_or_offset" | "adjacent_surface" | "unknown_offset" | "occluded_boundary" | "warped_paper" | "person_nearby";
export interface PlacementReview {
  version: "plane-placement-v1";
  assessment: PlacementAssessment;
  riskReasons: PlacementRisk[];
  targetPlaneId: string | null;
}
export type MetricEligibility = "needs_size" | "needs_placement_confirmation" | "geometry_invalid" | "plane_mismatch" | "eligible_planar_estimate";
export interface EligibilityResult {
  status: MetricEligibility;
  message: string;
  measurement?: MetricMeasurement;
}

/** Ignore legacy badges and samePlaneConfirmed. Only the explicit versioned declaration applies. */
export function evaluatePlaneEligibility(meta: CalibrationMetadata | null | undefined,
  targetPlaneId: string | null | undefined, opening?: QuadrilateralCorners | null, frame?: MetricFrame): EligibilityResult {
  const placement = meta?.placementReview;
  const risks = placement?.riskReasons;
  if (placement?.version === "plane-placement-v1" &&
    (placement.assessment === "mismatch_reported" || (Array.isArray(risks) &&
      risks.some(r => ["handheld_or_offset", "adjacent_surface", "warped_paper", "occluded_boundary"].includes(r))))) {
    return { status: "plane_mismatch", message: "Paper placement cannot measure this opening. Retake with a flat sheet on the installation plane, enter both tape dimensions, or continue an approximate preview." };
  }
  if (meta?.paperStandardConfirmed !== true || !["short", "a4", "long"].includes(meta.paperStandard ?? "")) {
    return { status: "needs_size", message: "Confirm the actual paper format and physical short or long edge." };
  }
  if (placement?.version !== "plane-placement-v1" || placement.assessment !== "user_confirmed_same_plane" ||
    !Array.isArray(risks) || risks.some(r => r !== "person_nearby") ||
    typeof placement.targetPlaneId !== "string" || !placement.targetPlaneId || typeof targetPlaneId !== "string" || !targetPlaneId) {
    return { status: "needs_placement_confirmation", message: "Confirm that the paper was flat against this opening's installation surface." };
  }
  if (placement.targetPlaneId !== targetPlaneId) {
    return { status: "plane_mismatch", message: "This opening uses another plane. Review its reference or enter both tape dimensions." };
  }
  const reference = meta.metricReference;
  if (!reference || reference.paperStandard !== meta.paperStandard || !frame) {
    return { status: "geometry_invalid", message: "Review the reference geometry for this image." };
  }
  if (reference.planeId !== targetPlaneId) {
    return { status: "plane_mismatch", message: "Review the paper reference for this opening's installation plane." };
  }
  const measurement = evaluateMetricOpening(reference, opening ?? reference.paperCorners, frame);
  if (!measurement.valid) return { status: "geometry_invalid", message: measurement.message };
  return { status: "eligible_planar_estimate", message: "Photo estimate using user-declared same-plane placement. Physical accuracy is not independently validated.", measurement };
}

/** Recheck quotation and restored records against current image geometry, never a stored badge. */
export function evaluateConfigurationEligibility(configuration: ProductConfigurationSnapshot,
  meta: CalibrationMetadata | null | undefined, frame = meta?.metricReference?.frame): EligibilityResult {
  if (!configuration.perspectiveFitCorners || !frame) return { status: "geometry_invalid", message: "Fit the installation perimeter before measuring." };
  const result = evaluatePlaneEligibility(meta, configuration.targetPlaneId ?? (typeof configuration.visualParameterValues.measurement_plane_id === "string" ? configuration.visualParameterValues.measurement_plane_id : null),
    denormalizeCorners(configuration.perspectiveFitCorners, frame.width, frame.height), frame);
  if (result.measurement && (Math.abs(result.measurement.widthMm - configuration.widthCm * 10) > 1e-6 ||
    Math.abs(result.measurement.heightMm - configuration.heightCm * 10) > 1e-6)) {
    return { status: "geometry_invalid", message: "Dimensions no longer match the fitted perimeter. Review the fit or enter both tape dimensions." };
  }
  return result;
}
