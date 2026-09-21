/** Pure Product Details preview calculations for IMP-MS09. */
export const MIN_PRODUCT_QUANTITY = 1;
export const MAX_PRODUCT_QUANTITY = 999;
export const MAX_VISIBLE_PREVIEW_MODELS = 5;

export type Vector3Values = { x: number; y: number; z: number };
export type DimensionPairResult =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | { status: "valid"; widthCm: number; heightCm: number };

export function validateDimensionPair(widthValue: string, heightValue: string): DimensionPairResult {
  const width = widthValue.trim();
  const height = heightValue.trim();
  if (!width && !height) return { status: "empty" };
  if (!width || !height) {
    return { status: "invalid", message: "Enter both width and height to preview proportions." };
  }

  const widthCm = Number(width);
  const heightCm = Number(height);
  if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
    return { status: "invalid", message: "Width and height must be numbers greater than zero." };
  }
  const ratio = widthCm / heightCm;
  if (ratio < 0.1 || ratio > 10) {
    return { status: "invalid", message: "Width-to-height ratio must be between 0.1 and 10." };
  }
  return { status: "valid", widthCm, heightCm };
}

export type ModelTransform = { scale: Vector3Values; position: Vector3Values };

export function calculateModelTransform(
  sourceSize: Vector3Values,
  sourceCenter: Vector3Values,
  dimensions?: { widthCm: number; heightCm: number },
): ModelTransform | null {
  if (![sourceSize.x, sourceSize.y, sourceSize.z].every((value) => Number.isFinite(value) && value > 0)) {
    return null;
  }

  let scale: Vector3Values;
  if (dimensions) {
    const ratio = dimensions.widthCm / dimensions.heightCm;
    if (!Number.isFinite(ratio) || ratio < 0.1 || ratio > 10) return null;
    const targetWidth = ratio >= 1 ? 2 : 2 * ratio;
    const targetHeight = ratio >= 1 ? 2 / ratio : 2;
    const scaleX = targetWidth / sourceSize.x;
    const scaleY = targetHeight / sourceSize.y;
    scale = { x: scaleX, y: scaleY, z: Math.min(scaleX, scaleY) };
  } else {
    const uniformScale = 2 / Math.max(sourceSize.x, sourceSize.y, sourceSize.z);
    scale = { x: uniformScale, y: uniformScale, z: uniformScale };
  }

  return {
    scale,
    position: {
      x: -sourceCenter.x * scale.x,
      y: -sourceCenter.y * scale.y,
      z: -sourceCenter.z * scale.z,
    },
  };
}

export function normalizeProductQuantity(value: string | number): number {
  if (value === "" || (typeof value === "string" && !value.trim())) return MIN_PRODUCT_QUANTITY;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return MIN_PRODUCT_QUANTITY;
  return Math.min(MAX_PRODUCT_QUANTITY, Math.max(MIN_PRODUCT_QUANTITY, Math.floor(numeric)));
}

export function getVisiblePreviewModelCount(quantity: number): number {
  return Math.min(normalizeProductQuantity(quantity), MAX_VISIBLE_PREVIEW_MODELS);
}

export function calculatePreviewLayoutPositions(quantity: number, modelWidth: number): number[] {
  const count = getVisiblePreviewModelCount(quantity);
  if (!Number.isFinite(modelWidth) || modelWidth <= 0) return [];
  return Array.from({ length: count }, (_, index) =>
    (index - (count - 1) / 2) * modelWidth * 1.15,
  );
}

export function getPreviewOverflowLabel(quantity: number): string | null {
  const normalized = normalizeProductQuantity(quantity);
  return normalized > MAX_VISIBLE_PREVIEW_MODELS
    ? `+${normalized - MAX_VISIBLE_PREVIEW_MODELS} more`
    : null;
}
