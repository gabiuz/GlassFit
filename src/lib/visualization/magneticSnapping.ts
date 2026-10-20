import type { Point2D } from "./types";

/**
 * Interface representing ImageData or an ImageData-like buffer.
 * Compatible with standard DOM ImageData and lightweight test buffers.
 */
export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array | number[];
}

/**
 * Result of client-side magnetic edge snapping (IMP-MS59 / QAD-TC74).
 */
export interface EdgeSnapResult {
  snapped: boolean;
  snappedPoint: { x: number; y: number };
  gradientStrength: number;
  edgeAngleRad: number;
}

/**
 * Visual collinearity and straightness guide line segment.
 */
export interface CollinearityGuideLine {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

/**
 * Edge fit quality assessment result.
 */
export interface EdgeFitQuality {
  percentage: number;
  label: string;
  badgeVariant: "green" | "yellow" | "muted";
}

/**
 * Evaluates local image gradient within snapRadius of the current drag position.
 * Computes horizontal and vertical Sobel convolution kernels on the luminance channel,
 * identifies dominant edge candidates, and resolves the sub-pixel peak along the gradient normal.
 *
 * Traceability: IMP-MS59, PRD-F4, PRD-F6, SDD-C3, DSD-UI3, QAD-TC74.3, QAD-TC74.4, QAD-TC74.6
 */
export function computeMagneticSnap(
  currentPos: { x: number; y: number },
  imageData: ImageDataLike,
  snapRadius: number = 10,
): EdgeSnapResult {
  const width = imageData.width;
  const height = imageData.height;

  // Ensure minimum patch dimensions for 3x3 Sobel convolution
  if (width < 3 || height < 3) {
    return {
      snapped: false,
      snappedPoint: { ...currentPos },
      gradientStrength: 0,
      edgeAngleRad: 0,
    };
  }

  // 1. Calculate luminance channel
  const data = imageData.data;
  const lum = new Float32Array(width * height);
  for (let i = 0; i < lum.length; i++) {
    const idx = i * 4;
    const r = data[idx] ?? 0;
    const g = data[idx + 1] ?? 0;
    const b = data[idx + 2] ?? 0;
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // 2. Compute 3x3 Sobel gradients for interior pixels
  const gxGrid = new Float32Array(width * height);
  const gyGrid = new Float32Array(width * height);
  const magGrid = new Float32Array(width * height);

  let magSum = 0;
  let interiorCount = 0;

  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width;
    const rowAbove = (y - 1) * width;
    const rowBelow = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x;

      const p00 = lum[rowAbove + x - 1];
      const p01 = lum[rowAbove + x];
      const p02 = lum[rowAbove + x + 1];
      const p10 = lum[rowOffset + x - 1];
      const p12 = lum[rowOffset + x + 1];
      const p20 = lum[rowBelow + x - 1];
      const p21 = lum[rowBelow + x];
      const p22 = lum[rowBelow + x + 1];

      // Sobel horizontal kernel [-1 0 1; -2 0 2; -1 0 1]
      const gx = (p02 + 2 * p12 + p22) - (p00 + 2 * p10 + p20);
      // Sobel vertical kernel [-1 -2 -1; 0 0 0; 1 2 1]
      const gy = (p20 + 2 * p21 + p22) - (p00 + 2 * p01 + p02);

      const mag = Math.hypot(gx, gy);
      gxGrid[idx] = gx;
      gyGrid[idx] = gy;
      magGrid[idx] = mag;

      magSum += mag;
      interiorCount++;
    }
  }

  const meanMag = interiorCount > 0 ? magSum / interiorCount : 0;
  // Dynamic threshold: 1.5x mean gradient, minimum absolute threshold of 20
  const tau = Math.max(20.0, 1.5 * meanMag);

  const cx = width / 2;
  const cy = height / 2;

  // 3. Find candidate edge pixels within snapRadius
  let bestScore = -1;
  let bestX = -1;
  let bestY = -1;

  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x;
      const mag = magGrid[idx];

      if (mag >= tau) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= snapRadius) {
          // Weight gradient magnitude with distance penalty
          const score = mag * (1.0 - 0.25 * (dist / snapRadius));
          if (score > bestScore) {
            bestScore = score;
            bestX = x;
            bestY = y;
          }
        }
      }
    }
  }

  // If no candidate edge is within snapRadius, release snapping
  if (bestX < 0 || bestY < 0) {
    return {
      snapped: false,
      snappedPoint: { ...currentPos },
      gradientStrength: 0,
      edgeAngleRad: 0,
    };
  }

  const bestIdx = bestY * width + bestX;
  const bestGx = gxGrid[bestIdx];
  const bestGy = gyGrid[bestIdx];
  const bestMag = magGrid[bestIdx];

  // 4. Sub-pixel peak localization along gradient normal
  const normLen = Math.hypot(bestGx, bestGy);
  let nx = 0;
  let ny = 0;
  if (normLen > 1e-6) {
    nx = bestGx / normLen;
    ny = bestGy / normLen;
  }

  // Bilinear sampling helper on magnitude grid
  const sampleMag = (px: number, py: number): number => {
    const xCl = Math.max(0, Math.min(width - 1, px));
    const yCl = Math.max(0, Math.min(height - 1, py));
    const x0 = Math.floor(xCl);
    const x1 = Math.min(width - 1, x0 + 1);
    const y0 = Math.floor(yCl);
    const y1 = Math.min(height - 1, y0 + 1);

    const wa = (x1 - xCl) * (y1 - yCl);
    const wb = (x1 - xCl) * (yCl - y0);
    const wc = (xCl - x0) * (y1 - yCl);
    const wd = (xCl - x0) * (yCl - y0);

    return (
      wa * magGrid[y0 * width + x0] +
      wb * magGrid[y1 * width + x0] +
      wc * magGrid[y0 * width + x1] +
      wd * magGrid[y1 * width + x1]
    );
  };

  const mMinus = sampleMag(bestX - nx, bestY - ny);
  const m0 = bestMag;
  const mPlus = sampleMag(bestX + nx, bestY + ny);

  let delta = 0;
  const denom = 2 * (mMinus - 2 * m0 + mPlus);
  if (Math.abs(denom) > 1e-5 && mMinus - 2 * m0 + mPlus < 0) {
    delta = Math.max(-0.5, Math.min(0.5, (mMinus - mPlus) / denom));
  }

  // Refined sub-pixel peak relative to patch center
  const subX = bestX + delta * nx;
  const subY = bestY + delta * ny;

  const dx = subX - cx;
  const dy = subY - cy;
  const finalDist = Math.hypot(dx, dy);

  // If sub-pixel refinement drifted beyond snapRadius, release snapping
  if (finalDist > snapRadius) {
    return {
      snapped: false,
      snappedPoint: { ...currentPos },
      gradientStrength: 0,
      edgeAngleRad: 0,
    };
  }

  // Tangent edge angle is perpendicular to gradient normal
  let edgeAngleRad = Math.atan2(bestGy, bestGx) + Math.PI / 2;
  while (edgeAngleRad > Math.PI) edgeAngleRad -= 2 * Math.PI;
  while (edgeAngleRad < -Math.PI) edgeAngleRad += 2 * Math.PI;

  return {
    snapped: true,
    snappedPoint: {
      x: currentPos.x + dx,
      y: currentPos.y + dy,
    },
    gradientStrength: Math.round(bestMag),
    edgeAngleRad,
  };
}

/**
 * Extracts a square pixel patch of ImageData around a center coordinate.
 * Uses an offscreen canvas for fast extraction.
 */
export function extractPatchImageData(
  sourceCanvas: HTMLCanvasElement,
  centerX: number,
  centerY: number,
  patchSize: number = 24,
): ImageData | null {
  try {
    const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    const half = Math.floor(patchSize / 2);
    const sx = Math.max(0, Math.min(sourceCanvas.width - patchSize, Math.round(centerX - half)));
    const sy = Math.max(0, Math.min(sourceCanvas.height - patchSize, Math.round(centerY - half)));

    return ctx.getImageData(sx, sy, patchSize, patchSize);
  } catch {
    // Tainted canvas or extraction error returns null safely
    return null;
  }
}

/**
 * Computes the edge fit quality percentage and badge variant (IMP-MS59 / QAD-TC74).
 *
 * - Fit >= 90%: Green badge ("Sharp Edge Alignment")
 * - Fit 70% - 89%: Yellow badge ("Moderate Edge Contrast")
 * - Fit < 70%: Muted badge ("Manual Alignment Recommended")
 */
export function computeEdgeFitQuality(
  gradientStrength: number,
  isSnapped: boolean,
): EdgeFitQuality {
  if (!isSnapped) {
    return {
      percentage: 55,
      label: "Manual Alignment Recommended",
      badgeVariant: "muted",
    };
  }

  // Scale gradient strength into percentage (assuming strong contrast reaches ~160+)
  const normalized = Math.min(100, Math.max(40, Math.round((gradientStrength / 180) * 100)));

  if (normalized >= 90) {
    return {
      percentage: normalized,
      label: "Sharp Edge Alignment",
      badgeVariant: "green",
    };
  }

  if (normalized >= 70) {
    return {
      percentage: normalized,
      label: "Moderate Edge Contrast",
      badgeVariant: "yellow",
    };
  }

  return {
    percentage: normalized,
    label: "Manual Alignment Recommended",
    badgeVariant: "muted",
  };
}

/**
 * Projects extended straightness reference guide lines along the 4 edges of a quadrilateral,
 * extending 20px beyond the corners to visually verify collinearity.
 */
export function calculateExtendedGuideLines(
  corners: [Point2D, Point2D, Point2D, Point2D],
  extensionPx: number = 20,
): [CollinearityGuideLine, CollinearityGuideLine, CollinearityGuideLine, CollinearityGuideLine] {
  const guides: CollinearityGuideLine[] = [];

  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);

    if (len < 1e-4) {
      guides.push({ start: { ...a }, end: { ...b } });
      continue;
    }

    const ux = dx / len;
    const uy = dy / len;

    guides.push({
      start: {
        x: a.x - extensionPx * ux,
        y: a.y - extensionPx * uy,
      },
      end: {
        x: b.x + extensionPx * ux,
        y: b.y + extensionPx * uy,
      },
    });
  }

  return guides as [
    CollinearityGuideLine,
    CollinearityGuideLine,
    CollinearityGuideLine,
    CollinearityGuideLine,
  ];
}
