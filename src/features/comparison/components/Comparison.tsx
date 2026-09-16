"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import Button from "@/components/shared/Button";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";
import {
  ALUMINUM_COLOR_VARIATIONS,
  getAlternateAluminumFinish,
  getAluminumVariationTitle,
  normalizeAluminumFinish,
  type AluminumFinishKey,
} from "@/lib/visualization/colorVariations";
import {
  getComparisonOverlayFrame,
  getComparisonLayerImageUrls,
} from "@/lib/visualization/multiProductPresentation";
import type {
  PlacedOverlay,
  ProductVariationSnapshot,
} from "@/lib/visualization/types";

const BEFORE_IMAGE = "/comparison_assets/room_without_furniture.png";
const AFTER_IMAGE = "/comparison_assets/room_with_furniture.png";

type ProductVariantSelection = {
  left: AluminumFinishKey;
  right: AluminumFinishKey;
};

type ToggleSwitchProps = {
  value: "left" | "right";
  onChange: (value: "left" | "right") => void;
  textLeft: string;
  textRight: string;
};

function ToggleSwitch({ value, onChange, textLeft, textRight }: ToggleSwitchProps) {
  const isLeft = value === "left";
  return (
    <div className="flex items-center select-none relative">
      <button
        type="button"
        onClick={() => onChange("left")}
        className={`px-3 py-1.5 sm:px-4 flex items-center justify-center cursor-pointer text-base sm:text-xl leading-7 rounded-l-[10px] whitespace-nowrap ${isLeft
          ? "bg-green border border-green text-white font-medium"
          : "bg-white border border-[#c3c3c3] text-black font-normal hover:bg-neutral-50"
          }`}
      >
        {textLeft}
      </button>
      <button
        type="button"
        onClick={() => onChange("right")}
        className={`px-3 py-1.5 sm:px-4 flex items-center justify-center cursor-pointer text-base sm:text-xl leading-7 rounded-r-[10px] -ml-px whitespace-nowrap ${!isLeft
          ? "bg-green border border-green text-white font-medium"
          : "bg-white border border-[#c3c3c3] text-black font-normal hover:bg-neutral-50"
          }`}
      >
        {textRight}
      </button>
    </div>
  );
}

function ComparisonImage({
  alt,
  className,
  src,
}: {
  alt: string;
  className: string;
  src: string;
}) {
  return (
    <img
      alt={alt}
      className={className}
      draggable={false}
      src={src}
    />
  );
}

function BeforeState({ src }: { src: string }) {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none rounded-[20px] bg-neutral-100">
      <ComparisonImage
        alt="Original uploaded photo"
        className="h-full w-full rounded-[20px] object-contain"
        src={src}
      />
    </div>
  );
}

function AfterState({ src }: { src: string }) {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none rounded-[15px] bg-neutral-100">
      <ComparisonImage
        alt="Final visualization output"
        className="h-full w-full rounded-[15px] object-contain transition-all duration-300"
        src={src}
      />
    </div>
  );
}

function ProductVariantScene({
  backgroundImage,
  finish,
  overlays,
  selectedOverlayId,
  onSelectOverlay,
  interactive = true,
}: {
  backgroundImage: string;
  finish: AluminumFinishKey;
  overlays: PlacedOverlay[];
  selectedOverlayId: string;
  onSelectOverlay: (overlayId: string) => void;
  interactive?: boolean;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [sceneSize, setSceneSize] = useState({ width: 0, height: 0 });
  const layerImageUrls = getComparisonLayerImageUrls(
    overlays,
    selectedOverlayId,
    finish,
  );
  const sourceWidth = overlays[0]?.sourceCanvasWidth ?? 1;
  const sourceHeight = overlays[0]?.sourceCanvasHeight ?? 1;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const updateSize = () => {
      const bounds = scene.getBoundingClientRect();
      setSceneSize({ width: bounds.width, height: bounds.height });
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);

  const sourceAspectRatio = sourceWidth / sourceHeight;
  const sceneAspectRatio = sceneSize.width / Math.max(sceneSize.height, 1);
  const renderedWidth = sceneAspectRatio > sourceAspectRatio
    ? sceneSize.height * sourceAspectRatio
    : sceneSize.width;
  const renderedHeight = sceneAspectRatio > sourceAspectRatio
    ? sceneSize.height
    : sceneSize.width / sourceAspectRatio;
  const offsetX = (sceneSize.width - renderedWidth) / 2;
  const offsetY = (sceneSize.height - renderedHeight) / 2;

  return (
    <div ref={sceneRef} className="absolute inset-0 rounded-[15px] bg-neutral-100">
      <ComparisonImage
        alt="Uploaded room"
        className="absolute inset-0 h-full w-full rounded-[15px] object-contain"
        src={backgroundImage}
      />
      {layerImageUrls.map((imageUrl, index) => (
        <ComparisonImage
          key={`${overlays[index]?.overlayId}-${finish}`}
          alt=""
          className="absolute inset-0 h-full w-full rounded-[15px] object-contain pointer-events-none"
          src={imageUrl}
        />
      ))}
      {interactive && overlays.map((overlay, index) => {
        const frame = getComparisonOverlayFrame({
          overlay,
          renderedWidth,
          renderedHeight,
          offsetX,
          offsetY,
        });
        const isSelected = overlay.overlayId === selectedOverlayId;

        return (
          <button
            key={overlay.overlayId}
            type="button"
            aria-label={`Compare ${overlay.productName} ${index + 1}`}
            aria-pressed={isSelected}
            onClick={() => onSelectOverlay(overlay.overlayId)}
            className={`absolute z-20 rounded-sm border-2 bg-transparent cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07b6d3] focus-visible:ring-offset-2 ${isSelected
              ? "border-[#07b6d3] shadow-[0_0_0_2px_rgba(255,255,255,0.85)]"
              : "border-transparent hover:border-[#07b6d3]/70"
              }`}
            style={{
              left: frame.centerX,
              top: frame.centerY,
              width: frame.width,
              height: frame.height,
              transform: `translate(-50%, -50%) rotate(${frame.rotation}deg)`,
            }}
          >
            {isSelected && (
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#0f1422] px-2.5 py-1 text-xs font-medium text-white shadow-md">
                Editing {overlay.productName}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const getVariantLabel = (variant: AluminumFinishKey) => {
  return getAluminumVariationTitle(variant);
};

type ComparisonPanelCardProps = {
  title: string;
  label: string;
  imageSrc: string;
  preview?: ReactNode;
  swatchClassName: string;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
};

function ComparisonPanelCard({
  title,
  label,
  imageSrc,
  preview,
  swatchClassName,
  isSelected,
  isDisabled,
  onClick,
}: ComparisonPanelCardProps) {
  return (
    <div
      onClick={!isDisabled ? onClick : undefined}
      className={`flex flex-col gap-2.25 items-center relative w-full max-w-[176px] select-none ${isDisabled ? "cursor-not-allowed" : "cursor-pointer group"
        }`}
    >
      <div
        className={`relative rounded-[20px] overflow-hidden shrink-0 w-24 h-24 sm:w-37.5 sm:h-37.5 transition-all duration-300 ${isSelected
          ? "border-[5px] border-[#129044] shadow-lg scale-105"
          : "border border-neutral-200/60 shadow-sm hover:scale-[1.02] hover:shadow-md"
          }`}
      >
        {preview ?? <AfterState src={imageSrc} />}
        <div className={`absolute bottom-2 left-2 h-7 w-7 rounded-full shadow-md ${swatchClassName}`} />

        {isSelected && (
          <div className="absolute top-2.75 right-2.75 w-7.5 h-7.5 bg-[#129044]/30 border-[2.5px] border-[#129044] rounded-[50%] flex items-center justify-center z-20 animate-in zoom-in duration-200">
            <Check className="w-4 h-4 text-[#129044] stroke-[3.5px]" />
          </div>
        )}
        {isDisabled && (
          <>
            <div className="absolute inset-0 bg-black/55 z-10" />
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="w-9 h-9 bg-black/60 rounded-full flex items-center justify-center border border-white/20">
                <Image
                  src="/eye-slash.svg"
                  alt="Disabled"
                  width={30}
                  height={30}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col items-center w-full leading-[1.4] text-center">
        <p className="font-medium text-black text-[16px] w-full transition-colors duration-200 group-hover:text-black">
          {title}
        </p>
        <p className="font-normal text-black/60 text-[14px] w-full">
          {label}
        </p>
      </div>
    </div>
  );
}

export function Comparison() {
  const router = useRouter();
  const {
    finalSnapshotDataUrl,
    comparisonOverlays,
    placedOverlays,
    productConfiguration,
    selectedProductId,
    spaceImageSession,
    variationSnapshots,
    setFinalSnapshotDataUrl,
    setComparisonOverlays,
    setPlacedOverlays,
    setProductConfiguration,
    setVariationSnapshots,
    selectWorkspaceProduct,
  } =
    useVisualizationSession();
  const [viewAs, setViewAs] = useState<"left" | "right">("left"); // left = Side-by-Side, right = Slider
  const [compareMode, setCompareMode] = useState<"left" | "right">("left"); // left = Before and After, right = Product Variant

  // Variant Selections for Product Variant Comparison
  const configuredFinish = normalizeAluminumFinish(productConfiguration?.aluminumFinish);
  const [leftVariant, setLeftVariant] = useState<AluminumFinishKey>(configuredFinish);
  const [rightVariant, setRightVariant] = useState<AluminumFinishKey>(
    getAlternateAluminumFinish(configuredFinish),
  );
  const [productVariantSelections, setProductVariantSelections] = useState<
    Record<string, ProductVariantSelection>
  >(() => Object.fromEntries(
    comparisonOverlays.map((overlay) => {
      const finish = normalizeAluminumFinish(overlay.configuration.aluminumFinish);
      return [
        overlay.overlayId,
        { left: finish, right: getAlternateAluminumFinish(finish) },
      ];
    }),
  ));
  const [selectedComparisonOverlayId, setSelectedComparisonOverlayId] = useState(
    comparisonOverlays.at(-1)?.overlayId ?? "",
  );
  const [isPreparingQuotation, setIsPreparingQuotation] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const selectedComparisonOverlay = comparisonOverlays.find(
    (overlay) => overlay.overlayId === selectedComparisonOverlayId,
  );

  const saveSelectedProductFinish = (finish: AluminumFinishKey) => {
    if (!selectedComparisonOverlayId) return;
    setComparisonOverlays(
      comparisonOverlays.map((overlay) =>
        overlay.overlayId === selectedComparisonOverlayId
          ? {
              ...overlay,
              configuration: {
                ...overlay.configuration,
                aluminumFinish: finish,
              },
            }
          : overlay,
      ),
    );
    if (selectedComparisonOverlay?.isActive && productConfiguration) {
      setProductConfiguration({
        ...productConfiguration,
        aluminumFinish: finish,
      });
    }
  };

  const handleSelectComparisonOverlay = (overlayId: string) => {
    const overlay = comparisonOverlays.find((item) => item.overlayId === overlayId);
    setSelectedComparisonOverlayId(overlayId);
    if (!overlay) return;
    const savedSelection = productVariantSelections[overlayId];
    if (savedSelection) {
      setLeftVariant(savedSelection.left);
      setRightVariant(savedSelection.right);
      return;
    }
    const finish = normalizeAluminumFinish(overlay.configuration.aluminumFinish);
    setLeftVariant(finish);
    setRightVariant(getAlternateAluminumFinish(finish));
    setProductVariantSelections((current) => ({
      ...current,
      [overlayId]: {
        left: finish,
        right: getAlternateAluminumFinish(finish),
      },
    }));
  };

  const handleSwap = () => {
    const nextLeftVariant = rightVariant;
    const nextRightVariant = leftVariant;
    setLeftVariant(nextLeftVariant);
    setRightVariant(nextRightVariant);
    saveSelectedProductFinish(nextLeftVariant);
    if (selectedComparisonOverlayId) {
      setProductVariantSelections((current) => ({
        ...current,
        [selectedComparisonOverlayId]: {
          left: nextLeftVariant,
          right: nextRightVariant,
        },
      }));
    }
  };

  const handleLeftVariantChange = (variant: AluminumFinishKey) => {
    setLeftVariant(variant);
    saveSelectedProductFinish(variant);
    if (!selectedComparisonOverlayId) return;
    setProductVariantSelections((current) => ({
      ...current,
      [selectedComparisonOverlayId]: {
        left: variant,
        right: current[selectedComparisonOverlayId]?.right ?? rightVariant,
      },
    }));
  };

  const handleRightVariantChange = (variant: AluminumFinishKey) => {
    setRightVariant(variant);
    if (!selectedComparisonOverlayId) return;
    setProductVariantSelections((current) => ({
      ...current,
      [selectedComparisonOverlayId]: {
        left: current[selectedComparisonOverlayId]?.left ?? leftVariant,
        right: variant,
      },
    }));
  };

  const handleEditPlacement = () => {
    if (selectedComparisonOverlay) {
      setPlacedOverlays(
        comparisonOverlays
          .filter((overlay) => overlay.overlayId !== selectedComparisonOverlay.overlayId)
          .map((overlay) => ({ ...overlay, isActive: false })),
      );
      selectWorkspaceProduct(
        selectedComparisonOverlay.productId,
        undefined,
        selectedComparisonOverlay.configuration,
      );
      return;
    }

    if (!isBeforeAfter && productConfiguration && productConfiguration.aluminumFinish !== leftVariant) {
      setProductConfiguration({
        ...productConfiguration,
        aluminumFinish: leftVariant,
      });
    }
  };

  const isSideBySide = viewAs === "left";
  const isBeforeAfter = compareMode === "left";
  const editProductId = selectedComparisonOverlay?.productId ?? selectedProductId;
  const editPlacementHref = editProductId
    ? `/visualize/${editProductId}/workspace`
    : "/visualization";
  const latestPlacedOverlay = placedOverlays[placedOverlays.length - 1];
  const beforeImage = spaceImageSession?.workspaceImage.url ?? BEFORE_IMAGE;
  const afterImage =
    finalSnapshotDataUrl ??
    latestPlacedOverlay?.flattenedImageDataUrl ??
    AFTER_IMAGE;
  const imageForFinish = (finish: AluminumFinishKey) =>
    variationSnapshots.find((item) => item.key === finish)?.imageDataUrl ?? afterImage;
  const leftVariantImage = imageForFinish(leftVariant);
  const rightVariantImage = imageForFinish(rightVariant);

  // Slider State & Logic
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      handleMove(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleTouchStart = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging]);

  const handleProceedToQuotation = async () => {
    setComparisonError(null);

    if (!isBeforeAfter && selectedComparisonOverlay && comparisonOverlays.length > 0) {
      setIsPreparingQuotation(true);
      try {
        const targetAwareSnapshots = await Promise.all(
          ALUMINUM_COLOR_VARIATIONS.map(async (variation) => ({
            ...variation,
            imageDataUrl: await composeComparisonSnapshot(
              beforeImage,
              getComparisonLayerImageUrls(
                comparisonOverlays,
                selectedComparisonOverlay.overlayId,
                variation.key,
              ),
            ),
          } satisfies ProductVariationSnapshot)),
        );
        const chosenImage = targetAwareSnapshots.find(
          (snapshot) => snapshot.key === leftVariant,
        )?.imageDataUrl;
        if (chosenImage) setFinalSnapshotDataUrl(chosenImage);
        setVariationSnapshots(targetAwareSnapshots);

        const updatedOverlays = comparisonOverlays.map((overlay) =>
          overlay.overlayId === selectedComparisonOverlay.overlayId
            ? {
                ...overlay,
                configuration: {
                  ...overlay.configuration,
                  aluminumFinish: leftVariant,
                },
              }
            : overlay,
        );
        setComparisonOverlays(updatedOverlays);

        if (selectedComparisonOverlay.isActive && productConfiguration) {
          setProductConfiguration({
            ...productConfiguration,
            aluminumFinish: leftVariant,
          });
        }
      } catch (error) {
        setComparisonError(
          error instanceof Error
            ? error.message
            : "Unable to prepare the selected product comparison.",
        );
        setIsPreparingQuotation(false);
        return;
      }
      setIsPreparingQuotation(false);
    } else if (!isBeforeAfter) {
      const chosenImage = imageForFinish(leftVariant);
      setFinalSnapshotDataUrl(chosenImage);
      if (productConfiguration) {
        setProductConfiguration({
          ...productConfiguration,
          aluminumFinish: leftVariant,
        });
      }
    }

    router.push("/quotation");
  };

  return (
    <div className="w-full max-w-325 mx-auto px-6 py-12 md:py-16 flex flex-col gap-12 items-center">
      {/* Header Title Section */}
      <div className="flex flex-col gap-5 items-center justify-center text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-black leading-tight">
          Your <span className="text-green">Visual</span> Preview
        </h1>
        <p className="text-lg sm:text-[24px] md:text-[28px] font-normal text-black/90 tracking-tight leading-normal">
          See how your selected product may look in your space.
        </p>
      </div>

      {/* Control Panel Section */}
      <div className="w-full flex flex-col xl:flex-row gap-6 xl:gap-0 justify-between items-center">
        <div className="flex flex-col md:flex-row gap-8 md:gap-12 xl:gap-25.75 items-center">
          {/* View As Toggle */}
          <div className="flex flex-col gap-2.5 items-center xl:items-start w-full xl:w-auto">
            <span className="text-[#c3c3c3] text-[16px] tracking-[-0.304px] leading-[1.4] font-normal">
              View as:
            </span>
            <ToggleSwitch
              value={viewAs}
              onChange={setViewAs}
              textLeft="Side-by-Side"
              textRight="Slider"
            />
          </div>

          {/* Compare Mode Toggle */}
          <div className="flex flex-col gap-2.5 items-center xl:items-start w-full xl:w-auto">
            <span className="text-[#c3c3c3] text-[16px] tracking-[-0.304px] leading-[1.4] font-normal">
              Compare mode:
            </span>
            <ToggleSwitch
              value={compareMode}
              onChange={setCompareMode}
              textLeft="Before and After"
              textRight="Product Variant"
            />
          </div>
        </div>

        <div className="bg-[#c3c3c3] border border-[#c3c3c3] border-solid flex items-center justify-center px-5 py-2.5 rounded-[20px] self-center xl:self-auto">
          <p className="text-base text-white tracking-wide font-medium whitespace-nowrap">
            Comparing: {isBeforeAfter ? "Raw and Final Out" : `${getVariantLabel(leftVariant)} and ${getVariantLabel(rightVariant)}`}
          </p>
        </div>
      </div>

      {!isBeforeAfter && comparisonOverlays.length > 0 && (
        <div className="w-full rounded-[20px] border border-neutral-200 bg-[#f5f5f5] p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-1">
            <p className="text-base font-medium text-[#0f1422]">
              Choose a product to compare
            </p>
            <p className="text-sm text-black/60">
              Click a model in the preview or choose it below. Only that product changes finish.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Products to compare">
            {comparisonOverlays.map((overlay, index) => {
              const isSelected = overlay.overlayId === selectedComparisonOverlayId;
              return (
                <button
                  key={overlay.overlayId}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectComparisonOverlay(overlay.overlayId)}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07b6d3] focus-visible:ring-offset-2 ${isSelected
                    ? "border-[#07b6d3] bg-[#07b6d3] text-white"
                    : "border-neutral-300 bg-white text-[#0f1422] hover:border-[#07b6d3] hover:bg-[#e9f9fb]"
                    }`}
                >
                  {overlay.productName} {index + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Compare Views Area */}
      <div className="w-full flex items-center justify-center min-h-64 sm:min-h-96 lg:min-h-144.75">
        {isSideBySide ? (
          /* Side-by-Side View Mode */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 w-full">
            {/* Left Card */}
            <div className="relative flex flex-col h-64 sm:h-96 lg:h-144.75 w-full rounded-[20px] overflow-hidden shadow-md border border-neutral-200/40 p-6">
              {isBeforeAfter ? (
                /* Before: Empty Room */
                <>
                  <BeforeState src={beforeImage} />
                  <div className="absolute top-6 left-6 bg-black border border-[#c3c3c3] px-3.5 py-1.5 rounded-[20px] z-10 shadow-md">
                    <p className="text-base text-white font-normal tracking-wide">
                      Before - Original Photo
                    </p>
                  </div>
                </>
              ) : (
                /* Variant: Selected Left Finish */
                <>
                  {comparisonOverlays.length > 0 ? (
                    <ProductVariantScene
                      backgroundImage={beforeImage}
                      finish={leftVariant}
                      overlays={comparisonOverlays}
                      selectedOverlayId={selectedComparisonOverlayId}
                      onSelectOverlay={handleSelectComparisonOverlay}
                    />
                  ) : (
                    <AfterState src={leftVariantImage} />
                  )}
                  <div className="absolute top-6 left-6 bg-black border border-[#c3c3c3] px-3.5 py-1.5 rounded-[20px] z-10 shadow-md">
                    <p className="text-base text-white font-normal tracking-wide">
                      {getVariantLabel(leftVariant)}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Right Card */}
            <div className="relative flex flex-col h-64 sm:h-96 lg:h-144.75 w-full rounded-[20px] overflow-hidden shadow-md border border-neutral-200/40 p-6">
              {isBeforeAfter ? (
                /* After: Cabinet Installed */
                <>
                  <AfterState src={afterImage} />
                  <div className="absolute top-6 left-6 bg-black border border-[#c3c3c3] px-3.5 py-1.5 rounded-[20px] z-10 shadow-md">
                    <p className="text-base text-white font-normal tracking-wide">
                      After - Final Output
                    </p>
                  </div>
                </>
              ) : (
                /* Variant: Selected Right Finish */
                <>
                  {comparisonOverlays.length > 0 ? (
                    <ProductVariantScene
                      backgroundImage={beforeImage}
                      finish={rightVariant}
                      overlays={comparisonOverlays}
                      selectedOverlayId={selectedComparisonOverlayId}
                      onSelectOverlay={handleSelectComparisonOverlay}
                    />
                  ) : (
                    <AfterState src={rightVariantImage} />
                  )}
                  <div className="absolute top-6 left-6 bg-black border border-[#c3c3c3] px-3.5 py-1.5 rounded-[20px] z-10 shadow-md">
                    <p className="text-base text-white font-normal tracking-wide">
                      {getVariantLabel(rightVariant)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Premium Interactive Draggable Image Slider Mode */
          <div
            ref={containerRef}
            className="relative w-full h-64 sm:h-96 lg:h-144.75 max-w-225 rounded-[20px] overflow-hidden select-none cursor-ew-resize shadow-lg border border-neutral-200/50"
          >
            {/* Underlay / Bottom state (Visible on the right side of the slider) */}
            <div className="absolute inset-0 w-full h-full">
              {isBeforeAfter || comparisonOverlays.length === 0 ? (
                <AfterState src={isBeforeAfter ? afterImage : rightVariantImage} />
              ) : (
                <ProductVariantScene
                  backgroundImage={beforeImage}
                  finish={rightVariant}
                  overlays={comparisonOverlays}
                  selectedOverlayId={selectedComparisonOverlayId}
                  onSelectOverlay={handleSelectComparisonOverlay}
                />
              )}
            </div>

            {/* Overlay / Top state (Clipped, visible on the left side of the slider) */}
            <div
              className="absolute inset-0 w-full h-full"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              {isBeforeAfter ? (
                <BeforeState src={beforeImage} />
              ) : (
                comparisonOverlays.length > 0 ? (
                  <ProductVariantScene
                    backgroundImage={beforeImage}
                    finish={leftVariant}
                    overlays={comparisonOverlays}
                    selectedOverlayId={selectedComparisonOverlayId}
                    onSelectOverlay={handleSelectComparisonOverlay}
                    interactive={false}
                  />
                ) : (
                  <AfterState src={leftVariantImage} />
                )
              )}
            </div>

            {/* Interactive Vertical Slider Line / Handle */}
            <div
              className="absolute top-0 bottom-0 w-2.5 bg-white cursor-ew-resize z-40 flex items-center justify-center transition-opacity"
              style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            >
              <div className="shrink-0 rounded-full bg-grad-dark border-5 p-2.5 border-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-200">
                <Image
                  src="/swap-icons.svg"
                  alt="Slider Handle"
                  width={20}
                  height={20}
                  draggable={false}
                />
              </div>
            </div>

            {/* Floating Labels indicating left/right visual meanings */}
            <div className="absolute top-6 left-6 z-20 bg-black/90 border border-white/10 px-3.5 py-1.5 rounded-[20px] text-white text-sm font-normal select-none pointer-events-none backdrop-blur-sm shadow-sm transition-opacity duration-200">
              {isBeforeAfter ? "Before - Original" : getVariantLabel(leftVariant)}
            </div>
            <div className="absolute top-6 right-6 z-20 bg-black/90 border border-white/10 px-3.5 py-1.5 rounded-[20px] text-white text-sm font-normal select-none pointer-events-none backdrop-blur-sm shadow-sm transition-opacity duration-200">
              {isBeforeAfter ? "After - Installed" : getVariantLabel(rightVariant)}
            </div>
          </div>
        )}
      </div>

      {/* Product Variant Selection Panel */}
      {!isBeforeAfter && (
        <div className="w-full flex flex-col lg:flex-row gap-6 lg:gap-8 justify-center items-center py-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
          {/* Panel A - Left */}
          <div className="bg-[rgba(245,245,245,0.4)] backdrop-blur-md border border-white/30 p-7.5 rounded-[20px] shadow-[0px_0px_10px_0px_rgba(0,0,0,0.08)] flex flex-col gap-5 items-start w-full max-w-155">
            <p className="font-medium text-black text-2xl tracking-[-0.456px] leading-[1.2]">
              Panel A - Left
            </p>
            <div className="flex flex-wrap sm:flex-nowrap gap-4 items-center justify-center sm:justify-between w-full">
              {ALUMINUM_COLOR_VARIATIONS.map((variation) => (
                <ComparisonPanelCard
                  key={variation.key}
                  title={variation.title}
                  label={variation.label}
                  imageSrc={imageForFinish(variation.key)}
                  preview={comparisonOverlays.length > 0 ? (
                    <ProductVariantScene
                      backgroundImage={beforeImage}
                      finish={variation.key}
                      overlays={comparisonOverlays}
                      selectedOverlayId={selectedComparisonOverlayId}
                      onSelectOverlay={handleSelectComparisonOverlay}
                      interactive={false}
                    />
                  ) : undefined}
                  swatchClassName={variation.swatchClassName}
                  isSelected={leftVariant === variation.key}
                  isDisabled={rightVariant === variation.key}
                  onClick={() => handleLeftVariantChange(variation.key)}
                />
              ))}
            </div>
          </div>

          {/* Swap Button */}
          <button
            type="button"
            onClick={handleSwap}
            className="bg-black hover:bg-black/90 active:scale-95 text-white flex flex-col items-center justify-center gap-1.5 w-19 h-19 rounded-full shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] shrink-0 transition-all cursor-pointer border border-white/10"
          >
            <Image
              src="/swap-icons.svg"
              alt="Swap"
              width={20}
              height={20}
            />
            <span className="text-[12px] font-normal tracking-[-0.228px] leading-[1.4] whitespace-nowrap">
              Swap
            </span>
          </button>

          {/* Panel B - Right */}
          <div className="bg-[rgba(245,245,245,0.4)] backdrop-blur-md border border-white/30 p-7.5 rounded-[20px] shadow-[0px_0px_10px_0px_rgba(0,0,0,0.08)] flex flex-col gap-5 items-start w-full max-w-155">
            <p className="font-medium text-black text-2xl tracking-[-0.456px] leading-[1.2]">
              Panel B - Right
            </p>
            <div className="flex flex-wrap sm:flex-nowrap gap-4 items-center justify-center sm:justify-between w-full">
              {ALUMINUM_COLOR_VARIATIONS.map((variation) => (
                <ComparisonPanelCard
                  key={variation.key}
                  title={variation.title}
                  label={variation.label}
                  imageSrc={imageForFinish(variation.key)}
                  preview={comparisonOverlays.length > 0 ? (
                    <ProductVariantScene
                      backgroundImage={beforeImage}
                      finish={variation.key}
                      overlays={comparisonOverlays}
                      selectedOverlayId={selectedComparisonOverlayId}
                      onSelectOverlay={handleSelectComparisonOverlay}
                      interactive={false}
                    />
                  ) : undefined}
                  swatchClassName={variation.swatchClassName}
                  isSelected={rightVariant === variation.key}
                  isDisabled={leftVariant === variation.key}
                  onClick={() => handleRightVariantChange(variation.key)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Bottom Footer Actions Box */}
      {comparisonError && (
        <p role="alert" className="w-full rounded-[15px] bg-red-50 px-4 py-3 text-sm text-red-700">
          {comparisonError}
        </p>
      )}
      <div className="bg-[#f5f5f5] w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 rounded-[20px] shadow-sm select-none">
        <Link
          href={editPlacementHref}
          onClick={handleEditPlacement}
          className="w-full sm:w-auto"
        >
          <Button
            variant="blackBtnWhiteText"
            value="Edit Placement"
            leftIcon={<ChevronLeft className="w-5 h-5 shrink-0 text-white" />}
            rightIcon={null}
            className="w-full sm:w-auto font-medium justify-center cursor-pointer py-3.5 rounded-[25px] flex items-center hover:opacity-90 [--btn-width:100%] sm:[--btn-width:fit-content] [--btn-padding:12px_16px] sm:[--btn-padding:15px_20px] [--btn-font-size:16px] sm:[--btn-font-size:20px] [--btn-gap:10px] sm:[--btn-gap:15px] whitespace-nowrap"
            style={{
              width: "var(--btn-width, fit-content)",
              padding: "var(--btn-padding, 15px 20px)",
              fontSize: "var(--btn-font-size, 20px)",
              gap: "var(--btn-gap, 15px)",
            }}
          />
        </Link>

        <Button
          variant="lightGradWhiteText"
          leftIcon={null}
          rightIcon={<ChevronRight className="w-5 h-5 shrink-0 text-white" />}
          className="w-full sm:w-auto font-medium justify-center cursor-pointer py-3.5 rounded-[25px] flex items-center hover:opacity-95 [--btn-width:100%] sm:[--btn-width:fit-content] [--btn-padding:12px_16px] sm:[--btn-padding:15px_20px] [--btn-font-size:16px] sm:[--btn-font-size:20px] [--btn-gap:10px] sm:[--btn-gap:15px] whitespace-nowrap"
          style={{
            width: "var(--btn-width, fit-content)",
            padding: "var(--btn-padding, 15px 20px)",
            fontSize: "var(--btn-font-size, 20px)",
            gap: "var(--btn-gap, 15px)",
          }}
          onClick={handleProceedToQuotation}
          disabled={isPreparingQuotation}
          value={isPreparingQuotation ? "Preparing comparison..." : "Proceed to Estimate Price"}
        />
      </div>
    </div>
  );
}

async function composeComparisonSnapshot(
  backgroundImageUrl: string,
  layerImageUrls: string[],
) {
  if (layerImageUrls.length === 0) {
    throw new Error("No product layers are available for comparison.");
  }

  const [backgroundImage, ...layerImages] = await Promise.all([
    loadComparisonImage(backgroundImageUrl),
    ...layerImageUrls.map(loadComparisonImage),
  ]);
  const referenceLayer = layerImages[0];
  const canvas = document.createElement("canvas");
  canvas.width = referenceLayer.naturalWidth;
  canvas.height = referenceLayer.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Snapshot rendering is unavailable in this browser.");
  }

  context.fillStyle = "#f5f5f5";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawContainedImage(context, backgroundImage, canvas.width, canvas.height);
  for (const layerImage of layerImages) {
    context.drawImage(layerImage, 0, 0, canvas.width, canvas.height);
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

function loadComparisonImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    if (/^https?:\/\//i.test(source)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load a comparison image."));
    image.src = source;
  });
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
) {
  const scale = Math.min(
    targetWidth / image.naturalWidth,
    targetHeight / image.naturalHeight,
  );
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(
    image,
    (targetWidth - width) / 2,
    (targetHeight - height) / 2,
    width,
    height,
  );
}
