"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { RawMaterial } from "@/lib/pricing/types";

type DeleteMaterialModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  material: RawMaterial | null;
  isDeleting?: boolean;
};

export function DeleteMaterialModal({
  isOpen,
  onClose,
  onConfirm,
  material,
  isDeleting = false,
}: DeleteMaterialModalProps) {
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

  if (!isOpen || !material) return null;

  const content = (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
      onClick={() => {
        if (!isDeleting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-material-title"
    >
      <div
        className="bg-white rounded-[20px] p-[40px] sm:p-[50px] w-full max-w-[360px] flex flex-col gap-[15px] items-center text-center shadow-[0px_4px_30px_0px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-150 select-none"
        onClick={(e) => e.stopPropagation()}
      >
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

          <div className="flex flex-col gap-3 items-center justify-center text-black w-full">
            <h2
              id="delete-material-title"
              className="text-2xl font-medium leading-[1.4] tracking-tight text-center text-[#0f1422]"
            >
              Delete Material?
            </h2>
            <p className="text-sm font-normal text-neutral-600 leading-relaxed text-center">
              You are about to delete <span className="font-semibold text-black">&quot;{material.description}&quot;</span> (<code className="text-xs bg-neutral-100 px-1 py-0.5 rounded">{material.material_code}</code>). If this material is referenced in active products, it will be deactivated instead.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 bg-[#0f1422] hover:bg-black text-white text-xs font-medium py-2.5 px-4 rounded-[10px] cursor-pointer transition-colors disabled:opacity-50 text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 bg-[#c50000] hover:bg-red-700 text-white text-xs font-medium py-2.5 px-4 rounded-[10px] cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 text-center"
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
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
