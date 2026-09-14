import type {
  PlacedOverlay,
  ProductConfigurationSnapshot,
} from "./types";

export function createDuplicateConfiguration(
  configuration: ProductConfigurationSnapshot,
): ProductConfigurationSnapshot {
  return {
    ...configuration,
    positionX: 0,
    positionY: 0,
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
