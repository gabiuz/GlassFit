/**
 * Alpha-aware hit testing for comparison product layers.
 * Maps to PRD-F15, PRD-F16, SDD-C5, SDD-C6, DSD-UI9, and QAD-TC27.
 */
import {
  ALUMINUM_COLOR_VARIATIONS,
  normalizeAluminumFinish,
} from "./colorVariations";
import type { PlacedOverlay } from "./types";

export const OVERLAY_ALPHA_THRESHOLD = 24;
export const OVERLAY_HIT_SLOP_CSS_PX = 10;
export const MAX_OVERLAY_MASK_DIMENSION = 1024;

export type OpaqueBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type OverlayAlphaMask = {
  overlayId: string;
  width: number;
  height: number;
  alpha: Uint8Array;
  opaqueBounds: OpaqueBounds | null;
};

export type OverlayAlphaMaskMap = Readonly<Record<string, OverlayAlphaMask>>;

export type ContainTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
  renderedWidth: number;
  renderedHeight: number;
};

export type OverlayHitTestInput = {
  x: number;
  y: number;
  containerWidth: number;
  containerHeight: number;
  orderedOverlayIds: readonly string[];
  masks: OverlayAlphaMaskMap;
  alphaThreshold?: number;
  hitSlopCssPx?: number;
};

export function getOverlayHitMaskSource(overlay: PlacedOverlay) {
  if (overlay.flattenedImageDataUrl) {
    return overlay.flattenedImageDataUrl;
  }

  const committedFinish = normalizeAluminumFinish(
    overlay.configuration.aluminumFinish,
  );
  const committedSource = overlay.variationImageDataUrls?.[committedFinish];
  if (committedSource) {
    return committedSource;
  }

  for (const variation of ALUMINUM_COLOR_VARIATIONS) {
    const source = overlay.variationImageDataUrls?.[variation.key];
    if (source) {
      return source;
    }
  }

  return null;
}

export function calculateContainTransform(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): ContainTransform | null {
  if (
    !isPositiveFinite(containerWidth)
    || !isPositiveFinite(containerHeight)
    || !isPositiveFinite(imageWidth)
    || !isPositiveFinite(imageHeight)
  ) {
    return null;
  }

  const scale = Math.min(
    containerWidth / imageWidth,
    containerHeight / imageHeight,
  );
  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;

  return {
    scale,
    offsetX: (containerWidth - renderedWidth) / 2,
    offsetY: (containerHeight - renderedHeight) / 2,
    renderedWidth,
    renderedHeight,
  };
}

export function createOverlayAlphaMask(
  overlayId: string,
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
  alphaThreshold = OVERLAY_ALPHA_THRESHOLD,
): OverlayAlphaMask {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Overlay mask dimensions must be positive integers.");
  }
  if (rgba.length !== width * height * 4) {
    throw new Error("Overlay mask RGBA data does not match its dimensions.");
  }

  const alpha = new Uint8Array(width * height);
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let pixelIndex = 0; pixelIndex < alpha.length; pixelIndex += 1) {
    const alphaValue = rgba[pixelIndex * 4 + 3];
    alpha[pixelIndex] = alphaValue;
    if (alphaValue < alphaThreshold) continue;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }

  return {
    overlayId,
    width,
    height,
    alpha,
    opaqueBounds: right >= 0 ? { left, top, right, bottom } : null,
  };
}

export function findTopmostOverlayAtPoint({
  x,
  y,
  containerWidth,
  containerHeight,
  orderedOverlayIds,
  masks,
  alphaThreshold = OVERLAY_ALPHA_THRESHOLD,
  hitSlopCssPx = OVERLAY_HIT_SLOP_CSS_PX,
}: OverlayHitTestInput) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || hitSlopCssPx < 0) {
    return null;
  }

  for (let index = orderedOverlayIds.length - 1; index >= 0; index -= 1) {
    const overlayId = orderedOverlayIds[index];
    const mask = masks[overlayId];
    if (!mask?.opaqueBounds) continue;

    const transform = calculateContainTransform(
      containerWidth,
      containerHeight,
      mask.width,
      mask.height,
    );
    if (!transform) return null;

    const maskX = (x - transform.offsetX) / transform.scale;
    const maskY = (y - transform.offsetY) / transform.scale;
    if (
      maskX < 0
      || maskY < 0
      || maskX >= mask.width
      || maskY >= mask.height
    ) {
      continue;
    }

    const radius = Math.ceil(hitSlopCssPx / transform.scale);
    if (hasOpaquePixel(mask, maskX, maskY, radius, alphaThreshold)) {
      return overlayId;
    }
  }

  return null;
}

function hasOpaquePixel(
  mask: OverlayAlphaMask,
  maskX: number,
  maskY: number,
  radius: number,
  alphaThreshold: number,
) {
  const bounds = mask.opaqueBounds;
  if (!bounds) return false;

  const centerX = Math.floor(maskX);
  const centerY = Math.floor(maskY);
  if (
    centerX + radius < bounds.left
    || centerX - radius > bounds.right
    || centerY + radius < bounds.top
    || centerY - radius > bounds.bottom
  ) {
    return false;
  }

  const startX = Math.max(0, centerX - radius);
  const endX = Math.min(mask.width - 1, centerX + radius);
  const startY = Math.max(0, centerY - radius);
  const endY = Math.min(mask.height - 1, centerY + radius);
  const radiusSquared = radius * radius;

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const deltaX = x - centerX;
      const deltaY = y - centerY;
      if (deltaX * deltaX + deltaY * deltaY > radiusSquared) continue;
      if (mask.alpha[y * mask.width + x] >= alphaThreshold) return true;
    }
  }

  return false;
}

function isPositiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}
