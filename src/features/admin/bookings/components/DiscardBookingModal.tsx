"use client";

import { X, AlertTriangle } from "lucide-react";

type DiscardBookingModalProps = {
  isOpen: boolean;
  quotationNumber: string;
  customerName: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DiscardBookingModal({
  isOpen,
  quotationNumber,
  customerName,
  isDeleting,
  onClose,
  onConfirm,
}: DiscardBookingModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 select-none"
      onClick={() => !isDeleting && onClose()}
    >
      <div
        className="bg-white dark:bg-[#0f1422] rounded-[20px] w-full max-w-[480px] border border-neutral-200 dark:border-neutral-800 shadow-[0px_4px_30px_0px_rgba(0,0,0,0.15)] p-6 sm:p-8 flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-booking-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-950/50 text-[#c50000]">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2
              id="discard-booking-title"
              className="text-[#0f1422] dark:text-white text-xl font-medium leading-tight tracking-tight"
            >
              Discard & Delete Quotation
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-[#c3c3c3] hover:text-[#0f1422] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#475569] dark:text-neutral-300 leading-relaxed">
            Are you sure you want to permanently discard and delete consultation{" "}
            <strong className="text-[#0f1422] dark:text-white font-semibold">
              {quotationNumber}
            </strong>{" "}
            for{" "}
            <strong className="text-[#0f1422] dark:text-white font-semibold">
              {customerName}
            </strong>
            ?
          </p>
          <p className="text-xs text-[#94a3b8] dark:text-neutral-400 leading-relaxed">
            This action is irreversible. The quotation, consultation booking, and all itemized breakdowns will be permanently deleted for both administration and the customer.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-[10px] border border-[#c3c3c3] dark:border-neutral-700 text-sm text-[#0f1422] dark:text-neutral-200 font-normal hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="confirm-discard-booking-btn"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-[10px] bg-[#c50000] hover:bg-red-700 text-white text-sm font-normal transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isDeleting && (
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            <span>{isDeleting ? "Deleting..." : "Permanently Delete"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
