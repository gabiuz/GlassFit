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
 * Scales a quadrilateral along its horizontal, vertical, or uniform axis relative to its center.
 */
export function scaleCornersAlongAxis(
  corners: QuadrilateralCorners,
  ratio: number,
  axis: "width" | "height" | "scale",
): QuadrilateralCorners {
  const safeRatio = Math.max(0.05, ratio);
  const [p0, p1, p2, p3] = corners;
  const cx = (p0.x + p1.x + p2.x + p3.x) / 4;
  const cy = (p0.y + p1.y + p2.y + p3.y) / 4;

  if (axis === "scale") {
    return [
      { x: cx + (p0.x - cx) * safeRatio, y: cy + (p0.y - cy) * safeRatio },
      { x: cx + (p1.x - cx) * safeRatio, y: cy + (p1.y - cy) * safeRatio },
      { x: cx + (p2.x - cx) * safeRatio, y: cy + (p2.y - cy) * safeRatio },
      { x: cx + (p3.x - cx) * safeRatio, y: cy + (p3.y - cy) * safeRatio },
    ];
  }

  if (axis === "width") {
    const topMidX = (p0.x + p1.x) / 2;
    const topMidY = (p0.y + p1.y) / 2;
    const botMidX = (p3.x + p2.x) / 2;
    const botMidY = (p3.y + p2.y) / 2;

    return [
      { x: topMidX + (p0.x - topMidX) * safeRatio, y: topMidY + (p0.y - topMidY) * safeRatio },
      { x: topMidX + (p1.x - topMidX) * safeRatio, y: topMidY + (p1.y - topMidY) * safeRatio },
      { x: botMidX + (p2.x - botMidX) * safeRatio, y: botMidY + (p2.y - botMidY) * safeRatio },
      { x: botMidX + (p3.x - botMidX) * safeRatio, y: botMidY + (p3.y - botMidY) * safeRatio },
    ];
  }

  const leftMidX = (p0.x + p3.x) / 2;
  const leftMidY = (p0.y + p3.y) / 2;
  const rightMidX = (p1.x + p2.x) / 2;
  const rightMidY = (p1.y + p2.y) / 2;

  return [
    { x: leftMidX + (p0.x - leftMidX) * safeRatio, y: leftMidY + (p0.y - leftMidY) * safeRatio },
    { x: rightMidX + (p1.x - rightMidX) * safeRatio, y: rightMidY + (p1.y - rightMidY) * safeRatio },
    { x: rightMidX + (p2.x - rightMidX) * safeRatio, y: rightMidY + (p2.y - rightMidY) * safeRatio },
    { x: leftMidX + (p3.x - leftMidX) * safeRatio, y: leftMidY + (p3.y - leftMidY) * safeRatio },
  ];
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
 * Kept as a fallback when WebGL is unavailable.
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
  const a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / det;
  const c = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / det;
  const e = (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / det;

  const b = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / det;
  const d = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / det;
  const f = (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / det;

  const EXPAND_PX = 0.5;
  const cx = (x0 + x1 + x2) / 3;
  const cy = (y0 + y1 + y2) / 3;

  const expandVertex = (vx: number, vy: number) => {
    const dx = vx - cx;
    const dy = vy - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return { ex: vx, ey: vy };
    const scale = EXPAND_PX / len;
    return { ex: vx + dx * scale, ey: vy + dy * scale };
  };

  const e0 = expandVertex(x0, y0);
  const e1 = expandVertex(x1, y1);
  const e2 = expandVertex(x2, y2);

  context.save();
  context.beginPath();
  context.moveTo(e0.ex, e0.ey);
  context.lineTo(e1.ex, e1.ey);
  context.lineTo(e2.ex, e2.ey);
  context.closePath();
  context.clip();

  context.transform(a, b, c, d, e, f);
  context.drawImage(source, 0, 0);
  context.restore();
}

/**
 * Fallback Canvas 2D perspective warper using triangle mesh subdivision.
 */
function drawPerspectiveWarpedImage2D(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  targetCorners: QuadrilateralCorners,
  subdivisions: number,
  srcLeft: number,
  srcTop: number,
  srcWidth: number,
  srcHeight: number,
): void {
  const srcCorners: QuadrilateralCorners = [
    { x: srcLeft, y: srcTop },
    { x: srcLeft + srcWidth, y: srcTop },
    { x: srcLeft + srcWidth, y: srcTop + srcHeight },
    { x: srcLeft, y: srcTop + srcHeight },
  ];

  const H = computeHomographyMatrix(srcCorners, targetCorners);
  if (!H) {
    return;
  }

  const grid: GridVertex[][] = [];
  const steps = Math.max(2, subdivisions);

  for (let row = 0; row <= steps; row++) {
    const rowVertices: GridVertex[] = [];
    const v = srcTop + (row / steps) * srcHeight;

    for (let col = 0; col <= steps; col++) {
      const u = srcLeft + (col / steps) * srcWidth;

      const w = H[6] * u + H[7] * v + H[8];
      const x = (H[0] * u + H[1] * v + H[2]) / w;
      const y = (H[3] * u + H[4] * v + H[5]) / w;

      rowVertices.push({ u, v, x, y });
    }
    grid.push(rowVertices);
  }

  for (let row = 0; row < steps; row++) {
    for (let col = 0; col < steps; col++) {
      const pTopLeft = grid[row][col];
      const pTopRight = grid[row][col + 1];
      const pBottomRight = grid[row + 1][col + 1];
      const pBottomLeft = grid[row + 1][col];

      drawAffineTriangle(context, source, pTopLeft, pTopRight, pBottomLeft);
      drawAffineTriangle(context, source, pTopRight, pBottomRight, pBottomLeft);
    }
  }
}

type CachedWebGLWarpState = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  uInvH: WebGLUniformLocation;
  uResolution: WebGLUniformLocation;
  uTexSize: WebGLUniformLocation;
  uSrcRect: WebGLUniformLocation;
  uTexture: WebGLUniformLocation;
  texture: WebGLTexture;
};

let cachedWebGLWarp: CachedWebGLWarpState | null = null;

function getOrCreateWebGLWarpState(): CachedWebGLWarpState | null {
  if (typeof document === "undefined") {
    return null;
  }

  if (cachedWebGLWarp) {
    if (!cachedWebGLWarp.gl.isContextLost()) {
      return cachedWebGLWarp;
    }
    cachedWebGLWarp = null;
  }

  const canvas = document.createElement("canvas");
  const gl =
    canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false }) ||
    (canvas.getContext("experimental-webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    }) as WebGLRenderingContext | null);

  if (!gl) {
    return null;
  }

  const vsSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fsSource = `
    precision highp float;
    uniform sampler2D u_image;
    uniform mat3 u_invH;
    uniform vec2 u_resolution;
    uniform vec2 u_texSize;
    uniform vec4 u_srcRect;

    void main() {
      vec2 fragCoord = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
      vec3 srcPt = u_invH * vec3(fragCoord, 1.0);
      if (abs(srcPt.z) < 1e-7) {
        discard;
      }

      vec2 srcPx = srcPt.xy / srcPt.z;

      float left = u_srcRect.x;
      float top = u_srcRect.y;
      float right = left + u_srcRect.z;
      float bottom = top + u_srcRect.w;

      float edgeDistX = min(srcPx.x - left, right - srcPx.x);
      float edgeDistY = min(srcPx.y - top, bottom - srcPx.y);
      float edgeDist = min(edgeDistX, edgeDistY);

      if (edgeDist < 0.0) {
        discard;
      }

      // 0.5px sub-pixel anti-aliasing edge falloff
      float edgeAlpha = clamp(edgeDist / 0.5, 0.0, 1.0);
      vec2 uv = srcPx / u_texSize;
      vec4 texColor = texture2D(u_image, uv);
      gl_FragColor = vec4(texColor.rgb, texColor.a * edgeAlpha);
    }
  `;

  const createShader = (type: number, src: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vs = createShader(gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const aPosition = gl.getAttribLocation(program, "a_position");
  const uInvH = gl.getUniformLocation(program, "u_invH");
  const uResolution = gl.getUniformLocation(program, "u_resolution");
  const uTexSize = gl.getUniformLocation(program, "u_texSize");
  const uSrcRect = gl.getUniformLocation(program, "u_srcRect");
  const uTexture = gl.getUniformLocation(program, "u_image");

  if (!uInvH || !uResolution || !uTexSize || !uSrcRect || !uTexture) {
    gl.deleteProgram(program);
    return null;
  }

  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) {
    gl.deleteProgram(program);
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // Full-screen quad in clip space [-1, 1]
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]),
    gl.STATIC_DRAW,
  );

  const texture = gl.createTexture();
  if (!texture) {
    gl.deleteProgram(program);
    return null;
  }

  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  cachedWebGLWarp = {
    canvas,
    gl,
    program,
    positionBuffer,
    uInvH,
    uResolution,
    uTexSize,
    uSrcRect,
    uTexture,
    texture,
  };

  return cachedWebGLWarp;
}

/**
 * Draws a perspective-warped image onto a 2D canvas context.
 * Uses a hardware-accelerated offscreen WebGL per-pixel projective shader.
 * This guarantees zero internal triangle subdivisions, eliminating all seam grid lines.
 */
export function drawPerspectiveWarpedImage(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  targetCorners: QuadrilateralCorners,
  subdivisions: number = 16,
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

  // Try WebGL per-pixel projective mapping first
  const webglState = getOrCreateWebGLWarpState();
  if (webglState) {
    const { gl, canvas: glCanvas, program, texture, uInvH, uResolution, uTexSize, uSrcRect, uTexture } = webglState;

    const xs = targetCorners.map((p) => p.x);
    const ys = targetCorners.map((p) => p.y);
    const minX = Math.floor(Math.min(...xs));
    const minY = Math.floor(Math.min(...ys));
    const maxX = Math.ceil(Math.max(...xs));
    const maxY = Math.ceil(Math.max(...ys));

    const quadWidth = Math.max(1, maxX - minX);
    const quadHeight = Math.max(1, maxY - minY);

    // Target corners relative to the quad's bounding box
    const localTargetCorners: QuadrilateralCorners = [
      { x: targetCorners[0].x - minX, y: targetCorners[0].y - minY },
      { x: targetCorners[1].x - minX, y: targetCorners[1].y - minY },
      { x: targetCorners[2].x - minX, y: targetCorners[2].y - minY },
      { x: targetCorners[3].x - minX, y: targetCorners[3].y - minY },
    ];

    const srcCorners: QuadrilateralCorners = [
      { x: left, y: top },
      { x: left + width, y: top },
      { x: left + width, y: top + height },
      { x: left, y: top + height },
    ];

    // Compute inverse homography directly: maps local destination (x, y) -> source (u, v)
    const invH = computeHomographyMatrix(localTargetCorners, srcCorners);

    if (invH) {
      if (glCanvas.width !== quadWidth || glCanvas.height !== quadHeight) {
        glCanvas.width = quadWidth;
        glCanvas.height = quadHeight;
      }

      gl.viewport(0, 0, quadWidth, quadHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      // Upload source texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      if (source instanceof HTMLCanvasElement || source instanceof HTMLImageElement) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      }

      // In GLSL, mat3 uniform is column-major:
      // Column 0: invH[0], invH[3], invH[6]
      // Column 1: invH[1], invH[4], invH[7]
      // Column 2: invH[2], invH[5], invH[8]
      const colMajorInvH = new Float32Array([
        invH[0], invH[3], invH[6],
        invH[1], invH[4], invH[7],
        invH[2], invH[5], invH[8],
      ]);

      gl.uniformMatrix3fv(uInvH, false, colMajorInvH);
      gl.uniform2f(uResolution, quadWidth, quadHeight);
      gl.uniform2f(uTexSize, sourceWidth, sourceHeight);
      gl.uniform4f(uSrcRect, left, top, width, height);
      gl.uniform1i(uTexture, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Single blit to destination 2D canvas with zero internal seams
      context.drawImage(glCanvas, minX, minY);
      return;
    }
  }

  // Fallback to Canvas 2D triangle mesh if WebGL is unavailable
  drawPerspectiveWarpedImage2D(context, source, targetCorners, subdivisions, left, top, width, height);
}

