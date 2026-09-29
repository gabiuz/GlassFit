"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useProductFilter } from "./ProductFilterContext";
import { ProductFilter } from "./ProductFilter";

export function MobileBottomSheet() {
  const {
    isMobileSheetOpen,
    setIsMobileSheetOpen,
    draftFilteredProducts,
    applyDraftFilters,
    resetDraftFilters,
  } = useProductFilter();

  const [shouldRender, setShouldRender] = useState(isMobileSheetOpen);
  const [active, setActive] = useState(false);

  // Sync scroll locking and animation trigger states
  useEffect(() => {
    if (isMobileSheetOpen) {
      setShouldRender(true);
      document.body.style.overflow = "hidden";
      const animTimer = setTimeout(() => setActive(true), 20);
      return () => clearTimeout(animTimer);
    } else {
      setActive(false);
      document.body.style.overflow = "";
      const renderTimer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(renderTimer);
    }
  }, [isMobileSheetOpen]);

  // Clean up overflow on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!shouldRender) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setIsMobileSheetOpen(false)}
        className={`fixed inset-0 bg-black/60 z-[9998] transition-opacity duration-300 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 h-[88vh] bg-white rounded-t-[24px] shadow-[0_-8px_32px_rgba(0,0,0,0.15)] flex flex-col transition-transform duration-300 ease-out z-[9999] ${
          active ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Swipe Handle Indicator */}
        <div className="w-full flex justify-center py-2 shrink-0">
          <div className="w-10 h-1.25 bg-[#c3c3c3]/50 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 border-b border-neutral-100 shrink-0">
          <h2 className="text-xl font-medium text-black">Filters</h2>
          <button
            type="button"
            onClick={() => setIsMobileSheetOpen(false)}
            className="p-1 rounded-full bg-neutral-100 text-neutral-500 hover:text-black hover:bg-neutral-200 transition-colors cursor-pointer"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ProductFilter isMobile={true} />
        </div>

        {/* Sticky Footer */}
        <div className="border-t border-neutral-100 p-5 bg-white flex items-center justify-between gap-4 shrink-0 pb-7">
          <button
            type="button"
            onClick={resetDraftFilters}
            className="text-neutral-500 hover:text-black font-medium text-base py-3 px-4 rounded-[20px] transition-colors cursor-pointer select-none"
          >
            Clear all
          </button>

          <button
            type="button"
            onClick={applyDraftFilters}
            className="flex-1 bg-green hover:bg-[#05a5bf] text-white font-medium text-base py-3 px-6 rounded-[20px] shadow-sm flex items-center justify-center transition-colors cursor-pointer select-none"
          >
            Show {draftFilteredProducts.length} results
          </button>
        </div>
      </div>
    </>
  );
}
