"use client";

import { quotationMeasurement } from "@/lib/visualization/measurementRecord";
import React, { useMemo } from "react";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";
import type {
  PlacedOverlay,
  ProductConfigurationSnapshot,
  ProductStructuralDefinition,
} from "@/lib/visualization/types";
import {
  calculateBOMFromStructuralDefinition,
  calculateOverlayPricing,
  aggregateMultiProductBOM,
} from "@/lib/pricing/pricingEngine";
import { computeLouverBladeCount, computeLouverOperatorCount } from "@/lib/visualization/jalousieGeometryAnalyzer";
import { computeDynamicBayCount, computeMullionCount } from "@/lib/visualization/bayReplicationEngine";
import type { ItemizedProductQuotation, DynamicBayConfig } from "@/lib/pricing/types";
import { PriceCard, ProductDetailsData } from "./PriceCard";

interface ProductItem {
  itemId: string;
  productId: string;
  productName: string;
  specSummary: string;
  qty: number;
  unitPrice: number;
  imageUrl: string;
  details: ProductDetailsData;
}

export function ProductSummary() {
  const {
    finalSnapshotDataUrl,
    productConfiguration,
    structuralDefinition,
    placedOverlays,
    comparisonOverlays,
  } = useVisualizationSession();

  const { productsData, consolidatedSummary } = useMemo(() => {
    const overlays =
      placedOverlays && placedOverlays.length > 0
        ? placedOverlays
        : comparisonOverlays && comparisonOverlays.length > 0
          ? comparisonOverlays
          : [];

    const items: ProductItem[] = [];
    const quotations: ItemizedProductQuotation[] = [];

    if (overlays.length > 0) {
      overlays.forEach((overlay, idx) => {
        const { item, quotation } = createProductSummaryItemFromOverlay(
          overlay,
          idx,
          finalSnapshotDataUrl,
        );
        items.push(item);
        quotations.push(quotation);
      });
    } else if (structuralDefinition) {
      const { item, quotation } = createProductSummaryItem(
        structuralDefinition,
        productConfiguration,
        finalSnapshotDataUrl,
      );
      items.push(item);
      quotations.push(quotation);
    }

    const summary = aggregateMultiProductBOM(quotations);

    return { productsData: items, consolidatedSummary: summary };
  }, [
    finalSnapshotDataUrl,
    placedOverlays,
    comparisonOverlays,
    productConfiguration,
    structuralDefinition,
  ]);

  const formattedTotal = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  })
    .format(consolidatedSummary.finalGrandTotal)
    .replace("PHP", "Php");

  return (
    <div className="bg-[#F5F5F5] flex flex-col gap-9 items-start p-6 md:p-12.5 relative rounded-[20px] w-full">
      <div className="flex items-center justify-start select-none">
        <h2 className="text-black text-3xl font-medium leading-10 whitespace-nowrap">
          Product Summary
        </h2>
      </div>

      {/* Itemized Separate Quotations for Each Product */}
      <div className="flex flex-col gap-6 w-full">
        {productsData.length > 0 ? (
          productsData.map((prod, index) => (
            <PriceCard
              key={prod.itemId}
              itemIndex={index + 1}
              totalItems={productsData.length}
              productId={prod.productId}
              productName={prod.productName}
              specSummary={prod.specSummary}
              qty={prod.qty}
              unitPrice={prod.unitPrice}
              imageUrl={prod.imageUrl}
              details={prod.details}
              initiallyExpanded
            />
          ))
        ) : (
          <div className="rounded-[20px] bg-white px-6 py-7.5 text-black shadow-sm">
            No configured product was found for this quotation yet.
          </div>
        )}
      </div>

      {/* Final Consolidated Grand Quotation Card */}
      <div className="w-full bg-green text-white flex flex-col gap-5 p-6 md:p-8 rounded-[20px] drop-shadow-[0px_0px_2.5px_rgba(0,0,0,0.25)] select-none">
        {productsData.length > 1 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b border-white/20 text-xs sm:text-sm">
            <div>
              <span className="text-white/70 block">Total Fixtures</span>
              <span className="font-semibold text-white text-base">
                {productsData.length} Items ({consolidatedSummary.totalQuantity} Units)
              </span>
            </div>
            <div>
              <span className="text-white/70 block">Aluminum Framing</span>
              <span className="font-semibold text-white text-base">
                {consolidatedSummary.totalFramingMeters.toFixed(1)} linear meters
              </span>
            </div>
            <div>
              <span className="text-white/70 block">Glazing Surface</span>
              <span className="font-semibold text-white text-base">
                {consolidatedSummary.totalGlazingSqm.toFixed(2)} sqm
              </span>
            </div>
            <div>
              <span className="text-white/70 block">Fabrication Labor</span>
              <span className="font-semibold text-white text-base">
                ₱{consolidatedSummary.totalLaborCost.toLocaleString("en-PH")}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between w-full min-w-0">
          <div className="flex flex-col items-start min-w-0">
            <span className="text-xl sm:text-2xl font-medium leading-7">
              {productsData.length > 1
                ? "Final Estimated Quotation (Overall Total)"
                : "Estimated Total"}
            </span>
            <span className="text-xs sm:text-sm text-white/80">
              Includes material offcuts, hardware, workshop labor, and contractor margin
            </span>
          </div>
          <span className="max-w-full min-w-0 text-3xl md:text-5xl font-medium leading-tight md:leading-[57.60px] [overflow-wrap:anywhere]">
            {formattedTotal}
          </span>
        </div>
      </div>
    </div>
  );
}

function createProductSummaryItemFromOverlay(
  overlay: PlacedOverlay,
  index: number,
  finalSnapshotDataUrl: string | null,
): { item: ProductItem; quotation: ItemizedProductQuotation } {
  const config = overlay.configuration;
  const widthCm = Number(config.widthCm) || 120;
  const heightCm = Number(config.heightCm) || 120;
  const depthCm = 0;
  const thicknessMm = Number(config.thicknessMm) || 6;
  const aluminumFinish = getAluminumFinishLabel(config.aluminumFinish);
  const glassFinish = getGlassFinishLabel(config.glassAppearance);
  const dimension = formatDimension(widthCm, heightCm, depthCm);

  const pricing = calculateOverlayPricing(overlay);
  const bomCalc = pricing.bomResult;
  const unitPrice = pricing.unitPrice;
  const qty = config.quantity ?? 1;
  const totalPrice = pricing.totalPrice;

  const hasSill = config.includeSill ?? true;
  const structuralWaiver = config.structuralWaiver ?? false;
  const widthMm = (widthCm * 10);
  const heightMm = (heightCm * 10);
  const panelCount = config.panelCount ?? (widthMm >= 2400 ? 3 : 2);
  const finishType =
    config.aluminumFinish === "white" ? "PowderCoatedWhite" : "Analok";
  const glassType =
    thicknessMm >= 6 && config.glassAppearance === "clear"
      ? "6mm_clear"
      : "6mm_bronze";

  const itemId = overlay.overlayId || `overlay-${index}`;
  const addonPrice = config.addonPrice ?? 0;
  const accessoryPriceDelta = config.accessoryPriceDelta ?? 0;
  const swappedAccessories = Object.values(config.swappedAccessories ?? {});
  const addonName = config.addonName ?? null;
  const selectedAddon = (config.selectedAddon as "none" | "screen" | "grill") ?? (config.addonProductId ? "screen" : undefined);
  const addonProductId = config.addonProductId ?? null;
  const addonAluminumFinish = config.addonAluminumFinish;
  const addonMountingSide = (config.addonMountingSide as "front" | "back") ?? undefined;
  const hatchCount = Number(config.hatchCount) || 0;
  const hatchTargetKeys = Array.isArray(config.hatchTargetKeys) ? (config.hatchTargetKeys as string[]) : undefined;

  const sideLabel = addonMountingSide === "back"
    ? "Interior Mount / Back"
    : addonMountingSide === "front"
      ? "Exterior Mount / Front"
      : null;
  const hatchLabel = hatchCount > 0
    ? `with ${hatchCount}x Operator Access ${hatchCount === 1 ? "Hatch" : "Hatches"}`
    : null;
  const sideHatchClause = [sideLabel, hatchLabel].filter(Boolean).length > 0
    ? ` (${[sideLabel, hatchLabel].filter(Boolean).join(", ")})`
    : "";

  const formattedAddonName = addonName
    ? `${addonName}${sideHatchClause}`
    : selectedAddon === "screen"
      ? `Insect Screen${sideHatchClause}`
      : selectedAddon === "grill"
        ? `Security Grille${sideHatchClause}`
        : null;

  const baseUnitPrice = config.baseUnitPrice ?? (unitPrice - addonPrice - accessoryPriceDelta);

  const isJalousieOverlay = (overlay.productName || "").toLowerCase().includes("jalousie");
  const isDynamicBayActiveOverlay = Boolean(overlay.configuration?.dynamicBayConfig?.enabled);
  const nominalPitchMmOverlay = overlay.configuration?.dynamicBayConfig?.nominal_bay_pitch_mm ?? 600;
  const bayCountOverlay = isDynamicBayActiveOverlay ? computeDynamicBayCount(widthMm, nominalPitchMmOverlay) : 1;
  const mullionCountOverlay = isDynamicBayActiveOverlay ? computeMullionCount(bayCountOverlay) : 0;
  const louverCountPerBayOverlay = computeLouverBladeCount(heightMm, 175);
  const opCountPerBayOverlay = computeLouverOperatorCount(louverCountPerBayOverlay, 4);
  const totalLouversOverlay = bayCountOverlay * louverCountPerBayOverlay;
  const totalOpsOverlay = bayCountOverlay * opCountPerBayOverlay;

  const jalousieOverlaySpec = isJalousieOverlay
    ? `${bayCountOverlay > 1 ? `${bayCountOverlay}-Sided Jalousie Window | ` : ""}${totalLouversOverlay}x Glass Louver Blades | ${totalOpsOverlay}x Window Operators${mullionCountOverlay > 0 ? ` | ${mullionCountOverlay}x Center Mullions` : ""}`
    : null;

  const item: ProductItem = {
    itemId,
    productId: overlay.productId,
    productName: overlay.productName,
    specSummary: [
      aluminumFinish,
      dimension,
      !hasSill ? "Flush Base (No Sill)" : null,
      panelCount > 2 ? `${panelCount}-Panel` : null,
      jalousieOverlaySpec,
      formattedAddonName && selectedAddon && selectedAddon !== "none" ? `Add-on: ${formattedAddonName}` : null,
      ...swappedAccessories.filter((selection) => selection.accessoryId !== "default").map((selection) => `Hardware: ${selection.accessoryName}`),
    ]
      .filter(Boolean)
      .join(" | "),
    qty,
    unitPrice,
    imageUrl:
      overlay.flattenedImageDataUrl ||
      finalSnapshotDataUrl ||
      "/images/modular_cabinets.png",
    details: {
      category: "Window & Door",
      variant:
        panelCount > 2 ? `${panelCount}-Panel Configuration` : "2-Panel Standard",
      material: bomCalc.glazingItems.length > 0 ? "Aluminum/Glass" : "Aluminum",
      aluminumFinish,
      glassFinish: bomCalc.glazingItems.length > 0 ? glassFinish : "None",
      glassType: bomCalc.glazingItems.length > 0 ? glassFinish : "None",
      thickness: `${thicknessMm}mm`,
      profileGrade: "Series 798",
      dimension,
      hasSill,
      structuralWaiver,
      selectedAddon,
      addonProductId,
      addonName,
      addonPrice: addonPrice > 0 ? addonPrice : undefined,
      addonAluminumFinish,
      addonMountingSide,
      hatchCount: hatchCount > 0 ? hatchCount : undefined,
      hatchTargetKeys,
      baseUnitPrice,
      swappedAccessories,
      accessoryPriceDelta,
      bomGroups: {
        framingAmount: bomCalc.effectiveFramingCost,
        glazingAmount: bomCalc.effectiveGlazingCost,
        hardwareAmount: bomCalc.hardwareSubtotal + bomCalc.consumablesSubtotal,
        laborAmount: bomCalc.fabricationLaborCost,
        directMaterialsSubtotal: bomCalc.directMaterialsSubtotal,
        contractorMargin: bomCalc.contractorMargin,
      },
    },
  };

  const quotation: ItemizedProductQuotation = {
    itemId,
    productId: overlay.productId,
    productName: overlay.productName,
    productType: "Window & Door",
    variantName:
      panelCount > 2 ? `${panelCount}-Panel Configuration` : "2-Panel Standard",
    specSummary: item.specSummary,
    dimensionsFormatted: dimension,
    widthMm,
    heightMm,
    panelCount,
    hasSill,
    structuralWaiver,
    finishType,
    glassType,
    quantity: qty,
    unitPrice,
    totalPrice,
    imageUrl: item.imageUrl,
    bomResult: bomCalc,
    selectedAddon,
    addonProductId,
    addonName,
    addonPrice: addonPrice > 0 ? addonPrice : undefined,
    baseUnitPrice,
    swappedAccessories: config.swappedAccessories,
    accessoryPriceDelta,
    addonAluminumFinish,
    grilleBOM: overlay.configuration?.grilleBOM ?? overlay.grilleBOM ?? null,
    ...quotationMeasurement(overlay.configuration),
  };

  return { item, quotation };
}

function createProductSummaryItem(
  definition: ProductStructuralDefinition,
  configuration: ProductConfigurationSnapshot | null,
  finalSnapshotDataUrl: string | null,
): { item: ProductItem; quotation: ItemizedProductQuotation } {
  const widthCm =
    configuration?.widthCm ?? getDefaultDimensionCm(definition, "width", 210);
  const heightCm =
    configuration?.heightCm ?? getDefaultDimensionCm(definition, "height", 150);
  const depthCm = getDefaultDimensionCm(definition, "depth", 0);
  const thicknessMm =
    configuration?.thicknessMm ?? getDefaultNumber(definition, "thickness", 3);
  const aluminumFinish = getAluminumFinishLabel(configuration?.aluminumFinish);
  const glassFinish = getGlassFinishLabel(configuration?.glassAppearance);
  const dimension = formatDimension(widthCm, heightCm, depthCm);
  const material = inferMaterial(definition);

  const widthMm = (widthCm * 10);
  const heightMm = (heightCm * 10);
  const hasSill = configuration?.includeSill ?? true;
  const structuralWaiver = configuration?.structuralWaiver ?? false;
  const panelCount = configuration?.panelCount ?? (widthMm >= 2400 ? 3 : 2);

  const finishType =
    configuration?.aluminumFinish === "white" ? "PowderCoatedWhite" : "Analok";
  const glassType =
    thicknessMm >= 6 && configuration?.glassAppearance === "clear"
      ? "6mm_clear"
      : "6mm_bronze";

  const bomCalc = calculateBOMFromStructuralDefinition(definition, {
    widthMm,
    heightMm,
    panelCount,
    hasSill,
    finishType,
    glassType,
    structuralWaiver,
  });

  const addonPrice = configuration?.addonPrice ?? 0;
  const accessoryPriceDelta = configuration?.accessoryPriceDelta ?? 0;
  const swappedAccessories = Object.values(configuration?.swappedAccessories ?? {});
  const addonName = configuration?.addonName ?? null;
  const selectedAddon = (configuration?.selectedAddon as "none" | "screen" | "grill") ?? (configuration?.addonProductId ? "screen" : undefined);
  const addonProductId = configuration?.addonProductId ?? null;
  const addonAluminumFinish = configuration?.addonAluminumFinish;
  const addonMountingSide = (configuration?.addonMountingSide as "front" | "back") ?? undefined;
  const hatchCount = Number(configuration?.hatchCount) || 0;
  const hatchTargetKeys = Array.isArray(configuration?.hatchTargetKeys) ? (configuration?.hatchTargetKeys as string[]) : undefined;

  const sideLabel = addonMountingSide === "back"
    ? "Interior Mount / Back"
    : addonMountingSide === "front"
      ? "Exterior Mount / Front"
      : null;
  const hatchLabel = hatchCount > 0
    ? `with ${hatchCount}x Operator Access ${hatchCount === 1 ? "Hatch" : "Hatches"}`
    : null;
  const sideHatchClause = [sideLabel, hatchLabel].filter(Boolean).length > 0
    ? ` (${[sideLabel, hatchLabel].filter(Boolean).join(", ")})`
    : "";

  const formattedAddonName = addonName
    ? `${addonName}${sideHatchClause}`
    : selectedAddon === "screen"
      ? `Insect Screen${sideHatchClause}`
      : selectedAddon === "grill"
        ? `Security Grille${sideHatchClause}`
        : null;

  const baseUnitPrice =
    bomCalc.finalQuotation > 0
      ? bomCalc.finalQuotation
      : definition.product.basePrice ?? 0;
  const unitPrice = baseUnitPrice + addonPrice + accessoryPriceDelta;
  const qty = configuration?.quantity ?? 1;
  const totalPrice = unitPrice * qty;
  const itemId = definition.product.productId;

  const isJalousie = (definition.product.productType || "").toLowerCase().includes("jalousie") ||
    definition.components.some((c) => c.dimensionBinding === "LOUVER_BLADE" || (c as Record<string, unknown>).dimension_binding === "LOUVER_BLADE");

  const dynamicBayConfig = definition.product.dynamicBayConfig ?? (definition.template as Record<string, unknown> | undefined)?.dynamic_bay_config as DynamicBayConfig | undefined;
  const isDynamicBayActive = Boolean(dynamicBayConfig?.enabled);
  const nominalPitchMm = dynamicBayConfig?.nominal_bay_pitch_mm ?? 600;
  const bayCount = isDynamicBayActive ? computeDynamicBayCount(widthMm, nominalPitchMm) : 1;
  const mullionCount = isDynamicBayActive ? computeMullionCount(bayCount) : 0;

  let jalousieSpec: string | null = null;
  if (isJalousie) {
    const louverComp = definition.components.find((c) => c.dimensionBinding === "LOUVER_BLADE" || (c as Record<string, unknown>).dimension_binding === "LOUVER_BLADE");
    const opComp = definition.components.find((c) => c.dimensionBinding === "LOUVER_OPERATOR" || (c as Record<string, unknown>).dimension_binding === "LOUVER_OPERATOR");
    const pitchMm = louverComp?.jalousieConfig?.pitch_mm ?? louverComp?.jalousieConfig?.pitchMm ?? 175;
    const louverCountPerBay = computeLouverBladeCount(heightMm, pitchMm);
    const bladesPerOp = opComp?.jalousieConfig?.blades_per_operator ?? opComp?.jalousieConfig?.bladesPerOperator ?? 4;
    const opCountPerBay = computeLouverOperatorCount(louverCountPerBay, bladesPerOp);
    const totalLouvers = bayCount * louverCountPerBay;
    const totalOps = bayCount * opCountPerBay;
    jalousieSpec = `${bayCount > 1 ? `${bayCount}-Sided Jalousie Window | ` : ""}${totalLouvers}x Glass Louver Blades | ${totalOps}x Window Operators${mullionCount > 0 ? ` | ${mullionCount}x Center Mullions` : ""}`;
  }

  const item: ProductItem = {
    itemId,
    productId: definition.product.productId,
    productName: definition.product.productName,
    specSummary: [
      definition.product.productType,
      aluminumFinish,
      dimension,
      !hasSill ? "Flush Base (No Sill)" : null,
      panelCount > 2 ? `${panelCount}-Panel` : null,
      jalousieSpec,
      formattedAddonName && selectedAddon && selectedAddon !== "none" ? `Add-on: ${formattedAddonName}` : null,
      ...swappedAccessories.filter((selection) => selection.accessoryId !== "default").map((selection) => `Hardware: ${selection.accessoryName}`),
    ]
      .filter(Boolean)
      .join(" | "),
    qty,
    unitPrice,
    imageUrl:
      finalSnapshotDataUrl ??
      definition.product.catalogImageUrl ??
      "/images/modular_cabinets.png",
    details: {
      category: definition.product.productType,
      variant: definition.template.templateName,
      material,
      aluminumFinish,
      glassFinish: bomCalc.glazingItems.length > 0 ? glassFinish : "None",
      glassType: bomCalc.glazingItems.length > 0 ? glassFinish : "None",
      thickness: `${thicknessMm}mm`,
      profileGrade: definition.template.modelStrategy,
      dimension,
      hasSill,
      structuralWaiver,
      selectedAddon,
      addonProductId,
      addonName,
      addonPrice: addonPrice > 0 ? addonPrice : undefined,
      addonAluminumFinish,
      addonMountingSide,
      hatchCount: hatchCount > 0 ? hatchCount : undefined,
      hatchTargetKeys,
      baseUnitPrice,
      swappedAccessories,
      accessoryPriceDelta,
      bomGroups: {
        framingAmount: bomCalc.effectiveFramingCost,
        glazingAmount: bomCalc.effectiveGlazingCost,
        hardwareAmount: bomCalc.hardwareSubtotal + bomCalc.consumablesSubtotal,
        laborAmount: bomCalc.fabricationLaborCost,
        directMaterialsSubtotal: bomCalc.directMaterialsSubtotal,
        contractorMargin: bomCalc.contractorMargin,
      },
    },
  };

  const quotation: ItemizedProductQuotation = {
    itemId,
    productId: definition.product.productId,
    productName: definition.product.productName,
    productType: definition.product.productType,
    variantName: definition.template.templateName,
    specSummary: item.specSummary,
    dimensionsFormatted: dimension,
    widthMm,
    heightMm,
    panelCount,
    hasSill,
    structuralWaiver,
    finishType,
    glassType,
    quantity: qty,
    unitPrice,
    totalPrice,
    imageUrl: item.imageUrl,
    bomResult: bomCalc,
    selectedAddon,
    addonProductId,
    addonName,
    addonPrice: addonPrice > 0 ? addonPrice : undefined,
    baseUnitPrice,
    swappedAccessories: configuration?.swappedAccessories,
    accessoryPriceDelta,
    addonAluminumFinish,
    addonMountingSide,
    hatchCount: hatchCount > 0 ? hatchCount : undefined,
    hatchTargetKeys,
    grilleBOM: configuration?.grilleBOM ?? null,
    ...quotationMeasurement(configuration),
  };

  return { item, quotation };
}

function getDefaultDimensionCm(
  definition: ProductStructuralDefinition,
  parameterKey: string,
  fallbackCm: number,
) {
  return getDefaultNumber(definition, parameterKey, fallbackCm * 10) / 10;
}

function getDefaultNumber(
  definition: ProductStructuralDefinition,
  parameterKey: string,
  fallback: number,
) {
  const parameter = definition.parameters.find(
    (item) => item.parameterKey === parameterKey,
  );
  const value =
    parameter?.defaultValue ??
    definition.template.baseConfiguration[parameterKey] ??
    fallback;
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDimension(widthCm: number, heightCm: number, depthCm: number) {
  const parts = [`W ${Number(widthCm.toFixed(3))}cm`, `H ${Number(heightCm.toFixed(3))}cm`];
  if (depthCm > 0) {
    parts.push(`D ${Math.round(depthCm)}cm`);
  }

  return parts.join(" X ");
}

function inferMaterial(definition: ProductStructuralDefinition) {
  const componentTypes = Array.from(
    new Set(definition.components.map((component) => component.componentType)),
  );

  return componentTypes.length > 0 ? componentTypes.join("/") : "Configured Product";
}

function getAluminumFinishLabel(value: string | null | undefined) {
  switch (value) {
    case "black":
      return "Black Aluminum";
    case "silver":
      return "Silver Aluminum";
    case "white":
      return "White Aluminum";
    default:
      return "Configured Finish";
  }
}

function getGlassFinishLabel(value: string | null | undefined) {
  switch (value) {
    case "frosted":
      return "Frosted Glass";
    case "opaque":
      return "Opaque Glass";
    case "reflective":
      return "Reflective Glass";
    case "outdoor":
      return "Outdoor Reflection Glass";
    case "clear":
      return "Clear Glass";
    default:
      return "Configured Glass";
  }
}
