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
      <div className="p-6 rounded-2xl bg-neutral-50/80 border border-neutral-200 text-center">
        <p className="text-sm text-neutral-500 font-medium">No request updates yet.</p>
      </div>
    );
  }

  const displayedUpdates =
    isExpanded || totalCount <= 3 ? sortedUpdates : sortedUpdates.slice(0, 3);

  const formatTimestamp = (isoString: string): string => {
    const parts = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (parts) {
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      const year = parts[1];
      const month = months[parseInt(parts[2], 10) - 1];
      const day = parseInt(parts[3], 10);
      let hour = parseInt(parts[4], 10);
      const minute = parts[5];
      const ampm = hour >= 12 ? "PM" : "AM";
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${month} ${day}, ${year} at ${hour}:${minute} ${ampm}`;
    }
    return new Date(isoString).toLocaleString("en-US");
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white border border-neutral-200 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#0f1422] tracking-tight">
          Update History
        </h3>
        <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full">
          {totalCount} {totalCount === 1 ? "update" : "updates"}
        </span>
      </div>

      <div className="relative pl-6 sm:pl-8 flex flex-col gap-6 before:content-[''] before:absolute before:left-2 sm:before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
        {displayedUpdates.map((update, idx) => {
          const isLatest = idx === 0;

          return (
            <div key={update.id} className="relative flex flex-col gap-1">
              {/* Bullet node on timeline */}
              <div
                className={`absolute -left-6 sm:-left-8 top-1 w-4 h-4 rounded-full border-2 bg-white transition-colors ${
                  isLatest
                    ? "border-[#07b6d3] ring-4 ring-[#07b6d3]/20"
                    : "border-neutral-300"
                }`}
              />

              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                <span className="text-sm font-semibold text-[#0f1422]">
                  {update.title}
                </span>
                <time
                  dateTime={update.occurredAt}
                  className="text-xs text-neutral-400 font-mono"
                >
                  {formatTimestamp(update.occurredAt)}
                </time>
              </div>

              <p className="text-sm text-neutral-600 leading-relaxed">
                {update.description}
              </p>
            </div>
          );
        })}
      </div>

      {totalCount > 3 && (
        <div className="pt-2 border-t border-neutral-100 flex justify-center">
          <button
            type="button"
            onClick={onToggleExpand}
            className="min-h-[44px] px-5 py-2 inline-flex items-center gap-2 rounded-xl text-sm font-medium text-[#07b6d3] hover:text-[#097283] hover:bg-neutral-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green cursor-pointer"
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
