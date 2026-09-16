/**
 * Perimeter ambient occlusion crevice and aperture reveal shadow calculations.
 * Roots 3D architectural extrusions inside wall openings.
 * Maps to PRD-F6, SDD-C5, SDD-C6, and QAD-TC12.
 */

export interface ContactShadowOptions {
  lightDirection?: { x: number; y: number };
  shadowOpacity?: number;
  creviceWidthPx?: number;
}

/**
 * Draws a subtle perimeter ambient occlusion crevice along the outer edges of the frame.
 * Simulates the micro-shadow where the aluminum extrusion contacts rough concrete or drywall.
 */
export function drawPerimeterAmbientOcclusion(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opacity = 0.35,
  creviceWidth = 3,
): void {
  if (width <= 0 || height <= 0 || opacity <= 0.01) {
    return;
  }

  const safeOpacity = Math.min(Math.max(opacity, 0), 0.60);
  const strokeW = Math.max(1, creviceWidth);

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  // Outer perimeter inset gradient
  // Top edge crevice
  const topGrad = ctx.createLinearGradient(0, 0, 0, strokeW);
  topGrad.addColorStop(0, `rgba(15, 20, 30, ${safeOpacity})`);
  topGrad.addColorStop(1, "rgba(15, 20, 30, 0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, strokeW);

  // Bottom edge crevice
  const bottomGrad = ctx.createLinearGradient(0, height, 0, height - strokeW);
  bottomGrad.addColorStop(0, `rgba(15, 20, 30, ${safeOpacity})`);
  bottomGrad.addColorStop(1, "rgba(15, 20, 30, 0)");
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, height - strokeW, width, strokeW);

  // Left edge crevice
  const leftGrad = ctx.createLinearGradient(0, 0, strokeW, 0);
  leftGrad.addColorStop(0, `rgba(15, 20, 30, ${safeOpacity})`);
  leftGrad.addColorStop(1, "rgba(15, 20, 30, 0)");
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, strokeW, height);

  // Right edge crevice
  const rightGrad = ctx.createLinearGradient(width, 0, width - strokeW, 0);
  rightGrad.addColorStop(0, `rgba(15, 20, 30, ${safeOpacity})`);
  rightGrad.addColorStop(1, "rgba(15, 20, 30, 0)");
  ctx.fillStyle = rightGrad;
  ctx.fillRect(width - strokeW, 0, strokeW, height);

  ctx.restore();
}

/**
 * Draws aperture reveal cast shadows based on light direction.
 * Simulates physical depth where the top wall header or side jamb casts shadows across the frame.
 */
export function drawApertureRevealShadow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lightDirection: { x: number; y: number } = { x: 0.35, y: 0.45 },
  shadowOpacity = 0.28,
): void {
  if (width <= 0 || height <= 0 || shadowOpacity <= 0.01) {
    return;
  }

  const safeOpacity = Math.min(Math.max(shadowOpacity, 0), 0.50);

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  // If light has a downward component (y > 0), the top wall header casts a shadow down
  if (lightDirection.y > 0.05) {
    const headerShadowDepth = Math.round(6 + Math.min(lightDirection.y, 1.0) * 10);
    const headerGrad = ctx.createLinearGradient(0, 0, 0, headerShadowDepth);
    headerGrad.addColorStop(0, `rgba(10, 15, 25, ${safeOpacity * 0.9})`);
    headerGrad.addColorStop(0.35, `rgba(10, 15, 25, ${safeOpacity * 0.45})`);
    headerGrad.addColorStop(1, "rgba(10, 15, 25, 0)");
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, width, headerShadowDepth);
  }

  // If light originates from the left or right, the opposite jamb casts an inner shadow
  if (Math.abs(lightDirection.x) > 0.05) {
    const jambShadowWidth = Math.round(4 + Math.min(Math.abs(lightDirection.x), 1.0) * 8);
    if (lightDirection.x > 0) {
      // Light from right, casts inner shadow on left jamb
      const leftJambGrad = ctx.createLinearGradient(0, 0, jambShadowWidth, 0);
      leftJambGrad.addColorStop(0, `rgba(10, 15, 25, ${safeOpacity * 0.75})`);
      leftJambGrad.addColorStop(1, "rgba(10, 15, 25, 0)");
      ctx.fillStyle = leftJambGrad;
      ctx.fillRect(0, 0, jambShadowWidth, height);
    } else {
      // Light from left, casts inner shadow on right jamb
      const rightJambGrad = ctx.createLinearGradient(width, 0, width - jambShadowWidth, 0);
      rightJambGrad.addColorStop(0, `rgba(10, 15, 25, ${safeOpacity * 0.75})`);
      rightJambGrad.addColorStop(1, "rgba(10, 15, 25, 0)");
      ctx.fillStyle = rightJambGrad;
      ctx.fillRect(width - jambShadowWidth, 0, jambShadowWidth, height);
    }
  }

  ctx.restore();
}

/**
 * Composites both perimeter contact ambient occlusion and aperture reveal shadows.
 */
export function applyContactOcclusionAndReveals(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: ContactShadowOptions = {},
): void {
  const {
    lightDirection = { x: 0.35, y: 0.45 },
    shadowOpacity = 0.28,
    creviceWidthPx = 3,
  } = options;

  drawPerimeterAmbientOcclusion(ctx, width, height, shadowOpacity * 1.1, creviceWidthPx);
  drawApertureRevealShadow(ctx, width, height, lightDirection, shadowOpacity);
}
