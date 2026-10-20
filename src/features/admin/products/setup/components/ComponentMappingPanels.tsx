"use client";

/**
 * MS-45 material and pricing-driver workspaces.
 * Traceability: PRD-F14, SDD-C9, DSD-UI10, ERD-E6, ERD-E17.
 */

import { useMemo, useState } from "react";
import { AlertCircle, Check, Search } from "lucide-react";
import type { DimensionBinding, PresentationCategory, RawMaterial } from "@/lib/pricing/types";

export interface MappingPart {
  id: string;
  componentName: string;
  rawMaterialId: string | null;
  dimensionBinding: DimensionBinding;
  spanRatio: number;
  presentationCategory: PresentationCategory;
  suggestedMaterialCategory: string;
}

type MaterialStatus = "loading" | "ready" | "error";

interface MaterialMappingPanelProps {
  parts: MappingPart[];
  selectedIds: Set<string>;
  materials: RawMaterial[];
  materialStatus: MaterialStatus;
  disabled: boolean;
  feedback: string | null;
  onRetryMaterials: () => void;
  onSelectIds: (ids: Set<string>) => void;
  onAssignMaterial: (ids: string[], materialId: string | null) => void;
}

const MATERIAL_CATEGORIES = ["Aluminum", "Glass", "Hardware", "Consumable"] as const;
const PART_CATEGORIES: PresentationCategory[] = ["Framing", "Glazing", "Hardware", "Consumable", "Other"];

export function MaterialMappingPanel({
  parts,
  selectedIds,
  materials,
  materialStatus,
  disabled,
  feedback,
  onRetryMaterials,
  onSelectIds,
  onAssignMaterial,
}: MaterialMappingPanelProps) {
  const [partCategory, setPartCategory] = useState<PresentationCategory>("Framing");
  const [materialCategory, setMaterialCategory] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [chosenMaterialId, setChosenMaterialId] = useState<string | null>(null);
  const selectedParts = parts.filter((part) => selectedIds.has(part.id));
  const selectedMaterial = materials.find((material) => material.id === chosenMaterialId && material.is_active);
  const targetParts = selectedParts.filter((part) => part.rawMaterialId !== chosenMaterialId);
  const activeMaterials = useMemo(() => {
    const search = query.trim().toLowerCase();
    return materials.filter((material) => {
      if (!material.is_active || (materialCategory !== "All" && material.category !== materialCategory)) return false;
      if (!search) return true;
      return [material.material_code, material.description, material.category, material.finish_type]
        .some((value) => value.toLowerCase().includes(search));
    });
  }, [materials, materialCategory, query]);
  const selectedHint = selectedParts.length > 0 && selectedParts.every((part) => part.suggestedMaterialCategory === selectedParts[0].suggestedMaterialCategory)
    ? selectedParts[0].suggestedMaterialCategory
    : null;
  const visiblePartCategories = PART_CATEGORIES.filter((category) => parts.some((part) => part.presentationCategory === category));
  const effectivePartCategory = visiblePartCategories.includes(partCategory) ? partCategory : visiblePartCategories[0] ?? "Framing";
  const unlinkedInGroup = parts.filter((part) => part.presentationCategory === effectivePartCategory && part.rawMaterialId === null);

  const selectUnlinked = () => {
    onSelectIds(new Set(unlinkedInGroup.map((part) => part.id)));
  };

  const applyMaterial = () => {
    if (!selectedMaterial || targetParts.length === 0 || disabled) return;
    onAssignMaterial(targetParts.map((part) => part.id), selectedMaterial.id);
    onSelectIds(new Set());
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <h3 className="text-sm font-semibold text-[#0f1422]">Choose a material, then click model parts</h3>
          <p className="mt-1 text-xs text-neutral-500">Each model click adds or removes a target. Apply once to link all highlighted parts.</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-[9px] border border-neutral-200 bg-neutral-50 p-1.5">
          {visiblePartCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setPartCategory(category)}
              aria-pressed={effectivePartCategory === category}
              className={`rounded-[7px] px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3] ${effectivePartCategory === category ? "bg-[#0f1422] text-white" : "text-neutral-600 hover:bg-white"}`}
            >
              {category}
            </button>
          ))}
          <button
            type="button"
            onClick={selectUnlinked}
            disabled={disabled || unlinkedInGroup.length === 0}
            className="ml-auto rounded-[7px] bg-[#07b6d3]/10 px-2.5 py-1.5 text-xs font-semibold text-[#078ca5] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3]"
          >
            Select {unlinkedInGroup.length} unlinked
          </button>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold text-[#0f1422]">{selectedParts.length} selected {selectedParts.length === 1 ? "part" : "parts"}</p>
            {selectedParts.length > 0 && (
              <button type="button" onClick={() => onSelectIds(new Set())} className="text-xs font-medium text-[#078ca5] hover:underline">Clear selection</button>
            )}
          </div>
          {selectedParts.length === 0 ? (
            <p className="rounded-[9px] border border-dashed border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-500">
              Choose a catalog material, then click multiple parts in the 3D preview. Table selection and category shortcuts also work.
            </p>
          ) : (
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-[9px] border border-[#07b6d3]/25 bg-[#07b6d3]/5 p-2">
              {selectedParts.map((part) => {
                const linkedMaterial = materials.find((material) => material.id === part.rawMaterialId);
                return (
                  <div key={part.id} className="flex items-center gap-2 rounded-[6px] bg-white px-2 py-1.5 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium text-[#0f1422]">{part.componentName}</span>
                    <span className={part.rawMaterialId ? "text-neutral-500" : "text-amber-700"}>
                      {part.rawMaterialId ? `Linked: ${linkedMaterial?.material_code ?? "Unavailable"}` : "Unassigned"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {selectedParts.some((part) => part.rawMaterialId !== null && part.rawMaterialId !== chosenMaterialId) && chosenMaterialId && (
            <p className="mt-1.5 text-[11px] text-amber-800">Apply will replace the current material on selected linked parts.</p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold text-[#0f1422]">Choose a catalog material</p>
            {selectedHint && <span className="text-[11px] text-[#078ca5]">Suggested category: {selectedHint}</span>}
          </div>
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-2.5 size-4 text-neutral-400" />
            <input
              type="search"
              aria-label="Search catalog materials"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search code, description, category, finish"
              disabled={disabled || materialStatus !== "ready"}
              className="w-full rounded-[8px] border border-neutral-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-[#07b6d3] disabled:bg-neutral-50"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Material category filter">
            {["All", ...MATERIAL_CATEGORIES].map((category) => (
              <button
                key={category}
                type="button"
                aria-pressed={materialCategory === category}
                onClick={() => setMaterialCategory(category)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3] ${materialCategory === category ? "bg-[#07b6d3]/10 text-[#078ca5]" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
              >
                {category}
              </button>
            ))}
          </div>
          {materialStatus === "loading" && <p className="mt-3 text-xs text-neutral-500">Loading catalog materials...</p>}
          {materialStatus === "error" && (
            <div className="mt-3 flex items-center justify-between rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span className="flex items-center gap-1"><AlertCircle className="size-3.5" /> Materials could not be loaded.</span>
              <button type="button" onClick={onRetryMaterials} className="font-semibold underline">Retry</button>
            </div>
          )}
          {materialStatus === "ready" && (
            <div aria-label="Catalog materials" className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
              {activeMaterials.length === 0 && <p className="rounded-[8px] bg-neutral-50 p-3 text-xs text-neutral-500">No materials found.</p>}
              {activeMaterials.map((material) => (
                <button
                  key={material.id}
                  type="button"
                  aria-pressed={material.id === chosenMaterialId}
                  onClick={() => { setChosenMaterialId(material.id); onSelectIds(new Set()); }}
                  disabled={disabled}
                  className={`flex w-full items-start gap-2.5 rounded-[9px] border p-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3] ${material.id === chosenMaterialId ? "border-[#07b6d3] bg-[#07b6d3]/10" : "border-neutral-200 hover:bg-neutral-50"}`}
                >
                  <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${material.id === chosenMaterialId ? "border-[#07b6d3] bg-[#07b6d3] text-white" : "border-neutral-400"}`}>
                    {material.id === chosenMaterialId && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs font-semibold text-[#0f1422]">{material.material_code}</span>
                    <span className="block truncate text-[11px] text-neutral-600">{material.description}</span>
                    <span className="block text-[11px] text-neutral-500">{material.category} · {material.finish_type} · PHP {material.unit_price.toFixed(2)}/{material.billing_unit}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-neutral-200 bg-[#fcfcfc] p-3">
        {selectedMaterial && (
          <p className="mb-2 text-[11px] text-neutral-600">
            {selectedMaterial.material_code}: PHP {selectedMaterial.unit_price.toFixed(2)}/{selectedMaterial.billing_unit}, {Math.round(selectedMaterial.waste_allowance * 1000) / 10}% scrap allowance.
            <span className="font-semibold text-[#078ca5]"> Effective PHP {(selectedMaterial.unit_price * (1 + selectedMaterial.waste_allowance)).toFixed(2)}/{selectedMaterial.billing_unit}.</span>
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-[#0f1422]">{targetParts.length} target {targetParts.length === 1 ? "part" : "parts"}</p>
            <p className="text-[11px] text-neutral-500">Material changes remain unsaved until you save components.</p>
          </div>
          <button
            type="button"
            onClick={applyMaterial}
            disabled={disabled || !selectedMaterial || targetParts.length === 0}
            className="rounded-[8px] bg-[#07b6d3] px-3 py-2 text-xs font-semibold text-white hover:bg-[#06a2bc] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3]"
          >
            Link to {targetParts.length} {targetParts.length === 1 ? "part" : "parts"}
          </button>
        </div>
        {selectedParts.length === 1 && selectedParts[0].rawMaterialId && (
          <button
            type="button"
            onClick={() => onAssignMaterial([selectedParts[0].id], null)}
            disabled={disabled || materialStatus !== "ready"}
            className="mt-2 text-[11px] font-medium text-neutral-500 underline hover:text-amber-700"
          >
            Unlink this part
          </button>
        )}
        {feedback && <p role="status" className="mt-2 text-[11px] font-medium text-[#078ca5]">{feedback}</p>}
      </div>
    </div>
  );
}

interface PricingDriverPanelProps {
  selectedParts: MappingPart[];
  disabled: boolean;
  onApply: (ids: string[], updates: { dimensionBinding?: DimensionBinding; spanRatio?: number }) => void;
}

const DRIVER_OPTIONS: { value: DimensionBinding; title: string; detail: string }[] = [
  { value: "WIDTH", title: "Width (1D)", detail: "Horizontal rails and sills" },
  { value: "HEIGHT", title: "Height (1D)", detail: "Vertical jambs and stiles" },
  { value: "AREA", title: "Area (2D)", detail: "Glass and flat panels" },
  { value: "FIXED", title: "Fixed", detail: "Pieces, sets, and hardware" },
];

export function PricingDriverPanel({ selectedParts, disabled, onApply }: PricingDriverPanelProps) {
  const [draftDriver, setDraftDriver] = useState<DimensionBinding | null>(null);
  const [draftSpan, setDraftSpan] = useState<number | null>(null);
  const [customSpanText, setCustomSpanText] = useState<string | null>(null);
  const commonDriver = selectedParts.length > 0 && selectedParts.every((part) => part.dimensionBinding === selectedParts[0].dimensionBinding)
    ? selectedParts[0].dimensionBinding
    : null;
  const commonSpan = selectedParts.length > 0 && selectedParts.every((part) => part.spanRatio === selectedParts[0].spanRatio)
    ? selectedParts[0].spanRatio
    : null;
  const displayedDriver = draftDriver ?? commonDriver;
  const displayedSpan = draftSpan ?? commonSpan;
  const customSpanInvalid = customSpanText !== null && customSpanText !== "" &&
    (!Number.isFinite(Number(customSpanText)) || Number(customSpanText) < 0 || Number(customSpanText) > 10);
  const canApply = selectedParts.some((part) =>
    (draftDriver !== null && part.dimensionBinding !== draftDriver) ||
    (draftSpan !== null && part.spanRatio !== draftSpan));

  const apply = () => {
    if (!canApply || disabled || customSpanInvalid) return;
    onApply(selectedParts.map((part) => part.id), {
      ...(draftDriver !== null ? { dimensionBinding: draftDriver } : {}),
      ...(draftSpan !== null ? { spanRatio: draftSpan } : {}),
    });
    setDraftDriver(null);
    setDraftSpan(null);
    setCustomSpanText(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <h3 className="text-sm font-semibold text-[#0f1422]">Choose a driver, then click model parts</h3>
          <p className="mt-1 text-xs text-neutral-500">Model clicks add or remove targets. Apply once to update every highlighted part.</p>
        </div>
        {selectedParts.length === 0 ? (
          <p className="rounded-[9px] border border-dashed border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-500">Choose Width, Height, Area, or Fixed below, then click several parts in the 3D preview.</p>
        ) : (
          <div className="rounded-[9px] border border-[#07b6d3]/25 bg-[#07b6d3]/5 p-3">
            <p className="text-xs font-semibold text-[#0f1422]">{selectedParts.length} selected {selectedParts.length === 1 ? "part" : "parts"}</p>
            <p className="mt-1 text-[11px] text-neutral-600">Current driver: {commonDriver ?? "Mixed"} · Span: {commonSpan === null ? "Mixed" : `${commonSpan.toFixed(2)}x`}</p>
            <div className="mt-2 max-h-24 space-y-1 overflow-y-auto">
              {selectedParts.map((part) => (
                <p key={part.id} className="flex justify-between gap-2 text-[11px] text-neutral-600">
                  <span className="truncate">{part.componentName}</span><span className="shrink-0 font-mono">{part.dimensionBinding} · {part.spanRatio.toFixed(2)}x</span>
                </p>
              ))}
            </div>
          </div>
        )}
        <fieldset disabled={disabled}>
          <legend className="mb-2 text-xs font-semibold text-[#0f1422]">Dimension driver</legend>
          <p className="mb-2 text-[11px] text-neutral-500">Choose the product dimension that determines billable quantity.</p>
          <div className="grid grid-cols-2 gap-2">
            {DRIVER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={displayedDriver === option.value}
                onClick={() => setDraftDriver(option.value)}
                className={`rounded-[8px] border p-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3] ${displayedDriver === option.value ? "border-[#07b6d3] bg-[#07b6d3]/10" : "border-neutral-200 hover:bg-neutral-50"}`}
              >
                <span className={`block text-xs font-semibold ${displayedDriver === option.value ? "text-[#078ca5]" : "text-[#0f1422]"}`}>{option.title}</span>
                <span className="mt-1 block text-[11px] text-neutral-500">{option.detail}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={disabled}>
          <legend className="mb-2 text-xs font-semibold text-[#0f1422]">Span ratio / multiplier</legend>
          <div className="flex flex-wrap gap-1.5">
            {[{ label: "1.0x Full", value: 1 }, { label: "0.5x Half", value: 0.5 }, { label: "0.33x Third", value: 0.3333 }].map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={displayedSpan !== null && Math.abs(displayedSpan - option.value) < 0.0001}
                onClick={() => { setDraftSpan(option.value); setCustomSpanText(null); }}
                className={`rounded-[8px] border px-2.5 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3] ${displayedSpan !== null && Math.abs(displayedSpan - option.value) < 0.0001 ? "border-[#07b6d3] bg-[#07b6d3]/10 text-[#078ca5]" : "border-neutral-200 text-neutral-600"}`}
              >
                {option.label}
              </button>
            ))}
            <label className="flex items-center gap-1 text-[11px] text-neutral-500">
              Custom
              <input
                type="number"
                min="0"
                max="10"
                step="0.01"
                value={customSpanText ?? (draftSpan ?? commonSpan ?? "")}
                onChange={(event) => {
                  setCustomSpanText(event.target.value);
                  const value = Number(event.target.value);
                  setDraftSpan(event.target.value !== "" && Number.isFinite(value) && value >= 0 && value <= 10 ? value : null);
                }}
                className="w-17 rounded-[6px] border border-neutral-200 px-1.5 py-1 text-xs outline-none focus:border-[#07b6d3]"
              />
            </label>
          </div>
        </fieldset>
        {selectedParts.length > 1 && commonDriver === null && <p className="rounded-[8px] bg-amber-50 p-2.5 text-[11px] text-amber-800">Selected parts use different drivers. Applying a new driver will change all selected parts.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 bg-[#fcfcfc] p-3">
        <p className="text-[11px] text-neutral-500">Material links stay unchanged.</p>
        <button
          type="button"
          onClick={apply}
          disabled={disabled || !canApply || customSpanInvalid}
          className="rounded-[8px] bg-[#07b6d3] px-3 py-2 text-xs font-semibold text-white hover:bg-[#06a2bc] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3]"
        >
          Apply driver to {selectedParts.length} {selectedParts.length === 1 ? "part" : "parts"}
        </button>
      </div>
    </div>
  );
}
