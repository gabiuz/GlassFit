/**
 * My Requests Interactive Island (IMP-MS19)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C10, DSD-UI12, ERD-E2, QAD-TC32
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

"use client";

import React, { useReducer, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
}: {
  initialRequests?: ClientRequestItem[];
}) {
  const [state, dispatch] = useReducer(
    requestReducer,
    initialRequests,
    createInitialRequestState
  );

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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

  return (
    <div className="flex flex-col gap-6 lg:gap-8 w-full">
      {/* Filters Bar */}
      <div
        role="group"
        aria-label="Filter requests"
        className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar py-1"
      >
        {FILTER_TABS.map((tab) => {
          const isActive = state.activeFilter === tab;
          const count = counts[tab];

          return (
            <button
              key={tab}
              type="button"
              aria-pressed={isActive}
              onClick={() => dispatch({ type: "set-filter", filter: tab })}
              className={`min-h-[44px] px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 shrink-0 flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${
                isActive
                  ? "bg-[#0f1422] text-white shadow-sm"
                  : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              <span>{tab}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Empty Fixture State: When no requests exist at all */}
      {state.requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-neutral-200 shadow-xs text-center gap-4">
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
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start w-full">
          {/* Left Column: Request List */}
          <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 flex flex-col gap-3">
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
                  req.productCount === 1 ? "Item" : "Items"
                }`;

                return (
                  <button
                    key={req.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => dispatch({ type: "select", requestId: req.id })}
                    className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col gap-3.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${
                      isSelected
                        ? "bg-cyan-50/20 border-[#07b6d3] shadow-md ring-1 ring-[#07b6d3]/30"
                        : "bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/60 shadow-xs"
                    }`}
                  >
                    {/* Top Row: Reference + Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-neutral-500 tracking-wider">
                        {req.referenceNo}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Middle Row: Product Name + Request Icon */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        <h4 className="text-base sm:text-lg font-semibold text-[#0f1422] truncate tracking-tight">
                          {req.productName}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
                          <span>{itemsCountLabel}</span>
                          <span>&bull;</span>
                          <span>Submitted {formatDate(req.submittedAt)}</span>
                        </div>
                      </div>

                      {/* Request Icon Treatment matching Section 6.1 */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                          isSelected
                            ? "bg-white border-[#07b6d3]/40 text-[#07b6d3]"
                            : "bg-neutral-50 border-neutral-200 text-neutral-400"
                        }`}
                        aria-hidden="true"
                      >
                        <Image
                          src="/profile/request.svg"
                          alt=""
                          width={18}
                          height={18}
                          className="shrink-0"
                        />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Column: Selected Request Detail Panel */}
          <div className="w-full lg:flex-1 min-w-0">
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
              <div className="bg-white rounded-3xl border border-neutral-200 shadow-xs p-6 sm:p-8 flex flex-col gap-6 lg:gap-8">
                {/* Header: Reference + Title + Items + Status */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-neutral-100">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-xs font-semibold text-neutral-400 uppercase tracking-widest">
                      {selectedRequest.referenceNo}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-[#0f1422] tracking-tight">
                      {selectedRequest.productName}
                    </h3>
                    <p className="text-sm text-neutral-500 font-medium">
                      {selectedRequest.productCount}{" "}
                      {selectedRequest.productCount === 1 ? "Item" : "Items"} &bull; Submitted{" "}
                      {formatDate(selectedRequest.submittedAt)}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {(() => {
                      const badge = getBookingStatusBadge(selectedRequest.status);
                      return (
                        <span
                          className={`inline-block text-sm px-3.5 py-1 rounded-full font-semibold border ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                        >
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Conditional Status Banner */}
                {(() => {
                  const banner = getBookingStatusBanner(selectedRequest.status);

                  const bannerStyles = {
                    cyan: "bg-[#e9f9fb] border-[#07b6d3]/40 text-[#097283]",
                    amber: "bg-amber-50 border-amber-200 text-amber-900",
                    green: "bg-emerald-50 border-emerald-200 text-emerald-900",
                    red: "bg-rose-50 border-rose-200 text-rose-900",
                  }[banner.treatment];

                  const iconColor = {
                    cyan: "text-[#07b6d3]",
                    amber: "text-amber-600",
                    green: "text-emerald-600",
                    red: "text-rose-600",
                  }[banner.treatment];

                  return (
                    <div
                      role="region"
                      aria-label="Status notice"
                      className={`p-4 sm:p-5 rounded-2xl border flex items-start gap-3.5 ${bannerStyles}`}
                    >
                      <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                        {banner.treatment === "green" ? (
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
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        ) : banner.treatment === "red" ? (
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
                              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        ) : (
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
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold">{banner.title}</span>
                        <p className="text-sm opacity-90 leading-relaxed">
                          {banner.description}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Progress Indicator */}
                <RequestStatusProgress status={selectedRequest.status} />

                {/* Quotation Card */}
                <div className="p-5 sm:p-6 rounded-2xl bg-neutral-50/80 border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shrink-0 text-[#07b6d3] shadow-2xs">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-[#0f1422] truncate">
                        {selectedRequest.quotation.filename}
                      </span>
                      <span className="text-xs text-neutral-500">
                        Generated {formatDate(selectedRequest.quotation.generatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsPreviewOpen(true)}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-[#0f1422] text-sm font-medium border border-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green cursor-pointer"
                    >
                      View PDF
                    </button>

                    <div className="relative group flex flex-col">
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        title="Download becomes available when live quotation files are connected."
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-neutral-200 text-neutral-400 text-sm font-medium cursor-not-allowed transition-colors"
                      >
                        Download PDF
                      </button>
                    </div>
                  </div>
                </div>

                {/* Update Timeline */}
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

      {/* Prototype Preview Dialog */}
      <QuotationPreviewDialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        quotation={selectedRequest ? selectedRequest.quotation : null}
        referenceNo={selectedRequest ? selectedRequest.referenceNo : ""}
      />
    </div>
  );
}
