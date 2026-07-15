"use client";

import React from "react";
import { X, RotateCcw } from "lucide-react";
import { useProductFilter, MIN_PRICE, MAX_PRICE } from "./ProductFilterContext";

export function FilterChips() {
  const { filters, removeChipFilter, resetFilters, activeFiltersCount } = useProductFilter();

  if (activeFiltersCount === 0) return null;

  // Build list of active filters
  const chips: { type: string; value?: string; label: string }[] = [];

  // Price range
  if (filters.range[0] !== MIN_PRICE || filters.range[1] !== MAX_PRICE) {
    chips.push({
      type: "range",
      label: `₱${filters.range[0].toLocaleString()} - ₱${filters.range[1].toLocaleString()}`,
    });
  }

  // Category (if different from default "Doors")
  if (filters.selectedCategory !== "Doors") {
    chips.push({
      type: "category",
      label: `Category: ${filters.selectedCategory}`,
    });
  }

  // Checked door styles (excluding "All")
  filters.checkedDoors
    .filter((d) => d !== "All")
    .forEach((door) => {
      chips.push({
        type: "checkedDoors",
        value: door,
        label: door,
      });
    });

  // Materials
  filters.materialFinish.forEach((mat) => {
    chips.push({
      type: "materialFinish",
      value: mat,
      label: mat,
    });
  });

  // Aluminum finishes (only if Aluminum is active)
  if (filters.materialFinish.includes("Aluminum")) {
    filters.anodized.forEach((finish) => {
      chips.push({
        type: "anodized",
        value: finish,
        label: finish,
      });
    });

    filters.powderCoated.forEach((finish) => {
      chips.push({
        type: "powderCoated",
        value: finish,
        label: finish,
      });
    });

    filters.aluminumProfile.forEach((profile) => {
      chips.push({
        type: "aluminumProfile",
        value: profile,
        label: profile,
      });
    });
  }

  // Glass finishes (only if Glass is active)
  if (filters.materialFinish.includes("Glass")) {
    filters.glass.forEach((finish) => {
      chips.push({
        type: "glass",
        value: finish,
        label: finish,
      });
    });

    filters.glassProfile.forEach((profile) => {
      chips.push({
        type: "glassProfile",
        value: profile,
        label: profile,
      });
    });

    filters.glassThickness.forEach((thick) => {
      chips.push({
        type: "glassThickness",
        value: thick,
        label: thick,
      });
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="w-full flex flex-wrap gap-2 items-center mb-6 py-1 select-none animate-in fade-in duration-200">
      <span className="text-xs text-neutral-400 font-medium uppercase tracking-wider mr-1">
        Active Filters:
      </span>

      {chips.map((chip, idx) => (
        <div
          key={`${chip.type}-${chip.value || idx}`}
          onClick={() => removeChipFilter(chip.type, chip.value)}
          className="flex items-center gap-1.5 bg-[#e9f9fb] hover:bg-[#d6f4f8] text-[#097283] text-sm font-medium px-3 py-1.5 rounded-full border border-[#097283]/10 transition-colors cursor-pointer"
        >
          <span>{chip.label}</span>
          <X className="w-3.5 h-3.5 hover:text-[#0f1422] transition-colors" />
        </div>
      ))}

      <button
        type="button"
        onClick={resetFilters}
        className="flex items-center gap-1.25 text-neutral-500 hover:text-red-500 text-sm font-medium ml-2 transition-colors cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Clear all</span>
      </button>
    </div>
  );
}
