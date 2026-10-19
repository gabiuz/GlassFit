/**
 * Scale estimation integration for improved initial dimension defaults.
 *
 * Receives scale signals from the FastAPI /analyze response and combines
 * them with the cross-ratio-corrected perspective quad measurements to
 * produce confidence-weighted initial widthCm / heightCm values.
 *
 * Traces to: PRD-F10, SDD-C5, BRD-M1
 */

import type {
  DimensionEstimate,
  FiducialPaperStandard,
  Point2D,
  ScaleEstimationSignal,
  ProductConfigurationSnapshot,
} from "./types";
import { PAPER_STANDARD_METRICS } from "./types";
// IMP-MS54 / IMP-MS60: calibrated opening dimension API for workspace corners.
export { evaluateMetricOpening, evaluateMetricOpening as evaluateMetricOpeningCorners } from "./metricGeometry";
import { evaluateMetricOpening, type MetricReference, type MetricFrame } from "./metricGeometry";
import { createMeasurementRecord, readMeasurementRecord } from "./measurementRecord";
import { evaluatePlaneEligibility } from "./planeEligibility";
import { denormalizeCorners } from "./perspectiveTransform";
import { calculateOverlayPricing } from "../pricing/pricingEngine";
import type { PlacedOverlay, CalibrationMetadata } from "./types";

/** IMP-MS56: atomically update only the explicitly assigned photo plane. */
export function recalculateMetricConfiguration(configuration: ProductConfigurationSnapshot,
  reference: MetricReference | null | undefined, frame: MetricFrame,
  meta?: import("./types").CalibrationMetadata | null): ProductConfigurationSnapshot {
  const values = configuration.visualParameterValues;
  const target = configuration.targetPlaneId ?? (typeof values.measurement_plane_id === "string" ? values.measurement_plane_id : null);
  const eligibility = evaluatePlaneEligibility(meta, target, configuration.perspectiveFitCorners
    ? denormalizeCorners(configuration.perspectiveFitCorners, frame.width, frame.height) : null, frame);
  // Tape measurements always win, even if valid photo corners remain attached.
  if (values.dimension_source === "manual_tape") {
    const photo = configuration.perspectiveFitCorners && meta
      ? createMeasurementRecord(meta, configuration.perspectiveFitCorners, frame, target) : null;
    return { ...configuration, visualParameterValues: { ...values, calibration_provenance: null,
      metric_measurement: null, photo_disagreement_mm: photo ? {
        width: photo.width_mm - configuration.widthCm * 10,
        height: photo.height_mm - configuration.heightCm * 10,
      } : null } };
  }
  const previous = readMeasurementRecord(values.calibration_provenance, configuration.widthCm, configuration.heightCm);
  // Another plane's accepted draft is independent of this reference update.
  if (previous && reference && previous.plane_id !== reference.planeId && previous.image_identity === frame.imageId && previous.image_width_px === frame.width && previous.image_height_px === frame.height &&
    target === previous.plane_id && JSON.stringify(configuration.perspectiveFitCorners) === JSON.stringify(previous.opening_corners)) return configuration;
  const corners = configuration.perspectiveFitCorners;
  const record = corners && meta ? createMeasurementRecord(meta, corners, frame, target) : null;
  if (!record) return { ...configuration, visualParameterValues: { ...values,
    dimension_source: "heuristic", metric_measurement: null, calibration_provenance: null,
    metric_eligibility: eligibility.status, placement_review: meta?.placementReview ?? null,
    metric_rejection: "Review the opening, paper format, and assigned installation plane before using a photo estimate.",
    calibration_scale_cm_per_px: null, user_verified: false,
  } };
  return { ...configuration, widthCm: record.width_mm / 10, heightCm: record.height_mm / 10,
    visualParameterValues: { ...values, width: record.width_mm, height: record.height_mm,
      metric_measurement: evaluateMetricOpening(reference, denormalizeCorners(corners!, frame.width, frame.height), frame),
      calibration_provenance: record, metric_rejection: null, dimension_source: record.source,
      metric_eligibility: eligibility.status, placement_review: meta?.placementReview ?? null,
      paper_standard: record.paper_standard, calibration_scale_cm_per_px: null, user_verified: false,
    } };
}

/** Keep cached render inputs and draft pricing aligned with the accepted model dimensions. */
export function recalculateMetricOverlay(overlay: PlacedOverlay, reference: MetricReference | null | undefined,
  frame: MetricFrame, meta?: CalibrationMetadata | null): PlacedOverlay {
  const configuration = recalculateMetricConfiguration(overlay.configuration, reference, frame, meta);
  if (configuration === overlay.configuration) return overlay;
  const changed = configuration.widthCm !== overlay.configuration.widthCm || configuration.heightCm !== overlay.configuration.heightCm;
  const next = { ...overlay, configuration, variationRenderRecipe: overlay.variationRenderRecipe
    ? { ...overlay.variationRenderRecipe, configuration } : undefined };
  if (!changed) return next;
  const pricing = calculateOverlayPricing({ ...next, bomResult: undefined, unitPrice: undefined, totalPrice: undefined });
  return { ...next, ...pricing, variationAssetRefs: undefined, variationImageDataUrls: undefined };
}

/**
 * Canonical corner ordering for 4 paper corner points:
 * [top_left, top_right, bottom_right, bottom_left]
 *
 * Sort cyclically around the centroid, then rotate to the smallest x+y.
 */
export function orderPaperCorners(pts: Point2D[]): [Point2D, Point2D, Point2D, Point2D] {
  if (pts.length !== 4) {
    throw new Error("Exactly 4 corner points are required for paper calibration.");
  }
  if (pts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new Error("Paper corners must be finite.");
  }
  const center = pts.reduce((c, p) => ({ x: c.x + p.x / 4, y: c.y + p.y / 4 }), { x: 0, y: 0 });
  const cyclic = [...pts].sort((a, b) => Math.atan2(a.y-center.y, a.x-center.x) - Math.atan2(b.y-center.y, b.x-center.x));
  const start = cyclic.reduce((best, p, i) => p.x+p.y < cyclic[best].x+cyclic[best].y ? i : best, 0);
  return [...cyclic.slice(start), ...cyclic.slice(0,start)] as [Point2D, Point2D, Point2D, Point2D];
}

/**
 * Derives physical metric scale factor (centimeters per pixel) directly from
 * 4 interactive or detected corners on a Philippine standard paper fiducial.
 *
 * Traces to: IMP-MS47, PRD-F6, PRD-F10, SDD-C5
 */
export function computeScaleFromPaperCorners(
  corners: [Point2D, Point2D, Point2D, Point2D] | Point2D[],
  paperStandard: FiducialPaperStandard,
): {
  scaleCmPerPx: number;
  confidence: number;
  orderedCorners: [Point2D, Point2D, Point2D, Point2D];
} {
  const ordered = orderPaperCorners(corners);
  const metrics = PAPER_STANDARD_METRICS[paperStandard] ?? PAPER_STANDARD_METRICS.a4;
  const dist = (p1: Point2D, p2: Point2D) => Math.hypot(p2.x - p1.x, p2.y - p1.y);

  const topWidthPx = dist(ordered[0], ordered[1]);
  const bottomWidthPx = dist(ordered[3], ordered[2]);
  const leftHeightPx = dist(ordered[0], ordered[3]);
  const rightHeightPx = dist(ordered[1], ordered[2]);

  const avgWidthPx = Math.sqrt(topWidthPx * bottomWidthPx);
  const avgHeightPx = Math.sqrt(leftHeightPx * rightHeightPx);

  // Check orientation (upright vs landscape) based on pixel aspect ratio
  const isLandscape = avgWidthPx > avgHeightPx;
  const realWidthCm = isLandscape
    ? Math.max(metrics.widthMm, metrics.heightMm) / 10
    : Math.min(metrics.widthMm, metrics.heightMm) / 10;
  const realHeightCm = isLandscape
    ? Math.min(metrics.widthMm, metrics.heightMm) / 10
    : Math.max(metrics.widthMm, metrics.heightMm) / 10;

  const scaleW = realWidthCm / Math.max(avgWidthPx, 1);
  const scaleH = realHeightCm / Math.max(avgHeightPx, 1);

  const scaleCmPerPx = (scaleW + scaleH) / 2;

  return {
    scaleCmPerPx: Number(scaleCmPerPx.toFixed(6)),
    confidence: 0, // IMP-MS53: geometry alone cannot quantify physical accuracy.
    orderedCorners: ordered,
  };
}

/**
 * Legacy scalar preview helper. IMP-MS54 forbids using this as a calibrated measurement.
 * Converts opening or overlay pixel dimensions directly to real-world metric centimeters
 * using the verified coplanar scale factor, with zero heuristic blending or depth distortion.
 *
 * Clamps result within architectural fabrication limits: [30cm, 600cm] width and [30cm, 400cm] height.
 *
 * Traces to: IMP-MS52, PRD-F5, PRD-F6, SDD-C4, QAD-TC67
 */
export function getVerifiedScaleInitialDimensions(
  verifiedScaleCmPerPx: number,
  canvasWidthPx: number,
  canvasHeightPx: number,
  defaultOverlayWidthPx?: number,
  defaultOverlayHeightPx?: number,
  photoWidthPx?: number,
  photoHeightPx?: number,
): { widthCm: number; heightCm: number } {
  const canvasToPhotoW =
    photoWidthPx && photoWidthPx > 0 && canvasWidthPx > 0
      ? photoWidthPx / canvasWidthPx
      : 1;
  const canvasToPhotoH =
    photoHeightPx && photoHeightPx > 0 && canvasHeightPx > 0
      ? photoHeightPx / canvasHeightPx
      : 1;

  const basePxW = defaultOverlayWidthPx || Math.round((canvasWidthPx || 636) * 0.35);
  const basePxH = defaultOverlayHeightPx || Math.round((canvasHeightPx || 579) * 0.35);

  const targetPxW = basePxW * canvasToPhotoW;
  const targetPxH = basePxH * canvasToPhotoH;

  const widthCm = Math.round(targetPxW * verifiedScaleCmPerPx);
  const heightCm = Math.round(targetPxH * verifiedScaleCmPerPx);

  return {
    widthCm: Math.max(30, Math.min(600, widthCm)),
    heightCm: Math.max(30, Math.min(400, heightCm)),
  };
}

/**
 * Computes improved initial dimensions by blending the scale estimation
 * signal with the perspective quad cross-ratio-corrected aspect ratio.
 *
 * When a YOLO reference object anchor is available, the quad pixel
 * dimensions are multiplied by the physical scale factor. When no anchor
 * is available, falls back to the existing default-height heuristic.
 *
 * IMP-MS54: paper signals without corner positions use approximate defaults.
 * Calibrated dimensions are available only through evaluateMetricOpening.
 */
export function computeEstimatedDimensions(
  quadWidthPx: number,
  quadHeightPx: number,
  scaleSignal: ScaleEstimationSignal | null | undefined,
  isDoor: boolean,
  templateDefaultHeightCm: number | null | undefined,
  depthAtQuadCenter: number | null | undefined,
): DimensionEstimate {
  // IMP-MS54: spans without corner positions cannot establish a metric plane result.
  if (scaleSignal?.method?.startsWith("paper_fiducial") || scaleSignal?.method?.startsWith("verified_calibrated")) {
    scaleSignal = null;
  }

  // Normalize template default height (convert mm to cm if in mm, e.g. 2100mm -> 210cm)
  let normalizedTemplateHeightCm: number | null = null;
  if (templateDefaultHeightCm && templateDefaultHeightCm > 0) {
    normalizedTemplateHeightCm =
      templateDefaultHeightCm > 500
        ? Math.round(templateDefaultHeightCm / 10)
        : Math.round(templateDefaultHeightCm);
  }

  const aspect = quadWidthPx / Math.max(quadHeightPx, 1);
  const isTallOpening = isDoor || aspect < 0.65;

  const defaultHeight = isTallOpening
    ? (normalizedTemplateHeightCm ?? 210)
    : (normalizedTemplateHeightCm ?? 120);

  // No scale signal available: fall back to architectural default-height heuristic.
  if (
    !scaleSignal ||
    scaleSignal.best_scale_cm_per_px === null ||
    scaleSignal.confidence < 0.1
  ) {
    const fallbackWidth = Math.round(defaultHeight * aspect);
    const fallbackHeight = defaultHeight;

    return {
      widthCm: Math.max(30, Math.min(600, fallbackWidth)),
      heightCm: Math.max(30, Math.min(400, fallbackHeight)),
      confidence: 0,
      method: "default_heuristic",
    };
  }

  let effectiveScale = scaleSignal.best_scale_cm_per_px;

  // Apply depth correction for the quad position if depth data is available.
  if (depthAtQuadCenter !== null && depthAtQuadCenter !== undefined && depthAtQuadCenter > 0.01) {
    const anchorDepths = (scaleSignal.anchors || [])
      .map((a) => a.depth_correction)
      .filter((d) => d > 0.01);
    if (anchorDepths.length > 0) {
      const avgAnchorDepth =
        anchorDepths.reduce((sum, d) => sum + d, 0) / anchorDepths.length;
      // If opening is farther (lower depth value), each pixel covers more real-world distance.
      effectiveScale *= avgAnchorDepth / depthAtQuadCenter;
    }
  }

  const estimatedWidth = Math.round(quadWidthPx * effectiveScale);
  const estimatedHeight = Math.round(quadHeightPx * effectiveScale);

  // Blend with default heuristic using confidence weight.
  const w = Math.min(Math.max(scaleSignal.confidence, 0), 0.85);
  const defaultEstWidth = Math.round(defaultHeight * aspect);
  const defaultEstHeight = defaultHeight;
  const blendedWidth = Math.round(w * estimatedWidth + (1 - w) * defaultEstWidth);
  const blendedHeight = Math.round(w * estimatedHeight + (1 - w) * defaultEstHeight);

  // Clamp to architecturally reasonable ranges.
  const clampedWidth = Math.max(30, Math.min(600, blendedWidth));
  const clampedHeight = Math.max(30, Math.min(400, blendedHeight));

  return {
    widthCm: clampedWidth,
    heightCm: clampedHeight,
    confidence: scaleSignal.confidence,
    method: scaleSignal.method,
  };
}

/**
 * Samples the relative depth map at a normalized coordinate (0.0 to 1.0).
 * Returns the grayscale value normalized to 0.0-1.0, or null on failure.
 */
export async function sampleDepthAtPoint(
  depthMapUrl: string | null | undefined,
  normalizedX: number,
  normalizedY: number,
): Promise<number | null> {
  if (!depthMapUrl || typeof window === "undefined") {
    return null;
  }

  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        if (canvas.width <= 0 || canvas.height <= 0) {
          resolve(null);
          return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const px = Math.min(
          canvas.width - 1,
          Math.max(0, Math.floor(normalizedX * canvas.width)),
        );
        const py = Math.min(
          canvas.height - 1,
          Math.max(0, Math.floor(normalizedY * canvas.height)),
        );
        const pixel = ctx.getImageData(px, py, 1, 1).data;
        // Grayscale image: R=G=B. Normalize 0-255 to 0.0-1.0.
        const normalizedDepth = pixel[0] / 255;
        resolve(normalizedDepth);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = depthMapUrl;
  });
}

/**
 * Computes photo-grounded initial dimensions using the scale estimation signal.
 *
 * Uses the overlay's default pixel footprint and the photo's spatial scale
 * factor to estimate what real-world dimensions the overlay "covers" in the
 * uploaded room photo.
 *
 * Falls back to hardcoded defaults when the scale signal is unavailable
 * or has low confidence.
 *
 * Traces to: PRD-F6, PRD-F10, SDD-C5, IMP-MS10, IMP-MS11
 */
export function getScaleAwareInitialDimensions(
  scaleSignal: ScaleEstimationSignal | null | undefined,
  defaultWidthCm: number,
  defaultHeightCm: number,
  overlayWidthPx: number,
  overlayHeightPx: number,
  canvasWidthPx: number,
  canvasHeightPx: number,
  photoWidthPx?: number,
  photoHeightPx?: number,
): { widthCm: number; heightCm: number; method: string } {
  // IMP-MS54: an arbitrary preview footprint is not a measured installation perimeter.
  if (scaleSignal?.method?.startsWith("paper_fiducial") || scaleSignal?.method?.startsWith("verified_calibrated")) {
    return { widthCm: defaultWidthCm, heightCm: defaultHeightCm, method: "default_fallback" };
  }

  if (
    !scaleSignal ||
    scaleSignal.best_scale_cm_per_px === null ||
    scaleSignal.confidence < 0.2 ||
    !photoWidthPx ||
    photoWidthPx <= 0 ||
    !photoHeightPx ||
    photoHeightPx <= 0
  ) {
    return {
      widthCm: defaultWidthCm,
      heightCm: defaultHeightCm,
      method: "default_fallback",
    };
  }

  // Convert overlay screen pixels to photo-space pixels.
  const canvasToPhotoRatioW = photoWidthPx / Math.max(canvasWidthPx, 1);
  const canvasToPhotoRatioH = photoHeightPx / Math.max(canvasHeightPx, 1);
  const overlayWidthInPhotoPx = overlayWidthPx * canvasToPhotoRatioW;
  const overlayHeightInPhotoPx = overlayHeightPx * canvasToPhotoRatioH;

  // Apply the photo-grounded scale factor.
  const estimatedWidth = overlayWidthInPhotoPx * scaleSignal.best_scale_cm_per_px;
  const estimatedHeight = overlayHeightInPhotoPx * scaleSignal.best_scale_cm_per_px;

  // Blend with defaults using confidence weight.
  // Cap confidence contribution at 0.7 to remain conservative.
  const w = Math.min(Math.max(scaleSignal.confidence, 0), 0.7);
  const blendedWidth = Math.round(w * estimatedWidth + (1 - w) * defaultWidthCm);
  const blendedHeight = Math.round(w * estimatedHeight + (1 - w) * defaultHeightCm);

  return {
    widthCm: Math.max(30, Math.min(600, blendedWidth)),
    heightCm: Math.max(30, Math.min(400, blendedHeight)),
    method: "scale_aware_initial",
  };
}

/**
 * Converts overlay pixel dimensions to real-world cm using the photo's
 * spatial scale factor.
 *
 * This provides a "what does this pixel footprint physically represent"
 * cross-check alongside the proportional method that preserves user intent.
 *
 * Traces to: PRD-F6, SDD-C5, IMP-MS10, IMP-MS11
 */
export function computePhotoGroundedCm(
  overlayWidthPx: number,
  overlayHeightPx: number,
  canvasWidthPx: number,
  canvasHeightPx: number,
  photoWidthPx: number,
  photoHeightPx: number,
  scaleCmPerPx: number,
): { widthCm: number; heightCm: number } {
  const canvasToPhotoRatioW = photoWidthPx / Math.max(canvasWidthPx, 1);
  const canvasToPhotoRatioH = photoHeightPx / Math.max(canvasHeightPx, 1);
  return {
    widthCm: Math.max(1, Math.round(overlayWidthPx * canvasToPhotoRatioW * scaleCmPerPx)),
    heightCm: Math.max(1, Math.round(overlayHeightPx * canvasToPhotoRatioH * scaleCmPerPx)),
  };
}

