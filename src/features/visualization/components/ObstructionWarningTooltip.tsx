"use client";

import React, { useMemo } from "react";
import type { ObstructionCandidate } from "@/lib/visualization/obstructionWarnings";

interface ObstructionWarningTooltipProps {
  warning: ObstructionCandidate;
  canvasWidth: number;
  canvasHeight: number;
  onDismiss: (warningId: string) => void;
}

export function ObstructionWarningTooltip({
  warning,
  canvasWidth,
  canvasHeight,
  onDismiss,
}: ObstructionWarningTooltipProps) {
  // Approximate tooltip dimensions for boundary clamping
  const tooltipWidth = 280;
  const tooltipHeight = 56;
  const margin = 12;

  const position = useMemo(() => {
    const rawX = warning.anchorPoint.x;
    const rawY = warning.anchorPoint.y;

    // Center tooltip on anchor point, clamped to canvas bounds
    const halfW = tooltipWidth / 2;
    const left = Math.max(margin, Math.min(canvasWidth - tooltipWidth - margin, rawX - halfW));

    // Place 12px above intersection point; if too close to top, place below intersection
    let top = rawY - tooltipHeight - 12;
    if (top < margin) {
      top = warning.intersectionBox.y2 + 12;
    }
    top = Math.max(margin, Math.min(canvasHeight - tooltipHeight - margin, top));

    return { left, top };
  }, [
    warning.anchorPoint.x,
    warning.anchorPoint.y,
    warning.intersectionBox.y2,
    canvasWidth,
    canvasHeight,
  ]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute pointer-events-auto z-30 select-none animate-in fade-in duration-200"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        width: `${tooltipWidth}px`,
      }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#0f1422]/95 text-white backdrop-blur-md rounded-[14px] shadow-lg border border-amber-500/40 text-xs">
        {/* Warning Icon Badge */}
        <div className="shrink-0 size-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[11px]">
          !
        </div>

        {/* 1-Sentence Non-Technical Message */}
        <p className="flex-1 text-neutral-200 leading-snug font-normal text-[11px]">
          {warning.message}
        </p>

        {/* Dismiss Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(warning.id);
          }}
          aria-label="Close obstruction warning"
          className="shrink-0 size-5 rounded-full hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <svg
            className="size-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
