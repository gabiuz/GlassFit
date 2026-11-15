"use client";

import React, { useMemo } from "react";
import { RotateCcw, Lock, AlertTriangle, Layers, Sparkles, Check } from "lucide-react";
import type { ProductComponentDefinition } from "@/lib/visualization/types";
import type { RawMaterial } from "@/lib/pricing/types";

export interface PartMaterialsSandboxProps {
  components: ProductComponentDefinition[];
  rawMaterials: RawMaterial[];
  materialOverrides: Record<string, string>;
  onMaterialChange: (componentKey: string, rawMaterialId: string) => void;
  onResetToDefaults: () => void;
  onApplyFramingFinish: (finishType: string) => void;
}

export function PartMaterialsSandbox({
  components,
  rawMaterials,
  materialOverrides,
  onMaterialChange,
  onResetToDefaults,
  onApplyFramingFinish,
}: PartMaterialsSandboxProps) {
  // Group components by presentation category
  const categories = useMemo(() => {
    const groups: Record<string, ProductComponentDefinition[]> = {
      Framing: [],
      Glazing: [],
      Hardware: [],
      Consumable: [],
      Other: [],
    };

    components.forEach((comp) => {
      const cat = comp.presentationCategory || "Framing";
      if (groups[cat]) {
        groups[cat].push(comp);
      } else {
        groups.Other.push(comp);
      }
    });

    return groups;
  }, [components]);

  // Determine available framing finishes among framing components
  const framingFinishes = useMemo(() => {
    const finishes = new Set<string>();
    const framingComps = categories.Framing || [];

    framingComps.forEach((comp) => {
      const allowedBindings = comp.allowedMaterials || [];
      allowedBindings.forEach((binding) => {
        const mat = rawMaterials.find((m) => m.id === binding.rawMaterialId);
        if (mat?.finish_type && mat.finish_type !== "None") {
          finishes.add(mat.finish_type);
        }
      });
      if (comp.rawMaterial?.finish_type && comp.rawMaterial.finish_type !== "None") {
        finishes.add(comp.rawMaterial.finish_type);
      }
    });

    return Array.from(finishes);
  }, [categories.Framing, rawMaterials]);

  // Format finish name for human readability
  const formatFinishName = (finish: string) => {
    if (finish.toLowerCase() === "powdercoatedwhite") return "White";
    if (finish.toLowerCase() === "powdercoatedblack") return "Black";
    return finish;
  };

  const getResolvedAllowedMaterials = (comp: ProductComponentDefinition): { rawMaterial: RawMaterial; isDefault: boolean }[] => {
    const list: { rawMaterial: RawMaterial; isDefault: boolean }[] = [];
    const seenIds = new Set<string>();

    if (comp.allowedMaterials && comp.allowedMaterials.length > 0) {
      comp.allowedMaterials.forEach((binding) => {
        const mat = rawMaterials.find((m) => m.id === binding.rawMaterialId) || binding.rawMaterial;
        if (mat && !seenIds.has(mat.id)) {
          seenIds.add(mat.id);
          list.push({ rawMaterial: mat, isDefault: binding.isDefault });
        }
      });
    }

    // Fallback to singular rawMaterialId if no junction bindings were found
    if (list.length === 0) {
      const singleId = comp.rawMaterialId || comp.rawMaterial?.id;
      if (singleId) {
        const mat = rawMaterials.find((m) => m.id === singleId) || comp.rawMaterial;
        if (mat && !seenIds.has(mat.id)) {
          seenIds.add(mat.id);
          list.push({ rawMaterial: mat, isDefault: true });
        }
      }
    }

    return list;
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-[12px] p-4 shadow-xs space-y-4">
      {/* Header with Reset Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-xs text-[#0f1422] uppercase tracking-wider">
              Simulate Material Configurations
            </h3>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#07b6d3]/10 text-[#07b6d3] font-semibold">
              Sandbox
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Test how different candidate materials impact product aesthetics and live pricing before activation.
          </p>
        </div>
        <button
          type="button"
          onClick={onResetToDefaults}
          className="self-start sm:self-auto flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1.5 rounded-[8px] font-medium transition-colors cursor-pointer"
        >
          <RotateCcw className="size-3 text-neutral-500" />
          <span>Reset to Defaults</span>
        </button>
      </div>

      {/* Symmetrical Framing Group Material Synchronization */}
      {framingFinishes.length > 1 && (
        <div className="bg-neutral-50 border border-neutral-200/80 rounded-[10px] p-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-[#07b6d3]" />
            <span className="text-xs font-semibold text-neutral-800">Apply to All Framing:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {framingFinishes.map((finish) => (
              <button
                key={finish}
                type="button"
                onClick={() => onApplyFramingFinish(finish)}
                className="text-[11px] px-2 py-0.5 rounded-full border border-neutral-300 hover:border-[#07b6d3] hover:text-[#07b6d3] bg-white font-medium transition-colors cursor-pointer"
              >
                {formatFinishName(finish)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Categorized Component Parts */}
      <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
        {(["Framing", "Glazing", "Hardware", "Consumable", "Other"] as const).map((categoryName) => {
          const compList = categories[categoryName] || [];
          if (compList.length === 0) return null;

          const categoryTitle =
            categoryName === "Framing"
              ? "Framing Members"
              : categoryName === "Glazing"
              ? "Glazing Infill"
              : categoryName === "Hardware"
              ? "Hardware & Accessories"
              : categoryName === "Consumable"
              ? "Consumables & Weatherseals"
              : "Other Components";

          return (
            <div key={categoryName} className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                <Layers className="size-3 text-[#07b6d3]" />
                <span>{categoryTitle}</span>
                <span className="text-[10px] text-neutral-400 font-normal">({compList.length})</span>
              </div>

              <div className="space-y-2">
                {compList.map((comp) => {
                  const allowedList = getResolvedAllowedMaterials(comp);
                  const activeMatId =
                    materialOverrides[comp.componentKey] ||
                    allowedList.find((item) => item.isDefault)?.rawMaterial.id ||
                    comp.rawMaterialId ||
                    "";

                  const defaultItem = allowedList.find((item) => item.isDefault);
                  const defaultPrice = defaultItem ? defaultItem.rawMaterial.unit_price : 0;

                  return (
                    <div
                      key={comp.componentKey}
                      className="border border-neutral-200 rounded-[10px] p-2.5 bg-[#fcfcfc] hover:bg-white transition-colors"
                    >
                      {/* Part Identity */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-semibold text-neutral-800 truncate">
                            {comp.componentName}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400 truncate">
                            ({comp.componentKey})
                          </span>
                        </div>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 shrink-0">
                          Qty: {comp.baseQuantity}
                        </span>
                      </div>

                      {/* Material Option Selector */}
                      {comp.pricingMethod === "Fixed" || comp.dimensionBinding === "FIXED" || (typeof comp.unitPrice === "number" && comp.unitPrice > 0) ? (
                        <div className="flex items-center justify-between text-xs bg-cyan-50/70 border border-cyan-200 rounded-[8px] p-2 text-cyan-900">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Lock className="size-3 text-[#07b6d3] shrink-0" />
                            <span className="font-semibold text-[#07b6d3]">Fixed Component</span>
                            <span className="text-neutral-500 text-[11px]">(Non-parametric)</span>
                          </div>
                          {typeof comp.unitPrice === "number" && comp.unitPrice > 0 && (
                            <span className="text-[11px] font-mono font-medium text-neutral-700 shrink-0 ml-2">
                              PHP {comp.unitPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      ) : allowedList.length === 0 ? (
                        // Case C: Component has zero materials configured
                        <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 rounded-[8px] p-2 text-xs">
                          <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
                          <span className="font-semibold">[ ! Unassigned ]</span>
                          <span className="text-amber-700">(Free component - zero cost)</span>
                        </div>
                      ) : allowedList.length === 1 ? (
                        // Case B: Component has exactly one material configured
                        <div className="flex items-center justify-between text-xs bg-neutral-100/70 border border-neutral-200 rounded-[8px] p-2 text-neutral-700">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Lock className="size-3 text-neutral-400 shrink-0" />
                            <span className="font-medium truncate">
                              {allowedList[0].rawMaterial.description}
                            </span>
                            {allowedList[0].rawMaterial.finish_type && allowedList[0].rawMaterial.finish_type !== "None" && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-200 text-neutral-700">
                                {formatFinishName(allowedList[0].rawMaterial.finish_type)}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-neutral-500 shrink-0 ml-2">
                            PHP {allowedList[0].rawMaterial.unit_price.toFixed(2)}/{allowedList[0].rawMaterial.billing_unit}
                          </span>
                        </div>
                      ) : (
                        // Case A: Component has multiple allowed materials
                        <div className="grid grid-cols-1 gap-1.5">
                          {allowedList.map(({ rawMaterial: mat }) => {
                            const isSelected = activeMatId === mat.id;
                            const priceDelta = mat.unit_price - defaultPrice;

                            return (
                              <button
                                key={mat.id}
                                type="button"
                                onClick={() => onMaterialChange(comp.componentKey, mat.id)}
                                className={`flex items-center justify-between text-left p-2 rounded-[8px] border text-xs transition-all cursor-pointer ${
                                  isSelected
                                    ? "border-[#07b6d3] bg-[#07b6d3]/10 text-neutral-900 shadow-2xs"
                                    : "border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className={`size-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                      isSelected
                                        ? "border-[#07b6d3] bg-[#07b6d3] text-white"
                                        : "border-neutral-300 bg-white"
                                    }`}
                                  >
                                    {isSelected && <Check className="size-2.5 stroke-[3]" />}
                                  </div>
                                  <span className="truncate font-medium">{mat.description}</span>
                                  {mat.finish_type && mat.finish_type !== "None" && (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.2 rounded shrink-0 ${
                                        isSelected
                                          ? "bg-[#07b6d3]/20 text-[#07b6d3] font-semibold"
                                          : "bg-neutral-100 text-neutral-600"
                                      }`}
                                    >
                                      {formatFinishName(mat.finish_type)}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  {/* Price Delta Badge */}
                                  {priceDelta === 0 ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 font-mono">
                                      Base
                                    </span>
                                  ) : priceDelta > 0 ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                                      +PHP {priceDelta.toFixed(2)}/{mat.billing_unit}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                      -PHP {Math.abs(priceDelta).toFixed(2)}/{mat.billing_unit}
                                    </span>
                                  )}

                                  <span className="text-[11px] font-mono text-neutral-500">
                                    PHP {mat.unit_price.toFixed(2)}/{mat.billing_unit}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
