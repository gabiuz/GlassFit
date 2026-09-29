"use client";

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
import type { ItemizedProductQuotation } from "@/lib/pricing/types";
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

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between w-full">
          <div className="flex flex-col items-start">
            <span className="text-xl sm:text-2xl font-medium leading-7">
              {productsData.length > 1
                ? "Final Estimated Quotation (Overall Total)"
                : "Estimated Total"}
            </span>
            <span className="text-xs sm:text-sm text-white/80">
              Includes material offcuts, hardware, workshop labor, and contractor margin
            </span>
          </div>
          <span className="text-3xl md:text-5xl font-medium leading-tight md:leading-[57.60px]">
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
  const widthMm = Math.round(widthCm * 10);
  const heightMm = Math.round(heightCm * 10);
  const panelCount = config.panelCount ?? (widthMm >= 2400 ? 3 : 2);
  const finishType =
    config.aluminumFinish === "white" ? "PowderCoatedWhite" : "Analok";
  const glassType =
    thicknessMm >= 6 && config.glassAppearance === "clear"
      ? "6mm_clear"
      : "6mm_bronze";

  const itemId = overlay.overlayId || `overlay-${index}`;

  const item: ProductItem = {
    itemId,
    productId: overlay.productId,
    productName: overlay.productName,
    specSummary: [
      aluminumFinish,
      dimension,
      !hasSill ? "Flush Base (No Sill)" : null,
      panelCount > 2 ? `${panelCount}-Panel` : null,
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
      material: "Aluminum/Glass",
      aluminumFinish,
      glassFinish,
      glassType: glassFinish,
      thickness: `${thicknessMm}mm`,
      profileGrade: "Series 798",
      dimension,
      hasSill,
      structuralWaiver,
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

  const widthMm = Math.round(widthCm * 10);
  const heightMm = Math.round(heightCm * 10);
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

  const unitPrice =
    bomCalc.finalQuotation > 0
      ? bomCalc.finalQuotation
      : definition.product.basePrice ?? 0;
  const qty = configuration?.quantity ?? 1;
  const totalPrice = unitPrice * qty;
  const itemId = definition.product.productId;

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
      glassFinish,
      glassType: glassFinish,
      thickness: `${thicknessMm}mm`,
      profileGrade: definition.template.modelStrategy,
      dimension,
      hasSill,
      structuralWaiver,
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
  const parts = [`W ${Math.round(widthCm)}cm`, `H ${Math.round(heightCm)}cm`];
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
