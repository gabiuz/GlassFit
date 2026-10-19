import type {
  MeasurementConfirmationEntry,
  PlacedOverlay,
  ProductStructuralDefinition,
  ProductConfigurationSnapshot,
} from "@/lib/visualization/types";
import type { CatalogProduct } from "@/lib/products/types";

const CM_TO_IN = 0.393701;

/**
 * Converts centimeters to inches rounded to 1 decimal place.
 */
export function convertCmToIn(cm: number): number {
  return Math.round(cm * CM_TO_IN * 10) / 10;
}

/**
 * Converts inches to centimeters rounded to the nearest integer.
 */
export function convertInToCm(inches: number): number {
  return Math.round(inches / CM_TO_IN);
}

/**
 * Resolves the 3D model preview URL for a product.
 */
function resolvePreviewGlbUrl(
  productId: string,
  catalogProducts: CatalogProduct[],
  structuralDefinition: ProductStructuralDefinition | null,
  overlayPreviewGlbUrl?: string | null,
): string | null {
  if (overlayPreviewGlbUrl) {
    return overlayPreviewGlbUrl;
  }

  if (structuralDefinition && structuralDefinition.product.productId === productId) {
    if (structuralDefinition.product.preview_glb_url) {
      return structuralDefinition.product.preview_glb_url;
    }
    const assetGlb = structuralDefinition.assets?.find(
      (a) =>
        (a.assetType === "Catalog 3D Preview" || a.assetType === "Whole Model") &&
        a.status === "Active" &&
        Boolean(a.url),
    );
    if (assetGlb?.url) {
      return assetGlb.url;
    }
  }

  const catalogProduct = catalogProducts.find((p) => p.id === productId);
  if (catalogProduct) {
    if (catalogProduct.previewGlbUrl) return catalogProduct.previewGlbUrl;
    const extended = catalogProduct as unknown as {
      preview_glb_url?: string | null;
      previewGlbUrl?: string | null;
    };
    if (extended.preview_glb_url) return extended.preview_glb_url;
    if (extended.previewGlbUrl) return extended.previewGlbUrl;
  }

  return null;
}

/**
 * Builds the list of measurement confirmation entries for the confirmation modal.
 * Non-active placed overlays are ordered first, followed by the active workspace product.
 */
export function buildMeasurementEntries(
  comparisonOverlays: PlacedOverlay[],
  activeStructuralDefinition: ProductStructuralDefinition | null,
  activeWidthCm: string | number,
  activeHeightCm: string | number,
  activeTotalPrice: number,
  catalogProducts: CatalogProduct[] = [],
  activeConfiguration?: ProductConfigurationSnapshot | null,
): MeasurementConfirmationEntry[] {
  const entries: MeasurementConfirmationEntry[] = [];

  const nonActiveOverlays = comparisonOverlays.filter((overlay) => !overlay.isActive);
  const activeOverlayFromList = comparisonOverlays.find((overlay) => overlay.isActive);

  for (const overlay of nonActiveOverlays) {
    const config = overlay.configuration;
    const systemWidthCm = config?.widthCm ?? 0;
    const systemHeightCm = config?.heightCm ?? 0;
    const systemTotalPrice = overlay.totalPrice ?? overlay.unitPrice ?? 0;
    const aluminumFinish = config?.aluminumFinish ?? "white";
    const previewGlbUrl = resolvePreviewGlbUrl(
      overlay.productId,
      catalogProducts,
      activeStructuralDefinition?.product.productId === overlay.productId
        ? activeStructuralDefinition
        : null,
      overlay.previewGlbUrl,
    );

    entries.push({
      overlayId: overlay.overlayId,
      productId: overlay.productId,
      productName: overlay.productName,
      aluminumFinish,
      previewGlbUrl,
      systemWidthCm,
      systemHeightCm,
      systemTotalPrice,
      structuralDefinition:
        activeStructuralDefinition?.product.productId === overlay.productId
          ? activeStructuralDefinition
          : overlay.variationRenderRecipe?.structuralDefinition ?? null,
      overlayConfiguration: config,
      isActiveProduct: false,
      override: {
        widthIn: convertCmToIn(systemWidthCm),
        heightIn: convertCmToIn(systemHeightCm),
        widthOverridden: false,
        heightOverridden: false,
        acknowledged: false,
      },
      recalculatedTotalPrice: null,
      dimensionSource:
        (config.visualParameterValues?.dimension_source as string | undefined) ?? undefined,
      calibrationMethod:
        (config.visualParameterValues?.calibration_method as string | undefined) ?? null,
      calibrationConfidence:
        (config.visualParameterValues?.calibration_confidence as number | undefined) ?? null,
      paperStandard:
        (config.visualParameterValues?.paper_standard as string | undefined) ?? null,
      calibrationScaleCmPerPx:
        (config.visualParameterValues?.calibration_scale_cm_per_px as number | undefined) ?? null,
      userVerified:
        (config.visualParameterValues?.user_verified as boolean | undefined) ?? null,
    });
  }

  if (activeOverlayFromList || activeStructuralDefinition) {
    const activeOverlay = activeOverlayFromList;
    const productId =
      activeOverlay?.productId ??
      activeStructuralDefinition?.product.productId ??
      "active-product";
    const productName =
      activeOverlay?.productName ??
      activeStructuralDefinition?.product.productName ??
      "Selected Product";
    const systemWidthCm =
      activeOverlay?.configuration.widthCm ??
      (Number(activeWidthCm) || 210);
    const systemHeightCm =
      activeOverlay?.configuration.heightCm ??
      (Number(activeHeightCm) || 150);
    const systemTotalPrice =
      activeOverlay?.totalPrice ?? activeTotalPrice;
    const aluminumFinish =
      activeOverlay?.configuration.aluminumFinish ??
      activeConfiguration?.aluminumFinish ??
      "white";
    const previewGlbUrl = resolvePreviewGlbUrl(
      productId,
      catalogProducts,
      activeStructuralDefinition,
      activeOverlay?.previewGlbUrl,
    );

    const fallbackConfig: ProductConfigurationSnapshot = {
      widthCm: systemWidthCm,
      heightCm: systemHeightCm,
      thicknessMm: 6,
      quantity: 1,
      aluminumFinish,
      glassAppearance: "clear",
      includeSill: true,
      yaw: 0,
      pitch: 0,
      rotateAngle: 0,
      isFlipped: false,
      visualParameterValues: {},
    };

    entries.push({
      overlayId: activeOverlay?.overlayId ?? `active-${productId}`,
      productId,
      productName,
      aluminumFinish,
      previewGlbUrl,
      systemWidthCm,
      systemHeightCm,
      systemTotalPrice,
      structuralDefinition: activeStructuralDefinition,
      overlayConfiguration:
        activeOverlay?.configuration ?? activeConfiguration ?? fallbackConfig,
      isActiveProduct: true,
      override: {
        widthIn: convertCmToIn(systemWidthCm),
        heightIn: convertCmToIn(systemHeightCm),
        widthOverridden: false,
        heightOverridden: false,
        acknowledged: false,
      },
      recalculatedTotalPrice: null,
      dimensionSource:
        (activeOverlay?.configuration.visualParameterValues?.dimension_source as string | undefined) ??
        (activeConfiguration?.visualParameterValues?.dimension_source as string | undefined) ??
        undefined,
      calibrationMethod:
        (activeOverlay?.configuration.visualParameterValues?.calibration_method as string | undefined) ??
        (activeConfiguration?.visualParameterValues?.calibration_method as string | undefined) ??
        null,
      calibrationConfidence:
        (activeOverlay?.configuration.visualParameterValues?.calibration_confidence as number | undefined) ??
        (activeConfiguration?.visualParameterValues?.calibration_confidence as number | undefined) ??
        null,
      paperStandard:
        (activeOverlay?.configuration.visualParameterValues?.paper_standard as string | undefined) ??
        (activeConfiguration?.visualParameterValues?.paper_standard as string | undefined) ??
        null,
      calibrationScaleCmPerPx:
        (activeOverlay?.configuration.visualParameterValues?.calibration_scale_cm_per_px as number | undefined) ??
        (activeConfiguration?.visualParameterValues?.calibration_scale_cm_per_px as number | undefined) ??
        null,
      userVerified:
        (activeOverlay?.configuration.visualParameterValues?.user_verified as boolean | undefined) ??
        (activeConfiguration?.visualParameterValues?.user_verified as boolean | undefined) ??
        null,
    });
  }

  return entries;
}

/**
 * Applies user-confirmed dimension overrides to the placed overlays array.
 */
export function applyMeasurementOverridesToOverlays(
  confirmedEntries: MeasurementConfirmationEntry[],
  currentOverlays: PlacedOverlay[],
): PlacedOverlay[] {
  return currentOverlays.map((overlay) => {
    const matchedEntry = confirmedEntries.find(
      (entry) =>
        entry.overlayId === overlay.overlayId,
    );

    if (!matchedEntry) {
      return overlay;
    }

    const {
      override,
      recalculatedTotalPrice,
      dimensionSource,
      calibrationMethod,
      calibrationConfidence,
      paperStandard,
      calibrationScaleCmPerPx,
      userVerified,
    } = matchedEntry;

    if (!override?.widthOverridden && !override?.heightOverridden) {
      if (
        dimensionSource ||
        calibrationMethod ||
        paperStandard ||
        calibrationScaleCmPerPx !== undefined ||
        userVerified !== undefined
      ) {
        return {
          ...overlay,
          configuration: {
            ...overlay.configuration,
            visualParameterValues: {
              ...(overlay.configuration.visualParameterValues ?? {}),
              ...(dimensionSource ? { dimension_source: dimensionSource } : {}),
              ...(dimensionSource && dimensionSource !== "planar_paper_estimate"
                ? { calibration_provenance: null, metric_measurement: null } : {}),
              ...(calibrationMethod ? { calibration_method: calibrationMethod } : {}),
              ...(calibrationConfidence !== undefined && calibrationConfidence !== null
                ? { calibration_confidence: calibrationConfidence }
                : {}),
              ...(paperStandard ? { paper_standard: paperStandard } : {}),
              ...(calibrationScaleCmPerPx !== undefined && calibrationScaleCmPerPx !== null
                ? { calibration_scale_cm_per_px: calibrationScaleCmPerPx }
                : {}),
              ...(userVerified !== undefined && userVerified !== null
                ? { user_verified: userVerified }
                : {}),
            },
          },
        };
      }
      return overlay;
    }

    const nextWidthCm = override.widthOverridden
      ? convertInToCm(override.widthIn)
      : overlay.configuration.widthCm;
    const nextHeightCm = override.heightOverridden
      ? convertInToCm(override.heightIn)
      : overlay.configuration.heightCm;

    const nextVisualValues = {
      ...(overlay.configuration.visualParameterValues ?? {}),
      ...(dimensionSource ? { dimension_source: dimensionSource } : {}),
      ...(calibrationMethod ? { calibration_method: calibrationMethod } : {}),
      ...(calibrationConfidence !== undefined && calibrationConfidence !== null
        ? { calibration_confidence: calibrationConfidence }
        : {}),
      ...(paperStandard ? { paper_standard: paperStandard } : {}),
      ...(calibrationScaleCmPerPx !== undefined && calibrationScaleCmPerPx !== null
        ? { calibration_scale_cm_per_px: calibrationScaleCmPerPx }
        : {}),
      ...(userVerified !== undefined && userVerified !== null
        ? { user_verified: userVerified }
        : {}),
      dimension_source: "manual_tape", calibration_provenance: null, metric_measurement: null, user_verified: false,
      ...(override.widthOverridden
        ? { width: nextWidthCm * 10 }
        : {}),
      ...(override.heightOverridden
        ? { height: nextHeightCm * 10 }
        : {}),
    };

    const nextConfig: ProductConfigurationSnapshot = {
      ...overlay.configuration,
      widthCm: nextWidthCm,
      heightCm: nextHeightCm,
      visualParameterValues: nextVisualValues,
    };

    const nextTotalPrice =
      recalculatedTotalPrice !== null
        ? recalculatedTotalPrice
        : overlay.totalPrice;

    const quantity = Math.max(1, overlay.configuration.quantity ?? 1);
    const nextUnitPrice =
      nextTotalPrice !== undefined ? nextTotalPrice / quantity : overlay.unitPrice;

    return {
      ...overlay,
      configuration: nextConfig,
      variationAssetRefs: undefined,
      variationRenderRecipe: overlay.variationRenderRecipe
        ? { ...overlay.variationRenderRecipe, configuration: nextConfig }
        : undefined,
      totalPrice: nextTotalPrice,
      unitPrice: nextUnitPrice,
    };
  });
}
