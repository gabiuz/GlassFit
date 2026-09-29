"use client";

import React, { useState } from "react";
import { X, CheckSquare, Square, Layers, Box, Check, Info } from "lucide-react";
import type { ExtractedComponentPart } from "@/lib/admin/products/modelDecomposer";

export interface DecompositionPreviewModalProps {
  isOpen: boolean;
  sourceFileName: string;
  parts: ExtractedComponentPart[];
  warnings?: string[];
  onClose: () => void;
  onApplyParts: (selectedParts: ExtractedComponentPart[]) => void;
}

export function DecompositionPreviewModal({
  isOpen,
  sourceFileName,
  parts: initialParts,
  warnings = [],
  onClose,
  onApplyParts,
}: DecompositionPreviewModalProps) {
  const [parts, setParts] = useState<ExtractedComponentPart[]>(initialParts);
  const [prevInitialParts, setPrevInitialParts] = useState<ExtractedComponentPart[]>(initialParts);

  if (initialParts !== prevInitialParts) {
    setPrevInitialParts(initialParts);
    setParts(initialParts);
  }

  if (!isOpen) return null;

  const selectedCount = parts.filter((p) => p.isSelected).length;

  const togglePartSelected = (id: string) => {
    setParts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isSelected: !p.isSelected } : p))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setParts((prev) => prev.map((p) => ({ ...p, isSelected: select })));
  };

  const handleApply = () => {
    const selected = parts.filter((p) => p.isSelected);
    onApplyParts(selected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[20px] shadow-2xl border border-neutral-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-neutral-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-[#07b6d3]/10 text-[#07b6d3] flex items-center justify-center">
              <Layers className="size-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-medium text-[#0f1422] leading-tight">
                Review Decomposed Structural Components
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
                Extracted <span className="font-semibold text-neutral-800">{parts.length} distinct structural parts</span> from{" "}
                <span className="font-mono text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded text-xs">{sourceFileName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-2 rounded-full hover:bg-neutral-100 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Warnings / Notices */}
        {warnings.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-100 px-6 py-2.5 flex items-center gap-2 text-xs text-amber-800">
            <Info className="size-4 shrink-0 text-amber-600" />
            <span>{warnings.join(" ")}</span>
          </div>
        )}

        {/* Selection Action Bar */}
        <div className="px-6 py-3 bg-[#fcfcfc] border-b border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
          <div className="flex items-center gap-2">
            <span className="font-medium text-neutral-800">
              {selectedCount} of {parts.length} parts selected
            </span>
            <span className="text-neutral-300">|</span>
            <button
              type="button"
              onClick={() => handleSelectAll(true)}
              className="text-[#07b6d3] font-medium hover:underline cursor-pointer"
            >
              Select All
            </button>
            <span className="text-neutral-300">|</span>
            <button
              type="button"
              onClick={() => handleSelectAll(false)}
              className="text-neutral-500 font-medium hover:underline cursor-pointer"
            >
              Deselect All
            </button>
          </div>
          <span className="text-[11px] text-neutral-400 hidden sm:inline">
            Uncheck helper or decorative meshes that are not physical components
          </span>
        </div>

        {/* Extracted Parts Table / List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 divide-y divide-neutral-100">
          <div className="space-y-2.5">
            {parts.map((part) => {
              const isSelected = part.isSelected;
              return (
                <div
                  key={part.id}
                  onClick={() => togglePartSelected(part.id)}
                  className={`p-3.5 sm:p-4 rounded-[14px] border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-[#07b6d3]/5 border-[#07b6d3]/40 shadow-xs"
                      : "bg-neutral-50/70 border-neutral-200 opacity-60 hover:opacity-100"
                  }`}
                >
                  {/* Left: Checkbox + Name */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePartSelected(part.id);
                      }}
                      className="text-neutral-500 hover:text-neutral-800 shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="size-5 text-[#07b6d3]" />
                      ) : (
                        <Square className="size-5 text-neutral-400" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#0f1422]">
                          {part.componentName}
                        </span>
                        {part.isRemovable && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-medium border border-amber-200">
                            {part.togglePropertyKey || "Removable"}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                        Node: <span className="text-neutral-600">{part.sourceNodeName}</span> &rarr; Key: <span className="text-neutral-600">{part.componentKey}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Badges & Dimensions */}
                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    {/* Presentation Category Badge */}
                    <span
                      className={`px-2.5 py-1 rounded-[8px] font-medium text-[11px] ${
                        part.presentationCategory === "Glazing"
                          ? "bg-sky-100 text-sky-700 border border-sky-200"
                          : part.presentationCategory === "Hardware"
                          ? "bg-amber-100 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {part.presentationCategory}
                    </span>

                    {/* Dimension Driver Badge */}
                    <span className="px-2 py-1 rounded-[8px] bg-neutral-100 text-neutral-700 font-mono text-[11px] border border-neutral-200">
                      Driver: {part.dimensionBinding}
                    </span>

                    {/* Span Ratio */}
                    {part.spanRatio !== 1 && (
                      <span className="px-2 py-1 rounded-[8px] bg-neutral-100 text-neutral-600 font-mono text-[11px]">
                        {part.spanRatio.toFixed(2)}x
                      </span>
                    )}

                    {/* Dimensions */}
                    <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-500 bg-white px-2.5 py-1 rounded-[8px] border border-neutral-200 shadow-2xs">
                      <Box className="size-3 text-neutral-400" />
                      <span>
                        {part.dimensionsMm.width} &times; {part.dimensionsMm.height} &times; {part.dimensionsMm.depth} mm
                      </span>
                    </div>

                    {/* Assembly Position */}
                    {part.assemblyPosition && (
                      <div className="hidden md:flex items-center gap-1 text-[10px] font-mono text-neutral-400 bg-neutral-50 px-2 py-0.5 rounded-[6px] border border-neutral-200/60" title="Assembly world coordinates (X, Y, Z)">
                        <span>Pos: ({part.assemblyPosition.x}, {part.assemblyPosition.y}, {part.assemblyPosition.z})m</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-neutral-200 bg-[#fcfcfc] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 font-medium text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={selectedCount === 0}
            className="bg-[#0f1422] text-white px-5 py-2.5 rounded-[10px] hover:bg-black transition-colors font-medium text-xs disabled:opacity-40 flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Check className="size-4" />
            Apply {selectedCount} Extracted Part{selectedCount === 1 ? "" : "s"} to Product
          </button>
        </div>
      </div>
    </div>
  );
}
