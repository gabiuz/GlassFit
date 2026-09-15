import type {
  AluminumFinishKey,
} from "./colorVariations";
import { normalizeAluminumFinish } from "./colorVariations";
import type {
  PlacedOverlay,
  ProductConfigurationSnapshot,
} from "./types";

const MIN_OVERLAY_WIDTH = 120;
const MIN_OVERLAY_HEIGHT = 90;
const MAX_OVERLAY_WIDTH = 1800;
const MAX_OVERLAY_HEIGHT = 1400;
const DEFAULT_PRODUCT_WIDTH_CM = 210;
const DEFAULT_PRODUCT_HEIGHT_CM = 150;
const DEFAULT_OVERLAY_WIDTH_PX = 540;
const DEFAULT_OVERLAY_HEIGHT_PX = 385;

export function getPlacedLayerImageUrls(
  placedOverlays: PlacedOverlay[],
  finish: AluminumFinishKey,
) {
  return placedOverlays.map(
    (overlay) =>
      overlay.variationImageDataUrls?.[finish] ?? overlay.flattenedImageDataUrl,
  );
}

export function getComparisonLayerImageUrls(
  overlays: PlacedOverlay[],
  selectedOverlayId: string,
  selectedFinish: AluminumFinishKey,
) {
  return overlays.map((overlay) => {
    const finish = overlay.overlayId === selectedOverlayId
      ? selectedFinish
      : normalizeAluminumFinish(overlay.configuration.aluminumFinish);

    return overlay.variationImageDataUrls?.[finish] ?? overlay.flattenedImageDataUrl;
  });
}

export function preserveActivePlacedLayer({
  activeImageDataUrl,
  currentFinish,
  variationImageDataUrls,
}: {
  activeImageDataUrl: string;
  currentFinish: AluminumFinishKey;
  variationImageDataUrls: Partial<Record<AluminumFinishKey, string>>;
}) {
  return {
    flattenedImageDataUrl: activeImageDataUrl,
    variationImageDataUrls: {
      ...variationImageDataUrls,
      [currentFinish]: activeImageDataUrl,
    },
  };
}

export function getOverlaySizeFromConfiguration(
  configuration: ProductConfigurationSnapshot,
) {
  const width = Number(configuration.widthCm) || DEFAULT_PRODUCT_WIDTH_CM;
  const height = Number(configuration.heightCm) || DEFAULT_PRODUCT_HEIGHT_CM;
  const widthPx = DEFAULT_OVERLAY_WIDTH_PX * (width / DEFAULT_PRODUCT_WIDTH_CM);
  const heightPx = DEFAULT_OVERLAY_HEIGHT_PX * (height / DEFAULT_PRODUCT_HEIGHT_CM);
  const zoomScale = 1 + (configuration.zoomLevel ?? 10) / 100;

  return {
    width: Math.round(
      Math.min(MAX_OVERLAY_WIDTH, Math.max(MIN_OVERLAY_WIDTH, widthPx)) * zoomScale,
    ),
    height: Math.round(
      Math.min(MAX_OVERLAY_HEIGHT, Math.max(MIN_OVERLAY_HEIGHT, heightPx)) * zoomScale,
    ),
  };
}

export function getComparisonOverlayFrame({
  overlay,
  renderedWidth,
  renderedHeight,
  offsetX,
  offsetY,
}: {
  overlay: PlacedOverlay;
  renderedWidth: number;
  renderedHeight: number;
  offsetX: number;
  offsetY: number;
}) {
  const sourceCanvasWidth = overlay.sourceCanvasWidth ?? renderedWidth;
  const sourceCanvasHeight = overlay.sourceCanvasHeight ?? renderedHeight;
  const xScale = renderedWidth / Math.max(sourceCanvasWidth, 1);
  const yScale = renderedHeight / Math.max(sourceCanvasHeight, 1);
  const fallbackSize = getOverlaySizeFromConfiguration(overlay.configuration);
  const overlayWidth = overlay.sourceOverlayWidth ?? fallbackSize.width;
  const overlayHeight = overlay.sourceOverlayHeight ?? fallbackSize.height;
  const visibleBounds = overlay.visibleModelBounds ?? {
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  };
  const rotation = overlay.configuration.rotateAngle;
  const rotationRadians = (rotation * Math.PI) / 180;
  const localCenterX =
    (visibleBounds.left + visibleBounds.width / 2 - 0.5) * overlayWidth;
  const localCenterY =
    (visibleBounds.top + visibleBounds.height / 2 - 0.5) * overlayHeight;
  const rotatedCenterX =
    localCenterX * Math.cos(rotationRadians) -
    localCenterY * Math.sin(rotationRadians);
  const rotatedCenterY =
    localCenterX * Math.sin(rotationRadians) +
    localCenterY * Math.cos(rotationRadians);

  return {
    centerX:
      offsetX +
      renderedWidth / 2 +
      ((overlay.configuration.positionX ?? 0) + rotatedCenterX) * xScale,
    centerY:
      offsetY +
      renderedHeight / 2 +
      ((overlay.configuration.positionY ?? 0) + rotatedCenterY) * yScale,
    width: overlayWidth * visibleBounds.width * xScale,
    height: overlayHeight * visibleBounds.height * yScale,
    rotation,
  };
}

export function createDuplicateConfiguration(
  configuration: ProductConfigurationSnapshot,
): ProductConfigurationSnapshot {
  return {
    ...configuration,
    positionX: 0,
    positionY: 0,
    perspectiveFitCorners: null,
  };
}

export function getVisualizationHeaderDetails({
  originalFileName,
  placedOverlays,
  activeProductName,
}: {
  originalFileName?: string;
  placedOverlays: PlacedOverlay[];
  activeProductName?: string;
}) {
  const productNames = placedOverlays.map((overlay) => overlay.productName);
  if (activeProductName) {
    productNames.push(activeProductName);
  }

  const productCounts = new Map<string, number>();
  for (const productName of productNames) {
    productCounts.set(productName, (productCounts.get(productName) ?? 0) + 1);
  }

  return {
    fileName: originalFileName || "Uploaded space",
    productCount: productNames.length,
    tags: Array.from(productCounts, ([productName, count]) =>
      count > 1 ? `${productName} x${count}` : productName,
    ),
  };
}
