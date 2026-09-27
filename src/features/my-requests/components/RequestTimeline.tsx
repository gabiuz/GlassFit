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
        <h3 className="text-[#07b6d3] text-lg sm:text-xl font-medium leading-snug">Request Updates</h3>
        <p className="text-xs text-[#c3c3c3]">No request updates yet.</p>
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[#07b6d3] text-lg sm:text-xl font-medium leading-snug">
          Request Updates
        </h3>
        <p className="text-xs text-[#c3c3c3]">Track your updates</p>
      </div>

      <div className="relative pl-7 flex flex-col gap-5 before:content-[''] before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-0.5 before:bg-[#c3c3c3]">
        {displayedUpdates.map((update, idx) => {
          const isLatest = idx === 0;

          return (
            <div key={update.id} className="relative flex flex-col gap-1">
              {/* Bullet node on timeline */}
              <div
                className={`absolute -left-7 top-1 size-5 rounded-full transition-colors ${
                  isLatest
                    ? "bg-[#07b6d3]"
                    : "bg-[#c3c3c3]"
                }`}
              />

              <div className="flex flex-col gap-0.5">
                <time
                  dateTime={update.occurredAt}
                  className="text-sm font-medium text-[#0f1422]"
                >
                  {formatTimestamp(update.occurredAt)}
                </time>
                <p className="text-xs text-[#c3c3c3] leading-snug">{update.title}</p>
              </div>
            </div>
          );
        })}
      </div>

      {totalCount > 3 && (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={onToggleExpand}
            className="min-h-10 px-3 py-2 inline-flex items-center gap-2 rounded-[10px] text-xs font-medium text-[#07b6d3] hover:bg-[#e9f9fb] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3]"
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
