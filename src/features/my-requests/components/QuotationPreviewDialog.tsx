/**
 * Accessible Quotation Preview Dialog (IMP-MS20)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C10, DSD-UI12, QAD-TC32, QAD-TC33
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes), BAN-UI-09 (Strict UI consistency)
 */

"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import type { ClientRequestQuotation } from "../requestData";

interface QuotationPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: ClientRequestQuotation | null;
  referenceNo: string;
}

export function QuotationPreviewDialog({
  isOpen,
  onClose,
  quotation,
  referenceNo,
}: QuotationPreviewDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";

      // Focus close button on open
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
        previousActiveElementRef.current?.focus();
      };
    }
  }, [isOpen]);

  // Trap focus and handle Escape
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "Tab" && dialogRef.current) {
      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  };

  if (!isOpen || !quotation) {
    return null;
  }

  const isLive = quotation.availability === "available";
  const isPending = quotation.availability === "pending";

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quotation-dialog-title"
        aria-describedby="quotation-dialog-description"
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 p-6 sm:p-8 flex flex-col gap-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="quotation-dialog-title"
              className="text-xl sm:text-2xl font-semibold text-[#0f1422] tracking-tight"
            >
              Quotation Preview
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              Reference: <span className="font-mono font-medium text-neutral-800">{referenceNo}</span>
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close quotation preview"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* PDF Canvas Mockup */}
        <div className="flex flex-col items-center justify-center p-8 bg-neutral-50 border-2 border-dashed border-neutral-300 rounded-xl text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-cyan-50 flex items-center justify-center text-green">
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
          <div>
            <p className="text-sm font-semibold text-[#0f1422]">{quotation.filename}</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              Generated: {new Date(quotation.generatedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
          {isLive ? (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green/10 text-[#05b64b] border border-green/20">
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Live Consultation Quotation
            </div>
          ) : isPending ? (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Quotation In Preparation
            </div>
          ) : (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Prototype Preview Only
            </div>
          )}
        </div>

        {/* Notice Description */}
        <p id="quotation-dialog-description" className="text-sm text-neutral-600 leading-relaxed text-center">
          {isLive
            ? "You can view the full interactive quotation and Bill of Materials breakdown online."
            : isPending
            ? "Your quotation document is currently being prepared by our team."
            : "Live quotation PDF preview will be available in a future update. Download becomes available when live quotation files are connected."}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2 border-t border-neutral-100">
          {isLive && (
            <Link
              href={`/q/${referenceNo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0f1422] hover:bg-neutral-800 text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
            >
              Open Consultation Viewer
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
