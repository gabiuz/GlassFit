/**
 * Collapsible Request Update Timeline Component (IMP-MS19)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C10, DSD-UI12, QAD-TC32
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

"use client";

import React from "react";
import type { RequestUpdate } from "../requestData";
import { getSortedTimelineUpdates } from "../requestState";

interface RequestTimelineProps {
  updates: RequestUpdate[];
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function RequestTimeline({
  updates,
  isExpanded,
  onToggleExpand,
}: RequestTimelineProps) {
  const sortedUpdates = getSortedTimelineUpdates(updates);
  const totalCount = sortedUpdates.length;

  if (totalCount === 0) {
    return (
      <div className="flex flex-col gap-1">
        <h4 className="text-[#07b6d3] text-[20px] font-medium leading-[1.4]">
          Request Updates
        </h4>
        <p className="text-[12px] text-[#c3c3c3] leading-[1.4]">
          No request updates yet.
        </p>
      </div>
    );
  }

  const displayedUpdates =
    isExpanded || totalCount <= 3 ? sortedUpdates : sortedUpdates.slice(0, 3);

  const formatTimelineDate = (isoString: string): string => {
    const parts = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (parts) {
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      const year = parts[1];
      const month = months[parseInt(parts[2], 10) - 1];
      const day = parseInt(parts[3], 10);
      return `${month} ${day}, ${year}`;
    }
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-[2px]">
        <h4 className="text-[#07b6d3] text-[20px] font-medium leading-[1.4]">
          Request Updates
        </h4>
        <p className="text-[12px] text-[#c3c3c3] leading-[1.4]">
          Track your updates
        </p>
      </div>

      <div className="relative flex flex-col gap-3">
        {/* Continuous vertical connector line */}
        {displayedUpdates.length > 1 && (
          <div
            aria-hidden="true"
            className="absolute left-[13px] top-[14px] bottom-[14px] w-[2px] bg-[#c3c3c3] pointer-events-none"
          />
        )}

        {displayedUpdates.map((update, idx) => {
          const isLatest = idx === 0;

          return (
            <div
              key={update.id}
              className="relative z-10 flex items-center gap-[12px] min-h-[54px]"
            >
              <div
                className={`size-[28px] rounded-full shrink-0 transition-colors ${
                  isLatest ? "bg-[#07b6d3]" : "bg-[#c3c3c3]"
                }`}
              />
              <div className="flex flex-col justify-center leading-[1.4]">
                <time
                  dateTime={update.occurredAt}
                  className="text-[14px] text-[#0f1422] font-normal"
                >
                  {formatTimelineDate(update.occurredAt)}
                </time>
                <p className="text-[14px] text-[#c3c3c3] font-normal">
                  {update.title}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {totalCount > 3 && (
        <div className="flex justify-start pt-1">
          <button
            type="button"
            onClick={onToggleExpand}
            className="px-3 py-1.5 inline-flex items-center gap-2 rounded-[10px] text-xs font-medium text-[#07b6d3] hover:bg-[#e9f9fb] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3] cursor-pointer"
          >
            <span>{isExpanded ? "Show latest updates" : "View all updates"}</span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                isExpanded ? "rotate-180" : "rotate-0"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
