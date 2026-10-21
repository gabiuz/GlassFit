/** IMP-MS56 / PRD-F6 / SDD-C5, SDD-C7 / QAD-TC71. */
import { z } from "zod";
import { createMetricReference, evaluateMetricOpening, type MetricFrame } from "./metricGeometry";
import { evaluatePlaneEligibility } from "./planeEligibility";
import { denormalizeCorners } from "./perspectiveTransform";
import type { CalibrationMetadata, ProductConfigurationSnapshot, QuadrilateralCorners } from "./types";

const point = z.object({ x: z.number().finite(), y: z.number().finite() });
const corners = z.tuple([point, point, point, point]);
const normalized = corners.refine(q => q.every(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1));
const positive = z.number().finite().positive();
const referenceSchema = z.object({
  version: z.literal("paper-plane-mm-v1"), direction: z.literal("workspace_pixels_to_plane_mm"),
  frame: z.object({ imageId: z.string().min(1), width: positive, height: positive }),
  planeId: z.string().min(1), revision: z.number().int().positive(),
  paperStandard: z.enum(["short", "a4", "long"]), firstEdge: z.enum(["short", "long"]),
  paperCorners: corners,
  matrix: z.tuple(Array.from({ length: 9 }, () => z.number().finite()) as [z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber]),
}).superRefine((r, ctx) => {
  const rebuilt = createMetricReference(r.frame, r.paperCorners, r.paperStandard, r.firstEdge, r.revision, r.planeId);
  if (!rebuilt.valid || r.matrix.some((v, i) => Math.abs(v - rebuilt.reference.matrix[i]) > 1e-9)) {
    ctx.addIssue({ code: "custom", message: "Invalid or corrupted reference transform" });
  }
});

export const StoredMeasurementRecordSchema = z.object({
  version: z.literal(1), measurement_revision: z.string().min(1),
  image_identity: z.string().min(1), image_width_px: positive, image_height_px: positive,
  plane_id: z.string().min(1), calibration_revision: z.number().int().positive(),
  opening_corners: normalized, width_mm: positive, height_mm: positive,
  edge_spans_mm: z.object({ top: positive, bottom: positive, left: positive, right: positive }),
  source: z.literal("planar_paper_estimate"), eligibility: z.literal("eligible_planar_estimate"),
  reason_codes: z.array(z.string()).max(0), reference_source: z.enum(["auto_detected", "candidate_selected", "manual_corners", "click_guided"]),
  paper_standard: z.enum(["short", "a4", "long"]),
  placement_assessment: z.literal("user_confirmed_same_plane"),
  placement_review: z.object({ version: z.literal("plane-placement-v1"), assessment: z.literal("user_confirmed_same_plane"),
    riskReasons: z.array(z.literal("person_nearby")), targetPlaneId: z.string().min(1) }),
  algorithm_version: z.literal("paper-plane-mm-v1"), coordinate_space: z.literal("normalized_workspace"),
  sensitivity_summary: z.object({ widthRelative: z.number().finite().nonnegative(), heightRelative: z.number().finite().nonnegative(), uncertaintyPx: positive, validated: z.literal(false) }),
  reference: referenceSchema,
});

function revision(r: z.infer<typeof referenceSchema>, q: QuadrilateralCorners): string {
  // Include correspondence and image inputs even if a caller accidentally reuses a revision.
  return JSON.stringify([r.frame, r.planeId, r.revision, r.paperStandard, r.firstEdge, r.paperCorners, q]);
}
export const MeasurementRecordSchema = StoredMeasurementRecordSchema.superRefine((r, ctx) => {
  const frame = { imageId: r.image_identity, width: r.image_width_px, height: r.image_height_px };
  const m = evaluateMetricOpening(r.reference, denormalizeCorners(r.opening_corners, frame.width, frame.height), frame);
  const eligibility = evaluatePlaneEligibility({ mode: "paper_fiducial", paperStandard: r.paper_standard,
    paperStandardConfirmed: true, status: "verified_calibrated", confidence: 0,
    placementReview: r.placement_review, metricReference: r.reference }, r.plane_id,
    denormalizeCorners(r.opening_corners, frame.width, frame.height), frame);
  if (eligibility.status !== "eligible_planar_estimate" || !m.valid || r.plane_id !== r.reference.planeId || r.calibration_revision !== r.reference.revision ||
      r.paper_standard !== r.reference.paperStandard || r.measurement_revision !== revision(r.reference, r.opening_corners) ||
      Math.abs(r.width_mm - m.widthMm) > 1e-6 || Math.abs(r.height_mm - m.heightMm) > 1e-6 ||
      Object.keys(r.edge_spans_mm).some(k => Math.abs(r.edge_spans_mm[k as keyof typeof r.edge_spans_mm] - m.edgesMm[k as keyof typeof m.edgesMm]) > 1e-6) ||
      JSON.stringify(r.sensitivity_summary) !== JSON.stringify(m.sensitivity)) {
    ctx.addIssue({ code: "custom", message: "Measurement evidence does not reproduce the accepted dimensions" });
  }
});
export type MeasurementRecord = z.infer<typeof MeasurementRecordSchema>;

/** Confidence and legacy verified flags never establish placement eligibility. */
export function createMeasurementRecord(meta: CalibrationMetadata | null | undefined,
  opening: QuadrilateralCorners, frame: MetricFrame, targetPlaneId: string | null | undefined): MeasurementRecord | null {
  const parsed = referenceSchema.safeParse(meta?.metricReference);
  if (!parsed.success || meta?.paperStandardConfirmed !== true ||
      evaluatePlaneEligibility(meta, targetPlaneId, denormalizeCorners(opening, frame.width, frame.height), frame).status !== "eligible_planar_estimate" ||
      meta.paperStandard !== parsed.data.paperStandard || targetPlaneId !== parsed.data.planeId || !meta.referenceSource) return null;
  const r = parsed.data;
  const m = evaluateMetricOpening(r, denormalizeCorners(opening, frame.width, frame.height), frame);
  if (!m.valid) return null;
  const result = MeasurementRecordSchema.safeParse({
    version: 1, measurement_revision: revision(r, opening), image_identity: frame.imageId,
    image_width_px: frame.width, image_height_px: frame.height, plane_id: r.planeId,
    calibration_revision: r.revision, opening_corners: opening, width_mm: m.widthMm, height_mm: m.heightMm,
    edge_spans_mm: m.edgesMm, source: "planar_paper_estimate", eligibility: "eligible_planar_estimate", reason_codes: [],
    reference_source: meta.referenceSource, paper_standard: r.paperStandard,
    placement_assessment: "user_confirmed_same_plane", placement_review: meta.placementReview, algorithm_version: r.version,
    coordinate_space: "normalized_workspace", sensitivity_summary: m.sensitivity, reference: r,
  });
  return result.success ? result.data : null;
}

export function readMeasurementRecord(value: unknown, widthCm?: number, heightCm?: number): MeasurementRecord | null {
  const result = MeasurementRecordSchema.safeParse(value);
  if (!result.success || (widthCm !== undefined && (!Number.isFinite(widthCm) || Math.abs(widthCm * 10 - result.data.width_mm) > 1e-6)) ||
    (heightCm !== undefined && (!Number.isFinite(heightCm) || Math.abs(heightCm * 10 - result.data.height_mm) > 1e-6))) return null;
  return result.data;
}

export function dimensionSourceLabel(source?: string): string {
  if (source === "planar_paper_estimate") return "Photo estimate: paper calibrated";
  if (source === "manual_tape") return "Manual tape measurement";
  if (source === "calibrated_visual" || source === "verified_calibrated_visual") return "Legacy photo estimate";
  return "Approximate preview";
}

/** New writes downgrade legacy labels; historical snapshots keep their original source. */
export function quotationMeasurement(config?: ProductConfigurationSnapshot | null) {
  const evidence = readMeasurementRecord(config?.visualParameterValues.calibration_provenance, config?.widthCm, config?.heightCm);
  const record = evidence && config?.visualParameterValues.dimension_source === "planar_paper_estimate" && config?.targetPlaneId === evidence.plane_id &&
    JSON.stringify(config?.perspectiveFitCorners) === JSON.stringify(evidence.opening_corners) ? evidence : null;
  const manual = config?.visualParameterValues.dimension_source === "manual_tape";
  return {
    dimensionSource: manual ? "manual_tape" : record ? "planar_paper_estimate" : "heuristic",
    calibrationProvenance: manual ? null : record,
  };
}

/** A modal opened before recalibration cannot confirm an earlier draft revision. */
export function currentPhotoMeasurement(config: ProductConfigurationSnapshot, meta?: CalibrationMetadata | null): MeasurementRecord | null {
  const evidence = quotationMeasurement(config).calibrationProvenance;
  const reference = meta?.metricReference;
  if (!evidence || !reference || reference.frame.imageId !== evidence.image_identity ||
      reference.frame.width !== evidence.image_width_px || reference.frame.height !== evidence.image_height_px) return null;
  if (reference.planeId !== evidence.plane_id) return evidence;
  const current = createMeasurementRecord(meta, evidence.opening_corners, reference.frame, evidence.plane_id);
  return current?.measurement_revision === evidence.measurement_revision ? current : null;
}
