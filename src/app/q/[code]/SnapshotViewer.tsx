"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Maximize2, X, Image as ImageIcon } from "lucide-react";

interface SnapshotViewerProps {
  snapshotImageUrl: string | null;
  productName: string;
  referenceCode: string;
}

export function SnapshotViewer({
  snapshotImageUrl,
  productName,
  referenceCode,
}: SnapshotViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!snapshotImageUrl) {
    return (
      <div className="bg-neutral-100 border border-neutral-200 rounded-[20px] p-8 flex flex-col items-center justify-center gap-3 text-center min-h-[260px]">
        <div className="w-12 h-12 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500">
          <ImageIcon className="w-6 h-6" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[#0f1422]">
            Architectural Product Visualization
          </span>
          <span className="text-xs text-neutral-500">
            {productName} (Ref: {referenceCode})
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Thumbnail Card */}
      <div className="relative group overflow-hidden rounded-[20px] bg-neutral-950 border border-neutral-200 shadow-sm aspect-[16/10] w-full max-h-[420px] flex items-center justify-center">
        <Image
          src={snapshotImageUrl}
          alt={`Visualization snapshot for ${productName}`}
          fill
          unoptimized
          className="object-contain transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-between p-4 pointer-events-none">
          <span className="text-white text-xs font-medium px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity">
            Visualization Snapshot Preview
          </span>
          <button
            onClick={() => setIsOpen(true)}
            className="pointer-events-auto bg-white/90 hover:bg-white text-[#0f1422] p-2 rounded-full shadow-md transition-all cursor-pointer opacity-90 group-hover:opacity-100"
            title="Enlarge snapshot"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lightbox Zoom Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] w-full h-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-2 right-2 z-10 bg-white/20 hover:bg-white/40 text-white p-2.5 rounded-full transition-colors cursor-pointer"
              title="Close image view"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={snapshotImageUrl}
                alt={`Enlarged visualization snapshot for ${productName}`}
                fill
                unoptimized
                className="object-contain rounded-lg"
              />
            </div>
            <div className="absolute bottom-3 left-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-md backdrop-blur-xs">
              {productName} · Reference #{referenceCode}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
