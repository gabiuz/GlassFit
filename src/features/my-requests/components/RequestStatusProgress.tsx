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
        className="rounded-[20px] bg-[#c50000] px-4 py-3.5 sm:px-5 flex items-center gap-3 text-white"
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
    <div className="w-full px-1 py-1">
      <ol className="relative grid grid-cols-4 gap-0">
        {behavior.steps.map((step, index) => {
          const isCurrent = step.state === "current";
          const isComplete = step.state === "complete";

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className="relative flex flex-col items-center gap-2 text-center min-w-0"
            >
              {index < behavior.steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`absolute top-[9px] left-1/2 h-0.5 w-full ${
                    isComplete ? "bg-[#05b64b]" : "bg-[#c3c3c3]"
                  }`}
                />
              )}

              <div
                className={`relative z-10 size-5 rounded-full flex items-center justify-center shrink-0 border-[3px] bg-white ${
                  isComplete
                    ? "border-[#05b64b] bg-[#05b64b]"
                    : isCurrent
                    ? "border-[#07b6d3]"
                    : "border-[#c3c3c3] bg-[#c3c3c3]"
                }`}
              >
                {isComplete ? (
                  <Image
                    src="/send-booking/check.svg"
                    alt=""
                    width={14}
                    height={14}
                    aria-hidden="true"
                    className="scale-[1.35]"
                  />
                ) : null}
              </div>

              <span className={`text-[10px] sm:text-xs leading-tight ${
                isComplete
                  ? "text-[#05b64b]"
                  : isCurrent
                  ? "text-[#07b6d3]"
                  : "text-[#c3c3c3]"
              }`}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
