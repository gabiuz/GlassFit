"use client";

import React, { useState, useMemo } from "react";
import { Layers, RotateCcw, Check, ChevronDown } from "lucide-react";
import type { ProductComponentDefinition } from "@/lib/visualization/types";
import type { RawMaterial } from "@/lib/pricing/types";
import {
  resolveSwatchColor,
  formatPriceDelta,
} from "@/lib/visualization/materialCustomization";

export interface PartMaterialsPickerProps {
  components: (ProductComponentDefinition & { isFromAddon?: boolean; addonType?: string })[];
  selectedMaterials: Record<string, string>;
  candidateMaterialsMap: Map<string, RawMaterial>;
  allRawMaterials?: RawMaterial[];
  onSelectPartMaterial: (componentKey: string, rawMaterialId: string) => void;
  onResetToDefaults: () => void;
  dimensionsMm?: { widthMm: number; heightMm: number; panelCount?: number };
  className?: string;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
}

interface ComponentMaterialOption {
  rawMaterial: RawMaterial;
  isDefault: boolean;
  priceDelta: number;
  swatchHex: string;
}

export function PartMaterialsPicker({
  components,
  selectedMaterials,
  candidateMaterialsMap,
  allRawMaterials = [],
  onSelectPartMaterial,
  onResetToDefaults,
  dimensionsMm,
  className = "",
  isCollapsible = true,
  defaultExpanded = true,
}: PartMaterialsPickerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("All");
  const [expandedPartKey, setExpandedPartKey] = useState<string | null>(null);

  // Calculate dimensional multiplier for price delta estimation
  const getMultiplier = (comp: ProductComponentDefinition): number => {
    const widthM = (dimensionsMm?.widthMm ?? 1800) / 1000;
    const heightM = (dimensionsMm?.heightMm ?? 1500) / 1000;
    const span = comp.spanRatio ?? 1.0;
    const qty = comp.baseQuantity ?? 1;

    switch (comp.dimensionBinding) {
      case "WIDTH":
        return widthM * span * qty;
      case "HEIGHT":
        return heightM * span * qty;
      case "PERIMETER":
        return 2 * (widthM + heightM) * span * qty;
      case "AREA":
        return widthM * heightM * span * qty;
      case "FIXED":
      default:
        return qty;
    }
  };

  // Resolve candidate materials for a given component
  const getComponentOptions = (comp: ProductComponentDefinition): ComponentMaterialOption[] => {
    const options: ComponentMaterialOption[] = [];
    const seenIds = new Set<string>();
    const isGlass = comp.presentationCategory === "Glazing";
    const multiplier = getMultiplier(comp);

    // 1. Primary: Explicit component allowed materials (configured by admin in Step 4)
    if (comp.allowedMaterials && comp.allowedMaterials.length > 0) {
      for (const binding of comp.allowedMaterials) {
        const mat =
          binding.rawMaterial ||
          candidateMaterialsMap.get(binding.rawMaterialId) ||
          allRawMaterials.find((m) => m.id === binding.rawMaterialId);

        if (mat && !seenIds.has(mat.id)) {
          seenIds.add(mat.id);
          options.push({
            rawMaterial: mat,
            isDefault: Boolean(binding.isDefault),
            priceDelta: 0,
            swatchHex: resolveSwatchColor(mat.finish_type || mat.category, isGlass),
          });
        }
      }
    }

    // 2. Fallback: Direct component material binding
    if (options.length === 0) {
      const singleId = comp.rawMaterialId || comp.rawMaterial?.id;
      const mat = comp.rawMaterial || (singleId ? candidateMaterialsMap.get(singleId) || allRawMaterials.find((m) => m.id === singleId) : null);
      if (mat && !seenIds.has(mat.id)) {
        seenIds.add(mat.id);
        options.push({
          rawMaterial: mat,
          isDefault: true,
          priceDelta: 0,
          swatchHex: resolveSwatchColor(mat.finish_type || mat.category, isGlass),
        });
      }
    }

    // 3. Complementary candidates from catalog for matching category when options are limited
    if (options.length <= 1) {
      const compCategory = comp.presentationCategory === "Framing"
        ? "Aluminum"
        : comp.presentationCategory === "Glazing"
          ? "Glass"
          : comp.presentationCategory === "Hardware"
            ? "Hardware"
            : null;

      if (compCategory) {
        // Collect extra materials from candidateMaterialsMap or allRawMaterials
        const extraCandidates = Array.from(candidateMaterialsMap.values()).concat(allRawMaterials);
        for (const candidate of extraCandidates) {
          if (candidate.category === compCategory && !seenIds.has(candidate.id)) {
            // For framing: offer distinct finishes (Analok, White, Black, Mill)
            if (compCategory === "Aluminum") {
              const finishNorm = (candidate.finish_type || "").toLowerCase().trim();
              if (["analok", "powdercoatedwhite", "powdercoatedblack", "mill", "anodized"].some((f) => finishNorm.includes(f))) {
                seenIds.add(candidate.id);
                options.push({
                  rawMaterial: candidate,
                  isDefault: false,
                  priceDelta: 0,
                  swatchHex: resolveSwatchColor(candidate.finish_type || candidate.category, false),
                });
              }
            } else if (compCategory === "Glass") {
              seenIds.add(candidate.id);
              options.push({
                rawMaterial: candidate,
                isDefault: false,
                priceDelta: 0,
                swatchHex: resolveSwatchColor(candidate.finish_type || candidate.description, true),
              });
            }
          }
        }
      }
    }

    // Determine baseline default price
    const defaultOption = options.find((o) => o.isDefault) || options[0];
    const defaultUnitPrice = defaultOption?.rawMaterial.unit_price ?? 0;

    // Compute price deltas relative to baseline
    return options.map((opt) => ({
      ...opt,
      priceDelta: Math.round((opt.rawMaterial.unit_price - defaultUnitPrice) * multiplier * 100) / 100,
    }));
  };

  // Group components by presentation category
  const categoriesCount = useMemo(() => {
    const counts: Record<string, number> = { All: components.length, Framing: 0, Glazing: 0, Hardware: 0 };
    for (const comp of components) {
      const cat = comp.presentationCategory || "Framing";
      if (counts[cat] !== undefined) {
        counts[cat] += 1;
      }
    }
    return counts;
  }, [components]);

  // Filter components by active tab
  const filteredComponents = useMemo(() => {
    if (activeCategoryFilter === "All") return components;
    return components.filter((c) => (c.presentationCategory || "Framing") === activeCategoryFilter);
  }, [components, activeCategoryFilter]);

  // Count active part overrides
  const customOverrideCount = useMemo(() => {
    let count = 0;
    for (const comp of components) {
      const currentMatId = selectedMaterials[comp.componentKey];
      const defaultMatId =
        comp.allowedMaterials?.find((m) => m.isDefault)?.rawMaterialId ||
        comp.rawMaterialId ||
        comp.rawMaterial?.id;
      if (currentMatId && defaultMatId && currentMatId !== defaultMatId) {
        count += 1;
      }
    }
    return count;
  }, [components, selectedMaterials]);

  if (components.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-[16px] border border-neutral-200/90 bg-white shadow-xs overflow-hidden transition-all ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
        <div className="flex items-start gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-[8px] bg-[#07b6d3]/10 text-[#07b6d3]">
            <Layers className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-[#0f1422]">Customize Raw Materials by Part</h4>
            <p className="text-[11px] text-neutral-500">
              Choose each part&apos;s fabrication specification and compare price changes
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-neutral-600">
            {customOverrideCount} of {components.length} parts customized
          </span>
          <div className="flex items-center gap-2">
          {customOverrideCount > 0 && (
            <button
              type="button"
              onClick={onResetToDefaults}
              title="Reset all component parts to factory standard specifications"
              className="flex items-center gap-1 rounded-[8px] border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3] transition-colors cursor-pointer"
            >
              <RotateCcw className="size-3 text-neutral-400" />
              <span>Reset Defaults</span>
            </button>
          )}

          {isCollapsible && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
              aria-label="Toggle part materials picker"
              className="flex size-7 items-center justify-center rounded-[8px] border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3] transition-colors cursor-pointer"
            >
              <ChevronDown
                className={`size-3.5 transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
          )}
          </div>
        </div>
      </div>

      {/* Body Content */}
      {(!isCollapsible || isExpanded) && (
        <div className="p-4 space-y-4">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5 border-b border-neutral-100 pb-3">
            {(["All", "Framing", "Glazing", "Hardware"] as const).map((cat) => {
              const count = categoriesCount[cat] || 0;
              if (cat !== "All" && count === 0) return null;
              const isActive = activeCategoryFilter === cat;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategoryFilter(cat)}
                  aria-pressed={isActive}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3] transition-colors cursor-pointer ${
                    isActive
                      ? "bg-[#0f1422] text-white shadow-xs"
                      : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80"
                  }`}
                >
                  <span>{cat === "All" ? "All Parts" : cat === "Glazing" ? "Glass" : cat}</span>
                  <span className={`text-[10px] px-1 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-neutral-200 text-neutral-500"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Component Parts List */}
          <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
            {filteredComponents.map((comp) => {
              const options = getComponentOptions(comp);
              const activeMatId =
                selectedMaterials[comp.componentKey] ||
                options.find((o) => o.isDefault)?.rawMaterial.id ||
                comp.rawMaterialId ||
                options[0]?.rawMaterial.id ||
                "";

              const selectedOption = options.find((o) => o.rawMaterial.id === activeMatId) || options[0];
              const category = comp.presentationCategory || "Framing";
              const isPartExpanded = expandedPartKey === comp.componentKey;

              return (
                <div
                  key={comp.componentKey}
                  className="rounded-[12px] border border-neutral-200 bg-[#fbfbfb]"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedPartKey(isPartExpanded ? null : comp.componentKey)}
                    aria-expanded={isPartExpanded}
                    aria-label={`${comp.componentName}: ${selectedOption?.rawMaterial.description || "Standard factory specification"}. ${isPartExpanded ? "Hide" : "Show"} material choices`}
                    className="flex w-full items-center justify-between gap-3 rounded-[12px] p-3 text-left hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#07b6d3] cursor-pointer"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-[#0f1422]">{comp.componentName}</span>
                        <span className="rounded bg-[#07b6d3]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#087f93]">{category}</span>
                        {comp.isFromAddon && <span className="rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] font-medium text-[#087f93]">Add-on</span>}
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-neutral-600" title={selectedOption?.rawMaterial.description}>
                        {selectedOption?.rawMaterial.description || "Standard factory specification"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {selectedOption && <span className="text-[11px] font-medium tabular-nums text-neutral-700">{formatPriceDelta(selectedOption.priceDelta)}</span>}
                      <ChevronDown className={`size-4 text-neutral-500 transition-transform ${isPartExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                    </span>
                  </button>

                  {/* Material Choices */}
                  {isPartExpanded && (options.length === 0 ? (
                    <div className="border-t border-neutral-200 px-3 py-2 text-xs text-neutral-500">
                      Standard factory specification
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 border-t border-neutral-200 p-3 sm:grid-cols-2" role="group" aria-label={`Materials for ${comp.componentName}`}>
                      {options.map((opt) => {
                        const isSelected = opt.rawMaterial.id === activeMatId;
                        const optionLabel = opt.rawMaterial.description?.trim() || opt.rawMaterial.material_code || "Unnamed material";

                        return (
                          <button
                            key={opt.rawMaterial.id}
                            type="button"
                            onClick={() => onSelectPartMaterial(comp.componentKey, opt.rawMaterial.id)}
                            aria-pressed={isSelected}
                            className={`flex items-center justify-between gap-2 p-2 rounded-[8px] border text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3] cursor-pointer ${
                              isSelected
                                ? "bg-white border-[#07b6d3] ring-1 ring-[#07b6d3] shadow-xs"
                                : "bg-white/70 border-neutral-200 hover:bg-white hover:border-neutral-300"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-[#087f93] bg-[#087f93] text-white" : "border-neutral-400"}`} aria-hidden="true">
                                {isSelected && <Check className="size-3" />}
                              </span>
                              <div className="min-w-0">
                                <span className="block text-xs font-medium text-[#0f1422]">
                                  {optionLabel}
                                </span>
                                {opt.isDefault && <span className="text-[10px] text-neutral-500">Default</span>}
                              </div>
                            </div>

                            <span
                              className={`text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded shrink-0 ${
                                opt.priceDelta === 0
                                  ? "bg-neutral-100 text-neutral-600"
                                  : opt.priceDelta > 0
                                    ? "bg-[#07b6d3]/10 text-[#07b6d3]"
                                    : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {formatPriceDelta(opt.priceDelta)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
