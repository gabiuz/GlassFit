/**
 * Perimeter ambient occlusion crevice and aperture reveal shadow calculations.
 * Roots 3D architectural extrusions inside wall openings.
 * Maps to PRD-F6, SDD-C5, SDD-C6, and QAD-TC12.
 */

export interface ContactShadowOptions {
  lightDirection?: { x: number; y: number };
  shadowOpacity?: number;
  creviceWidthPx?: number;
  /** Installation opening in normalized render-canvas coordinates, not the canvas bounds. */
  installationBounds?: { x: number; y: number; width: number; height: number } | null;
}

interface PixelBounds { x: number; y: number; width: number; height: number }

function pixelBounds(width: number, height: number, bounds?: ContactShadowOptions["installationBounds"]): PixelBounds {
  if (!bounds) return { x: 0, y: 0, width, height };
  return {
    x: bounds.x * width,
    y: bounds.y * height,
    width: bounds.width * width,
    height: bounds.height * height,
  };
}

function validInstallationBounds(bounds: NonNullable<ContactShadowOptions["installationBounds"]>): boolean {
  return [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) &&
    bounds.width > 0 && bounds.height > 0 && bounds.width <= 2 && bounds.height <= 2 &&
    bounds.x > -2 && bounds.x < 2 && bounds.y > -2 && bounds.y < 2;
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
  installationBounds?: ContactShadowOptions["installationBounds"],
): void {
  if (width <= 0 || height <= 0 || opacity <= 0.01) {
    return;
  }
  if (installationBounds && !validInstallationBounds(installationBounds)) return;

  const safeOpacity = Math.min(Math.max(opacity, 0), 0.60);
  const strokeW = Math.max(1, creviceWidth);
  const bounds = pixelBounds(width, height, installationBounds);
  const { x, y, width: frameWidth, height: frameHeight } = bounds;

  ctx.save();
  // The outer crevice grounds the frame on the room photo. Keep it adjacent to
  // the installation opening, leaving unused source-frame padding transparent.
  if (installationBounds) {
    ctx.globalCompositeOperation = "source-over";

    const outerTop = ctx.createLinearGradient(0, y - strokeW, 0, y);
    outerTop.addColorStop(0, "rgba(15, 20, 30, 0)");
    outerTop.addColorStop(1, `rgba(15, 20, 30, ${safeOpacity})`);
    ctx.fillStyle = outerTop;
    ctx.fillRect(x, y - strokeW, frameWidth, strokeW);

    const outerBottom = ctx.createLinearGradient(0, y + frameHeight, 0, y + frameHeight + strokeW);
    outerBottom.addColorStop(0, `rgba(15, 20, 30, ${safeOpacity})`);
    outerBottom.addColorStop(1, "rgba(15, 20, 30, 0)");
    ctx.fillStyle = outerBottom;
    ctx.fillRect(x, y + frameHeight, frameWidth, strokeW);

    const outerLeft = ctx.createLinearGradient(x - strokeW, 0, x, 0);
    outerLeft.addColorStop(0, "rgba(15, 20, 30, 0)");
    outerLeft.addColorStop(1, `rgba(15, 20, 30, ${safeOpacity})`);
    ctx.fillStyle = outerLeft;
    ctx.fillRect(x - strokeW, y, strokeW, frameHeight);

    const outerRight = ctx.createLinearGradient(x + frameWidth, 0, x + frameWidth + strokeW, 0);
    outerRight.addColorStop(0, `rgba(15, 20, 30, ${safeOpacity})`);
    outerRight.addColorStop(1, "rgba(15, 20, 30, 0)");
    ctx.fillStyle = outerRight;
    ctx.fillRect(x + frameWidth, y, strokeW, frameHeight);
  }

  // Inner shading belongs to existing model pixels, including transparent glass.
  ctx.globalCompositeOperation = "source-atop";

  // Outer perimeter inset gradient
  // Top edge crevice
  const topGrad = ctx.createLinearGradient(0, y, 0, y + strokeW);
  topGrad.addColorStop(0, `rgba(15, 20, 30, ${safeOpacity})`);
  topGrad.addColorStop(1, "rgba(15, 20, 30, 0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(x, y, frameWidth, strokeW);

  // Bottom edge crevice
  const bottomGrad = ctx.createLinearGradient(0, y + frameHeight, 0, y + frameHeight - strokeW);
  bottomGrad.addColorStop(0, `rgba(15, 20, 30, ${safeOpacity})`);
  bottomGrad.addColorStop(1, "rgba(15, 20, 30, 0)");
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(x, y + frameHeight - strokeW, frameWidth, strokeW);

  // Left edge crevice
  const leftGrad = ctx.createLinearGradient(x, 0, x + strokeW, 0);
  leftGrad.addColorStop(0, `rgba(15, 20, 30, ${safeOpacity})`);
  leftGrad.addColorStop(1, "rgba(15, 20, 30, 0)");
  ctx.fillStyle = leftGrad;
  ctx.fillRect(x, y, strokeW, frameHeight);

  // Right edge crevice
  const rightGrad = ctx.createLinearGradient(x + frameWidth, 0, x + frameWidth - strokeW, 0);
  rightGrad.addColorStop(0, `rgba(15, 20, 30, ${safeOpacity})`);
  rightGrad.addColorStop(1, "rgba(15, 20, 30, 0)");
  ctx.fillStyle = rightGrad;
  ctx.fillRect(x + frameWidth - strokeW, y, strokeW, frameHeight);

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
  installationBounds?: ContactShadowOptions["installationBounds"],
): void {
  if (width <= 0 || height <= 0 || shadowOpacity <= 0.01) {
    return;
  }
  if (installationBounds && !validInstallationBounds(installationBounds)) return;

  const safeOpacity = Math.min(Math.max(shadowOpacity, 0), 0.50);
  const { x, y, width: frameWidth, height: frameHeight } = pixelBounds(width, height, installationBounds);

  ctx.save();
  ctx.globalCompositeOperation = "source-atop";

  // If light has a downward component (y > 0), the top wall header casts a shadow down
  if (lightDirection.y > 0.05) {
    const headerShadowDepth = Math.round(6 + Math.min(lightDirection.y, 1.0) * 10);
    const headerGrad = ctx.createLinearGradient(0, y, 0, y + headerShadowDepth);
    headerGrad.addColorStop(0, `rgba(10, 15, 25, ${safeOpacity * 0.9})`);
    headerGrad.addColorStop(0.35, `rgba(10, 15, 25, ${safeOpacity * 0.45})`);
    headerGrad.addColorStop(1, "rgba(10, 15, 25, 0)");
    ctx.fillStyle = headerGrad;
    ctx.fillRect(x, y, frameWidth, headerShadowDepth);
  }

  // If light originates from the left or right, the opposite jamb casts an inner shadow
  if (Math.abs(lightDirection.x) > 0.05) {
    const jambShadowWidth = Math.round(4 + Math.min(Math.abs(lightDirection.x), 1.0) * 8);
    if (lightDirection.x > 0) {
      // Light from right, casts inner shadow on left jamb
      const leftJambGrad = ctx.createLinearGradient(x, 0, x + jambShadowWidth, 0);
      leftJambGrad.addColorStop(0, `rgba(10, 15, 25, ${safeOpacity * 0.75})`);
      leftJambGrad.addColorStop(1, "rgba(10, 15, 25, 0)");
      ctx.fillStyle = leftJambGrad;
      ctx.fillRect(x, y, jambShadowWidth, frameHeight);
    } else {
      // Light from left, casts inner shadow on right jamb
      const rightJambGrad = ctx.createLinearGradient(x + frameWidth, 0, x + frameWidth - jambShadowWidth, 0);
      rightJambGrad.addColorStop(0, `rgba(10, 15, 25, ${safeOpacity * 0.75})`);
      rightJambGrad.addColorStop(1, "rgba(10, 15, 25, 0)");
      ctx.fillStyle = rightJambGrad;
      ctx.fillRect(x + frameWidth - jambShadowWidth, y, jambShadowWidth, frameHeight);
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
    installationBounds,
  } = options;

  drawPerimeterAmbientOcclusion(ctx, width, height, shadowOpacity * 1.1, creviceWidthPx, installationBounds);
  drawApertureRevealShadow(ctx, width, height, lightDirection, shadowOpacity, installationBounds);
}
