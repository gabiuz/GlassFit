"use client";

import React, { useState } from "react";
import Image from "next/image";
import { X, ZoomIn, RefreshCw } from "lucide-react";

export interface ImagePreviewCardProps {
  imageSource: string;
  fileName: string;
  fileSizeBytes: number;
  onRemove: () => void;
  onReplace: () => void;
  onExpand?: () => void;
}

export function ImagePreviewCard({
  imageSource,
  fileName,
  fileSizeBytes,
  onRemove,
  onReplace,
  onExpand,
}: ImagePreviewCardProps) {
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");

  return (
    <div className="relative w-full aspect-square bg-[#f8fafc] rounded-[16px] border border-neutral-200 overflow-hidden flex flex-col justify-between group">
      {/* Background Checkerboard for Transparency */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />

      {/* Image Viewport */}
      <div className="relative w-full h-full flex items-center justify-center p-2">
        <Image
          src={imageSource}
          alt={fileName}
          fill
          unoptimized
          className={`transition-all duration-200 ${
            fitMode === "contain" ? "object-contain p-4" : "object-cover"
          }`}
        />

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="p-2 rounded-full bg-white text-neutral-700 hover:text-black hover:scale-105 transition-transform shadow-md cursor-pointer"
              title="Inspect Full Image"
            >
              <ZoomIn className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onReplace}
            className="p-2 rounded-full bg-white text-neutral-700 hover:text-black hover:scale-105 transition-transform shadow-md cursor-pointer"
            title="Replace Image"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* Top-Right Remove Button */}
      <button
        type="button"
        onClick={onRemove}
        title="Remove Image"
        className="absolute top-3 right-3 p-1.5 bg-white/90 hover:bg-red-50 text-neutral-500 hover:text-red-500 rounded-full transition-colors border border-neutral-200 shadow-sm z-20 cursor-pointer"
      >
        <X className="size-4" />
      </button>

      {/* Bottom Metadata Bar */}
      <div className="relative p-2.5 bg-white/95 backdrop-blur-sm border-t border-neutral-200 flex items-center justify-between text-xs z-10">
        <div className="flex flex-col min-w-0 pr-2">
          <p className="font-medium text-[#0f1422] truncate">{fileName}</p>
          <p className="text-neutral-400 text-[11px]">
            {fileSizeBytes > 1024 * 1024
              ? `${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`
              : `${(fileSizeBytes / 1024).toFixed(1)} KB`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFitMode(fitMode === "contain" ? "cover" : "contain")}
          className="text-[10px] px-2 py-1 rounded bg-neutral-100 text-neutral-600 hover:bg-neutral-200 font-medium transition-colors shrink-0 cursor-pointer"
        >
          {fitMode === "contain" ? "Fit" : "Fill"}
        </button>
      </div>
    </div>
  );
}
