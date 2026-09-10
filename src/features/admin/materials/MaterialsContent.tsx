"use client";

import { useState, useMemo, useTransition } from "react";
import { SearchBar } from "@/components/shared/SearchBar";
import { Copy, Check, Plus, TrendingUp, Layers, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RawMaterial, RawMaterialCategory, RawMaterialFinishType } from "@/lib/pricing/types";
import {
  upsertRawMaterial,
  deleteRawMaterial,
  batchUpdateMaterialPrices,
  toggleRawMaterialStatus,
} from "@/lib/admin/materials/materialActions";
import { MaterialModal } from "./MaterialModal";
import { BatchPriceModal } from "./BatchPriceModal";
import { DeleteMaterialModal } from "./DeleteMaterialModal";

type MaterialsContentProps = {
  initialMaterials: RawMaterial[];
};

const CATEGORIES: (RawMaterialCategory | "ALL")[] = [
  "ALL",
  "Aluminum",
  "Glass",
  "Hardware",
  "Consumable",
];

const FINISHES: (RawMaterialFinishType | "ALL")[] = [
  "ALL",
  "Analok",
  "PowderCoatedWhite",
  "PowderCoatedBlack",
  "Anodized",
  "Mill",
  "Bronze",
  "Clear",
  "None",
];

const categoryBadgeStyles: Record<RawMaterialCategory, string> = {
  Aluminum: "bg-blue-50 text-blue-700 border-blue-200",
  Glass: "bg-cyan-50 text-cyan-700 border-cyan-200",
  Hardware: "bg-amber-50 text-amber-700 border-amber-200",
  Consumable: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function MaterialCodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Click to copy code: ${code}`}
      className="group relative inline-flex items-center gap-1.5 px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black rounded-md text-xs font-mono transition-colors cursor-pointer"
    >
      <span>{code}</span>
      {copied ? (
        <Check className="size-3 text-emerald-600 animate-in zoom-in-50 duration-150 shrink-0" />
      ) : (
        <Copy className="size-3 text-neutral-400 group-hover:text-neutral-700 transition-colors shrink-0" />
      )}
      {copied && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-sans px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap animate-in fade-in duration-150 z-10">
          Copied!
        </span>
      )}
    </button>
  );
}

export function MaterialsContent({ initialMaterials }: MaterialsContentProps) {
  const [materials, setMaterials] = useState<RawMaterial[]>(initialMaterials);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<RawMaterialCategory | "ALL">("ALL");
  const [selectedFinish, setSelectedFinish] = useState<RawMaterialFinishType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState<RawMaterial | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3000);
  };

  // Filtered materials
  const filtered = useMemo(() => {
    return materials.filter((item) => {
      // Category filter
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false;
      }
      // Finish filter
      if (selectedFinish !== "ALL" && item.finish_type !== selectedFinish) {
        return false;
      }
      // Status filter
      if (statusFilter === "ACTIVE" && !item.is_active) return false;
      if (statusFilter === "INACTIVE" && item.is_active) return false;

      // Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const codeMatch = item.material_code.toLowerCase().includes(q);
        const descMatch = item.description.toLowerCase().includes(q);
        const catMatch = item.category.toLowerCase().includes(q);
        if (!codeMatch && !descMatch && !catMatch) return false;
      }

      return true;
    });
  }, [materials, selectedCategory, selectedFinish, statusFilter, searchQuery]);

  // Handle Save (Add or Edit)
  const handleSaveMaterial = (saved: RawMaterial) => {
    setMaterials((prev) => {
      const idx = prev.findIndex((m) => m.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      } else {
        return [saved, ...prev];
      }
    });
    showToast(`Material "${saved.description}" saved successfully`);
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!deletingMaterial) return;
    setIsDeleting(true);
    try {
      const result = await deleteRawMaterial(deletingMaterial.id);
      if (result.deactivated) {
        setMaterials((prev) =>
          prev.map((m) => (m.id === deletingMaterial.id ? { ...m, is_active: false } : m))
        );
        showToast(
          `Material is referenced in product components and has been deactivated instead of permanently deleted`
        );
      } else {
        setMaterials((prev) => prev.filter((m) => m.id !== deletingMaterial.id));
        showToast(`Material "${deletingMaterial.description}" permanently deleted`);
      }
      setDeletingMaterial(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete material";
      alert(message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Status Toggle
  const handleToggleStatus = (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      try {
        const nextStatus = !currentStatus;
        // Optimistic update
        setMaterials((prev) =>
          prev.map((m) => (m.id === id ? { ...m, is_active: nextStatus } : m))
        );
        await toggleRawMaterialStatus(id, nextStatus);
        showToast(`Material status set to ${nextStatus ? "Active" : "Inactive"}`);
      } catch (err: unknown) {
        // Rollback
        setMaterials((prev) =>
          prev.map((m) => (m.id === id ? { ...m, is_active: currentStatus } : m))
        );
        const message = err instanceof Error ? err.message : "Failed to toggle status";
        alert(message);
      }
    });
  };

  // Handle Batch Update Success
  const handleBatchSuccess = (updates: { id: string; unit_price: number }[]) => {
    setMaterials((prev) => {
      const updateMap = new Map(updates.map((u) => [u.id, u.unit_price]));
      return prev.map((m) => {
        if (updateMap.has(m.id)) {
          return { ...m, unit_price: updateMap.get(m.id)! };
        }
        return m;
      });
    });
    showToast(`Successfully updated ${updates.length} material prices`);
  };

  return (
    <div className="flex flex-col items-start gap-6 sm:gap-8 w-full max-w-[1240px] select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0f1422] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="size-4 text-[#45c9e3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="w-full flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 xl:gap-6">
        <div className="flex flex-col gap-1 items-start min-w-0">
          <h1 className="text-black text-2xl sm:text-3xl lg:text-[32px] font-medium leading-tight tracking-tight">
            Raw Materials Catalog
          </h1>
          <p className="text-neutral-700 text-sm sm:text-base lg:text-lg font-normal leading-snug">
            Manage wholesale aluminum profiles, glass stock sheets, hardware, and waste scrap allowances
          </p>
        </div>

        <div className="w-full xl:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 sm:w-auto">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search code or description..."
              inputClassName="w-full sm:w-[260px] md:w-[300px]"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsBatchOpen(true)}
            className="bg-white border border-neutral-300 hover:bg-neutral-50 text-[#0f1422] rounded-[25px] px-4 py-2.5 sm:py-3 flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0 shadow-xs"
          >
            <TrendingUp className="size-4 text-[#097283]" />
            <span className="text-sm font-medium whitespace-nowrap">Batch Price Adjust</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingMaterial(null);
              setIsAddEditOpen(true);
            }}
            className="bg-[#0f1422] rounded-[25px] px-5 py-2.5 sm:py-3 flex items-center justify-center gap-2 cursor-pointer hover:bg-black transition-colors shrink-0 shadow-xs text-white"
          >
            <Plus className="size-4" />
            <span className="text-sm sm:text-base font-medium whitespace-nowrap">
              + Add Material
            </span>
          </button>
        </div>
      </div>

      {/* Filter and Count Summary Bar */}
      <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-[20px] shadow-xs border border-neutral-100">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
                  selectedCategory === cat
                    ? "bg-[#097283] text-white shadow-xs"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-neutral-200 mx-1 hidden sm:block" />

          {/* Finish Filter */}
          <select
            value={selectedFinish}
            onChange={(e) => setSelectedFinish(e.target.value as RawMaterialFinishType | "ALL")}
            className="text-xs bg-neutral-100 hover:bg-neutral-200 border-none rounded-full px-3 py-1.5 text-neutral-700 outline-none cursor-pointer"
          >
            <option value="ALL">All Finishes</option>
            {FINISHES.filter((f) => f !== "ALL").map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
            className="text-xs bg-neutral-100 hover:bg-neutral-200 border-none rounded-full px-3 py-1.5 text-neutral-700 outline-none cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>

        <p className="text-neutral-400 text-xs font-normal whitespace-nowrap self-end md:self-auto">
          Showing <span className="font-semibold text-neutral-700">{filtered.length}</span> of{" "}
          {materials.length} raw materials
        </p>
      </div>

      {/* Materials Table Container */}
      <div className="bg-white rounded-[20px] p-4 sm:p-6 lg:p-[30px] flex flex-col items-start w-full shadow-xs overflow-hidden border border-neutral-100">
        <div className="w-full overflow-x-auto pb-2">
          <table className="w-full min-w-[960px] text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e5e5e5] text-xs font-semibold text-neutral-700">
                <th className="py-3 px-3">Material Code</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Finish / Variant</th>
                <th className="py-3 px-3 text-center">Unit</th>
                <th className="py-3 px-3 text-right">Unit Price</th>
                <th className="py-3 px-3 text-right">Scrap Allowance</th>
                <th className="py-3 px-3 text-right">Effective Rate</th>
                <th className="py-3 px-3 text-center">Active</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-neutral-400 text-sm">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="size-8 text-neutral-300" />
                      <span>No raw materials found matching your criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const effectivePrice = item.unit_price * (1 + item.waste_allowance);

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "hover:bg-neutral-50/80 transition-colors text-xs",
                        !item.is_active && "opacity-60 bg-neutral-50/40"
                      )}
                    >
                      {/* Code */}
                      <td className="py-3 px-3">
                        <MaterialCodeBadge code={item.material_code} />
                      </td>

                      {/* Description */}
                      <td className="py-3 px-3 font-medium text-[#0f1422]">
                        {item.description}
                      </td>

                      {/* Category Pill */}
                      <td className="py-3 px-3">
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[11px] font-medium border",
                            categoryBadgeStyles[item.category] || "bg-neutral-100 text-neutral-700"
                          )}
                        >
                          {item.category}
                        </span>
                      </td>

                      {/* Finish */}
                      <td className="py-3 px-3 text-neutral-600 font-normal">
                        {item.finish_type}
                      </td>

                      {/* Unit */}
                      <td className="py-3 px-3 text-center font-mono text-neutral-500">
                        {item.billing_unit}
                      </td>

                      {/* Unit Price */}
                      <td className="py-3 px-3 text-right font-medium text-[#0f1422]">
                        ₱{item.unit_price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Scrap Allowance */}
                      <td className="py-3 px-3 text-right font-mono">
                        <span className={item.waste_allowance > 0 ? "text-amber-700 font-semibold" : "text-neutral-400"}>
                          {(item.waste_allowance * 100).toFixed(1)}%
                        </span>
                      </td>

                      {/* Effective Rate */}
                      <td className="py-3 px-3 text-right font-semibold text-[#097283]">
                        ₱{effectivePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Active Status Switch */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item.id, item.is_active)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            item.is_active ? "bg-[#05b64b]" : "bg-neutral-300"
                          )}
                          title={item.is_active ? "Deactivate material" : "Activate material"}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              item.is_active ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMaterial(item);
                              setIsAddEditOpen(true);
                            }}
                            className="bg-[#0f1422] hover:bg-black text-white px-3 py-1 rounded-[8px] text-[11px] font-normal transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingMaterial(item)}
                            className="bg-[#c50000] hover:bg-red-700 text-white px-3 py-1 rounded-[8px] text-[11px] font-normal transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Material Modal */}
      <MaterialModal
        isOpen={isAddEditOpen}
        onClose={() => {
          setIsAddEditOpen(false);
          setEditingMaterial(null);
        }}
        onSave={handleSaveMaterial}
        material={editingMaterial}
        onUpsertAction={upsertRawMaterial}
      />

      {/* Batch Price Adjustment Modal */}
      <BatchPriceModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        materials={materials}
        onBatchUpdateAction={batchUpdateMaterialPrices}
        onSuccess={handleBatchSuccess}
      />

      {/* Delete Confirmation Modal */}
      <DeleteMaterialModal
        isOpen={!!deletingMaterial}
        onClose={() => setDeletingMaterial(null)}
        onConfirm={handleConfirmDelete}
        material={deletingMaterial}
        isDeleting={isDeleting}
      />
    </div>
  );
}
