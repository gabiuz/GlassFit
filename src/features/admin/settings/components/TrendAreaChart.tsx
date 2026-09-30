"use client";

import React from "react";
import type { BusinessAnalyticsMonthlyTrend } from "@/lib/settings/types";

interface TrendAreaChartProps {
    trends: BusinessAnalyticsMonthlyTrend[];
}

export function TrendAreaChart({ trends }: TrendAreaChartProps) {
    // If empty or less than 2 points, generate fallback points for smooth rendering
    const dataPoints = trends && trends.length > 0
        ? trends
        : [
            { month_label: "M-5", count: 0, total_value: 0 },
            { month_label: "M-4", count: 0, total_value: 0 },
            { month_label: "M-3", count: 0, total_value: 0 },
            { month_label: "M-2", count: 0, total_value: 0 },
            { month_label: "M-1", count: 0, total_value: 0 },
            { month_label: "Current", count: 0, total_value: 0 },
        ];

    const maxCount = Math.max(...dataPoints.map((d) => d.count), 5);

    // SVG Canvas dimensions
    const width = 360;
    const height = 140;
    const paddingX = 25;
    const paddingY = 20;

    const plotWidth = width - paddingX * 2;
    const plotHeight = height - paddingY * 2;

    const points = dataPoints.map((d, i) => {
        const x = paddingX + (i / Math.max(dataPoints.length - 1, 1)) * plotWidth;
        const normalizedY = d.count / maxCount;
        const y = height - paddingY - normalizedY * plotHeight;
        return { x, y, data: d };
    });

    const polylinePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

    // Closed path for area gradient fill
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const areaPath = `M ${firstPoint.x.toFixed(1)},${(height - paddingY).toFixed(1)} ` +
        points.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
        ` L ${lastPoint.x.toFixed(1)},${(height - paddingY).toFixed(1)} Z`;

    return (
        <div className="flex flex-col p-4 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0] h-full justify-between">
            <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-700 tracking-tight">
                    Inquiry Volume &amp; Valuation Trends
                </span>
                <span className="text-[11px] font-medium text-neutral-400">
                    Last 6 Months
                </span>
            </div>

            {/* SVG Visual Chart */}
            <div className="relative w-full h-40 flex items-center justify-center my-1">
                <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`}>
                    <defs>
                        <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#07b6d3" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#07b6d3" stopOpacity="0.0" />
                        </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    <line
                        x1={paddingX}
                        y1={paddingY}
                        x2={width - paddingX}
                        y2={paddingY}
                        stroke="#e2e8f0"
                        strokeDasharray="3 3"
                    />
                    <line
                        x1={paddingX}
                        y1={height / 2}
                        x2={width - paddingX}
                        y2={height / 2}
                        stroke="#e2e8f0"
                        strokeDasharray="3 3"
                    />
                    <line
                        x1={paddingX}
                        y1={height - paddingY}
                        x2={width - paddingX}
                        y2={height - paddingY}
                        stroke="#cbd5e1"
                    />

                    {/* Area Gradient */}
                    <path d={areaPath} fill="url(#cyanGradient)" />

                    {/* Trend Stroke */}
                    <polyline
                        fill="none"
                        stroke="#07b6d3"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={polylinePoints}
                    />

                    {/* Node Dots */}
                    {points.map((p, idx) => (
                        <g key={idx} className="group cursor-pointer">
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r="4"
                                fill="#ffffff"
                                stroke="#07b6d3"
                                strokeWidth="2.5"
                                className="transition-all duration-200 group-hover:r-6"
                            />
                            {/* Hover tooltip label */}
                            <text
                                x={p.x}
                                y={p.y - 10}
                                textAnchor="middle"
                                fill="#0f1422"
                                fontSize="9"
                                fontWeight="bold"
                                className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                            >
                                {p.data.count}
                            </text>
                        </g>
                    ))}
                </svg>
            </div>

            {/* X-Axis Labels */}
            <div className="w-full flex items-center justify-between px-2 pt-2 border-t border-[#e2e8f0]/80">
                {dataPoints.map((d, idx) => (
                    <span key={idx} className="text-[10px] font-medium text-neutral-400">
                        {d.month_label}
                    </span>
                ))}
            </div>
        </div>
    );
}
