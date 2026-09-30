"use client";

import React, { useState, useEffect, useTransition } from "react";
import { X, TrendingUp, DollarSign, CalendarCheck, BarChart2, Download, RefreshCw } from "lucide-react";
import { getAdminBusinessAnalyticsAction } from "../settingsActions";
import type { BusinessAnalyticsData } from "@/lib/settings/types";
import { StatusDonutChart } from "./StatusDonutChart";
import { TrendAreaChart } from "./TrendAreaChart";
import { ChannelBarChart } from "./ChannelBarChart";
import { ProductDistributionChart } from "./ProductDistributionChart";

interface BusinessIntelligenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExportBookings: () => void;
    isExportingBookings: boolean;
    onToast: (msg: string, variant: "success" | "error") => void;
}

type DateRangeFilter = "all" | "30d" | "90d";

export function BusinessIntelligenceModal({
    isOpen,
    onClose,
    onExportBookings,
    isExportingBookings,
    onToast,
}: BusinessIntelligenceModalProps) {
    const [rangeFilter, setRangeFilter] = useState<DateRangeFilter>("all");
    const [data, setData] = useState<BusinessAnalyticsData | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (!isOpen) return;

        let startDate: string | null = null;
        const now = new Date();

        if (rangeFilter === "30d") {
            const d = new Date(now);
            d.setDate(d.getDate() - 30);
            startDate = d.toISOString();
        } else if (rangeFilter === "90d") {
            const d = new Date(now);
            d.setDate(d.getDate() - 90);
            startDate = d.toISOString();
        }

        startTransition(async () => {
            const res = await getAdminBusinessAnalyticsAction(startDate, now.toISOString());
            if (res.ok && res.data) {
                setData(res.data);
            } else {
                onToast(res.ok ? "Failed to load analytics" : res.error, "error");
            }
        });
    }, [isOpen, rangeFilter, onToast]);

    if (!isOpen) return null;

    const overview = data?.overview;
    const platforms = data?.platforms ?? { messenger_count: 0, viber_count: 0, other_count: 0 };
    const catalog = data?.catalog ?? { total_products: 0, active_products: 0, draft_products: 0, avg_base_price: 0 };
    const distribution = data?.product_distribution ?? [];
    const monthlyTrends = data?.monthly_trends ?? [];

    const totalConsultations = overview?.total_bookings ?? 0;
    const pendingCount = overview?.pending_count ?? 0;
    const ongoingCount = overview?.ongoing_count ?? 0;
    const doneCount = overview?.done_count ?? 0;
    const totalPipelineValue = overview?.total_negotiated_value ?? 0;
    const avgQuotationValue = overview?.avg_quotation_value ?? 0;
    const conversionRate = totalConsultations > 0
        ? ((doneCount / totalConsultations) * 100).toFixed(1)
        : "0.0";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#0f1422]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-[24px] w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-neutral-200 overflow-hidden"
                role="dialog"
                aria-modal="true"
            >
                {/* Modal Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 border-b border-[#f0f0f0] bg-white">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <BarChart2 className="w-5 h-5 text-[#07b6d3]" />
                            <h2 className="text-[#0f1422] text-lg sm:text-xl font-bold tracking-tight">
                                GlassFit Business Intelligence &amp; Telemetry
                            </h2>
                        </div>
                        <p className="text-neutral-500 text-xs sm:text-sm font-normal">
                            Executive overview of quotation conversion, customer intake channels, and revenue metrics.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                        {/* Date Range Filter Pills */}
                        <div className="flex items-center p-1 rounded-xl bg-neutral-100 border border-neutral-200 text-xs font-medium">
                            <button
                                type="button"
                                onClick={() => setRangeFilter("all")}
                                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                    rangeFilter === "all"
                                        ? "bg-white text-[#0f1422] shadow-sm font-semibold"
                                        : "text-neutral-500 hover:text-neutral-800"
                                }`}
                            >
                                All Time
                            </button>
                            <button
                                type="button"
                                onClick={() => setRangeFilter("30d")}
                                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                    rangeFilter === "30d"
                                        ? "bg-white text-[#0f1422] shadow-sm font-semibold"
                                        : "text-neutral-500 hover:text-neutral-800"
                                }`}
                            >
                                30 Days
                            </button>
                            <button
                                type="button"
                                onClick={() => setRangeFilter("90d")}
                                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                    rangeFilter === "90d"
                                        ? "bg-white text-[#0f1422] shadow-sm font-semibold"
                                        : "text-neutral-500 hover:text-neutral-800"
                                }`}
                            >
                                90 Days
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                            aria-label="Close modal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Modal Body / Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-6">
                    {/* Executive Metric Cards (4-col Grid) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 1. Total Pipeline Valuation */}
                        <div className="p-4 rounded-2xl bg-[#0f1422] text-white flex flex-col justify-between relative overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-neutral-400">Total Pipeline Value</span>
                                <DollarSign className="w-4 h-4 text-[#07b6d3]" />
                            </div>
                            <div className="mt-3">
                                <span className="text-xl font-bold tracking-tight text-white">
                                    ₱ {totalPipelineValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <p className="text-[11px] text-neutral-400 mt-0.5">Effective gross quotation value</p>
                            </div>
                        </div>

                        {/* 2. Total Consultations */}
                        <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] flex flex-col justify-between shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-neutral-500">Total Consultations</span>
                                <CalendarCheck className="w-4 h-4 text-[#07b6d3]" />
                            </div>
                            <div className="mt-3">
                                <span className="text-xl font-bold tracking-tight text-[#0f1422]">
                                    {totalConsultations}
                                </span>
                                <p className="text-[11px] text-neutral-400 mt-0.5">Logged client inquiries</p>
                            </div>
                        </div>

                        {/* 3. Conversion Rate */}
                        <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] flex flex-col justify-between shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-neutral-500">Conversion Rate</span>
                                <TrendingUp className="w-4 h-4 text-[#10b981]" />
                            </div>
                            <div className="mt-3">
                                <span className="text-xl font-bold tracking-tight text-[#10b981]">
                                    {conversionRate}%
                                </span>
                                <p className="text-[11px] text-neutral-400 mt-0.5">Triage transitioned to Done</p>
                            </div>
                        </div>

                        {/* 4. Average Quotation Size */}
                        <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] flex flex-col justify-between shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-neutral-500">Avg Quotation Size</span>
                                <BarChart2 className="w-4 h-4 text-[#f59e0b]" />
                            </div>
                            <div className="mt-3">
                                <span className="text-xl font-bold tracking-tight text-[#0f1422]">
                                    ₱ {avgQuotationValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <p className="text-[11px] text-neutral-400 mt-0.5">Mean price per consultation</p>
                            </div>
                        </div>
                    </div>

                    {/* Visual Charts Grid (2x2) */}
                    {isPending ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-400">
                            <RefreshCw className="w-6 h-6 animate-spin text-[#07b6d3]" />
                            <span className="text-xs font-medium">Aggregating real-time business telemetry...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Chart A: Status Donut Chart */}
                            <div className="h-[280px]">
                                <StatusDonutChart
                                    pending={pendingCount}
                                    ongoing={ongoingCount}
                                    done={doneCount}
                                />
                            </div>

                            {/* Chart B: Monthly Trend Area Chart */}
                            <div className="h-[280px]">
                                <TrendAreaChart trends={monthlyTrends} />
                            </div>

                            {/* Chart C: Messaging Channel Share Bar */}
                            <div className="h-[250px]">
                                <ChannelBarChart platforms={platforms} />
                            </div>

                            {/* Chart D: Product Catalog Distribution */}
                            <div className="h-[250px]">
                                <ProductDistributionChart
                                    catalog={catalog}
                                    distribution={distribution}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer / Action Bar */}
                <div className="p-4 sm:p-5 border-t border-[#f0f0f0] bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-neutral-500 text-center sm:text-left">
                        Data reflects live PostgreSQL transactions and frozen quotations.
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-white border border-[#c3c3c3] text-[#0f1422] text-xs sm:text-sm font-normal px-4 py-2 rounded-[10px] cursor-pointer hover:bg-neutral-100 transition-colors"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            onClick={onExportBookings}
                            disabled={isExportingBookings}
                            className="bg-[#07b6d3] text-white text-xs sm:text-sm font-medium px-4 py-2 rounded-[10px] cursor-pointer hover:bg-cyan-600 transition-colors flex items-center gap-2 disabled:opacity-60 shadow-sm"
                        >
                            {isExportingBookings ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            <span>Download GlassFit Excel Report</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
