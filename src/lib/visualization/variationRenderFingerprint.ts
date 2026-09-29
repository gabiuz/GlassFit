import type { AluminumFinishKey } from "./colorVariations";
import type { PlacedOverlay, VariationRenderRecipe } from "./types";

export const VARIATION_RENDER_SCHEMA_VERSION = 1;

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${stableSerialize(record[key])}`
  )).join(",")}}`;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createVariationRenderFingerprint(
  recipe: VariationRenderRecipe,
  finish: AluminumFinishKey,
) {
  const configuration = recipe.configuration;
  return fnv1a(stableSerialize({
    schemaVersion: VARIATION_RENDER_SCHEMA_VERSION,
    productId: recipe.productId,
    templateId: recipe.templateId,
    structuralDefinition: recipe.structuralDefinition,
    configuration: {
      widthCm: configuration.widthCm,
      heightCm: configuration.heightCm,
      thicknessMm: configuration.thicknessMm,
      panelCount: configuration.panelCount,
      includeSill: configuration.includeSill,
      yaw: configuration.yaw,
      pitch: configuration.pitch,
      rotateAngle: configuration.rotateAngle,
      isFlipped: configuration.isFlipped,
      zoomLevel: configuration.zoomLevel,
      glassAppearance: configuration.glassAppearance,
      glassColor: configuration.glassColor,
      glassThicknessMm: configuration.glassThicknessMm,
      glassType: configuration.glassType,
      ambientLight: configuration.ambientLight,
      autoShadow: configuration.autoShadow,
      autoRealism: configuration.autoRealism,
      positionX: configuration.positionX,
      positionY: configuration.positionY,
      visualParameterValues: configuration.visualParameterValues,
      perspectiveFitCorners: configuration.perspectiveFitCorners,
      activeOcclusionIds: configuration.activeOcclusionIds,
      manualOcclusionMaskDataUrl: configuration.manualOcclusionMaskDataUrl,
      manualOcclusionPolygons: configuration.manualOcclusionPolygons,
    },
    sourceCanvasWidth: recipe.sourceCanvasWidth,
    sourceCanvasHeight: recipe.sourceCanvasHeight,
    sourceOverlayWidth: recipe.sourceOverlayWidth,
    sourceOverlayHeight: recipe.sourceOverlayHeight,
    visibleModelBounds: recipe.visibleModelBounds,
    finish,
  }));
}

export function createVariationCacheKey(
  assetSessionId: string,
  overlayId: string,
  finish: AluminumFinishKey,
  fingerprint: string,
) {
  return `${assetSessionId}:${overlayId}:${finish}:${fingerprint}`;
}

export function hasUsableVariationRecipe(
  overlay: PlacedOverlay,
): overlay is PlacedOverlay & { variationRenderRecipe: VariationRenderRecipe } {
  return Boolean(overlay.variationRenderRecipe);
}
