"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import dynamic from "next/dynamic";
import { normalizeAluminumFinish } from "@/lib/visualization/colorVariations";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  X,
  Edit3,
  Check,
} from "lucide-react";
import type {
  MeasurementConfirmationEntry,
  MeasurementOverride,
} from "@/lib/visualization/types";
import {
  convertInToCm,
} from "@/lib/visualization/measurementConfirmation";
import { calculateBOMFromStructuralDefinition } from "@/lib/pricing/pricingEngine";

const ProductModel3D = dynamic(
  () =>
    import("@/features/product-details/components/ProductModel3D").then(
      (m) => m.ProductModel3D,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-60 w-full animate-pulse items-center justify-center rounded-[20px] bg-neutral-100 text-xs text-neutral-400">
        Loading 3D Preview...
      </div>
    ),
  },
);

export interface MeasurementConfirmationModalProps {
  isOpen: boolean;
  entries: MeasurementConfirmationEntry[];
  onConfirmAll: (confirmedEntries: MeasurementConfirmationEntry[]) => void;
  onCancel: () => void;
}

function formatFinishName(finish: string): string {
  const lower = finish.toLowerCase();
  if (lower === "white") return "White Powder Coat";
  if (lower === "black") return "Analok Black";
  if (lower === "silver") return "Natural Anodized / Silver";
  return finish.charAt(0).toUpperCase() + finish.slice(1);
}

export function MeasurementConfirmationModal({
  isOpen,
  entries,
  onConfirmAll,
  onCancel,
}: MeasurementConfirmationModalProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [localEntries, setLocalEntries] = useState<MeasurementConfirmationEntry[]>(() =>
    entries.map((entry) => ({
      ...entry,
      override: {
        ...entry.override,
      },
    })),
  );
  const [prevEntries, setPrevEntries] = useState(entries);
  const [isEditingWidth, setIsEditingWidth] = useState(false);
  const [isEditingHeight, setIsEditingHeight] = useState(false);
  const [widthInputStr, setWidthInputStr] = useState<string>(() =>
    String(entries[0]?.override.widthIn ?? ""),
  );
  const [heightInputStr, setHeightInputStr] = useState<string>(() =>
    String(entries[0]?.override.heightIn ?? ""),
  );
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const acknowledgementCheckboxId = useId();

  if (prevEntries !== entries) {
    setPrevEntries(entries);
    setLocalEntries(
      entries.map((entry) => ({
        ...entry,
        override: {
          ...entry.override,
        },
      })),
    );
    setCurrentPageIndex(0);
    setIsEditingWidth(false);
    setIsEditingHeight(false);
    setWidthInputStr(String(entries[0]?.override.widthIn ?? ""));
    setHeightInputStr(String(entries[0]?.override.heightIn ?? ""));
  }

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

  if (!isOpen || localEntries.length === 0) {
    return null;
  }

  const currentEntry = localEntries[currentPageIndex] ?? localEntries[0];
  const isMultiProduct = localEntries.length > 1;
  const isFirstPage = currentPageIndex === 0;
  const isLastPage = currentPageIndex === localEntries.length - 1;

  const currentWidthIn = currentEntry.override.widthIn;
  const currentHeightIn = currentEntry.override.heightIn;
  const currentWidthCm = convertInToCm(currentWidthIn);
  const currentHeightCm = convertInToCm(currentHeightIn);
  const currentWidthMm = Math.round(currentWidthCm * 10);
  const currentHeightMm = Math.round(currentHeightCm * 10);

  const isOverridden =
    currentEntry.override.widthOverridden || currentEntry.override.heightOverridden;
  const isAcknowledged = currentEntry.override.acknowledged;
  const isStructuralLimitExceeded = currentWidthMm > 2400;

  const displayedPrice =
    currentEntry.recalculatedTotalPrice !== null
      ? currentEntry.recalculatedTotalPrice
      : currentEntry.systemTotalPrice;

  const recalculatePrice = (
    entry: MeasurementConfirmationEntry,
    override: MeasurementOverride,
  ) => {
    if (!entry.structuralDefinition) {
      return null;
    }

    const widthCmVal = convertInToCm(override.widthIn);
    const heightCmVal = convertInToCm(override.heightIn);
    const widthMmVal = Math.round(widthCmVal * 10);
    const heightMmVal = Math.round(heightCmVal * 10);

    const finishType =
      entry.overlayConfiguration.aluminumFinish === "white"
        ? "PowderCoatedWhite"
        : "Analok";
    const glassType =
      (entry.overlayConfiguration.thicknessMm ?? 6) >= 6 &&
      entry.overlayConfiguration.glassAppearance === "clear"
        ? "6mm_clear"
        : "6mm_bronze";

    const bomCalc = calculateBOMFromStructuralDefinition(
      entry.structuralDefinition,
      {
        widthMm: widthMmVal,
        heightMm: heightMmVal,
        panelCount: entry.overlayConfiguration.panelCount,
        hasSill: entry.overlayConfiguration.includeSill,
        finishType,
        glassType,
        structuralWaiver: entry.overlayConfiguration.structuralWaiver,
      },
    );

    const unitPrice =
      bomCalc.finalQuotation > 0
        ? bomCalc.finalQuotation
        : (entry.structuralDefinition.product.basePrice ?? 0);

    const quantity = Math.max(1, entry.overlayConfiguration.quantity ?? 1);
    return unitPrice * quantity;
  };

  const handleWidthInputChange = (valueStr: string) => {
    const cleaned = valueStr.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;

    setWidthInputStr(sanitized);

    const parsed = parseFloat(sanitized);
    if (!isNaN(parsed) && parsed > 0) {
      setLocalEntries((prev) => {
        const updated = [...prev];
        const target = { ...updated[currentPageIndex] };
        const nextOverride: MeasurementOverride = {
          ...target.override,
          widthIn: parsed,
          widthOverridden: true,
          acknowledged: false,
        };
        target.override = nextOverride;
        updated[currentPageIndex] = target;
        return updated;
      });

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        setLocalEntries((prev) => {
          const updated = [...prev];
          const target = { ...updated[currentPageIndex] };
          const price = recalculatePrice(target, target.override);
          target.recalculatedTotalPrice = price;
          updated[currentPageIndex] = target;
          return updated;
        });
      }, 200);
    }
  };

  const handleWidthBlur = () => {
    const parsed = parseFloat(widthInputStr);
    if (isNaN(parsed) || parsed <= 0) {
      const fallback = currentWidthIn > 0 ? currentWidthIn : 1;
      setWidthInputStr(String(fallback));
      handleWidthInputChange(String(fallback));
    }
  };

  const toggleEditWidth = () => {
    if (isEditingWidth) {
      handleWidthBlur();
      setIsEditingWidth(false);
    } else {
      setWidthInputStr(String(currentWidthIn));
      setIsEditingWidth(true);
    }
  };

  const handleHeightInputChange = (valueStr: string) => {
    const cleaned = valueStr.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;

    setHeightInputStr(sanitized);

    const parsed = parseFloat(sanitized);
    if (!isNaN(parsed) && parsed > 0) {
      setLocalEntries((prev) => {
        const updated = [...prev];
        const target = { ...updated[currentPageIndex] };
        const nextOverride: MeasurementOverride = {
          ...target.override,
          heightIn: parsed,
          heightOverridden: true,
          acknowledged: false,
        };
        target.override = nextOverride;
        updated[currentPageIndex] = target;
        return updated;
      });

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        setLocalEntries((prev) => {
          const updated = [...prev];
          const target = { ...updated[currentPageIndex] };
          const price = recalculatePrice(target, target.override);
          target.recalculatedTotalPrice = price;
          updated[currentPageIndex] = target;
          return updated;
        });
      }, 200);
    }
  };

  const handleHeightBlur = () => {
    const parsed = parseFloat(heightInputStr);
    if (isNaN(parsed) || parsed <= 0) {
      const fallback = currentHeightIn > 0 ? currentHeightIn : 1;
      setHeightInputStr(String(fallback));
      handleHeightInputChange(String(fallback));
    }
  };

  const toggleEditHeight = () => {
    if (isEditingHeight) {
      handleHeightBlur();
      setIsEditingHeight(false);
    } else {
      setHeightInputStr(String(currentHeightIn));
      setIsEditingHeight(true);
    }
  };

  const handleAcknowledgementToggle = () => {
    setLocalEntries((prev) => {
      const updated = [...prev];
      const target = { ...updated[currentPageIndex] };
      target.override = {
        ...target.override,
        acknowledged: !target.override.acknowledged,
      };
      updated[currentPageIndex] = target;
      return updated;
    });
  };

  const handleNextPage = () => {
    if (currentPageIndex < localEntries.length - 1) {
      const nextIndex = currentPageIndex + 1;
      setCurrentPageIndex(nextIndex);
      setIsEditingWidth(false);
      setIsEditingHeight(false);
      setWidthInputStr(String(localEntries[nextIndex]?.override.widthIn ?? ""));
      setHeightInputStr(String(localEntries[nextIndex]?.override.heightIn ?? ""));
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      const prevIndex = currentPageIndex - 1;
      setCurrentPageIndex(prevIndex);
      setIsEditingWidth(false);
      setIsEditingHeight(false);
      setWidthInputStr(String(localEntries[prevIndex]?.override.widthIn ?? ""));
      setHeightInputStr(String(localEntries[prevIndex]?.override.heightIn ?? ""));
    }
  };

  const handleConfirmAll = () => {
    const hasUnacknowledgedOverride = localEntries.some(
      (entry) =>
        (entry.override.widthOverridden || entry.override.heightOverridden) &&
        !entry.override.acknowledged,
    );

    if (hasUnacknowledgedOverride) {
      return;
    }

    onConfirmAll(localEntries);
  };

  const canProceed = !isOverridden || isAcknowledged;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs overscroll-contain overflow-y-auto animate-in fade-in duration-200"
      style={{ touchAction: "auto" }}
    >
      <div className="relative my-auto flex max-h-[90dvh] sm:max-h-[85vh] w-full max-w-[680px] flex-col rounded-[25px] border border-white bg-white p-5 sm:p-8 text-left shadow-[0px_0px_30px_0px_rgba(0,0,0,0.3)] select-none overflow-y-auto overscroll-contain">
        {/* Header with Product Identity, Finish Badge & Page Counter */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-neutral-700">
                {formatFinishName(currentEntry.aluminumFinish)}
              </span>
              {isMultiProduct && (
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-[#0f1422]/60">
                  Product {currentPageIndex + 1} of {localEntries.length}
                </span>
              )}
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#0f1422] sm:text-2xl">
              {currentEntry.productName}
            </h2>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-full p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 3D Model Preview Panel */}
        <div className="relative mb-5 flex h-60 w-full items-center justify-center overflow-hidden rounded-[20px] border border-neutral-200/80 bg-neutral-50">
          {currentEntry.previewGlbUrl ? (
            <ProductModel3D
              key={`3d-preview-${currentEntry.productId}-${currentPageIndex}-${currentEntry.aluminumFinish}-${currentEntry.overlayConfiguration.glassAppearance}`}
              glbUrl={currentEntry.previewGlbUrl}
              aluminumFinish={normalizeAluminumFinish(currentEntry.aluminumFinish)}
              glassAppearance={currentEntry.overlayConfiguration.glassAppearance}
              glassColor="clear"
              glassThicknessMm={6}
              quantity={1}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
              {currentEntry.overlayConfiguration.visualParameterValues?.thumbnailUrl ? (
                <Image
                  src={String(currentEntry.overlayConfiguration.visualParameterValues.thumbnailUrl)}
                  alt={currentEntry.productName}
                  width={160}
                  height={120}
                  unoptimized
                  className="max-h-32 object-contain"
                />
              ) : null}
              <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-500 shadow-xs">
                3D preview unavailable
              </span>
            </div>
          )}
        </div>

        {/* Measurement Verification Section */}
        <div className="mb-5 flex flex-col gap-1.5">
          <div className="text-base font-semibold tracking-tight text-[#0f1422]">
            Confirm Opening Measurements
          </div>
          <p className="text-xs text-[#0f1422]/70 sm:text-sm">
            These are the outer dimensions (width x height) the system computed for your product. Verify against your actual wall opening.
          </p>
        </div>

        {/* Dimension Fields Grid */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Outer Width Field */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#0f1422]/70">
                Outer Width (in)
              </label>
              <button
                type="button"
                onClick={toggleEditWidth}
                className="flex cursor-pointer items-center gap-1 text-xs font-medium text-[#07b6d3] underline-offset-2 transition-colors hover:text-[#069bb5] hover:underline"
              >
                {isEditingWidth ? (
                  <>
                    <Check className="size-3" /> Done
                  </>
                ) : (
                  <>
                    <Edit3 className="size-3" /> Edit
                  </>
                )}
              </button>
            </div>

            {isEditingWidth ? (
              <input
                type="text"
                inputMode="decimal"
                value={widthInputStr}
                onChange={(e) => handleWidthInputChange(e.target.value)}
                onBlur={handleWidthBlur}
                className="w-full rounded-[14px] border border-[#07b6d3] bg-white px-4 py-3 text-lg font-semibold text-[#0f1422] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#07b6d3]/30"
              />
            ) : (
              <div className="flex items-center justify-between rounded-[14px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-lg font-semibold text-[#0f1422]">
                <span>{currentWidthIn} in</span>
                {currentEntry.override.widthOverridden && (
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                    Modified
                  </span>
                )}
              </div>
            )}

            <div className="text-[11px] text-[#0f1422]/60">
              Approx. {currentWidthCm} cm ({currentWidthMm} mm)
            </div>

            {isStructuralLimitExceeded && (
              <div className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-800">
                <AlertTriangle className="size-3 shrink-0" />
                <span>Exceeds recommended structural limit. Consult with the fabricator.</span>
              </div>
            )}
          </div>

          {/* Outer Height Field */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#0f1422]/70">
                Outer Height (in)
              </label>
              <button
                type="button"
                onClick={toggleEditHeight}
                className="flex cursor-pointer items-center gap-1 text-xs font-medium text-[#07b6d3] underline-offset-2 transition-colors hover:text-[#069bb5] hover:underline"
              >
                {isEditingHeight ? (
                  <>
                    <Check className="size-3" /> Done
                  </>
                ) : (
                  <>
                    <Edit3 className="size-3" /> Edit
                  </>
                )}
              </button>
            </div>

            {isEditingHeight ? (
              <input
                type="text"
                inputMode="decimal"
                value={heightInputStr}
                onChange={(e) => handleHeightInputChange(e.target.value)}
                onBlur={handleHeightBlur}
                className="w-full rounded-[14px] border border-[#07b6d3] bg-white px-4 py-3 text-lg font-semibold text-[#0f1422] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#07b6d3]/30"
              />
            ) : (
              <div className="flex items-center justify-between rounded-[14px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-lg font-semibold text-[#0f1422]">
                <span>{currentHeightIn} in</span>
                {currentEntry.override.heightOverridden && (
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                    Modified
                  </span>
                )}
              </div>
            )}

            <div className="text-[11px] text-[#0f1422]/60">
              Approx. {currentHeightCm} cm ({currentHeightMm} mm)
            </div>
          </div>
        </div>

        {/* Estimated Price Display */}
        <div className="mb-5 flex items-center justify-between rounded-[16px] border border-neutral-200/80 bg-neutral-50 p-4">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-[#0f1422]/60">Estimated Price</span>
            <span className="text-xs text-[#0f1422]/40">
              {currentEntry.structuralDefinition
                ? "Calculated based on current dimensions"
                : "Live recalculation unavailable for this product"}
            </span>
          </div>
          <div className="text-xl font-semibold text-[#07b6d3]">
            ₱{Math.round(displayedPrice).toLocaleString()}
          </div>
        </div>

        {/* Override Acknowledgement Agreement (Conditional) */}
        {isOverridden && (
          <div className="mb-5 flex flex-col gap-3 rounded-[16px] border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-start gap-2.5">
              <FileWarning className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <p className="text-xs leading-relaxed text-[#0f1422]/80 sm:text-sm">
                By overriding the system-computed measurements, I confirm that the width and height I have entered are real, accurate measurements I have personally taken or verified. I understand that incorrect measurements may result in fabrication errors and that GlassFit and the fabricator are not responsible for discrepancies arising from customer-provided overrides.
              </p>
            </div>
            <label
              htmlFor={acknowledgementCheckboxId}
              className="flex cursor-pointer items-center gap-2.5 pt-1 text-xs font-medium text-[#0f1422] sm:text-sm"
            >
              <input
                id={acknowledgementCheckboxId}
                type="checkbox"
                checked={isAcknowledged}
                onChange={handleAcknowledgementToggle}
                className="size-4 rounded accent-[#07b6d3]"
              />
              <span>I confirm the measurements I entered are accurate.</span>
            </label>
          </div>
        )}

        {/* Multi-Product / Confirmation Navigation Controls */}
        <div className="mt-auto flex flex-col gap-3 pt-2">
          {isMultiProduct ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={isFirstPage}
                className="flex cursor-pointer items-center gap-1.5 rounded-[20px] border border-neutral-300 bg-transparent px-4 py-3 text-sm font-medium text-[#0f1422] transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
                <span>Previous</span>
              </button>

              <div className="text-xs font-medium text-[#0f1422]/50">
                {currentPageIndex + 1} of {localEntries.length}
              </div>

              {!isLastPage ? (
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={!canProceed}
                  className="flex cursor-pointer items-center gap-1.5 rounded-[20px] bg-[#0f1422] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>Next</span>
                  <ChevronRight className="size-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmAll}
                  disabled={!canProceed}
                  className="flex cursor-pointer items-center gap-2 rounded-[20px] bg-[#0f1422] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span>Confirm All & Continue</span>
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConfirmAll}
              disabled={!canProceed}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[20px] bg-[#0f1422] px-5 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircle2 className="size-5 text-emerald-400" />
              <span>Confirm & Continue</span>
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="w-full cursor-pointer rounded-[20px] border border-neutral-300 bg-transparent px-5 py-3 text-sm font-normal text-[#0f1422] transition-colors hover:bg-neutral-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
