"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";
import type { RawMaterial, RawMaterialCategory } from "@/lib/pricing/types";
import type { BatchUpdateMaterialPricesInput } from "@/lib/admin/materials/types";

type BatchPriceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  materials: RawMaterial[];
  onBatchUpdateAction: (input: BatchUpdateMaterialPricesInput) => Promise<{ count: number }>;
  onSuccess: (updatedMaterials: { id: string; unit_price: number }[]) => void;
};

const CATEGORIES: (RawMaterialCategory | "ALL")[] = ["ALL", "Aluminum", "Glass", "Hardware", "Consumable"];

export function BatchPriceModal({
  isOpen,
  onClose,
  materials,
  onBatchUpdateAction,
  onSuccess,
}: BatchPriceModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<RawMaterialCategory | "ALL">("ALL");
  const [percentageDelta, setPercentageDelta] = useState<number>(5);
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize priceMap with current unit prices
  useEffect(() => {
    if (isOpen) {
      const initialMap: Record<string, number> = {};
      materials.forEach((m) => {
        initialMap[m.id] = m.unit_price;
      });
      setPriceMap(initialMap);
      setErrorMessage(null);
    }
  }, [isOpen, materials]);

  // Filter materials based on category
  const filteredMaterials = useMemo(() => {
    if (selectedCategory === "ALL") return materials;
    return materials.filter((m) => m.category === selectedCategory);
  }, [materials, selectedCategory]);

  // Apply percentage hike/discount across filtered materials
  const handleApplyPercentage = (pct: number) => {
    setPriceMap((prev) => {
      const updated = { ...prev };
      filteredMaterials.forEach((m) => {
        const factor = 1 + pct / 100;
        // Round to 2 decimal places
        const newPrice = Math.round(m.unit_price * factor * 100) / 100;
        updated[m.id] = Math.max(0, newPrice);
      });
      return updated;
    });
  };

  // Reset to original prices for current filter
  const handleResetToOriginal = () => {
    setPriceMap((prev) => {
      const updated = { ...prev };
      filteredMaterials.forEach((m) => {
        updated[m.id] = m.unit_price;
      });
      return updated;
    });
  };

  // Calculate total modified count
  const modifiedItems = useMemo(() => {
    return Object.entries(priceMap)
      .filter(([id, newPrice]) => {
        const original = materials.find((m) => m.id === id);
        return original && original.unit_price !== newPrice;
      })
      .map(([id, newPrice]) => ({ id, unit_price: newPrice }));
  }, [priceMap, materials]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modifiedItems.length === 0) {
      onClose();
      return;
    }

    // Check for negative prices
    const hasNegative = modifiedItems.some((item) => item.unit_price < 0 || isNaN(item.unit_price));
    if (hasNegative) {
      setErrorMessage("Unit prices must be non-negative numbers");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onBatchUpdateAction({
        updates: modifiedItems,
      });
      onSuccess(modifiedItems);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update batch prices";
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
        className="bg-white rounded-[20px] p-6 sm:p-8 w-full max-w-[800px] shadow-[0px_4px_30px_0px_rgba(0,0,0,0.15)] flex flex-col gap-5 my-8 select-none animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-tr from-[#097283]/10 to-[#45c9e3]/20 flex items-center justify-center text-[#097283]">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-[#0f1422] leading-tight">
                Batch Price Adjustment
              </h2>
              <p className="text-xs text-neutral-500 font-normal">
                Quickly adjust supplier profile and glass rates across catalog categories
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

        {/* Error notification */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Quick percentage calculation bar */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-[16px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-neutral-700">Filter Category:</span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full transition-all cursor-pointer font-medium ${
                  selectedCategory === cat
                    ? "bg-[#097283] text-white shadow-xs"
                    : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="flex items-center gap-1.5 bg-white border border-neutral-300 rounded-xl px-2.5 py-1">
              <span className="text-xs font-medium text-neutral-500">%</span>
              <input
                type="number"
                step="0.5"
                value={percentageDelta}
                onChange={(e) => setPercentageDelta(parseFloat(e.target.value) || 0)}
                className="w-14 text-xs font-mono text-right text-[#0f1422] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => handleApplyPercentage(percentageDelta)}
              className="bg-[#0f1422] hover:bg-black text-white text-xs font-medium px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              Apply {percentageDelta >= 0 ? `+${percentageDelta}%` : `${percentageDelta}%`}
            </button>
            <button
              type="button"
              onClick={handleResetToOriginal}
              title="Reset current view to original prices"
              className="p-1.5 rounded-xl border border-neutral-300 text-neutral-500 hover:text-black hover:bg-white transition-colors cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Editable Table */}
        <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-neutral-100 text-neutral-700 font-semibold sticky top-0 border-b border-neutral-200">
              <tr>
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Current Price</th>
                <th className="py-2.5 px-3 text-right">New Unit Price (PHP)</th>
                <th className="py-2.5 px-3 text-right">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredMaterials.map((m) => {
                const current = m.unit_price;
                const newPrice = priceMap[m.id] ?? current;
                const delta = newPrice - current;
                const pctChange = current > 0 ? (delta / current) * 100 : 0;
                const isChanged = Math.abs(delta) > 0.001;

                return (
                  <tr
                    key={m.id}
                    className={`hover:bg-neutral-50/70 transition-colors ${
                      isChanged ? "bg-amber-50/40" : ""
                    }`}
                  >
                    <td className="py-2 px-3 font-mono text-neutral-600 text-[11px]">
                      {m.material_code}
                    </td>
                    <td className="py-2 px-3 font-medium text-neutral-800">
                      {m.description}
                    </td>
                    <td className="py-2 px-3 text-neutral-500">{m.category}</td>
                    <td className="py-2 px-3 text-right font-medium text-neutral-600">
                      ₱{current.toFixed(2)} / {m.billing_unit}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="inline-flex items-center gap-1 bg-white border border-neutral-300 rounded-lg px-2 py-0.5 focus-within:border-[#097283]">
                        <span className="text-neutral-400 text-[10px]">₱</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={isNaN(newPrice) ? "" : newPrice}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPriceMap((prev) => ({
                              ...prev,
                              [m.id]: isNaN(val) ? 0 : val,
                            }));
                          }}
                          className="w-20 text-xs font-mono font-semibold text-right outline-none text-[#0f1422]"
                        />
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[11px]">
                      {isChanged ? (
                        <span
                          className={delta > 0 ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"}
                        >
                          {delta > 0 ? `+₱${delta.toFixed(2)}` : `-₱${Math.abs(delta).toFixed(2)}`}{" "}
                          ({pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`})
                        </span>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info and actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-neutral-100">
          <div className="text-xs text-neutral-500">
            {modifiedItems.length > 0 ? (
              <span className="font-semibold text-[#097283]">
                {modifiedItems.length} {modifiedItems.length === 1 ? "price" : "prices"} modified and ready to update
              </span>
            ) : (
              <span>No price changes staged</span>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-[12px] border border-neutral-300 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || modifiedItems.length === 0}
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
                ? "Updating..."
                : `Update ${modifiedItems.length} ${modifiedItems.length === 1 ? "Price" : "Prices"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
