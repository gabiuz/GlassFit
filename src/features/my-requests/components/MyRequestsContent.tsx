/**
 * My Requests Interactive Island (IMP-MS20)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C10, DSD-UI12, ERD-E2, QAD-TC32, QAD-TC33
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes), BAN-UI-09 (Strict UI consistency)
 */

"use client";

import React, { useEffect, useReducer, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CANONICAL_REQUEST_FIXTURES,
  getBookingStatusBadge,
  getBookingStatusBanner,
  type ClientRequestItem,
  type RequestFilter,
} from "../requestData";
import {
  createInitialRequestState,
  filterRequests,
  getFilterCounts,
  getSelectedRequest,
  requestReducer,
} from "../requestState";
import { RequestStatusProgress } from "./RequestStatusProgress";
import { RequestTimeline } from "./RequestTimeline";
import { QuotationPreviewDialog } from "./QuotationPreviewDialog";

const FILTER_TABS: RequestFilter[] = ["All", "Active", "Completed", "Cancelled"];

export function MyRequestsContent({
  initialRequests = CANONICAL_REQUEST_FIXTURES,
  loadError = null,
}: {
  initialRequests?: ClientRequestItem[];
  loadError?: string | null;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(
    requestReducer,
    initialRequests,
    createInitialRequestState
  );

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    dispatch({ type: "sync-requests", requests: initialRequests });
  }, [initialRequests]);

  const counts = getFilterCounts(state.requests);
  const visibleRequests = filterRequests(state.requests, state.activeFilter);
  const selectedRequest = getSelectedRequest(state);

  const formatDate = (isoString: string): string => {
    const parts = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (parts) {
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      const year = parts[1];
      const month = months[parseInt(parts[2], 10) - 1];
      const day = parseInt(parts[3], 10);
      return `${month} ${day}, ${year}`;
    }
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatSubmittedAt = (isoString: string): string =>
    new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    }).format(new Date(isoString));

  return (
    <div className="flex flex-col items-start gap-6 sm:gap-8 w-full">
      {/* Database Query Failure Alert */}
      {loadError && (
        <div
          role="alert"
          aria-live="assertive"
          className="w-full rounded-[20px] bg-[#c50000] px-4 py-4 sm:px-5 text-white flex items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-white/25 flex items-center justify-center shrink-0">
              <Image
                src="/visualization/circle-exclamation-duotone-regular-full 1.svg"
                alt=""
                width={21}
                height={21}
                aria-hidden="true"
                className="brightness-0 invert"
              />
            </div>
            <p className="text-sm font-medium leading-snug">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="min-h-10 px-4 rounded-[10px] bg-white text-[#0f1422] text-xs font-semibold hover:bg-neutral-100 transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div
        role="group"
        aria-label="Filter requests"
        className="w-full overflow-x-auto pb-1 -mx-1 px-1"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-max">
          {FILTER_TABS.map((tab) => {
            const isActive = state.activeFilter === tab;
            const count = counts[tab];

            return (
              <button
                key={tab}
                type="button"
                aria-pressed={isActive}
                onClick={() => dispatch({ type: "set-filter", filter: tab })}
                className={cn(
                  "px-4 sm:px-5 py-2 sm:py-2.5 rounded-[25px] flex items-center gap-2.5 sm:gap-3 whitespace-nowrap transition-[background-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3]",
                  isActive
                    ? "bg-[#07b6d3] text-white shadow-xs"
                    : "bg-[#c3c3c3] text-white hover:bg-stone-400"
                )}
              >
                <span className="text-sm sm:text-base font-normal leading-snug">{tab}</span>
                <span className="bg-white rounded-[10px] px-2 sm:px-2.5 py-[2px] text-xs text-[#0f1422] font-semibold leading-tight text-center min-w-[17px]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State: When no requests exist at all */}
      {state.requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-neutral-200 shadow-xs text-center gap-4 w-full">
          <div className="w-16 h-16 rounded-full bg-cyan-50 text-[#07b6d3] flex items-center justify-center">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-1 max-w-md">
            <h3 className="text-xl font-semibold text-[#0f1422]">
              You have no consultation requests yet.
            </h3>
            <p className="text-sm text-neutral-500">
              Start by exploring our customized aluminum and glass catalog to configure your space.
            </p>
          </div>
          <Link
            href="/product"
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#0f1422] hover:bg-neutral-800 text-white text-sm font-medium inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green mt-2"
          >
            Explore Catalog
          </Link>
        </div>
      ) : (
        /* Master-Detail Split Layout */
        <div className="w-full flex flex-col xl:flex-row items-start gap-6">
          {/* Left Column: Request List */}
          <div className="w-full xl:w-[420px] 2xl:w-[480px] shrink-0 flex flex-col gap-4">
            {visibleRequests.length === 0 ? (
              <div className="p-8 bg-white rounded-2xl border border-neutral-200 text-center flex flex-col items-center justify-center gap-2">
                <p className="text-sm font-semibold text-neutral-700">
                  No requests match this filter.
                </p>
                <p className="text-xs text-neutral-500">
                  Select another tab to view your consultation requests.
                </p>
              </div>
            ) : (
              visibleRequests.map((req) => {
                const isSelected = req.id === state.selectedRequestId;
                const badge = getBookingStatusBadge(req.status);
                const itemsCountLabel = `${req.productCount} ${
                  req.productCount === 1 ? "Product" : "Products"
                }`;

                return (
                  <button
                    key={req.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => dispatch({ type: "select", requestId: req.id })}
                    className={cn(
                      "bg-white p-4 sm:p-5 rounded-[20px] flex flex-col gap-5 items-start w-full text-left shadow-xs border-2 transition-[border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3]",
                      isSelected
                        ? "border-[#07b6d3]"
                        : "border-transparent hover:border-neutral-200"
                    )}
                  >
                    {/* Top Row: Reference + Status Badge */}
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="text-[#c3c3c3] text-xs sm:text-sm font-normal leading-snug">
                        {req.referenceNo}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-[5px] rounded-[20px] font-normal border ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 items-start w-full min-w-0">
                      <h4 className="text-[#07b6d3] text-base sm:text-lg font-medium leading-snug truncate w-full">
                        {req.productName}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-1.5 text-xs sm:text-sm text-[#0f1422] font-normal leading-snug">
                        <span>{itemsCountLabel}</span>
                        <span>&bull;</span>
                        <span>Submitted: {formatSubmittedAt(req.submittedAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Column: Selected Request Detail Panel */}
          <div className="w-full xl:flex-1 min-w-0">
            {!selectedRequest ? (
              <div className="p-12 bg-white rounded-3xl border border-neutral-200 shadow-xs text-center flex flex-col items-center justify-center gap-2">
                <p className="text-base font-semibold text-neutral-700">
                  Choose another filter to view a request.
                </p>
                <p className="text-sm text-neutral-500">
                  No request is currently active in this filtered view.
                </p>
              </div>
            ) : (
              <div className="flex-1 w-full bg-white rounded-[20px] p-5 sm:p-6 lg:p-[30px] flex flex-col gap-5 shadow-xs">
                <div className="flex flex-row items-start justify-between gap-3 w-full">
                  <div className="flex flex-col gap-1 min-w-0">
                    <h3 className="text-[#0f1422] text-xl sm:text-2xl font-medium leading-tight truncate">
                      {selectedRequest.productName}
                    </h3>
                    <span className="text-[#c3c3c3] text-xs sm:text-sm font-normal leading-snug">
                      {selectedRequest.referenceNo}
                    </span>
                  </div>
                  {(() => {
                    const badge = getBookingStatusBadge(selectedRequest.status);
                    return (
                      <span className={`shrink-0 text-xs px-2.5 py-[5px] rounded-[20px] font-normal border ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>

                {(() => {
                  const banner = getBookingStatusBanner(selectedRequest.status);
                  const bannerStyles = {
                    cyan: "bg-[#07b6d3] text-white",
                    amber: "bg-[#ffc876] text-[#0f1422]",
                    green: "bg-[#05b64b] text-white",
                    red: "bg-[#c50000] text-white",
                  }[banner.treatment];
                  const usesDarkIcon = banner.treatment === "amber";
                  const iconSource = banner.treatment === "green"
                    ? "/send-booking/check.svg"
                    : "/visualization/circle-exclamation-duotone-regular-full 1.svg";

                  return (
                    <div role="region" aria-label="Status notice" className={`rounded-[20px] px-4 py-4 sm:px-5 flex items-center gap-3 ${bannerStyles}`}>
                      <div className="size-8 rounded-full bg-white/25 flex items-center justify-center shrink-0">
                        <Image
                          src={iconSource}
                          alt=""
                          width={21}
                          height={21}
                          aria-hidden="true"
                          className={usesDarkIcon ? "brightness-0" : "brightness-0 invert"}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{banner.title}</span>
                        <p className="text-xs opacity-80 leading-snug">{banner.description}</p>
                      </div>
                    </div>
                  );
                })()}

                <RequestStatusProgress status={selectedRequest.status} />

                <div className="w-full border-t border-[#e5e5e5] pt-4 flex flex-col gap-4">
                  <div className="flex flex-col gap-0.5">
                    <h4 className="text-[#07b6d3] text-lg sm:text-xl font-medium leading-snug">Your Visualization</h4>
                    <p className="text-[#c3c3c3] text-xs leading-snug">The PDF you downloaded and shared</p>
                  </div>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-16 sm:size-[72px] rounded-[16px] bg-[#f5f5f5] flex items-center justify-center shrink-0">
                        <Image src="/admin/pdf-file.svg" alt="PDF file" width={45} height={45} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-[#0f1422] truncate">{selectedRequest.quotation.filename}</span>
                        <span className="text-[11px] text-[#c3c3c3]">Generated {formatDate(selectedRequest.quotation.generatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsPreviewOpen(true)}
                        className="min-h-10 px-4 rounded-[10px] bg-[#0f1422] text-white text-xs font-medium transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3]"
                      >
                        View PDF
                      </button>
                      {selectedRequest.quotation.r2ObjectKey ? (
                        <a
                          href={`/api/quotations/download?key=${encodeURIComponent(selectedRequest.quotation.r2ObjectKey)}`}
                          download={selectedRequest.quotation.filename}
                          className="min-h-10 px-4 rounded-[10px] bg-[#07b6d3] hover:bg-[#069db6] text-white text-xs font-medium inline-flex items-center justify-center transition-[background-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3]"
                        >
                          Download PDF
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          aria-disabled="true"
                          title="PDF document is being prepared by our system."
                          className="min-h-10 px-4 rounded-[10px] bg-[#07b6d3]/45 text-white text-xs font-medium cursor-not-allowed"
                        >
                          Download PDF
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full border-t border-[#e5e5e5] pt-4">
                  <RequestTimeline
                    updates={selectedRequest.updates}
                    isExpanded={
                      state.expandedTimelineRequestId === selectedRequest.id
                    }
                    onToggleExpand={() =>
                      dispatch({
                        type: "toggle-timeline",
                        requestId: selectedRequest.id,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accessible Quotation Preview Dialog */}
      <QuotationPreviewDialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        quotation={selectedRequest ? selectedRequest.quotation : null}
        referenceNo={selectedRequest ? selectedRequest.referenceNo : ""}
      />
    </div>
  );
}
