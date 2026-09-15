import type { Point2D, QuadrilateralCorners } from "./types";

/**
 * Direct Linear Transform (DLT) homography solver.
 * Solves an 8x8 linear system using Gaussian elimination with partial pivoting
 * to find the 3x3 projective matrix mapping four source points to four target points.
 *
 * Matrix equations:
 * | h0 h1 h2 |   | x |   | w * u |
 * | h3 h4 h5 | * | y | = | w * v |
 * | h6 h7 1  |   | 1 |   |   w   |
 */
export function computeHomographyMatrix(
  src: QuadrilateralCorners,
  dst: QuadrilateralCorners,
): number[] | null {
  const matrix: number[][] = [];
  const rhs: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];

    // Row 2i: x*h0 + y*h1 + h2 - u*x*h6 - u*y*h7 = u
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    rhs.push(u);

    // Row 2i+1: x*h3 + y*h4 + h5 - v*x*h6 - v*y*h7 = v
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    rhs.push(v);
  }

  // Gaussian elimination with partial pivoting
  const n = 8;
  for (let i = 0; i < n; i++) {
    // Find pivot row
    let maxRow = i;
    let maxVal = Math.abs(matrix[i][i]);
    for (let k = i + 1; k < n; k++) {
      const val = Math.abs(matrix[k][i]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = k;
      }
    }

    // Singular or degenerate system check
    if (maxVal < 1e-10) {
      return null;
    }

    // Swap pivot row with current row
    if (maxRow !== i) {
      const tempRow = matrix[i];
      matrix[i] = matrix[maxRow];
      matrix[maxRow] = tempRow;

      const tempRhs = rhs[i];
      rhs[i] = rhs[maxRow];
      rhs[maxRow] = tempRhs;
    }

    // Eliminate below
    for (let k = i + 1; k < n; k++) {
      const factor = matrix[k][i] / matrix[i][i];
      for (let j = i; j < n; j++) {
        matrix[k][j] -= factor * matrix[i][j];
      }
      rhs[k] -= factor * rhs[i];
    }
  }

  // Back-substitution
  const h = new Array<number>(8);
  for (let i = n - 1; i >= 0; i--) {
    let sum = rhs[i];
    for (let j = i + 1; j < n; j++) {
      sum -= matrix[i][j] * h[j];
    }
    h[i] = sum / matrix[i][i];
  }

  // Return full 3x3 homography matrix in row-major order with h8 normalized to 1
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/**
 * Converts four target corner coordinates (in pixel space) into a CSS matrix3d() string.
 * The source rectangle is assumed to be an unrotated element with transform-origin at (0, 0).
 */
export function homographyToCssMatrix3d(
  corners: QuadrilateralCorners,
  elementWidth: number,
  elementHeight: number,
  srcBounds?: { left: number; top: number; width: number; height: number } | null,
): string {
  if (elementWidth <= 0 || elementHeight <= 0) {
    return "none";
  }

  const left = srcBounds && Number.isFinite(srcBounds.left) ? srcBounds.left * elementWidth : 0;
  const top = srcBounds && Number.isFinite(srcBounds.top) ? srcBounds.top * elementHeight : 0;
  const width =
    srcBounds && Number.isFinite(srcBounds.width) && srcBounds.width > 0
      ? srcBounds.width * elementWidth
      : elementWidth;
  const height =
    srcBounds && Number.isFinite(srcBounds.height) && srcBounds.height > 0
      ? srcBounds.height * elementHeight
      : elementHeight;

  const srcCorners: QuadrilateralCorners = [
    { x: left, y: top },
    { x: left + width, y: top },
    { x: left + width, y: top + height },
    { x: left, y: top + height },
  ];

  const H = computeHomographyMatrix(srcCorners, corners);
  if (!H) {
    return "none";
  }

  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = H;

  // CSS matrix3d column-major parameter order:
  // matrix3d(m11, m12, m13, m14, m21, m22, m23, m24, m31, m32, m33, m34, m41, m42, m43, m44)
  // Column 1: h0, h3, 0, h6
  // Column 2: h1, h4, 0, h7
  // Column 3: 0, 0, 1, 0
  // Column 4: h2, h5, 0, h8
  return `matrix3d(${h0}, ${h3}, 0, ${h6}, ${h1}, ${h4}, 0, ${h7}, 0, 0, 1, 0, ${h2}, ${h5}, 0, ${h8})`;
}

/**
 * Checks whether four corner points form a valid, strictly convex quadrilateral.
 * The corners must be ordered clockwise or counter-clockwise without self-intersections.
 */
export function isValidQuadrilateral(corners: QuadrilateralCorners): boolean {
  if (!corners || corners.length !== 4) {
    return false;
  }

  // Cross product of adjacent edges: (B - A) x (C - B)
  const crossProduct = (a: Point2D, b: Point2D, c: Point2D) => {
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  };

  const cp0 = crossProduct(corners[3], corners[0], corners[1]);
  const cp1 = crossProduct(corners[0], corners[1], corners[2]);
  const cp2 = crossProduct(corners[1], corners[2], corners[3]);
  const cp3 = crossProduct(corners[2], corners[3], corners[0]);

  // All cross products must be strictly positive (counter-clockwise)
  // or all strictly negative (clockwise)
  const epsilon = 1e-4;
  const allPositive = cp0 > epsilon && cp1 > epsilon && cp2 > epsilon && cp3 > epsilon;
  const allNegative = cp0 < -epsilon && cp1 < -epsilon && cp2 < -epsilon && cp3 < -epsilon;

  return allPositive || allNegative;
}

/**
 * Estimates proportional width and height from quadrilateral edge dimensions.
 */
export function estimateDimensionsFromCorners(corners: QuadrilateralCorners): {
  widthRatio: number;
  heightRatio: number;
} {
  const dist = (p1: Point2D, p2: Point2D) => Math.hypot(p2.x - p1.x, p2.y - p1.y);

  const topWidth = dist(corners[0], corners[1]);
  const bottomWidth = dist(corners[3], corners[2]);
  const leftHeight = dist(corners[0], corners[3]);
  const rightHeight = dist(corners[1], corners[2]);

  const avgWidth = (topWidth + bottomWidth) / 2;
  const avgHeight = (leftHeight + rightHeight) / 2;

  return {
    widthRatio: avgWidth,
    heightRatio: avgHeight,
  };
}

/**
 * Normalizes corner coordinates relative to canvas boundaries (0.0 to 1.0 range).
 */
export function normalizeCorners(
  pixelCorners: QuadrilateralCorners,
  canvasWidth: number,
  canvasHeight: number,
): QuadrilateralCorners {
  const safeW = Math.max(canvasWidth, 1);
  const safeH = Math.max(canvasHeight, 1);

  return [
    { x: pixelCorners[0].x / safeW, y: pixelCorners[0].y / safeH },
    { x: pixelCorners[1].x / safeW, y: pixelCorners[1].y / safeH },
    { x: pixelCorners[2].x / safeW, y: pixelCorners[2].y / safeH },
    { x: pixelCorners[3].x / safeW, y: pixelCorners[3].y / safeH },
  ];
}

/**
 * Denormalizes corner coordinates from normalized (0.0 to 1.0) space to current canvas pixels.
 */
export function denormalizeCorners(
  normalizedCorners: QuadrilateralCorners,
  canvasWidth: number,
  canvasHeight: number,
): QuadrilateralCorners {
  return [
    { x: normalizedCorners[0].x * canvasWidth, y: normalizedCorners[0].y * canvasHeight },
    { x: normalizedCorners[1].x * canvasWidth, y: normalizedCorners[1].y * canvasHeight },
    { x: normalizedCorners[2].x * canvasWidth, y: normalizedCorners[2].y * canvasHeight },
    { x: normalizedCorners[3].x * canvasWidth, y: normalizedCorners[3].y * canvasHeight },
  ];
}

type GridVertex = {
  u: number;
  v: number;
  x: number;
  y: number;
};

/**
 * Solves the affine transformation matrix mapping a source triangle (u, v)
 * to a destination triangle (x, y), then clips and paints the texture.
 */
function drawAffineTriangle(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  p0: GridVertex,
  p1: GridVertex,
  p2: GridVertex,
): void {
  const { u: u0, v: v0, x: x0, y: y0 } = p0;
  const { u: u1, v: v1, x: x1, y: y1 } = p1;
  const { u: u2, v: v2, x: x2, y: y2 } = p2;

  // Determinant of source triangle in (u, v) coordinates
  const det = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
  if (Math.abs(det) < 1e-6) {
    return;
  }

  // Affine matrix coefficients: [a, b, c, d, e, f]
  // [x] = [a c e] * [u]
  // [y] = [b d f] * [v]
  // [1]   [0 0 1]   [1]
  const a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / det;
  const c = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / det;
  const e = (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / det;

  const b = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / det;
  const d = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / det;
  const f = (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / det;

  context.save();
  context.beginPath();
  context.moveTo(x0, y0);
  context.lineTo(x1, y1);
  context.lineTo(x2, y2);
  context.closePath();
  context.clip();

  context.transform(a, b, c, d, e, f);
  context.drawImage(source, 0, 0);
  context.restore();
}

/**
 * Draws a perspective-warped image onto a 2D canvas context by subdividing
 * the source image into a triangle mesh and applying piecewise affine approximations.
 * This simulates projective texture mapping without requiring WebGL.
 */
export function drawPerspectiveWarpedImage(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  targetCorners: QuadrilateralCorners,
  subdivisions: number = 8,
  srcBounds?: { left: number; top: number; width: number; height: number } | null,
): void {
  const sourceWidth =
    source instanceof HTMLCanvasElement
      ? source.width
      : source instanceof HTMLImageElement
        ? source.naturalWidth || source.width
        : 0;
  const sourceHeight =
    source instanceof HTMLCanvasElement
      ? source.height
      : source instanceof HTMLImageElement
        ? source.naturalHeight || source.height
        : 0;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return;
  }

  const left = srcBounds && Number.isFinite(srcBounds.left) ? srcBounds.left * sourceWidth : 0;
  const top = srcBounds && Number.isFinite(srcBounds.top) ? srcBounds.top * sourceHeight : 0;
  const width =
    srcBounds && Number.isFinite(srcBounds.width) && srcBounds.width > 0
      ? srcBounds.width * sourceWidth
      : sourceWidth;
  const height =
    srcBounds && Number.isFinite(srcBounds.height) && srcBounds.height > 0
      ? srcBounds.height * sourceHeight
      : sourceHeight;

  const srcCorners: QuadrilateralCorners = [
    { x: left, y: top },
    { x: left + width, y: top },
    { x: left + width, y: top + height },
    { x: left, y: top + height },
  ];

  const H = computeHomographyMatrix(srcCorners, targetCorners);
  if (!H) {
    return;
  }

  // Precompute grid vertices
  const grid: GridVertex[][] = [];
  const steps = Math.max(2, subdivisions);

  for (let row = 0; row <= steps; row++) {
    const rowVertices: GridVertex[] = [];
    const v = top + (row / steps) * height;

    for (let col = 0; col <= steps; col++) {
      const u = left + (col / steps) * width;

      // Project (u, v) using homography matrix H
      const w = H[6] * u + H[7] * v + H[8];
      const x = (H[0] * u + H[1] * v + H[2]) / w;
      const y = (H[3] * u + H[4] * v + H[5]) / w;

      rowVertices.push({ u, v, x, y });
    }
    grid.push(rowVertices);
  }

  // Render two triangles per grid cell
  for (let row = 0; row < steps; row++) {
    for (let col = 0; col < steps; col++) {
      const pTopLeft = grid[row][col];
      const pTopRight = grid[row][col + 1];
      const pBottomRight = grid[row + 1][col + 1];
      const pBottomLeft = grid[row + 1][col];

      // Triangle 1 (Top-Left, Top-Right, Bottom-Left)
      drawAffineTriangle(context, source, pTopLeft, pTopRight, pBottomLeft);

      // Triangle 2 (Top-Right, Bottom-Right, Bottom-Left)
      drawAffineTriangle(context, source, pTopRight, pBottomRight, pBottomLeft);
    }
  }
}
