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


  const formatSubmittedAt = (isoString: string): string => {
    const date = new Date(isoString);
    const dateStr = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    }).format(date);
    const timeStr = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    }).format(date);
    return `${dateStr} · ${timeStr}`;
  };

  const formatQuotationMeta = (isoString: string): string => {
    const date = new Date(isoString);
    const dateStr = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    }).format(date);
    const timeStr = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    }).format(date);
    return `Generated ${dateStr} · ${timeStr} · 248 KB`;
  };

  return (
    <div className="flex flex-col items-start gap-6 sm:gap-8 w-full">
      {/* Database Query Failure Alert */}
      {loadError && (
        <div
          role="alert"
          aria-live="assertive"
          className="w-full rounded-[20px] bg-[#e74242] px-4 py-4 sm:px-5 text-white flex items-center justify-between gap-4 shadow-xs"
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
            className="min-h-10 px-4 rounded-[10px] bg-white text-[#0f1422] text-xs font-semibold hover:bg-neutral-100 transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer"
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
        <div className="flex items-center gap-[15px] sm:gap-[20px] min-w-max">
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
                  "px-[20px] py-[10px] rounded-[25px] flex items-center gap-[15px] whitespace-nowrap transition-[background-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3] cursor-pointer",
                  isActive
                    ? "bg-[#07b6d3] text-white shadow-xs"
                    : "bg-[#c3c3c3] text-white hover:bg-[#b0b0b0]"
                )}
              >
                <span className="text-[16px] font-normal leading-[1.4]">{tab}</span>
                <span className="bg-white rounded-[10px] px-[6px] py-[2px] text-[12px] text-[#0f1422] font-semibold leading-tight text-center min-w-[20px]">
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
        <div className="w-full flex flex-col xl:flex-row items-start gap-[20px] lg:gap-[30px]">
          {/* Left Column: Request List */}
          <div className="w-full xl:w-[540px] 2xl:w-[610px] shrink-0 flex flex-col gap-[20px] sm:gap-[30px]">
            {visibleRequests.length === 0 ? (
              <div className="p-8 bg-white rounded-[20px] border border-[#c3c3c3] text-center flex flex-col items-center justify-center gap-2">
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
                      "bg-white rounded-[20px] p-[24px] sm:p-[30px] flex items-start justify-between gap-4 w-full text-left transition-[border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3] cursor-pointer",
                      isSelected
                        ? "border-2 border-[#07b6d3] shadow-xs"
                        : "border border-[#c3c3c3] hover:border-neutral-400"
                    )}
                  >
                    <div className="flex flex-col justify-between gap-[24px] sm:gap-[30px] items-start flex-1 min-w-0">
                      <span className="text-[#c3c3c3] text-[15px] sm:text-[16px] font-normal leading-[1.4]">
                        {req.referenceNo}
                      </span>
                      <div className="flex flex-col gap-[5px] items-start w-full min-w-0">
                        <h4 className="text-[#07b6d3] text-[18px] sm:text-[20px] font-medium leading-[1.4] truncate w-full">
                          {req.productName}
                        </h4>
                        <p className="text-[#0f1422] text-[13px] sm:text-[14px] font-normal leading-[1.4]">
                          {itemsCountLabel} · Submitted: {formatSubmittedAt(req.submittedAt)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-[12px] px-[10px] py-[5px] rounded-[20px] font-normal leading-[1.4] shrink-0 whitespace-nowrap",
                        badge.bgClass,
                        badge.textClass
                      )}
                    >
                      {badge.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Column: Selected Request Detail Panel */}
          <div className="w-full xl:flex-1 min-w-0">
            {!selectedRequest ? (
              <div className="p-12 bg-white rounded-[20px] border border-neutral-200 shadow-xs text-center flex flex-col items-center justify-center gap-2">
                <p className="text-base font-semibold text-neutral-700">
                  Choose another filter to view a request.
                </p>
                <p className="text-sm text-neutral-500">
                  No request is currently active in this filtered view.
                </p>
              </div>
            ) : (
              <div className="w-full bg-white rounded-[20px] p-[24px] sm:p-[30px] flex flex-col gap-[20px] shadow-xs">
                {/* Header: Title, Status Badge, Reference */}
                <div className="flex flex-col gap-[10px] items-start w-full">
                  <div className="flex items-center justify-between gap-3 w-full">
                    <h3 className="text-[#0f1422] text-[22px] sm:text-[24px] font-medium leading-[1.2] truncate">
                      {selectedRequest.productName}
                    </h3>
                    {(() => {
                      const badge = getBookingStatusBadge(selectedRequest.status);
                      return (
                        <span
                          className={cn(
                            "text-[12px] px-[10px] py-[5px] rounded-[20px] font-normal leading-[1.4] shrink-0 whitespace-nowrap",
                            badge.bgClass,
                            badge.textClass
                          )}
                        >
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[#c3c3c3] text-[15px] sm:text-[16px] font-normal leading-[1.4]">
                    {selectedRequest.referenceNo}
                  </p>
                </div>

                {/* Banner */}
                {(() => {
                  const banner = getBookingStatusBanner(selectedRequest.status);
                  const bannerStyles = {
                    cyan: "bg-[#07b6d3] text-white",
                    amber: "bg-[#ffc876] text-[#0f1422]",
                    green: "bg-[#05b64b] text-white",
                    red: "bg-[#e74242] text-white",
                  }[banner.treatment];

                  return (
                    <div
                      role="region"
                      aria-label="Status notice"
                      className={cn(
                        "rounded-[20px] p-[20px] flex items-center gap-[14px] sm:gap-[16px]",
                        bannerStyles
                      )}
                    >
                      <div className="size-[48px] sm:size-[54px] shrink-0 flex items-center justify-center">
                        <svg
                          width="54"
                          height="54"
                          viewBox="0 0 54 54"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="size-full"
                          aria-hidden="true"
                        >
                          <path
                            opacity="0.4"
                            d="M5.4 27C5.4 38.9306 15.0694 48.6 27 48.6C38.9306 48.6 48.6 38.9306 48.6 27C48.6 15.0694 38.9306 5.4 27 5.4C15.0694 5.4 5.4 15.0694 5.4 27ZM21.6 26.325C21.6 25.2028 22.5028 24.3 23.625 24.3H27.675C28.7972 24.3 29.7 25.2028 29.7 26.325V33.75H30.375C31.4972 33.75 32.4 34.6528 32.4 35.775C32.4 36.8972 31.4972 37.8 30.375 37.8H23.625C22.5028 37.8 21.6 36.8972 21.6 35.775C21.6 34.6528 22.5028 33.75 23.625 33.75H25.65V28.35H23.625C22.5028 28.35 21.6 27.4472 21.6 26.325ZM29.7 18.9C29.7 20.3934 28.4934 21.6 27 21.6C25.5066 21.6 24.3 20.3934 24.3 18.9C24.3 17.4066 25.5066 16.2 27 16.2C28.4934 16.2 29.7 17.4066 29.7 18.9Z"
                            fill="currentColor"
                          />
                          <path
                            d="M27 16.2C28.4934 16.2 29.7 17.4066 29.7 18.9C29.7 20.3934 28.4934 21.6 27 21.6C25.5066 21.6 24.3 20.3934 24.3 18.9C24.3 17.4066 25.5066 16.2 27 16.2ZM21.6 26.325C21.6 25.2028 22.5028 24.3 23.625 24.3H27.675C28.7972 24.3 29.7 25.2028 29.7 26.325V33.75H30.375C31.4972 33.75 32.4 34.6528 32.4 35.775C32.4 36.8972 31.4972 37.8 30.375 37.8H23.625C22.5028 37.8 21.6 36.8972 21.6 35.775C21.6 34.6528 22.5028 33.75 23.625 33.75H25.65V28.35H23.625C22.5028 28.35 21.6 27.4472 21.6 26.325Z"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                      <div className="flex flex-col leading-[1.4]">
                        <p className="text-[15px] sm:text-[16px] font-medium">{banner.title}</p>
                        <p className="text-[13px] sm:text-[14px] font-normal opacity-90">{banner.description}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Progress Tracker */}
                <RequestStatusProgress status={selectedRequest.status} />

                {/* Divider Line */}
                <div className="w-full border-t border-[#f0f0f0]" />

                {/* Your Visualization */}
                <div className="flex flex-col gap-[20px] w-full">
                  <div className="flex flex-col gap-[2px]">
                    <h4 className="text-[#07b6d3] text-[18px] sm:text-[20px] font-medium leading-[1.4]">
                      Your Visualization
                    </h4>
                    <p className="text-[#c3c3c3] text-[12px] font-normal leading-[1.4]">
                      The PDF the customer downloaded and shared
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[20px] w-full">
                    <div className="flex items-center gap-[16px] sm:gap-[20px] min-w-0">
                      <div className="bg-[#f5f5f5] rounded-[20px] p-[16px] sm:p-[20px] flex items-center justify-center shrink-0">
                        <Image
                          src="/admin/pdf-file.svg"
                          alt="PDF"
                          width={63}
                          height={63}
                          className="size-[50px] sm:size-[63px]"
                        />
                      </div>
                      <div className="flex flex-col gap-[5px] min-w-0">
                        <p className="text-[#0f1422] text-[14px] font-medium leading-[1.4] truncate">
                          {selectedRequest.quotation.filename}
                        </p>
                        <p className="text-[#c3c3c3] text-[12px] font-normal leading-[1.4]">
                          {formatQuotationMeta(selectedRequest.quotation.generatedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-[10px] shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsPreviewOpen(true)}
                        className="bg-[#0f1422] hover:bg-[#1a233a] text-white text-[12px] px-[15px] py-[6px] rounded-[10px] transition-colors cursor-pointer font-normal whitespace-nowrap"
                      >
                        View PDF
                      </button>
                      {selectedRequest.quotation.availability === "available" ? (
                        <a
                          href={`/api/quotations/download?code=${encodeURIComponent(selectedRequest.referenceNo)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-[#07b6d3] hover:bg-[#069db6] text-white text-[12px] px-[15px] py-[6px] rounded-[10px] transition-colors font-normal whitespace-nowrap inline-flex items-center justify-center"
                        >
                          Download PDF
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          aria-disabled="true"
                          title="PDF document is being prepared by our system."
                          className="bg-[#07b6d3]/45 text-white text-[12px] px-[15px] py-[6px] rounded-[10px] font-normal whitespace-nowrap cursor-not-allowed"
                        >
                          Download PDF
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Divider Line */}
                <div className="w-full border-t border-[#f0f0f0]" />

                {/* Request Updates */}
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
