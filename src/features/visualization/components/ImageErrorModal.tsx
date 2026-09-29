"use client";

import React from "react";
import Image from "next/image";

interface ImageErrorModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onTryAgain: () => void;
  errorMessage?: string;
}

export function ImageErrorModal({
  isOpen,
  onCancel,
  onTryAgain,
  errorMessage = "Unable to analyze the image.",
}: ImageErrorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-white rounded-[20px] shadow-[0px_0px_25px_0px_rgba(0,0,0,0.25)] flex flex-col items-center justify-center p-8 sm:p-12 gap-8 max-w-[520px] w-full text-center select-none">
        {/* Red Error Circle Exclamation Icon */}
        <div className="relative size-24 sm:size-28 flex items-center justify-center">
          <Image
            src="/visualization/circle-exclamation-duotone-regular-full 1.svg"
            alt="Error"
            width={120}
            height={120}
            className="object-contain"
          />
        </div>

        {/* Text Labels */}
        <div className="flex flex-col gap-1.5 items-center justify-center">
          <h2 className="text-[#0f1422] text-xl sm:text-2xl font-medium tracking-[-0.38px]">
            {errorMessage}
          </h2>
          <p className="text-[#0f1422] text-base sm:text-xl font-normal tracking-[-0.38px]">
            Please upload a clearer photo and try again.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-6 sm:gap-10 justify-center w-full mt-2">
          {/* Cancel Button */}
          <button
            type="button"
            onClick={onCancel}
            className="bg-transparent border border-[#0f1422] hover:bg-neutral-100 text-[#0f1422] font-normal text-base sm:text-xl px-6 py-3.5 rounded-[25px] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {/* Try Again Button */}
          <button
            type="button"
            onClick={onTryAgain}
            className="bg-[#0f1422] hover:bg-black text-white font-normal text-base sm:text-xl px-6 py-3.5 rounded-[25px] transition-colors cursor-pointer shadow-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
