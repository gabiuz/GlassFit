/**
 * Request Status Progress Component (IMP-MS19)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C10, DSD-UI12, QAD-TC32
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

"use client";

import React from "react";
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
        className="p-5 sm:p-6 rounded-2xl bg-rose-50/80 border border-rose-200 flex items-start gap-4"
      >
        <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-rose-900">
              Terminal State: Cancelled
            </span>
            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              Cancelled
            </span>
          </div>
          <p className="text-sm text-rose-700 leading-relaxed">
            This request was closed and is no longer active. Contact GlassFit customer support if you need to submit a new inquiry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-neutral-50/80 border border-neutral-200">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 mb-6">
        Request Progress
      </h3>

      <ol className="relative flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-2">
        {behavior.steps.map((step, index) => {
          const isCurrent = step.state === "current";
          const isComplete = step.state === "complete";

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className="flex-1 relative flex sm:flex-col items-center sm:items-center text-left sm:text-center gap-3 w-full"
            >
              {/* Connecting line between steps on desktop */}
              {index < behavior.steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`hidden sm:block absolute top-4 left-1/2 w-full h-0.5 -z-0 ${
                    isComplete ? "bg-emerald-500" : "bg-neutral-200"
                  }`}
                />
              )}

              {/* Step indicator circle */}
              <div
                className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors shrink-0 ${
                  isComplete
                    ? "bg-emerald-600 text-white shadow-sm"
                    : isCurrent
                    ? "bg-[#07b6d3] text-white ring-4 ring-[#07b6d3]/20 shadow-sm"
                    : "bg-white text-neutral-400 border-2 border-neutral-300"
                }`}
              >
                {isComplete ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Step Label and textual status badge */}
              <div className="flex flex-col sm:items-center">
                <span
                  className={`text-sm font-semibold tracking-tight ${
                    isComplete
                      ? "text-emerald-950"
                      : isCurrent
                      ? "text-[#0f1422]"
                      : "text-neutral-400"
                  }`}
                >
                  {step.label}
                </span>

                <span
                  className={`text-xs mt-0.5 font-medium ${
                    isComplete
                      ? "text-emerald-700"
                      : isCurrent
                      ? "text-[#07b6d3]"
                      : "text-neutral-400"
                  }`}
                >
                  {isComplete ? "(Completed)" : isCurrent ? "(Current Step)" : "(Upcoming)"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
