"use client";

import React from "react";
import { Filter, ArrowUpDown } from "lucide-react";
import { useProductFilter } from "./ProductFilterContext";

export function MobileFilterBar() {
  const { activeFiltersCount, setIsMobileSheetOpen } = useProductFilter();

  return (
    <div className="sticky top-[75px] z-30 xl:hidden w-full bg-white/95 backdrop-blur-md border border-neutral-100 rounded-[15px] p-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex gap-3 items-center">
      <button
        type="button"
        onClick={() => setIsMobileSheetOpen(true)}
        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-[12px] bg-[#f5f5f5] hover:bg-neutral-200 transition-colors text-black font-medium text-sm select-none border border-neutral-200/40"
      >
        <Filter className="w-4 h-4 text-black" />
        <span>Filters</span>
        {activeFiltersCount > 0 && (
          <span className="flex items-center justify-center bg-green text-white text-xs font-semibold px-2 py-0.5 rounded-full min-w-5 h-5">
            {activeFiltersCount}
          </span>
        )}
      </button>

      <button
        type="button"
        disabled
        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-[12px] bg-[#f5f5f5] text-black/50 font-medium text-sm select-none border border-neutral-200/20 cursor-not-allowed"
      >
        <ArrowUpDown className="w-4 h-4 text-black/40" />
        <span>Sort</span>
      </button>
    </div>
  );
}
