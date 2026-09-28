"use client";

import { useState, useRef, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Layers,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UpsertRawMaterialInput } from "@/lib/admin/materials/types";
import {
  parseRawMaterialCsv,
  generateCsvTemplate,
  type CsvParseResult,
  type ParsedMaterialRow,
} from "./csvMaterialParser";

type MaterialUploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  onBatchUpsertAction: (
    items: UpsertRawMaterialInput[]
  ) => Promise<{ successCount: number; errors: string[] }>;
};

const categoryBadgeStyles = {
  Aluminum: "bg-blue-50 text-blue-700 border-blue-200",
  Glass: "bg-cyan-50 text-cyan-700 border-cyan-200",
  Hardware: "bg-amber-50 text-amber-700 border-amber-200",
  Consumable: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function MaterialUploadModal({
  isOpen,
  onClose,
  onSuccess,
  onBatchUpsertAction,
}: MaterialUploadModalProps) {
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csvData = generateCsvTemplate();
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "glassfit_materials_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const processFile = (file: File) => {
    setErrorMessage(null);
    setFileName(file.name);

    if (!file.name.endsWith(".csv") && !file.type.includes("csv") && !file.type.includes("text")) {
      setErrorMessage("Please upload a valid .csv file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        try {
          const result = parseRawMaterialCsv(text);
          setParseResult(result);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to parse spreadsheet";
          setErrorMessage(msg);
        }
      }
    };
    reader.onerror = () => {
      setErrorMessage("Failed to read the selected file.");
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleImport = () => {
    if (!parseResult) return;
    const validPayloads: UpsertRawMaterialInput[] = parseResult.rows
      .filter((r) => r.status !== "error" && r.inputPayload)
      .map((r) => r.inputPayload!);

    if (validPayloads.length === 0) {
      setErrorMessage("No valid items found to import.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await onBatchUpsertAction(validPayloads);
        if (response.successCount > 0) {
          onSuccess(response.successCount);
          onClose();
        } else if (response.errors.length > 0) {
          setErrorMessage(response.errors[0]);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to batch import materials";
        setErrorMessage(msg);
      }
    });
  };

  const validItemsCount =
    parseResult?.rows.filter((r) => r.status !== "error" && r.inputPayload).length ?? 0;

  const content = (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      onClick={() => {
        if (!isPending) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-[20px] p-6 sm:p-8 w-full max-w-[840px] shadow-[0px_4px_30px_0px_rgba(0,0,0,0.15)] flex flex-col gap-5 my-8 select-none animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-tr from-[#097283]/10 to-[#45c9e3]/20 flex items-center justify-center text-[#097283]">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-[#0f1422] leading-tight">
                Import Raw Materials Spreadsheet
              </h2>
              <p className="text-xs text-neutral-500 font-normal">
                Upload your stock aluminum, glass, or hardware inventory from Excel or Google Sheets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Error alert */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Step 1: Download Template Banner */}
        <div className="bg-neutral-50 border border-neutral-200/80 rounded-[16px] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-[#097283] shrink-0">
              <Download className="size-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#0f1422] block">
                Need the standard spreadsheet format?
              </span>
              <span className="text-[11px] text-neutral-500">
                Download our pre-formatted template with plain English columns and example rows
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-700 rounded-[10px] text-xs font-medium transition-colors shrink-0 shadow-2xs cursor-pointer"
          >
            <Download className="size-3.5 text-[#097283]" />
            <span>Download Easy Template (.csv)</span>
          </button>
        </div>

        {/* Step 2: Drag & Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-[16px] p-6 sm:p-8 flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer transition-all",
            isDragging
              ? "border-[#097283] bg-[#097283]/5"
              : "border-neutral-300 hover:border-neutral-400 bg-neutral-50/50"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="size-12 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[#097283] shadow-xs">
            <UploadCloud className="size-6" />
          </div>
          <div>
            <span className="text-sm font-semibold text-[#0f1422] block">
              {fileName ? fileName : "Click to browse or drop your CSV file here"}
            </span>
            <span className="text-xs text-neutral-500 font-normal">
              Supports .csv files exported from Excel, Google Sheets, or LibreOffice
            </span>
          </div>
        </div>

        {/* Step 3: Review & Validation Table */}
        {parseResult && parseResult.rows.length > 0 && (
          <div className="flex flex-col gap-3">
            {/* Status Summary Pill Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2 px-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="size-3.5" />
                  {parseResult.summary.validCount} Ready
                </span>
                {parseResult.summary.warningCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertTriangle className="size-3.5" />
                    {parseResult.summary.warningCount} Special Multiplier Notes
                  </span>
                )}
                {parseResult.summary.errorCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                    <AlertCircle className="size-3.5" />
                    {parseResult.summary.errorCount} Skipped (Missing Price)
                  </span>
                )}
              </div>
              <span className="text-xs text-neutral-500">
                Total Rows Parsed: {parseResult.summary.total}
              </span>
            </div>

            {/* Table View */}
            <div className="border border-neutral-200 rounded-[14px] overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-neutral-50 sticky top-0 z-10 border-b border-neutral-200">
                  <tr className="text-neutral-600 font-semibold">
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Generated Code</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Finish</th>
                    <th className="py-2.5 px-3 text-right">Stock Price</th>
                    <th className="py-2.5 px-3 text-right">Workshop Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {parseResult.rows.map((row) => (
                    <tr
                      key={row.rowIndex}
                      className={cn(
                        "hover:bg-neutral-50/70 transition-colors",
                        row.status === "error" && "bg-red-50/30 opacity-75"
                      )}
                    >
                      <td className="py-2.5 px-3">
                        {row.status === "valid" ? (
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        ) : row.status === "warning" ? (
                          <AlertTriangle className="size-4 text-amber-600" />
                        ) : (
                          <AlertCircle className="size-4 text-red-600" />
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-neutral-700">
                        {row.materialCode}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#0f1422]">
                        {row.description}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                            categoryBadgeStyles[row.category] || "bg-neutral-100 text-neutral-700"
                          )}
                        >
                          {row.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600">{row.finishType}</td>
                      <td className="py-2.5 px-3 text-right font-medium">
                        ₱{row.stockPriceRrd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-[#097283]">
                        ₱{row.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })} / {row.billingUnit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-5 py-2.5 rounded-[12px] border border-neutral-300 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isPending || validItemsCount === 0}
            className="bg-[#05b64b] hover:bg-[#04963e] text-white text-xs font-semibold px-6 py-2.5 rounded-[12px] shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isPending && (
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
            <span>
              {isPending
                ? "Importing..."
                : `Import ${validItemsCount} Item${validItemsCount === 1 ? "" : "s"}`}
            </span>
            {!isPending && <ArrowRight className="size-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
