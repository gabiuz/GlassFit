"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface ImageLoadingModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onPlaceProduct?: () => void;
  isLoading?: boolean;
}

export function ImageLoadingModal({
  isOpen,
  onCancel,
  onPlaceProduct,
  isLoading = true,
}: ImageLoadingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#f5f5f5] border border-white rounded-[20px] shadow-[0px_0px_25px_0px_rgba(0,0,0,0.25)] flex flex-col items-center justify-center p-8 sm:p-12 gap-8 max-w-[520px] w-full text-center select-none">
        {/* Animated Spinner with Cyan Accent */}
        <div className="relative size-24 sm:size-28 flex items-center justify-center">
          {/* Custom SVG ring matching Figma spinner */}
          <svg
            className="size-full animate-spin text-[#06e5ff]"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="#bbf2f9"
              strokeWidth="12"
            />
            <path
              d="M50 10 A40 40 0 0 1 90 50"
              stroke="#06e5ff"
              strokeWidth="12"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Text Labels */}
        <div className="flex flex-col gap-1 items-center justify-center">
          <h2 className="text-[#0f1422] text-xl sm:text-2xl font-medium tracking-[-0.38px]">
            Loading
          </h2>
          <p className="text-[#0f1422] text-base sm:text-xl font-normal tracking-[-0.38px]">
            Please wait while we prepare your image...
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-6 sm:gap-10 justify-center w-full mt-2">
          {/* Cancel Button */}
          <button
            type="button"
            onClick={onCancel}
            className="bg-transparent border border-[#0f1422] hover:bg-neutral-200/60 text-[#0f1422] font-normal text-base sm:text-xl px-6 py-3.5 rounded-[25px] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {/* Place Product (Disabled when loading) */}
          <button
            type="button"
            disabled={isLoading}
            onClick={onPlaceProduct}
            className={`font-normal text-base sm:text-xl px-6 py-3.5 rounded-[25px] transition-all ${
              isLoading
                ? "bg-[#c3c3c3] text-white cursor-not-allowed opacity-90"
                : "bg-grad-light text-white cursor-pointer hover:opacity-95"
            }`}
          >
            Place Product
          </button>
        </div>
      </div>
    </div>
  );
}
