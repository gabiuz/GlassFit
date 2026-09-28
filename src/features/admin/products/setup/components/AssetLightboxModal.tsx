"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { X, Layers } from "lucide-react";
import { ModelPreviewCanvas } from "./ModelPreviewCanvas";

export interface AssetLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetType: "image" | "model";
  source: string | File;
  fileName: string;
  fileSizeBytes: number;
}

export function AssetLightboxModal({
  isOpen,
  onClose,
  assetType,
  source,
  fileName,
  fileSizeBytes,
}: AssetLightboxModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-[20px] shadow-2xl border border-neutral-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#07b6d3]/10 text-[#07b6d3] flex items-center justify-center">
              <Layers className="size-4" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-base sm:text-lg font-medium text-[#0f1422] truncate max-w-sm sm:max-w-md">
                {fileName}
              </h3>
              <p className="text-xs text-neutral-500">
                {assetType === "image" ? "2D Catalog Image Preview" : "3D WebGL Model Preview"} •{" "}
                {fileSizeBytes > 1024 * 1024
                  ? `${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`
                  : `${(fileSizeBytes / 1024).toFixed(1)} KB`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 text-neutral-500 hover:text-black transition-colors cursor-pointer"
            title="Close Lightbox"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="relative w-full h-[60vh] sm:h-[70vh] bg-neutral-900 flex items-center justify-center p-4 overflow-hidden">
          {assetType === "image" && typeof source === "string" ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={source}
                alt={fileName}
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          ) : assetType === "model" ? (
            <div className="w-full h-full">
              <ModelPreviewCanvas
                modelSource={source}
                fileName={fileName}
                fileSizeBytes={fileSizeBytes}
                onRemove={onClose}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
