"use client";

import React, { useState } from "react";
import { Check } from "lucide-react";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";
import {
  ALUMINUM_COLOR_VARIATIONS,
  normalizeAluminumFinish,
  type AluminumFinishKey,
} from "@/lib/visualization/colorVariations";

const FALLBACK_BEFORE_IMAGE = "/comparison_assets/room_without_furniture.png";
const FALLBACK_AFTER_IMAGE = "/comparison_assets/room_with_furniture.png";

export function VisualizationComparison() {
  const {
    finalSnapshotDataUrl,
    productConfiguration,
    spaceImageSession,
    variationSnapshots,
    setFinalSnapshotDataUrl,
    setProductConfiguration,
  } = useVisualizationSession();
  const configuredFinish = normalizeAluminumFinish(productConfiguration?.aluminumFinish);
  const [selectedFinish, setSelectedFinish] =
    useState<AluminumFinishKey>(configuredFinish);
  const beforeImage =
    spaceImageSession?.workspaceImage.url ?? FALLBACK_BEFORE_IMAGE;
  const afterImage = finalSnapshotDataUrl ?? FALLBACK_AFTER_IMAGE;
  const variations = ALUMINUM_COLOR_VARIATIONS.map((variation) => {
    const snapshot = variationSnapshots.find((item) => item.key === variation.key);
    return {
      ...variation,
      imageDataUrl: snapshot?.imageDataUrl ?? afterImage,
    };
  });
  const selectedVariation =
    variations.find((variation) => variation.key === selectedFinish) ??
    variations[0];

  const handleSelectFinish = (finishKey: AluminumFinishKey) => {
    setSelectedFinish(finishKey);
    const chosenImage = variations.find((v) => v.key === finishKey)?.imageDataUrl;
    if (chosenImage) {
      setFinalSnapshotDataUrl(chosenImage);
    }
    if (productConfiguration && finishKey !== productConfiguration.aluminumFinish) {
      setProductConfiguration({
        ...productConfiguration,
        aluminumFinish: finishKey,
      });
    }
  };

  return (
    <div className="w-full flex flex-col gap-9 select-none">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        <ComparisonImageCard
          alt="Before - Original Photo"
          imageUrl={beforeImage}
          label="Before - Original Photo"
        />
        <ComparisonImageCard
          alt="After - Final Output"
          imageUrl={selectedVariation.imageDataUrl}
          label={`After - ${selectedVariation.title}`}
          swatchClassName={selectedVariation.swatchClassName}
        />
      </div>
      <div className="bg-black border border-[#c3c3c3] border-solid drop-shadow-[0px_0px_2.5px_rgba(0,0,0,0.25)] flex flex-col gap-5 items-start p-7.5 rounded-[20px] w-full">
        <div>
          <h3 className="font-medium leading-7 text-2xl text-white whitespace-nowrap">
            Compare Color Variations
          </h3>
        </div>
        <div className="flex flex-wrap gap-4 items-center justify-start w-full">
          {variations.map((variation) => {
            const isActive = selectedFinish === variation.key;
            return (
              <button
                key={variation.key}
                type="button"
                onClick={() => handleSelectFinish(variation.key)}
                className="flex flex-col gap-2.25 items-center relative w-44 cursor-pointer group select-none text-left"
              >
                <div
                  className={`relative rounded-[20px] overflow-hidden shrink-0 w-37.5 h-37.5 transition-all duration-300 ${isActive
                      ? "border-5 border-[#129044] shadow-lg scale-105"
                      : "border border-neutral-800 hover:scale-[1.02] shadow-sm"
                    }`}
                >
                  <img
                    alt={variation.title}
                    className="h-full w-full rounded-[15px] object-cover"
                    draggable={false}
                    src={variation.imageDataUrl}
                  />
                  <div className={`absolute bottom-3 left-3 h-8 w-8 rounded-full shadow-md ${variation.swatchClassName}`} />

                  {isActive && (
                    <div className="absolute top-3.25 right-3.25 w-7.5 h-7.5 bg-[#129044]/50 border-[2.5px] border-[#129044] rounded-[50%] flex items-center justify-center z-20 animate-in zoom-in duration-200 shadow-sm">
                      <Check className="w-4 h-4 text-[#129044] stroke-[3.5px]" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center w-full leading-[1.4] text-center mt-1">
                  <p className="font-medium text-[16px] text-white tracking-[-0.304px] w-full transition-colors duration-200 group-hover:text-green">
                    {variation.title}
                  </p>
                  <p className="font-normal text-[14px] text-neutral-400 tracking-[-0.266px] w-full">
                    {variation.label}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ComparisonImageCard({
  alt,
  imageUrl,
  label,
  swatchClassName,
}: {
  alt: string;
  imageUrl: string;
  label: string;
  swatchClassName?: string;
}) {
  return (
    <div className="relative flex flex-col h-64 sm:h-96 lg:h-144.75 w-full rounded-[20px] overflow-hidden shadow-[0px_0px_5px_0px_rgba(0,0,0,0.15)] bg-neutral-100">
      <img
        alt={alt}
        className="h-full w-full rounded-[20px] object-contain"
        draggable={false}
        src={imageUrl}
      />
      {swatchClassName && (
        <div className={`absolute bottom-6 right-6 h-11 w-11 rounded-full shadow-lg ring-4 ring-white/90 ${swatchClassName}`} />
      )}
      <div className="absolute top-7.5 left-6 bg-black border border-[#c3c3c3] border-solid flex items-center justify-center px-3.5 py-1.5 rounded-[20px] z-10">
        <span className="text-white text-base font-normal leading-6 whitespace-nowrap">
          {label}
        </span>
      </div>
    </div>
  );
}
