"use client";

import React from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

interface ImageSuccessModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onPlaceProduct: () => void;
}

export function ImageSuccessModal({
  isOpen,
  onCancel,
  onPlaceProduct,
}: ImageSuccessModalProps) {
  const shouldReduceMotion = useReducedMotion();

  if (!isOpen) return null;

  const iconAnimation = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.2 },
      }
    : {
        initial: { transform: "scale(0.6)", opacity: 0 },
        animate: { transform: "scale(1)", opacity: 1 },
        transition: {
          type: "spring" as const,
          stiffness: 260,
          damping: 20,
          delay: 0.08,
        },
      };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-white rounded-[20px] shadow-[0px_0px_25px_0px_rgba(0,0,0,0.25)] flex flex-col items-center justify-center p-8 sm:p-12 gap-8 max-w-[520px] w-full text-center select-none">
        {/* Green Success Circle Check Icon */}
        <motion.div
          className="relative size-24 sm:size-28 flex items-center justify-center"
          initial={iconAnimation.initial}
          animate={iconAnimation.animate}
          transition={iconAnimation.transition}
        >
          <Image
            src="/visualization/circle-check-duotone-regular-full 1.svg"
            alt="Success"
            width={120}
            height={120}
            className="object-contain"
          />
        </motion.div>

        {/* Text Labels */}
        <div className="flex flex-col gap-1.5 items-center justify-center max-w-xs sm:max-w-sm">
          <h2 className="text-[#0f1422] text-xl sm:text-2xl font-medium tracking-[-0.38px]">
            Image analysis is complete.
          </h2>
          <p className="text-[#0f1422] text-base sm:text-xl font-normal tracking-[-0.38px]">
            You may now place your selected product.
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

          {/* Place Product Button */}
          <button
            type="button"
            onClick={onPlaceProduct}
            className="bg-green hover:bg-[#06a3bd] text-white font-normal text-base sm:text-xl px-6 py-3.5 rounded-[25px] transition-colors cursor-pointer shadow-sm"
          >
            Place Product
          </button>
        </div>
      </div>
    </div>
  );
}
