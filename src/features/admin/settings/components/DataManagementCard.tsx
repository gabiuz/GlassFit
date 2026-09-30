"use client";

import React, { useState, useEffect } from "react";
import { BarChart2, Download, RefreshCw, Database } from "lucide-react";
import { getSystemPreferences } from "../settingsActions";
import { BusinessIntelligenceModal } from "./BusinessIntelligenceModal";

interface DataManagementCardProps {
    lastBackupAt?: string | null;
    isOwner: boolean;
    onToast: (msg: string, variant: "success" | "error") => void;
}

export function DataManagementCard({
    lastBackupAt: initialLastBackupAt,
    isOwner,
    onToast,
}: DataManagementCardProps) {
    const [lastBackupAt, setLastBackupAt] = useState<string | null>(initialLastBackupAt ?? null);
    const [isExportingBookings, setIsExportingBookings] = useState(false);
    const [isExportingProducts, setIsExportingProducts] = useState(false);
    const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
    const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);

    useEffect(() => {
        if (initialLastBackupAt !== undefined) return;
        async function fetchBackupTimestamp() {
            const res = await getSystemPreferences();
            if (res.ok && res.data?.lastBackupAt) {
                setLastBackupAt(res.data.lastBackupAt);
            }
        }
        fetchBackupTimestamp();
    }, [initialLastBackupAt]);


    // Format last backup timestamp in PST
    const formatBackupDate = (isoString?: string | null) => {
        if (!isoString) return "Never backed up";
        try {
            const d = new Date(isoString);
            if (Number.isNaN(d.getTime())) return "Never backed up";
            return new Intl.DateTimeFormat("en-US", {
                timeZone: "Asia/Manila",
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            }).format(d);
        } catch {
            return "Never backed up";
        }
    };

    // Helper to download stream via hidden anchor
    const triggerBrowserDownload = async (url: string, defaultFilename: string) => {
        const res = await fetch(url);
        if (!res.ok) {
            let errorMsg = "Download failed";
            try {
                const errJson = await res.json();
                errorMsg = errJson.error || errorMsg;
            } catch {
                // Ignore parse errors
            }
            throw new Error(errorMsg);
        }

        // Get filename from Content-Disposition header if present
        const disposition = res.headers.get("Content-Disposition");
        let filename = defaultFilename;
        if (disposition && disposition.includes("filename=")) {
            const matches = /filename="?([^"]+)"?/.exec(disposition);
            if (matches && matches[1]) {
                filename = matches[1];
            }
        }

        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
    };

    const handleExportBookings = async (format: "excel" | "csv" = "excel") => {
        setIsExportingBookings(true);
        try {
            const ext = format === "csv" ? "csv" : "xls";
            await triggerBrowserDownload(
                `/api/admin/export/bookings?format=${format}`,
                `glassfit-bookings-${new Date().toISOString().split("T")[0]}.${ext}`
            );
            onToast(
                format === "csv"
                    ? "Consultation booking CSV exported successfully."
                    : "Consultation booking Excel report exported successfully.",
                "success"
            );
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to export booking records.";
            onToast(msg, "error");
        } finally {
            setIsExportingBookings(false);
        }
    };

    const handleExportProducts = async (format: "excel" | "csv" = "excel") => {
        setIsExportingProducts(true);
        try {
            const ext = format === "csv" ? "csv" : "xls";
            await triggerBrowserDownload(
                `/api/admin/export/products?format=${format}`,
                `glassfit-products-${new Date().toISOString().split("T")[0]}.${ext}`
            );
            onToast(
                format === "csv"
                    ? "Product catalog CSV exported successfully."
                    : "Product catalog Excel report exported successfully.",
                "success"
            );
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to export product records.";
            onToast(msg, "error");
        } finally {
            setIsExportingProducts(false);
        }
    };

    const handleDownloadBackup = async () => {
        if (!isOwner) {
            onToast("Only the business Owner may download system backups.", "error");
            return;
        }

        setIsDownloadingBackup(true);
        try {
            await triggerBrowserDownload(
                "/api/admin/export/backup",
                `glassfit-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
            );
            const nowIso = new Date().toISOString();
            setLastBackupAt(nowIso);
            onToast("System backup snapshot downloaded successfully.", "success");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to download system backup.";
            onToast(msg, "error");
        } finally {
            setIsDownloadingBackup(false);
        }
    };

    return (
        <>
            <div className="bg-white rounded-[20px] p-6 sm:p-[30px] flex flex-col gap-5 w-full">
                {/* Header row with Analytics Trigger button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#f0f0f0]">
                    <div className="flex flex-col gap-1">
                        <span className="text-[#0f1422] text-lg sm:text-xl font-medium tracking-tight">
                            Data Management
                        </span>
                        <p className="text-neutral-500 text-xs sm:text-sm font-normal">
                            Export business records and maintain system backups.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsAnalyticsModalOpen(true)}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[10px] border border-[#07b6d3] text-[#07b6d3] text-xs sm:text-sm font-medium hover:bg-[#07b6d3]/5 transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-sm"
                    >
                        <BarChart2 className="w-4 h-4" />
                        <span>View Analytics &amp; Insights</span>
                    </button>
                </div>

                <div className="flex flex-col gap-4 w-full">
                    {/* Booking Records */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-[#0f1422] text-sm sm:text-base font-medium leading-snug tracking-[-0.304px]">
                                Booking Records
                            </span>
                            <p className="text-neutral-400 text-xs font-normal leading-snug tracking-[-0.228px]">
                                Consultation inquiries, quotations, and pipeline metrics
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => handleExportBookings("excel")}
                                disabled={isExportingBookings}
                                className="bg-[#07b6d3] text-white text-sm font-medium px-3.5 py-1.5 rounded-[10px] cursor-pointer hover:bg-cyan-600 transition-colors whitespace-nowrap flex items-center gap-1.5 disabled:opacity-60 shadow-sm"
                            >
                                {isExportingBookings ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Download className="w-3.5 h-3.5" />
                                )}
                                <span>Export Excel</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleExportBookings("csv")}
                                disabled={isExportingBookings}
                                title="Export raw CSV data"
                                className="bg-white border border-neutral-300 text-neutral-600 hover:text-neutral-900 text-xs font-medium px-2.5 py-1.5 rounded-[10px] cursor-pointer hover:bg-neutral-50 transition-colors whitespace-nowrap disabled:opacity-60"
                            >
                                CSV
                            </button>
                        </div>
                    </div>

                    <div className="w-full border-t border-[#f0f0f0]" />

                    {/* Product Records */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-[#0f1422] text-sm sm:text-base font-medium leading-snug tracking-[-0.304px]">
                                Product Records
                            </span>
                            <p className="text-neutral-400 text-xs font-normal leading-snug tracking-[-0.228px]">
                                Master catalog, component dimensions, and stock pricing
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => handleExportProducts("excel")}
                                disabled={isExportingProducts}
                                className="bg-[#07b6d3] text-white text-sm font-medium px-3.5 py-1.5 rounded-[10px] cursor-pointer hover:bg-cyan-600 transition-colors whitespace-nowrap flex items-center gap-1.5 disabled:opacity-60 shadow-sm"
                            >
                                {isExportingProducts ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Download className="w-3.5 h-3.5" />
                                )}
                                <span>Export Excel</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleExportProducts("csv")}
                                disabled={isExportingProducts}
                                title="Export raw CSV data"
                                className="bg-white border border-neutral-300 text-neutral-600 hover:text-neutral-900 text-xs font-medium px-2.5 py-1.5 rounded-[10px] cursor-pointer hover:bg-neutral-50 transition-colors whitespace-nowrap disabled:opacity-60"
                            >
                                CSV
                            </button>
                        </div>
                    </div>

                    <div className="w-full border-t border-[#f0f0f0]" />

                    {/* System Backup */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-[#0f1422] text-sm sm:text-base font-medium leading-snug tracking-[-0.304px]">
                                System Backup
                            </span>
                            <p className="text-neutral-400 text-xs font-normal leading-snug tracking-[-0.228px]">
                                Last backup: {formatBackupDate(lastBackupAt)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleDownloadBackup}
                            disabled={isDownloadingBackup || !isOwner}
                            title={!isOwner ? "Only the Owner may download system backups" : undefined}
                            className="bg-[#07b6d3] text-white text-sm font-medium px-4 py-1.5 rounded-[10px] cursor-pointer hover:bg-cyan-600 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 disabled:opacity-60 shadow-sm"
                        >
                            {isDownloadingBackup ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Database className="w-3.5 h-3.5" />
                            )}
                            <span>Download Backup</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Business Intelligence Modal */}
            <BusinessIntelligenceModal
                isOpen={isAnalyticsModalOpen}
                onClose={() => setIsAnalyticsModalOpen(false)}
                onExportBookings={handleExportBookings}
                isExportingBookings={isExportingBookings}
                onToast={onToast}
            />
        </>
    );
}
