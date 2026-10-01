"use client";

import React from "react";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";
import {
  getAluminumVariationMetadata,
  normalizeAluminumFinish,
} from "@/lib/visualization/colorVariations";

const FALLBACK_BEFORE_IMAGE = "/comparison_assets/room_without_furniture.png";
const FALLBACK_AFTER_IMAGE = "/comparison_assets/room_with_furniture.png";

export function VisualizationComparison() {
  const {
    finalSnapshotDataUrl,
    productConfiguration,
    spaceImageSession,
    placedOverlays,
    comparisonOverlays,
  } = useVisualizationSession();

  const activeOverlay =
    placedOverlays?.find((overlay) => overlay.isActive) ??
    comparisonOverlays?.find((overlay) => overlay.isActive) ??
    placedOverlays?.[0] ??
    comparisonOverlays?.[0];

  const configuredFinish = normalizeAluminumFinish(
    activeOverlay?.configuration.aluminumFinish ?? productConfiguration?.aluminumFinish,
  );
  const variation = getAluminumVariationMetadata(configuredFinish);
  const beforeImage =
    spaceImageSession?.workspaceImage.url ?? FALLBACK_BEFORE_IMAGE;
  const afterImage = finalSnapshotDataUrl ?? FALLBACK_AFTER_IMAGE;

  return (
    <div className="w-full select-none">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        <ComparisonImageCard
          alt="Before - Original Photo"
          imageUrl={beforeImage}
          label="Before - Original Photo"
        />
        <ComparisonImageCard
          alt="After - Final Output"
          imageUrl={afterImage}
          label={`After - ${variation.title}`}
          swatchClassName={variation.swatchClassName}
          previewHex={variation.previewHex}
        />
      </div>
    </div>
  );
}

function ComparisonImageCard({
  alt,
  imageUrl,
  label,
  swatchClassName,
  previewHex,
}: {
  alt: string;
  imageUrl: string;
  label: string;
  swatchClassName?: string;
  previewHex?: string;
}) {
  return (
    <div className="relative flex flex-col h-64 sm:h-96 lg:h-144.75 w-full rounded-[20px] overflow-hidden shadow-[0px_0px_5px_0px_rgba(0,0,0,0.15)] bg-neutral-100">
      {imageUrl ? (
        <img
          alt={alt}
          className="h-full w-full rounded-[20px] object-contain"
          draggable={false}
          src={imageUrl}
        />
      ) : null}
      {previewHex ? (
        <div
          className={`absolute bottom-6 right-6 h-11 w-11 rounded-full shadow-lg ring-4 ring-white/90 ${swatchClassName ?? ""}`}
          style={{ backgroundColor: previewHex }}
        />
      ) : null}
      <div className="absolute top-7.5 left-6 bg-black border border-[#c3c3c3] border-solid flex items-center justify-center px-3.5 py-1.5 rounded-[20px] z-10">
        <span className="text-white text-base font-normal leading-6 whitespace-nowrap">
          {label}
        </span>
      </div>
    </div>
  );
}
