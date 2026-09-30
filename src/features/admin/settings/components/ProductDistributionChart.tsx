"use client";

import React from "react";
import type { BusinessAnalyticsCatalog, BusinessAnalyticsProductDistribution } from "@/lib/settings/types";

interface ProductDistributionChartProps {
    catalog: BusinessAnalyticsCatalog;
    distribution: BusinessAnalyticsProductDistribution[];
}

export function ProductDistributionChart({ catalog, distribution }: ProductDistributionChartProps) {
    const totalProducts = catalog?.total_products ?? 0;
    const activeProducts = catalog?.active_products ?? 0;
    const draftProducts = catalog?.draft_products ?? 0;
    const avgPrice = catalog?.avg_base_price ?? 0;

    const items = distribution && distribution.length > 0
        ? distribution
        : [
            { type_name: "Window", count: 0 },
            { type_name: "Door", count: 0 },
            { type_name: "Partition", count: 0 },
        ];

    const maxCount = Math.max(...items.map((i) => i.count), 1);

    return (
        <div className="flex flex-col p-4 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0] h-full justify-between">
            <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-700 tracking-tight">
                    Product Catalog Health &amp; Types
                </span>
                <span className="text-[11px] font-medium text-neutral-400">
                    {activeProducts} Active / {draftProducts} Draft
                </span>
            </div>

            {/* Horizontal Type Breakdown */}
            <div className="flex flex-col gap-2 my-auto">
                {items.slice(0, 4).map((item, idx) => {
                    const widthPct = (item.count / maxCount) * 100;
                    return (
                        <div key={idx} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="font-medium text-neutral-700">{item.type_name}</span>
                                <span className="font-bold text-[#0f1422]">{item.count} items</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden">
                                <div
                                    style={{ width: `${Math.max(widthPct, 4)}%` }}
                                    className="h-full bg-[#07b6d3] rounded-full transition-all duration-500 ease-out"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary Footer */}
            <div className="w-full grid grid-cols-2 gap-3 pt-3 border-t border-[#e2e8f0]/80">
                <div className="flex flex-col">
                    <span className="text-[10px] text-neutral-400 font-medium">Total Catalog Size</span>
                    <span className="text-xs font-bold text-[#0f1422]">{totalProducts} Products</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-neutral-400 font-medium">Mean Base Price</span>
                    <span className="text-xs font-bold text-[#0f1422]">
                        ₱ {avgPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </div>
        </div>
    );
}
