"use client";

import React, { useState } from "react";
import { ChevronDown, RotateCcw, Palette, ShieldCheck, Check, Sparkles } from "lucide-react";
import type {
  MaterialCustomizationGroup,
  MaterialCustomizationOption,
} from "@/lib/visualization/materialCustomization";
import {
  formatPriceDelta,
  hasMultipleMaterialOptions,
} from "@/lib/visualization/materialCustomization";

export interface MaterialCustomizerPanelProps {
  groups: MaterialCustomizationGroup[];
  totalPrice?: number;
  selectedMaterials?: Record<string, string>;
  onSelectOption: (group: MaterialCustomizationGroup, option: MaterialCustomizationOption) => void;
  onResetDefaults?: () => void;
  onResetToDefaults?: () => void;
  className?: string;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  isMobile?: boolean;
}

export function MaterialCustomizerPanel({
  groups,
  totalPrice,
  selectedMaterials,
  onSelectOption,
  onResetDefaults,
  onResetToDefaults,
  className = "",
  isCollapsible = true,
  defaultExpanded = true,
  isMobile = false,
}: MaterialCustomizerPanelProps) {
  const handleReset = onResetDefaults || onResetToDefaults;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const formattedTotal = typeof totalPrice === "number"
    ? new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
        .format(totalPrice)
        .replace("PHP", "PHP ")
    : null;

  return (
    <div
      className={`rounded-[20px] ${
        isMobile
          ? "border-0 shadow-none bg-transparent"
          : "border border-neutral-200/80 bg-white/95 backdrop-blur-md shadow-lg"
      } transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-[10px] bg-[#07b6d3]/10 text-[#07b6d3]">
            <Palette className="size-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-[#0f1422] sm:text-base">
              Finishes &amp; Materials
            </h3>
            <p className="text-[11px] text-neutral-500">
              Personalize framing colors and glazing varieties
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {handleReset && (
            <button
              type="button"
              onClick={handleReset}
              title="Reset to Product Defaults"
              aria-label="Reset to Defaults"
              className="flex items-center gap-1 rounded-[10px] border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 cursor-pointer"
            >
              <RotateCcw className="size-3 text-neutral-500" />
              <span className="hidden sm:inline">Reset to Defaults</span>
            </button>
          )}

          {isCollapsible && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
              aria-label="Toggle finishes panel"
              className="flex size-8 items-center justify-center rounded-[10px] border border-neutral-200 bg-neutral-50 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 cursor-pointer"
            >
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {(!isCollapsible || isExpanded) && (
        <div className="space-y-5 p-4 sm:p-5">
          {groups.map((group) => {
            const isConfigurable = hasMultipleMaterialOptions(group);
            const activeOption =
              (selectedMaterials && group.affectedComponentKeys.length > 0
                ? group.options.find(
                    (o) => o.materialId === selectedMaterials[group.affectedComponentKeys[0]],
                  )
                : null) ||
              group.options.find((o) => o.materialId === group.selectedMaterialId) ||
              group.options[0];

            return (
              <div key={group.groupId} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
                    {group.groupLabel}
                  </span>
                  {!isConfigurable && activeOption && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                      Standard Specification
                    </span>
                  )}
                </div>

                {isConfigurable ? (
                  /* Interactive Swatch Selection (QAD-TC81.1) */
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {group.options.map((option) => {
                      const isSelected = option.materialId === group.selectedMaterialId;
                      const isTempered = option.description.toLowerCase().includes("tempered");
                      const isClear = option.description.toLowerCase().includes("clear");
                      const isBase = option.priceDeltaTotal === 0;

                      return (
                        <button
                          key={option.materialId}
                          type="button"
                          onClick={() => onSelectOption(group, option)}
                          aria-pressed={isSelected}
                          className={`relative flex min-h-[48px] items-center justify-between rounded-[14px] border p-2.5 text-left transition-all cursor-pointer ${
                            isSelected
                              ? "border-[#07b6d3] bg-[#07b6d3]/5 shadow-xs ring-2 ring-[#07b6d3]/20"
                              : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            {/* Color Swatch Circle */}
                            <span
                              className="size-5 shrink-0 rounded-full border border-black/15 shadow-2xs flex items-center justify-center"
                              style={{ backgroundColor: option.swatchColor || "#94a3b8" }}
                              aria-hidden="true"
                            >
                              {isSelected && (
                                <Check
                                  className={`size-3 ${
                                    option.swatchColor === "#f5f6f8" || option.swatchColor === "#e6f4f8" || option.swatchColor === "#e0f2fe"
                                      ? "text-[#0f1422]"
                                      : "text-white"
                                  }`}
                                />
                              )}
                            </span>

                            <div className="min-w-0 flex flex-col">
                              <span className="truncate text-xs font-medium text-[#0f1422]">
                                {option.description}
                              </span>
                              {isTempered && (
                                <span className="flex items-center gap-1 text-[10px] text-sky-600 font-medium">
                                  <ShieldCheck className="size-3" /> Safety Grade
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Price Tag Badge */}
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isSelected
                                ? "bg-[#07b6d3] text-white"
                                : isBase
                                ? "bg-neutral-100 text-neutral-600"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            }`}
                          >
                            {isBase ? (isClear ? "Included" : "Base") : formatPriceDelta(option.priceDeltaTotal)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Single-Material Static Badge (QAD-TC81.2) */
                  <div className="flex items-center justify-between rounded-[12px] border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-4.5 rounded-full border border-black/10 shadow-2xs"
                        style={{ backgroundColor: activeOption?.swatchColor || "#94a3b8" }}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-[#0f1422]">
                        {activeOption?.description || "Standard Specification"}
                      </span>
                    </div>
                    <span className="rounded-full bg-neutral-200/80 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                      Standard
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Footer: Live Price Recalculation (QAD-TC81.4) */}
          {formattedTotal !== null && (
            <div className="border-t border-neutral-100 pt-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-[11px] font-medium text-neutral-500">
                    Estimated Fabrication Total
                  </span>
                  <span className="font-mono text-base font-bold text-[#07b6d3] sm:text-lg">
                    {formattedTotal}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-[8px] border border-emerald-200/60">
                  <Sparkles className="size-3" />
                  <span>Live Recalculation</span>
                </div>
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">
                Estimated fabrication price based on your selected finishes.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
