import type { AluminumFinishKey } from "./colorVariations";
import {
  ALUMINUM_COLOR_VARIATIONS,
  normalizeAluminumFinish,
} from "./colorVariations";
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

export type ProductVariantPanel = "left" | "right";

export type ProductVariantSelection = {
  left: AluminumFinishKey;
  right: AluminumFinishKey;
};

export type ProductVariantSelections = Record<string, ProductVariantSelection>;

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
  selections: ProductVariantSelections,
  panel: ProductVariantPanel,
) {
  return overlays.map((overlay) => {
    const finish = selections[overlay.overlayId]?.[panel]
      ?? normalizeAluminumFinish(overlay.configuration.aluminumFinish);
    const imageDataUrl = overlay.variationImageDataUrls?.[finish];

    if (!imageDataUrl) {
      throw new Error(
        `Product variation data is incomplete for ${overlay.productName}. Return to Edit Placement to regenerate the comparison.`,
      );
    }

    return imageDataUrl;
  });
}

export function hasCompleteVariationLayers(overlays: PlacedOverlay[]) {
  return overlays.every((overlay) =>
    ALUMINUM_COLOR_VARIATIONS.every(
      (variation) => Boolean(overlay.variationImageDataUrls?.[variation.key]),
    ),
  );
}

export function createProductVariantSelections(
  overlays: PlacedOverlay[],
): ProductVariantSelections {
  return Object.fromEntries(
    overlays.map((overlay) => {
      const finish = normalizeAluminumFinish(overlay.configuration.aluminumFinish);
      return [overlay.overlayId, { left: finish, right: finish }];
    }),
  );
}

export function reconcileProductVariantSelections(
  current: ProductVariantSelections,
  overlays: PlacedOverlay[],
): ProductVariantSelections {
  const initialized = createProductVariantSelections(overlays);
  return Object.fromEntries(
    overlays.map((overlay) => [
      overlay.overlayId,
      current[overlay.overlayId] ?? initialized[overlay.overlayId],
    ]),
  );
}

export function updateProductVariantSelection(
  current: ProductVariantSelections,
  overlayId: string,
  panel: ProductVariantPanel,
  finish: AluminumFinishKey,
): ProductVariantSelections {
  const existing = current[overlayId];
  if (!existing) {
    return current;
  }

  return {
    ...current,
    [overlayId]: {
      ...existing,
      [panel]: finish,
    },
  };
}

export function swapProductVariantSelections(
  current: ProductVariantSelections,
): ProductVariantSelections {
  return Object.fromEntries(
    Object.entries(current).map(([overlayId, selection]) => [
      overlayId,
      { left: selection.right, right: selection.left },
    ]),
  );
}

export function commitProductVariantSelections(
  overlays: PlacedOverlay[],
  selections: ProductVariantSelections,
) {
  return overlays.map((overlay) => {
    const finish = selections[overlay.overlayId]?.left
      ?? normalizeAluminumFinish(overlay.configuration.aluminumFinish);
    return {
      ...overlay,
      configuration: {
        ...overlay.configuration,
        aluminumFinish: finish,
      },
    };
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
