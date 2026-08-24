"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

type DeleteProductModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  productName: string;
  isDeleting?: boolean;
};

export function DeleteProductModal({
  isOpen,
  onClose,
  onConfirm,
  productName,
  isDeleting = false,
}: DeleteProductModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
      onClick={() => {
        if (!isDeleting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-product-title"
    >
      <div
        className="bg-white rounded-[20px] p-[50px] w-full max-w-[322px] flex flex-col gap-[15px] items-center text-center shadow-[0px_4px_30px_0px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-150 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon & Text Content */}
        <div className="flex flex-col gap-[20px] items-center justify-center w-full">
          <div className="size-[74px] relative shrink-0 flex items-center justify-center">
            <Image
              src="/admin/delete-logo.svg"
              alt="Delete Warning"
              width={74}
              height={74}
              priority
              className="size-full object-contain"
            />
          </div>

          <div className="flex flex-col gap-5 items-center justify-center text-black w-full">
            <h2
              id="delete-product-title"
              className="text-2xl font-medium leading-[1.4] tracking-[-0.456px] text-center"
            >
              Delete this product?
            </h2>
            <p className="text-[14px] font-light leading-[1.4] tracking-[-0.266px] text-center">
              You&apos;re about to delete &quot;{productName}&quot;. This can&apos;t be undone and will remove it from the storefront immediately.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center relative shrink-0">
          <div className="p-[5px]">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="bg-[#0f1422] hover:bg-black text-white text-[12px] font-light leading-[1.4] tracking-[-0.228px] px-[15px] py-[5px] rounded-[10px] cursor-pointer transition-colors disabled:opacity-50 min-w-[69px] text-center"
            >
              Cancel
            </button>
          </div>
          <div className="p-[5px]">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="bg-[#c50000] hover:bg-red-700 text-white text-[12px] font-light leading-[1.4] tracking-[-0.228px] px-[15px] py-[5px] rounded-[10px] cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 min-w-[66px] text-center"
            >
              {isDeleting && (
                <svg
                  className="animate-spin h-3.5 w-3.5 text-white"
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
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;

  return createPortal(content, document.body);
}
