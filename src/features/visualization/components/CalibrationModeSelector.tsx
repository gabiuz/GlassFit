"use client";

import React, { KeyboardEvent } from "react";
import { Check, FileText, Ruler, Zap } from "lucide-react";
import {
  type CalibrationMode,
  type FiducialPaperStandard,
  PAPER_STANDARD_METRICS,
} from "@/lib/visualization/types";

export interface CalibrationModeSelectorProps {
  mode: CalibrationMode;
  paperStandard: FiducialPaperStandard;
  onModeChange: (mode: CalibrationMode) => void;
  onPaperStandardChange: (standard: FiducialPaperStandard) => void;
}

const PAPER_OPTIONS: Array<{
  id: FiducialPaperStandard;
  title: string;
  metricDesc: string;
}> = [
  {
    id: "short",
    title: 'Short Bond / Letter (8.5" x 11")',
    metricDesc: `${PAPER_STANDARD_METRICS.short.widthMm} x ${PAPER_STANDARD_METRICS.short.heightMm} mm`,
  },
  {
    id: "a4",
    title: 'A4 Standard (8.27" x 11.69")',
    metricDesc: `${PAPER_STANDARD_METRICS.a4.widthMm} x ${PAPER_STANDARD_METRICS.a4.heightMm} mm`,
  },
  {
    id: "long",
    title: 'Long Bond / Folio (8.5" x 13")',
    metricDesc: `${PAPER_STANDARD_METRICS.long.widthMm} x ${PAPER_STANDARD_METRICS.long.heightMm} mm`,
  },
];

export function getNextPaperStandard(
  current: FiducialPaperStandard,
  direction: "next" | "prev",
): FiducialPaperStandard {
  const keys: FiducialPaperStandard[] = ["short", "a4", "long"];
  const currentIndex = keys.indexOf(current);
  if (currentIndex === -1) return "short";
  if (direction === "next") {
    return keys[(currentIndex + 1) % keys.length];
  }
  return keys[(currentIndex - 1 + keys.length) % keys.length];
}

export function CalibrationModeSelector({
  mode,
  paperStandard,
  onModeChange,
  onPaperStandardChange,
}: CalibrationModeSelectorProps) {
  const handleModeKeyDown = (event: KeyboardEvent<HTMLDivElement>, targetMode: CalibrationMode) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onModeChange(targetMode);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onModeChange("standard");
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onModeChange("paper_fiducial");
    }
  };

  const handlePaperKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentStandard: FiducialPaperStandard,
  ) => {
    let nextOption: FiducialPaperStandard | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextOption = getNextPaperStandard(currentStandard, "next");
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextOption = getNextPaperStandard(currentStandard, "prev");
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onPaperStandardChange(currentStandard);
      return;
    }

    if (nextOption) {
      event.preventDefault();
      onPaperStandardChange(nextOption);
      const nextBtn = document.getElementById(`paper-btn-${nextOption}`);
      nextBtn?.focus();
    }
  };

  return (
    <section
      aria-label="Measurement Calibration Mode"
      className="mx-auto w-full max-w-367 rounded-[20px] border border-[#c3c3c3]/50 bg-white p-5 shadow-[0px_0px_5px_0px_rgba(0,0,0,0.18)] sm:p-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-medium text-black sm:text-2xl">
            Measurement Calibration Mode
          </h2>
          <p className="text-sm text-neutral-600 sm:text-base">
            Choose how real-world dimensions are scaled for your space visualization.
          </p>
        </div>
        <div className="self-start rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600 sm:self-auto">
          {mode === "paper_fiducial" ? "Precision Active" : "Quick Mode"}
        </div>
      </div>

      {/* Mode selection radio cards */}
      <div
        role="radiogroup"
        aria-label="Calibration mode options"
        className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        {/* Quick Preview Card */}
        <div
          role="radio"
          aria-checked={mode === "standard"}
          tabIndex={0}
          onClick={() => onModeChange("standard")}
          onKeyDown={(e) => handleModeKeyDown(e, "standard")}
          className={[
            "group relative flex min-h-[148px] cursor-pointer flex-col justify-between rounded-[16px] border p-4 sm:p-5 transition-all outline-none",
            mode === "standard"
              ? "border-cyan-500 bg-cyan-50/40 shadow-sm ring-2 ring-cyan-500/20"
              : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={[
                  "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  mode === "standard"
                    ? "border-cyan-500 bg-cyan-500 text-white"
                    : "border-neutral-300 bg-white group-hover:border-neutral-400",
                ].join(" ")}
              >
                {mode === "standard" && <Check className="size-3.5 stroke-[3]" />}
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="size-4 text-neutral-500" />
                <h3 className="text-base font-semibold text-black sm:text-lg">
                  Quick Preview
                </h3>
              </div>
            </div>
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
              Standard (Fast)
            </span>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-neutral-600 sm:text-sm">
            Upload any space photo immediately. Visual dimensions will be estimated using automated room heuristics.
          </p>

          <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
            <span className="text-xs text-neutral-500">Requires no markers</span>
            <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700">
              Ballpark Sizing (~75% - 85%)
            </span>
          </div>
        </div>

        {/* Precision Calibration Card */}
        <div
          role="radio"
          aria-checked={mode === "paper_fiducial"}
          tabIndex={0}
          onClick={() => onModeChange("paper_fiducial")}
          onKeyDown={(e) => handleModeKeyDown(e, "paper_fiducial")}
          className={[
            "group relative flex min-h-[148px] cursor-pointer flex-col justify-between rounded-[16px] border p-4 sm:p-5 transition-all outline-none",
            mode === "paper_fiducial"
              ? "border-cyan-500 bg-cyan-50/40 shadow-sm ring-2 ring-cyan-500/20"
              : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={[
                  "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  mode === "paper_fiducial"
                    ? "border-cyan-500 bg-cyan-500 text-white"
                    : "border-neutral-300 bg-white group-hover:border-neutral-400",
                ].join(" ")}
              >
                {mode === "paper_fiducial" && <Check className="size-3.5 stroke-[3]" />}
              </div>
              <div className="flex items-center gap-1.5">
                <Ruler className="size-4 text-cyan-600" />
                <h3 className="text-base font-semibold text-black sm:text-lg">
                  Precision Calibration
                </h3>
              </div>
            </div>
            <span className="rounded-full border border-cyan-200 bg-cyan-100 px-2.5 py-0.5 text-xs font-semibold text-cyan-900">
              Recommended for Quotation
            </span>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-neutral-600 sm:text-sm">
            Tape a standard piece of bond paper to your wall before taking the photo. Eliminates measurement guesswork.
          </p>

          <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
            <span className="text-xs text-neutral-500">Requires 1 sheet of paper</span>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              High Precision (±2% - 5%)
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Paper Standard Selection (Precision Mode Only) */}
      {mode === "paper_fiducial" && (
        <div
          role="region"
          aria-label="Paper standard options"
          className="mt-6 rounded-[16px] border border-cyan-200 bg-cyan-50/30 p-4 transition-all sm:p-5"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-cyan-700" />
              <h4 className="text-sm font-semibold text-neutral-900 sm:text-base">
                Select Your Taped Paper Standard:
              </h4>
            </div>
            <span className="text-xs text-neutral-500">
              Matches physical stationery taped to wall
            </span>
          </div>

          <div
            role="radiogroup"
            aria-label="Philippine paper sizes"
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            {PAPER_OPTIONS.map((option) => {
              const isSelected = paperStandard === option.id;
              return (
                <button
                  key={option.id}
                  id={`paper-btn-${option.id}`}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => onPaperStandardChange(option.id)}
                  onKeyDown={(e) => handlePaperKeyDown(e, option.id)}
                  className={[
                    "flex min-h-[56px] flex-col justify-center rounded-[12px] border px-4 py-3 text-left transition-all outline-none",
                    isSelected
                      ? "border-cyan-500 bg-white shadow-sm ring-2 ring-cyan-500"
                      : "border-neutral-200 bg-white/80 hover:border-neutral-300 hover:bg-white",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={[
                        "text-sm font-medium",
                        isSelected ? "text-cyan-950 font-semibold" : "text-neutral-800",
                      ].join(" ")}
                    >
                      {option.title}
                    </span>
                    <span
                      className={[
                        "flex size-4 shrink-0 items-center justify-center rounded-full border",
                        isSelected
                          ? "border-cyan-600 bg-cyan-600 text-white"
                          : "border-neutral-300 bg-white",
                      ].join(" ")}
                    >
                      {isSelected && <span className="size-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <span className="mt-1 text-xs text-neutral-500">
                    {option.metricDesc}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-center text-xs text-neutral-500 sm:text-left">
            Dimensions: Short = 215.9 x 279.4 mm | A4 = 210 x 297 mm | Long = 215.9 x 330.2 mm
          </p>
        </div>
      )}
    </section>
  );
}
