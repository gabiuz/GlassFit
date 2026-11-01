"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { SelectedAccessoryState } from "@/lib/visualization/types";

export type ProductDetailsData = {
  category: string;
  variant: string;
  material: string;
  aluminumFinish: string;
  glassFinish: string;
  glassType: string;
  thickness: string;
  profileGrade: string;
  dimension: string;
  hasSill?: boolean;
  structuralWaiver?: boolean;
  selectedAddon?: "screen" | "grill" | "none" | null;
  addonProductId?: string | null;
  addonName?: string | null;
  addonPrice?: number | null;
  addonAluminumFinish?: string | null;
  addonMountingSide?: "front" | "back";
  hatchCount?: number;
  hatchTargetKeys?: string[];
  baseUnitPrice?: number | null;
  swappedAccessories?: SelectedAccessoryState[];
  accessoryPriceDelta?: number;
  bomGroups?: {
    framingAmount: number;
    glazingAmount: number;
    hardwareAmount: number;
    laborAmount: number;
    directMaterialsSubtotal: number;
    contractorMargin: number;
  };
};

export type PriceCardProps = {
  productId?: string;
  productName?: string;
  specSummary?: string;
  qty?: number;
  unitPrice?: number;
  imageUrl?: string;
  details?: ProductDetailsData;
  initiallyExpanded?: boolean;
  itemIndex?: number;
  totalItems?: number;
};

const defaultDetails: ProductDetailsData = {
  category: "Cabinet",
  variant: "Kitchen Cabinet",
  material: "Aluminum/Glass",
  aluminumFinish: "Analok (Champagne Gold)",
  glassFinish: "Clear",
  glassType: "Tempered Glass",
  thickness: "3mm",
  profileGrade: "High-end",
  dimension: "W 90cm X H 180cm x D 40cm",
  hasSill: true,
  structuralWaiver: false,
};

export function PriceCard({
  productId = "GF_001",
  productName = "Product Name",
  specSummary = "Cabinet | Analok (Champagne gold) | W90 × H180 × D40cm",
  qty = 1,
  unitPrice = 0,
  imageUrl = "/images/modular_cabinets.png",
  details = defaultDetails,
  initiallyExpanded = false,
  itemIndex,
  totalItems,
}: PriceCardProps) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

  const formattedUnitPrice = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  })
    .format(unitPrice)
    .replace("PHP", "Php");

  const subtotal = unitPrice * qty;
  const formattedSubtotal = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  })
    .format(subtotal)
    .replace("PHP", "Php");

  const hasSill = details.hasSill ?? true;
  const hasWaiver = details.structuralWaiver ?? false;
  const activeAccessories = (details.swappedAccessories ?? []).filter((selection) => selection.accessoryId !== "default");
  const accessoryPriceDelta = details.accessoryPriceDelta ?? 0;
  const summaryItems = [
    ["Product Category", details.category],
    ["Product Variant", details.variant],
    ["Material", details.material],
    ["Aluminum Finish", details.aluminumFinish],
    ["Glass Finish", details.glassFinish],
    ["Glass Type", details.glassType],
    ["Glass Thickness", details.thickness],
    ["Profile Grade", details.profileGrade],
    ["Dimension", details.dimension],
    [
      "Add-on Attachment",
      details.addonName && details.selectedAddon && details.selectedAddon !== "none"
        ? `${details.addonName}${details.addonAluminumFinish ? ` (${details.addonAluminumFinish})` : ""}${typeof details.addonPrice === "number" && details.addonPrice > 0 ? ` (+₱${details.addonPrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })})` : ""}`
        : "None",
    ],
    ...activeAccessories.map((selection) => [
      "Hardware & Accessories",
      `${selection.accessoryName} | ${selection.horizontalPosition === "left" ? "Left Side" : "Right Side"} (${selection.verticalPosition === "bottom" ? "Bottom Rail" : "Mid-Height"}) | ${selection.finish}${(selection.priceDelta ?? 0) > 0 ? ` (+₱${(selection.priceDelta ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })})` : ""}`,
    ]),
  ];

  return (
    <div className="bg-white drop-shadow-[0px_0px_2.5px_rgba(0,0,0,0.25)] flex flex-col gap-5 items-end justify-end px-6 md:px-12 py-7.5 relative rounded-[20px] w-full">
      {/* Structural Waiver Caution Banner */}
      {hasWaiver && (
        <div className="w-full bg-amber-50 border border-amber-300 rounded-[14px] p-4 text-left flex flex-col gap-1 select-none">
          <div className="flex items-center gap-2 text-amber-800 font-medium text-sm sm:text-base">
            <span>⚠️</span>
            <span>Structural Span Limit Waiver Acknowledged</span>
          </div>
          <p className="text-amber-700 text-xs sm:text-sm">
            Notice: This configuration exceeds standard Series 798 2-panel structural width recommendations (W &ge; 2400mm). The customer has acknowledged potential operational stiffness and wind-load deflection risks per NSCP 2015.
          </p>
        </div>
      )}

      {/* Sill Omission Deduction Notice */}
      {!hasSill && (
        <div className="w-full bg-teal-50 border border-teal-200 rounded-[14px] p-3 text-left flex items-center justify-between text-xs sm:text-sm text-teal-800 select-none">
          <span className="font-medium">✓ Bottom Sill Profile Omitted</span>
          <span className="text-teal-600">Net price deduction applied for flush-floor threshold</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
        <div className="flex flex-1 flex-col sm:flex-row gap-4 sm:gap-5 items-start sm:items-center min-w-0 w-full">
          <div className="relative shrink-0 w-full sm:w-33.5 h-44 sm:h-22 rounded-[10px] overflow-hidden border border-neutral-100 bg-neutral-50 shadow-sm">
            {imageUrl ? (
              <img
                alt={productName}
                className="size-full object-contain"
                draggable={false}
                src={imageUrl}
              />
            ) : null}
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 items-start">
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
              {itemIndex !== undefined && totalItems !== undefined && totalItems > 1 && (
                <span className="bg-[#07b6d3]/15 text-[#078da4] text-xs font-semibold px-2.5 py-0.5 rounded-full border border-[#07b6d3]/30">
                  Item {itemIndex} of {totalItems}
                </span>
              )}
              <span className="max-w-full break-all text-[#c3c3c3] text-sm font-normal tracking-[-0.266px] leading-[1.4]">
                {productId}
              </span>
              {details.addonName && details.selectedAddon && details.selectedAddon !== "none" && (
                <span className="bg-[#07b6d3]/15 text-[#078da4] text-xs font-semibold px-2.5 py-0.5 rounded-full border border-[#07b6d3]/30">
                  + {details.addonName} {typeof details.addonPrice === "number" && details.addonPrice > 0 ? `(+₱${details.addonPrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })})` : ""}
                </span>
              )}
            </div>
            <h2 className="text-green text-2xl md:text-3.5xl font-medium tracking-[-0.608px] leading-[1.2] truncate max-w-full">
              {productName}
            </h2>
            <p className="text-[#c3c3c3] text-sm font-normal tracking-[-0.266px] leading-[1.4] truncate max-w-full">
              {specSummary}
            </p>
            <div className="bg-[#c3c3c3] border border-[#c3c3c3] border-solid flex items-center justify-center px-2.5 py-1.25 rounded-[20px] shrink-0 mt-1 select-none">
              <span className="text-white text-base font-normal tracking-[-0.304px] leading-[1.4] whitespace-nowrap">
                Qty: {qty}
              </span>
            </div>
          </div>
        </div>
        {/* unit price and toggle arrow */}
        <div className="flex gap-7.5 items-center justify-between md:justify-end shrink-0 self-stretch md:self-center">
          <div className="flex flex-col gap-1 items-start md:items-end">
            <span className="text-black text-base font-normal tracking-[-0.304px] leading-[1.4]">
              Unit Price
            </span>
            <span className="text-[#c3c3c3] text-[24px] font-medium tracking-[-0.456px] leading-[1.2]">
              {formattedUnitPrice}
            </span>
            {((details.selectedAddon && details.selectedAddon !== "none" && typeof details.addonPrice === "number" && details.addonPrice > 0) || accessoryPriceDelta > 0) && (
              <span className="text-[11px] text-neutral-400 text-left md:text-right">
                Base: {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(details.baseUnitPrice ?? (unitPrice - (details.addonPrice ?? 0) - accessoryPriceDelta)).replace("PHP", "Php")}
                {typeof details.addonPrice === "number" && details.addonPrice > 0 ? ` + Add-on: ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(details.addonPrice).replace("PHP", "Php")}` : ""}
                {accessoryPriceDelta > 0 ? ` + Hardware: ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(accessoryPriceDelta).replace("PHP", "Php")}` : ""}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-neutral-50 hover:bg-neutral-100 text-black shrink-0 transition-colors border border-neutral-200/60"
            aria-label={isExpanded ? "Collapse details" : "Expand details"}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 shrink-0" />
            )}
          </button>
        </div>
      </div>
      <div className="w-full flex flex-col">
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="overflow-hidden w-full select-none"
            >
              <div className="border-t border-[#c3c3c3] border-solid w-full flex flex-col gap-5 pt-5 mt-2 pb-5">
                <div className="py-2.5">
                  <h4 className="text-[#c3c3c3] text-lg font-medium tracking-[-0.342px] leading-none">
                    Detail Summary
                  </h4>
                </div>

                <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-x-6 gap-y-3 text-left">
                  {summaryItems.map(([label, value], index) => (
                    <div key={`${label}-${index}`} className="flex min-w-0 flex-col gap-1">
                      <span className="text-[#c3c3c3] text-sm font-normal">{label}</span>
                      <span className="min-w-0 text-black text-sm font-normal [overflow-wrap:anywhere]">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Grouped 4-Item BOM Breakdown */}
                {details.bomGroups && (
                  <div className="mt-4 pt-4 border-t border-dashed border-neutral-200">
                    <h5 className="text-xs uppercase font-semibold text-neutral-500 mb-3 tracking-wider text-left">
                      Itemized Bill-of-Materials Breakdown
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-left">
                      <div className="bg-neutral-50 p-3 rounded-[12px] border border-neutral-100">
                        <span className="text-xs text-neutral-500 block">1. Aluminum Framing</span>
                        <span className="text-sm font-semibold text-neutral-800">
                          {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(details.bomGroups.framingAmount)}
                        </span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5">Incl. 12% offcut allowance</span>
                      </div>
                      {details.bomGroups.glazingAmount > 0 && <div className="bg-neutral-50 p-3 rounded-[12px] border border-neutral-100">
                        <span className="text-xs text-neutral-500 block">2. Glass Infill</span>
                        <span className="text-sm font-semibold text-neutral-800">
                          {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(details.bomGroups.glazingAmount)}
                        </span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5">Incl. 10% handling scrap</span>
                      </div>}
                      <div className="bg-neutral-50 p-3 rounded-[12px] border border-neutral-100">
                        <span className="text-xs text-neutral-500 block">3. Hardware & Consumables</span>
                        <span className="text-sm font-semibold text-neutral-800">
                          {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(details.bomGroups.hardwareAmount)}
                        </span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5">Rollers, locks & sealants</span>
                      </div>
                      <div className="bg-neutral-50 p-3 rounded-[12px] border border-neutral-100">
                        <span className="text-xs text-neutral-500 block">4. Workshop Labor</span>
                        <span className="text-sm font-semibold text-neutral-800">
                          {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(details.bomGroups.laborAmount)}
                        </span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5">Miter cutting & assembly</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="border-t border-[#c3c3c3] border-solid flex items-center justify-between py-5 w-full mt-2">
          <span className="text-black text-base font-normal tracking-[-0.304px] leading-[1.4]">
            Estimated Subtotal
          </span>
          <span className="text-green text-[32px] font-medium tracking-[-0.608px] leading-[1.2]">
            {formattedSubtotal}
          </span>
        </div>
      </div>
    </div>
  );
}
