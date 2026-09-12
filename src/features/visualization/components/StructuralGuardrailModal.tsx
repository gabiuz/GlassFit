import React from "react";
import { AlertTriangle, ShieldAlert, CheckCircle2, ChevronRight, FileWarning, X } from "lucide-react";
import type { EngineeringValidationResult } from "@/lib/visualization/guardrailEngine";

interface StructuralGuardrailModalProps {
  isOpen: boolean;
  validation: EngineeringValidationResult | null;
  onSwitchTo3Panels: () => void;
  onAcknowledgeAndProceed: () => void;
  onClose?: () => void;
}

export function StructuralGuardrailModal({
  isOpen,
  validation,
  onSwitchTo3Panels,
  onAcknowledgeAndProceed,
  onClose,
}: StructuralGuardrailModalProps) {
  if (!isOpen || !validation) return null;

  const widthM = (validation.widthMm / 1000).toFixed(2);
  const heightM = (validation.heightMm / 1000).toFixed(2);
  const leafWidthMm = Math.round(validation.leafWidthMm);
  const deadLoadKg = validation.totalLeafDeadLoadKg.toFixed(1);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-white rounded-[25px] shadow-[0px_0px_30px_0px_rgba(0,0,0,0.3)] flex flex-col p-6 sm:p-8 md:p-10 max-w-[620px] w-full text-left select-none overflow-hidden">
        {/* Header with Warning Pill & Close */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <ShieldAlert className="size-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  NSCP 2015 Structural Advisory
                </span>
              </div>
              <h2 className="text-[#0f1422] text-xl sm:text-2xl font-semibold tracking-tight mt-0.5">
                Structural Span Limit Exceeded
              </h2>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        {/* Advisory Description */}
        <p className="text-[#0f1422]/80 text-sm sm:text-base leading-relaxed mb-6">
          Your configured aperture (<span className="font-semibold text-[#0f1422]">{widthM}m W × {heightM}m H</span>) exceeds the standard <span className="font-semibold text-[#0f1422]">1,200mm leaf span limit</span> for 2-panel Series 798 residential sliding systems.
        </p>

        {/* Structural Metrics Comparison Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="rounded-[16px] bg-neutral-50 p-3.5 border border-neutral-200/80 flex flex-col gap-1">
            <span className="text-xs text-[#0f1422]/60 font-medium">Single Leaf Width</span>
            <span className="text-lg font-semibold text-amber-700">{leafWidthMm} mm</span>
            <span className="text-[11px] text-amber-800/80">Limit: 1,200 mm</span>
          </div>

          <div className="rounded-[16px] bg-neutral-50 p-3.5 border border-neutral-200/80 flex flex-col gap-1">
            <span className="text-xs text-[#0f1422]/60 font-medium">Panel Dead Load</span>
            <span className={`text-lg font-semibold ${validation.isRollerOverloaded ? "text-red-600" : "text-[#0f1422]"}`}>
              {deadLoadKg} kg
            </span>
            <span className="text-[11px] text-[#0f1422]/60">Roller Cap: 40.0 kg</span>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-[16px] bg-neutral-50 p-3.5 border border-neutral-200/80 flex flex-col gap-1">
            <span className="text-xs text-[#0f1422]/60 font-medium">Aspect Ratio</span>
            <span className="text-lg font-semibold text-[#0f1422]">{validation.aspectRatio.toFixed(2)} : 1</span>
            <span className="text-[11px] text-[#0f1422]/60">Crabbing: &gt; 1.2:1</span>
          </div>
        </div>

        {/* Risk Breakdown Notice */}
        <div className="rounded-[16px] bg-amber-500/5 border border-amber-500/20 p-4 mb-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-amber-900 font-medium text-xs sm:text-sm">
            <AlertTriangle className="size-4 text-amber-600 shrink-0" />
            <span>Why is this important for your installation?</span>
          </div>
          <ul className="text-xs sm:text-sm text-[#0f1422]/80 space-y-1.5 list-disc list-inside pl-1">
            <li>
              <strong className="text-[#0f1422]">Wind Load Deflection:</strong> Under high wind pressure, wide 2-panel sashes deflect beyond the allowable L/175 threshold, allowing water seepage.
            </li>
            <li>
              <strong className="text-[#0f1422]">Roller Micro-Pitting:</strong> Heavy glass leaves wear out standard POM nylon roller bearings rapidly.
            </li>
            <li>
              <strong className="text-[#0f1422]">Sash Racking & Binding:</strong> Wide leaves experience friction and binding when sliding.
            </li>
          </ul>
        </div>

        {/* Action Options (Behavior B) */}
        <div className="flex flex-col gap-3">
          {/* Primary Action (Recommended): Switch to 3 Panels */}
          <button
            type="button"
            onClick={onSwitchTo3Panels}
            className="w-full bg-[#0f1422] hover:bg-black text-white px-5 py-4 rounded-[20px] font-medium text-base sm:text-lg flex items-center justify-between transition-colors shadow-sm cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
              <div className="text-left">
                <div className="font-semibold text-white">Switch to 3 Panels (Recommended)</div>
                <div className="text-xs text-neutral-300 font-normal">
                  Reduces leaf width to {Math.round(validation.widthMm / 3)}mm and distributes load safely
                </div>
              </div>
            </div>
            <ChevronRight className="size-5 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Secondary Action: Acknowledge & Proceed as 2-Panel (Attach Structural Waiver) */}
          <button
            type="button"
            onClick={onAcknowledgeAndProceed}
            className="w-full bg-transparent hover:bg-neutral-100 border border-neutral-300 text-[#0f1422] px-5 py-3.5 rounded-[20px] font-normal text-sm sm:text-base flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <FileWarning className="size-5 text-amber-600 shrink-0" />
              <div className="text-left">
                <div className="font-medium text-[#0f1422]">Acknowledge & Proceed as 2-Panel</div>
                <div className="text-xs text-neutral-500">
                  Retains 2 leaves and attaches a formal structural waiver to your quotation
                </div>
              </div>
            </div>
            <ChevronRight className="size-5 text-neutral-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
