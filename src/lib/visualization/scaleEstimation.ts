/**
 * Scale estimation integration for improved initial dimension defaults.
 *
 * Receives scale signals from the FastAPI /analyze response and combines
 * them with the cross-ratio-corrected perspective quad measurements to
 * produce confidence-weighted initial widthCm / heightCm values.
 *
 * Traces to: PRD-F10, SDD-C5, BRD-M1
 */

import type { DimensionEstimate, ScaleEstimationSignal } from "./types";

/**
 * Computes improved initial dimensions by blending the scale estimation
 * signal with the perspective quad cross-ratio-corrected aspect ratio.
 *
 * When a YOLO reference object anchor is available, the quad pixel
 * dimensions are multiplied by the physical scale factor. When no anchor
 * is available, falls back to the existing default-height heuristic.
 */
export function computeEstimatedDimensions(
  quadWidthPx: number,
  quadHeightPx: number,
  scaleSignal: ScaleEstimationSignal | null | undefined,
  isDoor: boolean,
  templateDefaultHeightCm: number | null | undefined,
  depthAtQuadCenter: number | null | undefined,
): DimensionEstimate {
  const defaultHeight = isDoor
    ? (templateDefaultHeightCm && templateDefaultHeightCm > 0 ? templateDefaultHeightCm : 210)
    : (templateDefaultHeightCm && templateDefaultHeightCm > 0 ? templateDefaultHeightCm : 120);

  // No scale signal available: fall back to existing behavior.
  if (
    !scaleSignal ||
    scaleSignal.best_scale_cm_per_px === null ||
    scaleSignal.confidence < 0.1
  ) {
    const aspect = quadWidthPx / Math.max(quadHeightPx, 1);
    const fallbackWidth = isDoor
      ? Math.round(defaultHeight * aspect)
      : (aspect >= 1 ? Math.round(defaultHeight * aspect) : defaultHeight);
    const fallbackHeight = isDoor
      ? defaultHeight
      : (aspect >= 1 ? defaultHeight : Math.round(defaultHeight / Math.max(aspect, 0.01)));

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
  const aspect = quadWidthPx / Math.max(quadHeightPx, 1);
  const defaultEstWidth = defaultHeight * aspect;
  const blendedWidth = Math.round(w * estimatedWidth + (1 - w) * defaultEstWidth);
  const blendedHeight = Math.round(w * estimatedHeight + (1 - w) * defaultHeight);

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
