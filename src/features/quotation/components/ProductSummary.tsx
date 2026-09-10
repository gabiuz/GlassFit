"use client";

import React, { useMemo } from "react";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";
import type {
  ProductConfigurationSnapshot,
  ProductStructuralDefinition,
} from "@/lib/visualization/types";
import { calculateBOMFromStructuralDefinition } from "@/lib/pricing/pricingEngine";
import { PriceCard, ProductDetailsData } from "./PriceCard";

interface ProductItem {
  productId: string;
  productName: string;
  specSummary: string;
  qty: number;
  unitPrice: number;
  imageUrl: string;
  details: ProductDetailsData;
}

export function ProductSummary() {
  const { finalSnapshotDataUrl, productConfiguration, structuralDefinition } =
    useVisualizationSession();

  const productsData = useMemo(
    () =>
      structuralDefinition
        ? [
            createProductSummaryItem(
              structuralDefinition,
              productConfiguration,
              finalSnapshotDataUrl,
            ),
          ]
        : [],
    [finalSnapshotDataUrl, productConfiguration, structuralDefinition],
  );

  const total = productsData.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);

  const formattedTotal = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(total).replace("PHP", "Php");

  return (
    <div className="bg-[#F5F5F5] flex flex-col gap-9 items-start p-6 md:p-12.5 relative rounded-[20px] w-full">
      <div className="flex items-center justify-start select-none">
        <h2 className="text-black text-3xl font-medium leading-10 whitespace-nowrap">
          Product Summary
        </h2>
      </div>
      <div className="flex flex-col gap-6 w-full">
        {productsData.length > 0 ? (
          productsData.map((prod) => (
            <PriceCard
              key={prod.productId}
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
      <div className="w-full bg-green text-white flex flex-col md:flex-row gap-4 items-center justify-between px-6 md:px-12 py-7.5 rounded-[20px] drop-shadow-[0px_0px_2.5px_rgba(0,0,0,0.25)] select-none">
        <span className="text-xl font-medium leading-7">
          Estimated Total
        </span>
        <span className="text-3xl md:text-5xl font-medium leading-tight md:leading-[57.60px]">
          {formattedTotal}
        </span>
      </div>
    </div>
  );
}

function createProductSummaryItem(
  definition: ProductStructuralDefinition,
  configuration: ProductConfigurationSnapshot | null,
  finalSnapshotDataUrl: string | null,
): ProductItem {
  const widthCm = configuration?.widthCm ?? getDefaultDimensionCm(definition, "width", 210);
  const heightCm = configuration?.heightCm ?? getDefaultDimensionCm(definition, "height", 150);
  const depthCm = getDefaultDimensionCm(definition, "depth", 0);
  const thicknessMm = configuration?.thicknessMm ?? getDefaultNumber(definition, "thickness", 3);
  const aluminumFinish = getAluminumFinishLabel(configuration?.aluminumFinish);
  const glassFinish = getGlassFinishLabel(configuration?.glassAppearance);
  const dimension = formatDimension(widthCm, heightCm, depthCm);
  const material = inferMaterial(definition);

  const widthMm = Math.round(widthCm * 10);
  const heightMm = Math.round(heightCm * 10);
  const hasSill = configuration?.includeSill ?? true;
  const structuralWaiver = configuration?.structuralWaiver ?? false;
  const panelCount = configuration?.panelCount ?? (widthMm >= 2400 ? 3 : 2);

  // Map finish type to pricing engine enum
  const finishType = configuration?.aluminumFinish === "white" ? "PowderCoatedWhite" : "Analok";
  const glassType = thicknessMm >= 6 && configuration?.glassAppearance === "clear"
    ? "6mm_clear"
    : "6mm_bronze";

  // Calculate accurate parametric BOM pricing prioritizing linked catalog raw materials
  const bomCalc = calculateBOMFromStructuralDefinition(definition, {
    widthMm,
    heightMm,
    panelCount,
    hasSill,
    finishType,
    glassType,
    structuralWaiver,
  });

  const unitPrice = bomCalc.finalQuotation > 0 ? bomCalc.finalQuotation : (definition.product.basePrice ?? 0);

  return {
    productId: definition.product.productId,
    productName: definition.product.productName,
    specSummary: [
      definition.product.productType,
      aluminumFinish,
      dimension,
      !hasSill ? "Flush Base (No Sill)" : null,
      panelCount > 2 ? `${panelCount}-Panel` : null,
    ].filter(Boolean).join(" | "),
    qty: configuration?.quantity ?? 1,
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
