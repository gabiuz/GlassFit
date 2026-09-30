"use client";

import React from "react";
import type { BusinessAnalyticsPlatforms } from "@/lib/settings/types";

interface ChannelBarChartProps {
    platforms: BusinessAnalyticsPlatforms;
}

export function ChannelBarChart({ platforms }: ChannelBarChartProps) {
    const messenger = platforms?.messenger_count ?? 0;
    const viber = platforms?.viber_count ?? 0;
    const other = platforms?.other_count ?? 0;
    const total = messenger + viber + other;

    const messengerPct = total > 0 ? (messenger / total) * 100 : 50;
    const viberPct = total > 0 ? (viber / total) * 100 : 50;

    return (
        <div className="flex flex-col p-4 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0] h-full justify-between">
            <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-700 tracking-tight">
                    Customer Intake Channels
                </span>
                <span className="text-[11px] font-medium text-neutral-400">
                    {total} Inquiries
                </span>
            </div>

            {/* Segmented Bar Visual */}
            <div className="flex flex-col gap-3 my-auto">
                <div className="w-full h-7 rounded-xl bg-neutral-200 overflow-hidden flex p-1 gap-1 border border-neutral-300/60 shadow-inner">
                    {total === 0 ? (
                        <div className="w-full h-full bg-neutral-300 rounded-lg flex items-center justify-center">
                            <span className="text-[10px] text-neutral-500 font-medium">No Inquiry Data</span>
                        </div>
                    ) : (
                        <>
                            {messenger > 0 && (
                                <div
                                    style={{ width: `${messengerPct}%` }}
                                    className="h-full bg-[#0084ff] rounded-lg transition-all duration-700 ease-out flex items-center justify-center text-white text-[11px] font-semibold tracking-wider shadow-sm"
                                    title={`Messenger: ${messenger} (${messengerPct.toFixed(1)}%)`}
                                >
                                    {messengerPct >= 15 && `${messengerPct.toFixed(0)}%`}
                                </div>
                            )}
                            {viber > 0 && (
                                <div
                                    style={{ width: `${viberPct}%` }}
                                    className="h-full bg-[#7360f2] rounded-lg transition-all duration-700 ease-out flex items-center justify-center text-white text-[11px] font-semibold tracking-wider shadow-sm"
                                    title={`Viber: ${viber} (${viberPct.toFixed(1)}%)`}
                                >
                                    {viberPct >= 15 && `${viberPct.toFixed(0)}%`}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Sub-label comparison */}
                <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
                    <span className="font-medium text-[#0084ff]">Facebook Messenger</span>
                    <span className="font-medium text-[#7360f2]">Rakuten Viber</span>
                </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="w-full grid grid-cols-2 gap-3 pt-3 border-t border-[#e2e8f0]/80">
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-[#e2e8f0]">
                    <div className="w-8 h-8 rounded-lg bg-[#0084ff]/10 flex items-center justify-center text-[#0084ff] font-bold text-xs shrink-0">
                        FB
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-[#0f1422]">{messenger} inquiries</span>
                        <span className="text-[10px] text-neutral-400 font-normal">
                            {total > 0 ? `${messengerPct.toFixed(1)}% share` : "0%"}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-[#e2e8f0]">
                    <div className="w-8 h-8 rounded-lg bg-[#7360f2]/10 flex items-center justify-center text-[#7360f2] font-bold text-xs shrink-0">
                        VB
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-[#0f1422]">{viber} inquiries</span>
                        <span className="text-[10px] text-neutral-400 font-normal">
                            {total > 0 ? `${viberPct.toFixed(1)}% share` : "0%"}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
