"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
};

export function PriceCard({
  productId = "GF_001",
  productName = "Product Name",
  specSummary = "Cabinet | Analok (Champagne gold) | W90 × H180 × D40cm",
  qty = 1,
  unitPrice = 0o0000,
  imageUrl = "/images/modular_cabinets.png",
  details = defaultDetails,
  initiallyExpanded = false,
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

  return (
    <div className="bg-white drop-shadow-[0px_0px_2.5px_rgba(0,0,0,0.25)] flex flex-col gap-5 items-end justify-end px-6 md:px-12 py-7.5 relative rounded-[20px] w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
        <div className="flex flex-1 gap-5 items-center min-w-0">
          <div className="relative shrink-0 w-33.5 h-22 rounded-[10px] overflow-hidden border border-neutral-100 bg-neutral-50 shadow-sm">
            <Image
              alt={productName}
              className="object-cover size-full"
              src={imageUrl}
              fill
              sizes="134px"
            />
          </div>
          <div className="flex flex-col gap-2 items-start min-w-0">
            <span className="text-[#c3c3c3] text-sm font-normal tracking-[-0.266px] leading-[1.4] whitespace-nowrap">
              {productId}
            </span>
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

                <div className="grid grid-cols-2 md:grid-cols-[repeat(6,fit-content(100%))] gap-x-16.75 gap-y-2.5 text-sm w-full text-left">
                  <span className="text-[#c3c3c3] text-sm font-normal">
                    Product Category
                  </span>
                  <span className="text-black text-sm font-normal">
                    {details.category}
                  </span>
                  <span className="text-[#c3c3c3] text-sm font-normal">
                    Product Variant
                  </span>
                  <span className="text-black text-sm font-normal">
                    {details.variant}
                  </span>
                  <span className="text-[#c3c3c3] text-sm font-normal">
                    Material
                  </span>
                  <span className="text-black text-sm font-normal">
                    {details.material}
                  </span>
                  <span className="text-[#c3c3c3] text-sm font-normal">
                    Aluminum Finish
                  </span>
                  <span className="text-black text-sm font-normal">
                    {details.aluminumFinish}
                  </span>
                  <span className="text-[#c3c3c3] text-sm font-normal">
                    Glass Finish
                  </span>
                  <span className="text-black text-sm font-normal">
                    {details.glassFinish}
                  </span>
                  <span className="text-[#c3c3c3] text-sm font-normal">
                    Glass Type
                  </span>
                  <span className="text-black text-sm font-normal">
                    {details.glassType}
                  </span>
                  <span className="text-[#c3c3c3] text-sm font-normal">
                    Glass Thickness
                  </span>
                  <span className="text-black text-sm font-normal">
                    {details.thickness}
                  </span>
                  <span className="text-[#c3c3c3] text-sm font-normal">
                    Profile Grade
                  </span>
                  <span className="text-black text-sm font-normal">
                    {details.profileGrade}
                  </span>
                  <span className="text-[#c3c3c3] text-sm font-normal">
                    Dimension
                  </span>
                  <span className="text-black text-sm font-normal">
                    {details.dimension}
                  </span>
                </div>
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
