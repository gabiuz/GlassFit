"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, AlertCircle, Layers } from "lucide-react";
import {
  type RawMaterial,
  type RawMaterialCategory,
  type RawMaterialFinishType,
  type BillingUnit,
  RawMaterialCategorySchema,
  RawMaterialFinishTypeSchema,
  BillingUnitSchema,
} from "@/lib/pricing/types";
import {
  UpsertRawMaterialInputSchema,
  type UpsertRawMaterialInput,
} from "@/lib/admin/materials/types";

type MaterialModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (saved: RawMaterial) => void;
  material: RawMaterial | null; // null for Create, populated for Edit
  onUpsertAction: (input: UpsertRawMaterialInput) => Promise<RawMaterial>;
};

const CATEGORIES: RawMaterialCategory[] = ["Aluminum", "Glass", "Hardware", "Consumable"];

const FINISH_TYPES: RawMaterialFinishType[] = [
  "Analok",
  "PowderCoatedWhite",
  "PowderCoatedBlack",
  "Anodized",
  "Mill",
  "Bronze",
  "Clear",
  "None",
];

const BILLING_UNITS: BillingUnit[] = ["m", "sqm", "pc", "set", "tube", "lot"];

const DEFAULT_WASTE_BY_CATEGORY: Record<RawMaterialCategory, number> = {
  Aluminum: 0.12, // 12% standard offcut scrap
  Glass: 0.1, // 10% handling & edge cut scrap
  Hardware: 0.0, // Zero scrap for discrete hardware
  Consumable: 0.0, // Tube/roll units
};

export function MaterialModal({
  isOpen,
  onClose,
  onSave,
  material,
  onUpsertAction,
}: MaterialModalProps) {
  const isEditing = !!material;

  const [materialCode, setMaterialCode] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<RawMaterialCategory>("Aluminum");
  const [finishType, setFinishType] = useState<RawMaterialFinishType>("Analok");
  const [billingUnit, setBillingUnit] = useState<BillingUnit>("m");
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [wasteAllowance, setWasteAllowance] = useState<number>(0.12);
  const [isActive, setIsActive] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (material) {
        setMaterialCode(material.material_code);
        setDescription(material.description);
        setCategory(material.category);
        setFinishType(material.finish_type);
        setBillingUnit(material.billing_unit);
        setUnitPrice(material.unit_price);
        setWasteAllowance(material.waste_allowance);
        setIsActive(material.is_active);
      } else {
        setMaterialCode("");
        setDescription("");
        setCategory("Aluminum");
        setFinishType("Analok");
        setBillingUnit("m");
        setUnitPrice(0);
        setWasteAllowance(DEFAULT_WASTE_BY_CATEGORY["Aluminum"]);
        setIsActive(true);
      }
      setErrorMessage(null);
    }
  }, [isOpen, material]);

  // When category changes in Create mode, intelligently update default finish, unit, and waste
  const handleCategoryChange = (newCategory: RawMaterialCategory) => {
    setCategory(newCategory);
    if (!isEditing) {
      setWasteAllowance(DEFAULT_WASTE_BY_CATEGORY[newCategory]);
      if (newCategory === "Aluminum") {
        setFinishType("Analok");
        setBillingUnit("m");
      } else if (newCategory === "Glass") {
        setFinishType("Clear");
        setBillingUnit("sqm");
      } else if (newCategory === "Hardware") {
        setFinishType("Mill");
        setBillingUnit("pc");
      } else if (newCategory === "Consumable") {
        setFinishType("None");
        setBillingUnit("tube");
      }
    }
  };

  // Real-time calculation preview of effective cost
  const effectiveCost = useMemo(() => {
    const validPrice = Math.max(0, isNaN(unitPrice) ? 0 : unitPrice);
    const validWaste = Math.max(0, Math.min(1, isNaN(wasteAllowance) ? 0 : wasteAllowance));
    return validPrice * (1 + validWaste);
  }, [unitPrice, wasteAllowance]);

  const scrapMarkup = useMemo(() => {
    const validPrice = Math.max(0, isNaN(unitPrice) ? 0 : unitPrice);
    const validWaste = Math.max(0, Math.min(1, isNaN(wasteAllowance) ? 0 : wasteAllowance));
    return validPrice * validWaste;
  }, [unitPrice, wasteAllowance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const rawInput: UpsertRawMaterialInput = {
      ...(material?.id ? { id: material.id } : {}),
      material_code: materialCode.trim(),
      description: description.trim(),
      category,
      finish_type: finishType,
      billing_unit: billingUnit,
      unit_price: Number(unitPrice),
      waste_allowance: Number(wasteAllowance),
      is_active: isActive,
    };

    const validation = UpsertRawMaterialInputSchema.safeParse(rawInput);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      setErrorMessage(firstIssue?.message || "Invalid input parameters");
      return;
    }

    setIsSubmitting(true);
    try {
      const saved = await onUpsertAction(validation.data);
      onSave(saved);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save raw material";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-[20px] p-6 sm:p-8 w-full max-w-[620px] shadow-[0px_4px_30px_0px_rgba(0,0,0,0.15)] flex flex-col gap-5 my-8 select-none animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-tr from-[#097283]/10 to-[#45c9e3]/20 flex items-center justify-center text-[#097283]">
              <Layers className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-[#0f1422] leading-tight">
                {isEditing ? "Edit Raw Material" : "Add Raw Material"}
              </h2>
              <p className="text-xs text-neutral-500 font-normal">
                {isEditing
                  ? "Update stock catalog rates and waste allowances"
                  : "Register a new profile, glass sheet, or hardware accessory"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Row 1: Material Code & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-700">
                Material Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={materialCode}
                onChange={(e) => setMaterialCode(e.target.value)}
                placeholder="e.g. mat_al_798_head_anlk"
                disabled={isEditing}
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-sm font-mono text-[#0f1422] placeholder:text-neutral-400 focus:outline-none focus:border-[#097283] focus:ring-1 focus:ring-[#097283] disabled:bg-neutral-100 disabled:text-neutral-500 transition-all"
                required
              />
              <span className="text-[10px] text-neutral-400 font-normal">
                Unique identifier used by parametric components
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-700">
                Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Series 798 Double Head Track"
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-sm text-[#0f1422] placeholder:text-neutral-400 focus:outline-none focus:border-[#097283] focus:ring-1 focus:ring-[#097283] transition-all"
                required
              />
              <span className="text-[10px] text-neutral-400 font-normal">
                Human-readable material or extrusion name
              </span>
            </div>
          </div>

          {/* Row 2: Category, Finish Type & Billing Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-700">Category</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as RawMaterialCategory)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-sm bg-white text-[#0f1422] focus:outline-none focus:border-[#097283] focus:ring-1 focus:ring-[#097283] transition-all cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-700">Finish / Variant</label>
              <select
                value={finishType}
                onChange={(e) => setFinishType(e.target.value as RawMaterialFinishType)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-sm bg-white text-[#0f1422] focus:outline-none focus:border-[#097283] focus:ring-1 focus:ring-[#097283] transition-all cursor-pointer"
              >
                {FINISH_TYPES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-700">Billing Unit</label>
              <select
                value={billingUnit}
                onChange={(e) => setBillingUnit(e.target.value as BillingUnit)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-sm bg-white text-[#0f1422] focus:outline-none focus:border-[#097283] focus:ring-1 focus:ring-[#097283] transition-all cursor-pointer"
              >
                {BILLING_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u} ({u === "m" ? "Linear Meter" : u === "sqm" ? "Square Meter" : u === "pc" ? "Piece" : u === "tube" ? "Tube" : u === "set" ? "Set" : "Lot"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Unit Price & Waste Allowance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-700">
                Unit Price (PHP / {billingUnit}) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-semibold">
                  ₱
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={isNaN(unitPrice) ? "" : unitPrice}
                  onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3.5 py-2 rounded-xl border border-neutral-300 text-sm font-medium text-[#0f1422] focus:outline-none focus:border-[#097283] focus:ring-1 focus:ring-[#097283] transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-700">
                  Waste Allowance Scrap
                </label>
                <span className="text-xs font-semibold text-[#097283]">
                  {(wasteAllowance * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.005"
                  value={wasteAllowance}
                  onChange={(e) => setWasteAllowance(parseFloat(e.target.value))}
                  className="flex-1 accent-[#097283] cursor-pointer"
                />
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="1.0"
                  value={wasteAllowance}
                  onChange={(e) => setWasteAllowance(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 rounded-lg border border-neutral-300 text-xs font-mono text-right text-[#0f1422] focus:outline-none focus:border-[#097283]"
                />
              </div>
            </div>
          </div>

          {/* Live Calculation Preview Card */}
          <div className="bg-gradient-to-br from-neutral-50 to-slate-100/70 border border-neutral-200 rounded-[16px] p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0f1422]">
                <Sparkles className="size-3.5 text-[#097283]" />
                <span>Instant Fabricator Cost Breakdown</span>
              </div>
              <span className="text-[11px] text-neutral-500 font-medium">
                Per 1 {billingUnit}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-neutral-200/80 text-xs">
              <div>
                <span className="text-neutral-500 text-[11px] block">Base Rate</span>
                <span className="font-semibold text-neutral-800">
                  ₱{unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 text-[11px] block">
                  Scrap Factor (+{(wasteAllowance * 100).toFixed(1)}%)
                </span>
                <span className="font-semibold text-amber-700">
                  +₱{scrapMarkup.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[#097283] text-[11px] font-semibold block">
                  Effective Cost Rate
                </span>
                <span className="font-bold text-[#097283] text-sm">
                  ₱{effectiveCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Active Status Toggle */}
          <div className="flex items-center justify-between px-1 py-1">
            <div>
              <span className="text-xs font-medium text-neutral-800 block">Catalog Status</span>
              <span className="text-[11px] text-neutral-500">
                Active materials are selectable for parametric product components
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isActive ? "bg-[#05b64b]" : "bg-neutral-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-[12px] border border-neutral-300 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#097283] to-[#45c9e3] hover:opacity-95 text-white text-xs font-medium px-6 py-2.5 rounded-[12px] shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && (
                <svg
                  className="animate-spin h-3.5 w-3.5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              )}
              {isSubmitting
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : "Create Material"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
