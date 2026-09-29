/**
 * Procedural sensor noise and grain synthesis for live DOM and canvas snapshot export.
 * Maps to PRD-F6, SDD-C5, SDD-C6, and QAD-TC12.
 */

export const GRAIN_FILTER_SVG_ID = "glassfit-grain-filter";

/**
 * Clamps sensor grain intensity to a safe range [0.0, 0.18].
 */
export function clampGrainIntensity(intensity: number): number {
  if (!Number.isFinite(intensity) || intensity <= 0) {
    return 0;
  }
  return Math.min(Math.max(intensity, 0), 0.18);
}

/**
 * Generates an inline SVG filter definition string for monochromatic film grain.
 * Injected into the workspace viewport to harmonize DOM elements with camera sensor noise.
 */
export function getNoiseFilterSvgString(grainIntensity: number): string {
  const clamped = clampGrainIntensity(grainIntensity);
  if (clamped <= 0.01) {
    return "";
  }

  return `
    <svg style="position: absolute; width: 0; height: 0; overflow: hidden;" aria-hidden="true">
      <defs>
        <filter id="${GRAIN_FILTER_SVG_ID}" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" result="noise" />
          <feColorMatrix type="matrix" values="
            0.33 0.33 0.33 0 0
            0.33 0.33 0.33 0 0
            0.33 0.33 0.33 0 0
            0    0    0    ${(clamped * 1.5).toFixed(3)} 0" result="monoNoise" />
          <feBlend in="SourceGraphic" in2="monoNoise" mode="overlay" />
        </filter>
      </defs>
    </svg>
  `.trim();
}

/**
 * Applies procedural monochromatic sensor grain directly to a 2D canvas context.
 * Guarantees exact visual parity with the live DOM viewport during high-resolution snapshot export.
 */
export function applyNoiseToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grainIntensity: number,
): void {
  const clamped = clampGrainIntensity(grainIntensity);
  if (clamped <= 0.01 || width <= 0 || height <= 0) {
    return;
  }

  // Downscale noise canvas for large resolutions to maintain high frame export speed
  const isLarge = width > 1024 || height > 1024;
  const sampleWidth = isLarge ? Math.max(1, Math.round(width / 2)) : Math.round(width);
  const sampleHeight = isLarge ? Math.max(1, Math.round(height / 2)) : Math.round(height);

  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = sampleWidth;
  noiseCanvas.height = sampleHeight;
  const noiseCtx = noiseCanvas.getContext("2d");
  if (!noiseCtx) {
    return;
  }

  const imgData = noiseCtx.createImageData(sampleWidth, sampleHeight);
  const data = imgData.data;
  const factor = clamped * 255;
  const alpha = Math.round(clamped * 160);

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * factor;
    const value = Math.round(128 + noise);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = alpha;
  }

  noiseCtx.putImageData(imgData, 0, 0);

  if (ctx.canvas && typeof document !== "undefined") {
    const maskedNoiseCanvas = document.createElement("canvas");
    maskedNoiseCanvas.width = width;
    maskedNoiseCanvas.height = height;
    const maskedCtx = maskedNoiseCanvas.getContext("2d");
    if (maskedCtx) {
      maskedCtx.imageSmoothingEnabled = true;
      maskedCtx.drawImage(noiseCanvas, 0, 0, width, height);
      maskedCtx.globalCompositeOperation = "destination-in";
      maskedCtx.drawImage(ctx.canvas, 0, 0);

      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.drawImage(maskedNoiseCanvas, 0, 0);
      ctx.restore();
      return;
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(noiseCanvas, 0, 0, width, height);
  ctx.restore();
}
