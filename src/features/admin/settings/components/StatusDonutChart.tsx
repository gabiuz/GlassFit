"use client";

import React from "react";

interface StatusDonutChartProps {
    pending: number;
    ongoing: number;
    done: number;
}

export function StatusDonutChart({ pending, ongoing, done }: StatusDonutChartProps) {
    const total = pending + ongoing + done;

    const pendingPct = total > 0 ? (pending / total) * 100 : 0;
    const ongoingPct = total > 0 ? (ongoing / total) * 100 : 0;
    const donePct = total > 0 ? (done / total) * 100 : 0;

    const radius = 58;
    const circumference = 2 * Math.PI * radius;

    const doneDash = (donePct / 100) * circumference;
    const ongoingDash = (ongoingPct / 100) * circumference;
    const pendingDash = (pendingPct / 100) * circumference;

    const doneOffset = 0;
    const ongoingOffset = -doneDash;
    const pendingOffset = -(doneDash + ongoingDash);

    return (
        <div className="flex flex-col items-center justify-between p-4 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0] h-full">
            <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-700 tracking-tight">
                    Consultation Status Pipeline
                </span>
                <span className="text-[11px] font-medium text-neutral-400">
                    {total} Total
                </span>
            </div>

            {/* SVG Donut Visual */}
            <div className="relative w-40 h-40 flex items-center justify-center my-2">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 140 140">
                    {/* Background Ring */}
                    <circle
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="transparent"
                        stroke="#e2e8f0"
                        strokeWidth="16"
                    />

                    {total > 0 && (
                        <>
                            {/* Done / Finalized - Emerald */}
                            {donePct > 0 && (
                                <circle
                                    cx="70"
                                    cy="70"
                                    r={radius}
                                    fill="transparent"
                                    stroke="#10b981"
                                    strokeWidth="16"
                                    strokeDasharray={`${doneDash} ${circumference}`}
                                    strokeDashoffset={doneOffset}
                                    strokeLinecap="round"
                                    className="transition-all duration-700 ease-out"
                                />
                            )}

                            {/* Ongoing - Amber */}
                            {ongoingPct > 0 && (
                                <circle
                                    cx="70"
                                    cy="70"
                                    r={radius}
                                    fill="transparent"
                                    stroke="#f59e0b"
                                    strokeWidth="16"
                                    strokeDasharray={`${ongoingDash} ${circumference}`}
                                    strokeDashoffset={ongoingOffset}
                                    className="transition-all duration-700 ease-out"
                                />
                            )}

                            {/* Pending - Cyan */}
                            {pendingPct > 0 && (
                                <circle
                                    cx="70"
                                    cy="70"
                                    r={radius}
                                    fill="transparent"
                                    stroke="#07b6d3"
                                    strokeWidth="16"
                                    strokeDasharray={`${pendingDash} ${circumference}`}
                                    strokeDashoffset={pendingOffset}
                                    className="transition-all duration-700 ease-out"
                                />
                            )}
                        </>
                    )}
                </svg>

                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                    <span className="text-xl font-bold text-[#0f1422] leading-none">
                        {total > 0 ? `${donePct.toFixed(0)}%` : "0%"}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-medium mt-1">
                        Completed
                    </span>
                </div>
            </div>

            {/* Legend */}
            <div className="w-full grid grid-cols-3 gap-2 pt-3 border-t border-[#e2e8f0]/80">
                <div className="flex flex-col items-center text-center">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-2 h-2 rounded-full bg-[#07b6d3]" />
                        <span className="text-[11px] font-medium text-neutral-600">Pending</span>
                    </div>
                    <span className="text-xs font-bold text-[#0f1422]">{pending}</span>
                    <span className="text-[10px] text-neutral-400">{pendingPct.toFixed(1)}%</span>
                </div>

                <div className="flex flex-col items-center text-center">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                        <span className="text-[11px] font-medium text-neutral-600">Ongoing</span>
                    </div>
                    <span className="text-xs font-bold text-[#0f1422]">{ongoing}</span>
                    <span className="text-[10px] text-neutral-400">{ongoingPct.toFixed(1)}%</span>
                </div>

                <div className="flex flex-col items-center text-center">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                        <span className="text-[11px] font-medium text-neutral-600">Done</span>
                    </div>
                    <span className="text-xs font-bold text-[#0f1422]">{done}</span>
                    <span className="text-[10px] text-neutral-400">{donePct.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    );
}
