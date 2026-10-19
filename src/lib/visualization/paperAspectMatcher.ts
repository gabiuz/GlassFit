/**
 * Canonical Paper Perspective Unwarping Aspect Ratio Matcher (IMP-MS60 / QAD-TC75).
 * Computes frontally rectified aspect ratios and deterministic side correspondence
 * to accurately suggest canonical Philippine paper standards (Short, A4, Long)
 * from 4 corner fiducial coordinates.
 *
 * Traceability:
 * - PRD-F4: CV Image Analysis Pipeline
 * - PRD-F5: Parametric 3D Visualization Canvas
 * - PRD-F10: Quotation Measurement Modal
 * - SDD-C3: CV Scene Analyzer
 * - SDD-C5: 3D Perspective Model Workspace
 * - QAD-TC75: Perspective Unwarping Aspect Ratio Matcher and Sizing Parity
 */

import type { FiducialPaperStandard, Point2D, QuadrilateralCorners } from "./types";
import { computeHomographyMatrix } from "./perspectiveTransform";
import { orderPaperCorners } from "./scaleEstimation";

/** Canonical Philippine paper aspect ratios (length / width). */
export const CANONICAL_PAPER_RATIOS: Record<FiducialPaperStandard, number> = {
  short: 279.4 / 215.9, // ~1.2941176
  a4: 297.0 / 210.0,    // ~1.4142857
  long: 330.2 / 215.9,  // ~1.5294117
};

/** Canonical Philippine paper dimensions in millimeters (width, height) upright. */
export const CANONICAL_PAPER_DIMENSIONS_MM: Record<FiducialPaperStandard, { shortMm: number; longMm: number }> = {
  short: { shortMm: 215.9, longMm: 279.4 },
  a4: { shortMm: 210.0, longMm: 297.0 },
  long: { shortMm: 215.9, longMm: 330.2 },
};

/** 3.5% tolerance envelope for unambiguous standard classification. */
export const ASPECT_RATIO_TOLERANCE = 0.035;

export interface PaperAspectMatchResult {
  unwarpedRatio: number;
  suggestedStandard: FiducialPaperStandard | null;
  confidenceMatch: number;
  minDeviation: number;
  isAmbiguous: boolean;
  deviations: Record<FiducialPaperStandard, number>;
  detectedOrientation: "portrait" | "landscape";
  recommendedFirstEdge: "short" | "long";
}

/**
 * Computes unwarped aspect ratio using frontal rectifying homography and recovers
 * true physical aspect ratio under perspective projection.
 */
export function computeUnwarpedAspectRatio(
  corners: [Point2D, Point2D, Point2D, Point2D] | Point2D[],
  imageWidth = 1024,
  imageHeight = 1024,
  exifFocalLengthPx?: number | null,
): PaperAspectMatchResult {
  const ordered = orderPaperCorners(corners);
  const u0 = imageWidth * 0.5;
  const v0 = imageHeight * 0.5;

  // Normalized unit square Q mapping to image corners
  const qNorm: QuadrilateralCorners = [
    { x: 0.0, y: 0.0 },
    { x: 1.0, y: 0.0 },
    { x: 1.0, y: 1.0 },
    { x: 0.0, y: 1.0 },
  ];

  // Homography mapping unit square Q to image corners ordered
  const hRect = computeHomographyMatrix(qNorm, ordered);

  let ratio: number | null = null;
  let detectedOrientation: "portrait" | "landscape" = "portrait";
  let recommendedFirstEdge: "short" | "long" = "short";

  if (hRect) {
    const h1 = [hRect[0], hRect[3], hRect[6]];
    const h2 = [hRect[1], hRect[4], hRect[7]];

    const num = (h1[0] - u0 * h1[2]) * (h2[0] - u0 * h2[2]) + (h1[1] - v0 * h1[2]) * (h2[1] - v0 * h2[2]);
    const den = h1[2] * h2[2];

    const maxDim = Math.max(imageWidth, imageHeight);
    const fSq = Math.abs(den) > 1e-9 ? -num / den : -1.0;

    let f: number;
    if (fSq > 0 && fSq >= Math.pow(0.2 * maxDim, 2) && fSq <= Math.pow(5.0 * maxDim, 2)) {
      f = Math.sqrt(fSq);
    } else if (exifFocalLengthPx && exifFocalLengthPx > 0) {
      f = exifFocalLengthPx;
    } else {
      f = maxDim;
    }

    const vw = [(h1[0] - u0 * h1[2]) / f, (h1[1] - v0 * h1[2]) / f, h1[2]];
    const vh = [(h2[0] - u0 * h2[2]) / f, (h2[1] - v0 * h2[2]) / f, h2[2]];

    const nw = Math.hypot(vw[0], vw[1], vw[2]);
    const nh = Math.hypot(vh[0], vh[1], vh[2]);

    if (nw > 1e-6 && nh > 1e-6) {
      ratio = Math.max(nw, nh) / Math.min(nw, nh);
      if (nw > nh) {
        detectedOrientation = "landscape";
        recommendedFirstEdge = "long";
      } else {
        detectedOrientation = "portrait";
        recommendedFirstEdge = "short";
      }
    }
  }

  // Fallback to Euclidean side lengths if homography unwarping failed
  if (ratio === null || !Number.isFinite(ratio)) {
    const dist = (a: Point2D, b: Point2D) => Math.hypot(b.x - a.x, b.y - a.y);
    const topW = dist(ordered[0], ordered[1]);
    const botW = dist(ordered[3], ordered[2]);
    const leftH = dist(ordered[0], ordered[3]);
    const rightH = dist(ordered[1], ordered[2]);

    const avgW = (topW + botW) / 2.0;
    const avgH = (leftH + rightH) / 2.0;
    ratio = Math.max(avgW, avgH) / Math.max(Math.min(avgW, avgH), 1e-6);

    if (avgW > avgH) {
      detectedOrientation = "landscape";
      recommendedFirstEdge = "long";
    } else {
      detectedOrientation = "portrait";
      recommendedFirstEdge = "short";
    }
  }

  const deviations: Record<FiducialPaperStandard, number> = {
    short: Math.abs(ratio - CANONICAL_PAPER_RATIOS.short) / CANONICAL_PAPER_RATIOS.short,
    a4: Math.abs(ratio - CANONICAL_PAPER_RATIOS.a4) / CANONICAL_PAPER_RATIOS.a4,
    long: Math.abs(ratio - CANONICAL_PAPER_RATIOS.long) / CANONICAL_PAPER_RATIOS.long,
  };

  let bestStd: FiducialPaperStandard = "short";
  let minDev = deviations.short;

  if (deviations.a4 < minDev) {
    minDev = deviations.a4;
    bestStd = "a4";
  }
  if (deviations.long < minDev) {
    minDev = deviations.long;
    bestStd = "long";
  }

  const isMatched = minDev <= ASPECT_RATIO_TOLERANCE;
  const suggestedStandard = isMatched ? bestStd : null;
  const confidenceMatch = isMatched ? Math.round((1.0 - minDev) * 10000) / 10000 : 0.0;

  return {
    unwarpedRatio: Math.round(ratio * 10000) / 10000,
    suggestedStandard,
    confidenceMatch,
    minDeviation: minDev,
    isAmbiguous: !isMatched,
    deviations,
    detectedOrientation,
    recommendedFirstEdge,
  };
}

/**
 * Identifies principal physical orientation (portrait vs landscape) and recommends
 * side correspondence (short vs long for edge 0 to 1).
 */
export function detectPrincipalOrientation(
  corners: [Point2D, Point2D, Point2D, Point2D] | Point2D[],
  imageWidth = 1024,
  imageHeight = 1024,
): { orientation: "portrait" | "landscape"; recommendedFirstEdge: "short" | "long" } {
  const result = computeUnwarpedAspectRatio(corners, imageWidth, imageHeight);
  return {
    orientation: result.detectedOrientation,
    recommendedFirstEdge: result.recommendedFirstEdge,
  };
}
