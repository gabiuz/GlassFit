/**
 * Request Status Progress Component (IMP-MS19)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C10, DSD-UI12, QAD-TC32
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

"use client";

import React from "react";
import Image from "next/image";
import type { BookingRequestStatus } from "@/lib/booking/types";
import { getBookingProgressBehavior } from "../requestData";

interface RequestStatusProgressProps {
  status: BookingRequestStatus;
}

export function RequestStatusProgress({ status }: RequestStatusProgressProps) {
  const behavior = getBookingProgressBehavior(status);

  if (behavior.isCancelled) {
    return (
      <div
        role="status"
        className="rounded-[20px] bg-[#e74242] px-4 py-3.5 sm:px-5 flex items-center gap-3 text-white"
      >
        <div className="size-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Image
            src="/visualization/circle-exclamation-duotone-regular-full 1.svg"
            alt=""
            width={20}
            height={20}
            aria-hidden="true"
            className="brightness-0 invert"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium">Request cancelled</span>
          <p className="text-xs text-white/80 leading-snug">
            This request is closed and no longer active.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-2">
      <div className="relative">
        {/* Horizontal connector line behind circles */}
        <div
          aria-hidden="true"
          className="absolute top-[12.5px] left-[12.5%] right-[12.5%] h-[3px] -translate-y-1/2 grid grid-cols-3 pointer-events-none"
        >
          {behavior.steps.slice(0, 3).map((step, idx) => {
            const isSegmentComplete = step.state === "complete";
            return (
              <div
                key={idx}
                className={`h-[3px] w-full transition-colors ${
                  isSegmentComplete ? "bg-[#05b64b]" : "bg-[#c3c3c3]"
                }`}
              />
            );
          })}
        </div>

        {/* 4 Step nodes */}
        <ol className="relative grid grid-cols-4 gap-0 w-full">
          {behavior.steps.map((step) => {
            const isCurrent = step.state === "current";
            const isComplete = step.state === "complete";

            return (
              <li
                key={step.id}
                aria-current={isCurrent ? "step" : undefined}
                className="relative z-10 flex flex-col items-center gap-[10px] text-center min-w-0"
              >
                <div
                  className={`size-[28px] rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    isComplete
                      ? "bg-[#05b64b]"
                      : isCurrent
                      ? "bg-[#07b6d3] p-[5px]"
                      : "bg-[#c3c3c3]"
                  }`}
                >
                  {isComplete ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : isCurrent ? (
                    <div className="size-[16px] rounded-full bg-white" />
                  ) : null}
                </div>

                <span
                  className={`text-[12px] sm:text-[14px] leading-[1.4] whitespace-nowrap ${
                    isComplete
                      ? "text-[#05b64b]"
                      : isCurrent
                      ? "text-[#07b6d3]"
                      : "text-[#c3c3c3]"
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
