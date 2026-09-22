"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import Button from "@/components/shared/Button";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";
import {
  getAluminumVariationMetadata,
  getAvailableVariationFinishes,
  getAluminumVariationTitle,
  normalizeAluminumFinish,
  type AluminumFinishKey,
} from "@/lib/visualization/colorVariations";
import {
  commitProductVariantSelections,
  createProductVariantSelections,
  getComparisonLayerImageUrls,
  hasCompleteVariationLayers,
  reconcileProductVariantSelections,
  swapProductVariantSelections,
  updateProductVariantSelection,
  type ProductVariantSelections,
} from "@/lib/visualization/multiProductPresentation";
import {
  MAX_OVERLAY_MASK_DIMENSION,
  calculateContainTransform,
  createOverlayAlphaMask,
  findTopmostOverlayAtPoint,
  getOverlayHitMaskSource,
  type OverlayAlphaMask,
  type OverlayAlphaMaskMap,
} from "@/lib/visualization/overlayHitTesting";
import type {
  PlacedOverlay,
  ProductVariationSnapshot,
} from "@/lib/visualization/types";

const BEFORE_IMAGE = "/comparison_assets/room_without_furniture.png";
const AFTER_IMAGE = "/comparison_assets/room_with_furniture.png";
const EMPTY_ALPHA_MASKS: OverlayAlphaMaskMap = Object.freeze({});
const POINTER_TAP_MOVEMENT_PX = 6;

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
  selectionState,
  src,
}: {
  alt: string;
  className: string;
  selectionState?: "selected" | "idle";
  src: string;
}) {
  if (!src) return null;
  return (
    <img
      alt={alt}
      className={className}
      data-selection-state={selectionState}
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
  alphaMasks,
  backgroundImage,
  layerImageUrls,
  overlays,
  selectedOverlayId,
  selectionFeedback,
}: {
  alphaMasks: OverlayAlphaMaskMap;
  backgroundImage: string;
  layerImageUrls: string[];
  overlays: PlacedOverlay[];
  selectedOverlayId: string;
  selectionFeedback: "full" | "none";
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const sceneSize = useElementSize(sceneRef, selectionFeedback === "full");
  const selectedOverlay = overlays.find(
    (overlay) => overlay.overlayId === selectedOverlayId,
  );
  const selectedMask = alphaMasks[selectedOverlayId];
  const labelStyle: CSSProperties | null = selectedOverlay
    ? selectedMask
      ? getSelectionLabelStyle(selectedMask, sceneSize.width, sceneSize.height)
      : { left: "50%", top: 52, transform: "translate(-50%, -100%)" }
    : null;

  return (
    <div ref={sceneRef} className="absolute inset-0 rounded-[15px] bg-neutral-100">
      <ComparisonImage
        alt="Uploaded room"
        className="absolute inset-0 h-full w-full rounded-[15px] object-contain"
        src={backgroundImage}
      />
      {layerImageUrls.map((imageUrl, index) => (
        <ComparisonImage
          key={overlays[index]?.overlayId}
          alt=""
          className={`absolute inset-0 h-full w-full rounded-[15px] object-contain pointer-events-none ${selectionFeedback === "full" ? "comparison-overlay-layer" : ""}`}
          selectionState={selectionFeedback === "full"
            ? overlays[index]?.overlayId === selectedOverlayId ? "selected" : "idle"
            : undefined}
          src={imageUrl}
        />
      ))}
      {selectionFeedback === "full" && selectedOverlay && labelStyle && (
        <span
          aria-hidden="true"
          className="comparison-overlay-label pointer-events-none absolute z-20 max-w-[calc(100%-24px)] truncate rounded-full border border-white/10 bg-[#0f1422]/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm"
          style={labelStyle}
        >
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#07b6d3]" />
          Editing {selectedOverlay.productName}
        </span>
      )}
    </div>
  );
}

function ProductVariantInteractionLayer({
  alphaMasks,
  onSelectOverlay,
  overlays,
}: {
  alphaMasks: OverlayAlphaMaskMap;
  onSelectOverlay: (overlayId: string) => void;
  overlays: PlacedOverlay[];
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const pendingHoverPointRef = useRef<{ x: number; y: number } | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const [hasHoverTarget, setHasHoverTarget] = useState(false);
  const orderedOverlayIds = overlays.map((overlay) => overlay.overlayId);

  const resolveOverlay = (clientX: number, clientY: number) => {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    return findTopmostOverlayAtPoint({
      x: clientX - rect.left,
      y: clientY - rect.top,
      containerWidth: rect.width,
      containerHeight: rect.height,
      orderedOverlayIds,
      masks: alphaMasks,
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointerStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    pendingHoverPointRef.current = { x: event.clientX, y: event.clientY };
    if (hoverFrameRef.current !== null) return;
    hoverFrameRef.current = window.requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      const point = pendingHoverPointRef.current;
      if (!point) return;
      setHasHoverTarget(Boolean(resolveOverlay(point.x, point.y)));
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!start || start.pointerId !== event.pointerId) return;

    const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (movement > POINTER_TAP_MOVEMENT_PX) return;
    const overlayId = resolveOverlay(event.clientX, event.clientY);
    if (overlayId) onSelectOverlay(overlayId);
  };

  useEffect(() => () => {
    if (hoverFrameRef.current !== null) {
      window.cancelAnimationFrame(hoverFrameRef.current);
    }
  }, []);

  return (
    <div
      ref={surfaceRef}
      aria-hidden="true"
      className={`absolute inset-0 z-30 touch-manipulation ${hasHoverTarget ? "cursor-pointer" : "cursor-default"}`}
      onPointerCancel={() => {
        pointerStartRef.current = null;
      }}
      onPointerDown={handlePointerDown}
      onPointerLeave={() => setHasHoverTarget(false)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}

function IncompleteVariationPrompt({
  editPlacementHref,
  onEditPlacement,
}: {
  editPlacementHref: string;
  onEditPlacement: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[15px] bg-neutral-100 px-6 text-center">
      <p className="max-w-md text-sm text-black/70">
        This comparison needs complete product variations before it can be previewed.
      </p>
      <Link
        href={editPlacementHref}
        onClick={onEditPlacement}
        className="rounded-full bg-[#0f1422] px-4 py-2 text-sm font-medium text-white hover:bg-black"
      >
        Return to Edit Placement
      </Link>
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
  previewHex?: string;
  isSelected: boolean;
  isDisabled: boolean;
  disabledLabel: string;
  onClick: () => void;
};

function ComparisonPanelCard({
  title,
  label,
  imageSrc,
  preview,
  swatchClassName,
  previewHex,
  isSelected,
  isDisabled,
  disabledLabel,
  onClick,
}: ComparisonPanelCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-pressed={isSelected}
      className={`group relative flex min-h-24 w-full items-center gap-3 rounded-[16px] border p-2.5 text-left outline-none transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-[#07b6d3] focus-visible:ring-offset-2 active:scale-[0.98] disabled:active:scale-100 ${isSelected
        ? "border-[#129044] bg-[#edf8f1] shadow-[0_0_0_1px_rgba(18,144,68,0.12)]"
        : isDisabled
          ? "cursor-not-allowed border-neutral-200 bg-neutral-100/80 opacity-55"
          : "cursor-pointer border-neutral-200 bg-white hover:border-[#07b6d3] hover:bg-[#f3fbfc] hover:shadow-sm"
        }`}
    >
      <div
        className={`relative size-18 shrink-0 overflow-hidden rounded-[12px] border bg-neutral-100 ${isSelected ? "border-[#129044]" : "border-neutral-200"}`}
      >
        {preview ?? <AfterState src={imageSrc} />}
        <span className={`absolute bottom-1.5 left-1.5 size-5 rounded-full border-2 border-white shadow-sm ${swatchClassName}`} style={{ backgroundColor: previewHex }} aria-hidden="true" />
      </div>

      <span className="min-w-0 flex-1 leading-[1.35]">
        <span className="block truncate text-sm font-medium text-[#0f1422]">
          {title}
        </span>
        <span className="mt-1 block line-clamp-2 text-xs font-normal text-black/55">
          {isDisabled && !isSelected ? disabledLabel : label}
        </span>
      </span>

      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color] duration-150 ${isSelected
        ? "border-[#129044] bg-[#129044] text-white"
        : "border-neutral-300 bg-white text-transparent"
        }`} aria-hidden="true">
        <Check className="size-3.5 stroke-[3]" />
      </span>
    </button>
  );
}

function useElementSize(
  elementRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = elementRef.current;
    if (!enabled || !element) {
      return;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize((current) => (
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height }
      ));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef, enabled]);

  return size;
}

function getSelectionLabelStyle(
  mask: OverlayAlphaMask,
  containerWidth: number,
  containerHeight: number,
): CSSProperties | null {
  if (!mask.opaqueBounds) return null;
  const transform = calculateContainTransform(
    containerWidth,
    containerHeight,
    mask.width,
    mask.height,
  );
  if (!transform) return null;

  const bounds = mask.opaqueBounds;
  const modelCenterX = transform.offsetX
    + ((bounds.left + bounds.right) / 2) * transform.scale;
  const modelTop = transform.offsetY + bounds.top * transform.scale;
  const labelHalfWidth = Math.min(104, containerWidth / 2);
  const left = Math.min(
    Math.max(modelCenterX, labelHalfWidth),
    containerWidth - labelHalfWidth,
  );
  const renderBelow = modelTop < 44;

  return {
    left,
    top: renderBelow ? modelTop + 10 : modelTop - 10,
    transform: renderBelow ? "translateX(-50%)" : "translate(-50%, -100%)",
  };
}

function useOverlayAlphaMasks(overlays: PlacedOverlay[], enabled: boolean) {
  const cacheRef = useRef(new Map<
    string,
    { source: string; mask: OverlayAlphaMask }
  >());
  const [maskState, setMaskState] = useState<{
    sources: Array<{ overlayId: string; source: string }>;
    masks: Record<string, OverlayAlphaMask>;
  }>({ sources: [], masks: {} });

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      cacheRef.current.clear();
      return;
    }

    const sourceEntries = overlays.flatMap((overlay) => {
      const source = getOverlayHitMaskSource(overlay);
      return source ? [{ overlayId: overlay.overlayId, source }] : [];
    });

    void Promise.all(sourceEntries.map(async ({ overlayId, source }) => {
      const cached = cacheRef.current.get(overlayId);
      if (cached?.source === source) return cached.mask;

      try {
        return await decodeOverlayAlphaMask(overlayId, source);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`Unable to prepare comparison hit mask for ${overlayId}.`, error);
        }
        return null;
      }
    })).then((decodedMasks) => {
      if (cancelled) return;
      const nextCache = new Map<
        string,
        { source: string; mask: OverlayAlphaMask }
      >();
      const nextMasks: Record<string, OverlayAlphaMask> = {};

      decodedMasks.forEach((mask, index) => {
        if (!mask) return;
        const entry = sourceEntries[index];
        nextCache.set(entry.overlayId, { source: entry.source, mask });
        nextMasks[entry.overlayId] = mask;
      });
      cacheRef.current = nextCache;
      setMaskState({ sources: sourceEntries, masks: nextMasks });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, overlays]);

  if (!enabled) return EMPTY_ALPHA_MASKS;
  const currentSources = getOverlayMaskSources(overlays);
  return overlayMaskSourcesMatch(currentSources, maskState.sources)
    ? maskState.masks
    : EMPTY_ALPHA_MASKS;
}

function getOverlayMaskSources(overlays: PlacedOverlay[]) {
  return overlays.flatMap((overlay) => {
    const source = getOverlayHitMaskSource(overlay);
    return source ? [{ overlayId: overlay.overlayId, source }] : [];
  });
}

function overlayMaskSourcesMatch(
  left: Array<{ overlayId: string; source: string }>,
  right: Array<{ overlayId: string; source: string }>,
) {
  return left.length === right.length && left.every((entry, index) => (
    entry.overlayId === right[index]?.overlayId
    && entry.source === right[index]?.source
  ));
}

async function decodeOverlayAlphaMask(overlayId: string, source: string) {
  const image = await loadComparisonImage(source);
  const scale = Math.min(
    1,
    MAX_OVERLAY_MASK_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas alpha-mask decoding is unavailable in this browser.");
  }

  context.drawImage(image, 0, 0, width, height);
  return createOverlayAlphaMask(
    overlayId,
    width,
    height,
    context.getImageData(0, 0, width, height).data,
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
  const [productVariantSelections, setProductVariantSelections] = useState<
    ProductVariantSelections
  >(() => createProductVariantSelections(comparisonOverlays));
  const comparisonOverlayIds = comparisonOverlays
    .map((overlay) => overlay.overlayId)
    .join("\u0000");
  const [reconciledOverlayIds, setReconciledOverlayIds] = useState(comparisonOverlayIds);
  const [selectedComparisonOverlayId, setSelectedComparisonOverlayId] = useState(
    comparisonOverlays.at(-1)?.overlayId ?? "",
  );
  const [isPreparingQuotation, setIsPreparingQuotation] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const selectedComparisonOverlay = comparisonOverlays.find(
    (overlay) => overlay.overlayId === selectedComparisonOverlayId,
  );
  const selectedOverlayInitialFinish = normalizeAluminumFinish(
    selectedComparisonOverlay?.configuration.aluminumFinish ?? configuredFinish,
  );
  const selectedProductVariants = productVariantSelections[selectedComparisonOverlayId] ?? {
    left: selectedOverlayInitialFinish,
    right: selectedOverlayInitialFinish,
  };
  const leftVariant = selectedProductVariants.left;
  const rightVariant = selectedProductVariants.right;
  const variantDataComplete = hasCompleteVariationLayers(comparisonOverlays);
  const comparisonVariations = getAvailableVariationFinishes(
    comparisonOverlays.map((overlay) => overlay.variationImageDataUrls),
  ).map(getAluminumVariationMetadata);

  if (reconciledOverlayIds !== comparisonOverlayIds) {
    setReconciledOverlayIds(comparisonOverlayIds);
    setProductVariantSelections((current) =>
      reconcileProductVariantSelections(current, comparisonOverlays),
    );
    if (
      comparisonOverlays.length > 0
      && !comparisonOverlays.some((overlay) => overlay.overlayId === selectedComparisonOverlayId)
    ) {
      setSelectedComparisonOverlayId(comparisonOverlays.at(-1)?.overlayId ?? "");
    }
  }

  const handleSelectComparisonOverlay = (overlayId: string) => {
    setSelectedComparisonOverlayId(overlayId);
  };

  const handleSwap = () => {
    setProductVariantSelections(swapProductVariantSelections);
  };

  const handleLeftVariantChange = (variant: AluminumFinishKey) => {
    if (!selectedComparisonOverlayId) return;
    setProductVariantSelections((current) =>
      updateProductVariantSelection(
        current,
        selectedComparisonOverlayId,
        "left",
        variant,
      ),
    );
  };

  const handleRightVariantChange = (variant: AluminumFinishKey) => {
    if (!selectedComparisonOverlayId) return;
    setProductVariantSelections((current) =>
      updateProductVariantSelection(
        current,
        selectedComparisonOverlayId,
        "right",
        variant,
      ),
    );
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

  };

  const isSideBySide = viewAs === "left";
  const isBeforeAfter = compareMode === "left";
  const alphaMasks = useOverlayAlphaMasks(
    comparisonOverlays,
    !isBeforeAfter && variantDataComplete,
  );
  const selectedComparisonOverlayOrdinal = comparisonOverlays.findIndex(
    (overlay) => overlay.overlayId === selectedComparisonOverlayId,
  ) + 1;
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
  const leftLayerImageUrls = variantDataComplete
    ? getComparisonLayerImageUrls(comparisonOverlays, productVariantSelections, "left")
    : [];
  const rightLayerImageUrls = variantDataComplete
    ? getComparisonLayerImageUrls(comparisonOverlays, productVariantSelections, "right")
    : [];
  const getVariantPreviewLayerImageUrls = (
    panel: "left" | "right",
    variant: AluminumFinishKey,
  ) => {
    if (!variantDataComplete || !selectedComparisonOverlayId) {
      return [];
    }

    return getComparisonLayerImageUrls(
      comparisonOverlays,
      updateProductVariantSelection(
        productVariantSelections,
        selectedComparisonOverlayId,
        panel,
        variant,
      ),
      panel,
    );
  };

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
        if (!variantDataComplete) {
          throw new Error(
            "Product variation data is incomplete. Return to Edit Placement to regenerate the comparison.",
          );
        }
        const targetAwareSnapshots = await Promise.all(
          comparisonVariations.map(async (variation) => ({
            ...variation,
            imageDataUrl: await composeComparisonSnapshot(
              beforeImage,
              getComparisonLayerImageUrls(
                comparisonOverlays,
                updateProductVariantSelection(
                  productVariantSelections,
                  selectedComparisonOverlay.overlayId,
                  "left",
                  variation.key,
                ),
                "left",
              ),
            ),
          } satisfies ProductVariationSnapshot)),
        );
        const chosenImage = targetAwareSnapshots.find(
          (snapshot) => snapshot.key === leftVariant,
        )?.imageDataUrl;
        if (chosenImage) setFinalSnapshotDataUrl(chosenImage);
        setVariationSnapshots(targetAwareSnapshots);

        const updatedOverlays = commitProductVariantSelections(
          comparisonOverlays,
          productVariantSelections,
        );
        setComparisonOverlays(updatedOverlays);
        setPlacedOverlays(updatedOverlays);

        const activeOverlay = updatedOverlays.find((overlay) => overlay.isActive);
        if (activeOverlay && productConfiguration) {
          setProductConfiguration({
            ...productConfiguration,
            aluminumFinish: activeOverlay.configuration.aluminumFinish,
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
              Click a product in either preview or choose it here. Only that product changes finish.
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
          {selectedComparisonOverlay && (
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              Editing {selectedComparisonOverlay.productName} {selectedComparisonOverlayOrdinal}
            </p>
          )}
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
                    variantDataComplete ? (
                      <>
                        <ProductVariantScene
                          alphaMasks={alphaMasks}
                          backgroundImage={beforeImage}
                          layerImageUrls={leftLayerImageUrls}
                          overlays={comparisonOverlays}
                          selectedOverlayId={selectedComparisonOverlayId}
                          selectionFeedback="full"
                        />
                        <ProductVariantInteractionLayer
                          alphaMasks={alphaMasks}
                          onSelectOverlay={handleSelectComparisonOverlay}
                          overlays={comparisonOverlays}
                        />
                      </>
                    ) : variationSnapshots.length > 0 ? (
                      <AfterState src={leftVariantImage} />
                    ) : (
                      <IncompleteVariationPrompt
                        editPlacementHref={editPlacementHref}
                        onEditPlacement={handleEditPlacement}
                      />
                    )
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
                    variantDataComplete ? (
                      <>
                        <ProductVariantScene
                          alphaMasks={alphaMasks}
                          backgroundImage={beforeImage}
                          layerImageUrls={rightLayerImageUrls}
                          overlays={comparisonOverlays}
                          selectedOverlayId={selectedComparisonOverlayId}
                          selectionFeedback="full"
                        />
                        <ProductVariantInteractionLayer
                          alphaMasks={alphaMasks}
                          onSelectOverlay={handleSelectComparisonOverlay}
                          overlays={comparisonOverlays}
                        />
                      </>
                    ) : variationSnapshots.length > 0 ? (
                      <AfterState src={rightVariantImage} />
                    ) : (
                      <IncompleteVariationPrompt
                        editPlacementHref={editPlacementHref}
                        onEditPlacement={handleEditPlacement}
                      />
                    )
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
                variantDataComplete ? (
                  <ProductVariantScene
                    alphaMasks={alphaMasks}
                    backgroundImage={beforeImage}
                    layerImageUrls={rightLayerImageUrls}
                    overlays={comparisonOverlays}
                    selectedOverlayId={selectedComparisonOverlayId}
                    selectionFeedback="full"
                  />
                ) : variationSnapshots.length > 0 ? (
                  <AfterState src={rightVariantImage} />
                ) : (
                  <IncompleteVariationPrompt
                    editPlacementHref={editPlacementHref}
                    onEditPlacement={handleEditPlacement}
                  />
                )
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
                  variantDataComplete ? (
                    <ProductVariantScene
                      alphaMasks={alphaMasks}
                      backgroundImage={beforeImage}
                      layerImageUrls={leftLayerImageUrls}
                      overlays={comparisonOverlays}
                      selectedOverlayId={selectedComparisonOverlayId}
                      selectionFeedback="full"
                    />
                  ) : variationSnapshots.length > 0 ? (
                    <AfterState src={leftVariantImage} />
                  ) : (
                    <IncompleteVariationPrompt
                      editPlacementHref={editPlacementHref}
                      onEditPlacement={handleEditPlacement}
                    />
                  )
                ) : (
                  <AfterState src={leftVariantImage} />
                )
              )}
            </div>

            {!isBeforeAfter && comparisonOverlays.length > 0 && variantDataComplete && (
              <ProductVariantInteractionLayer
                alphaMasks={alphaMasks}
                onSelectOverlay={handleSelectComparisonOverlay}
                overlays={comparisonOverlays}
              />
            )}

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
        <section className="w-full rounded-[20px] border border-neutral-200 bg-[#f5f5f5] p-4 shadow-sm sm:p-6" aria-labelledby="variant-selection-heading">
          <div className="mb-5 flex flex-col gap-1">
            <h2 id="variant-selection-heading" className="text-xl font-medium tracking-[-0.38px] text-[#0f1422] sm:text-2xl">
              Choose finishes for each panel
            </h2>
            <p className="text-sm text-black/60">
              Panel A appears on the left and Panel B appears on the right. A finish can only be used on one side at a time.
            </p>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-5">
          {/* Panel A - Left */}
          <fieldset className="min-w-0 rounded-[16px] border border-neutral-200 bg-white p-3.5 sm:p-4">
            <legend className="sr-only">Panel A finish</legend>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-medium text-[#0f1422]">Panel A</p>
                <p className="text-xs text-black/50">Left side</p>
              </div>
              <span className="max-w-[65%] truncate rounded-full bg-[#edf8f1] px-3 py-1.5 text-xs font-medium text-[#106b34]">
                {getVariantLabel(leftVariant)}
              </span>
            </div>
            <div className="grid max-h-88 grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2" role="group" aria-label="Panel A finish options">
              {comparisonVariations.map((variation) => (
                <ComparisonPanelCard
                  key={variation.key}
                  title={variation.title}
                  label={variation.label}
                  imageSrc={imageForFinish(variation.key)}
                  preview={comparisonOverlays.length > 0 ? (
                    variantDataComplete ? (
                      <ProductVariantScene
                        alphaMasks={EMPTY_ALPHA_MASKS}
                        backgroundImage={beforeImage}
                        layerImageUrls={getVariantPreviewLayerImageUrls("left", variation.key)}
                        overlays={comparisonOverlays}
                        selectedOverlayId={selectedComparisonOverlayId}
                        selectionFeedback="none"
                      />
                    ) : undefined
                  ) : undefined}
                  swatchClassName={variation.swatchClassName}
                  previewHex={variation.previewHex}
                  isSelected={leftVariant === variation.key}
                  isDisabled={(!variantDataComplete && variationSnapshots.length === 0) || rightVariant === variation.key}
                  disabledLabel="Selected in Panel B"
                  onClick={() => handleLeftVariantChange(variation.key)}
                />
              ))}
            </div>
          </fieldset>

          {/* Swap Button */}
          <button
            type="button"
            onClick={handleSwap}
            aria-label="Swap Panel A and Panel B finishes"
            className="mx-auto flex h-11 min-w-28 shrink-0 cursor-pointer items-center justify-center gap-2 self-center rounded-full border border-white/10 bg-black px-4 text-white shadow-sm outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-[#07b6d3] focus-visible:ring-offset-2 active:scale-[0.97] lg:size-13 lg:min-w-0 lg:flex-col lg:gap-0.5 lg:px-0"
          >
            <Image
              src="/swap-icons.svg"
              alt=""
              width={18}
              height={18}
            />
            <span className="whitespace-nowrap text-xs font-normal lg:sr-only">
              Swap
            </span>
          </button>

          {/* Panel B - Right */}
          <fieldset className="min-w-0 rounded-[16px] border border-neutral-200 bg-white p-3.5 sm:p-4">
            <legend className="sr-only">Panel B finish</legend>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-medium text-[#0f1422]">Panel B</p>
                <p className="text-xs text-black/50">Right side</p>
              </div>
              <span className="max-w-[65%] truncate rounded-full bg-[#edf8f1] px-3 py-1.5 text-xs font-medium text-[#106b34]">
                {getVariantLabel(rightVariant)}
              </span>
            </div>
            <div className="grid max-h-88 grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2" role="group" aria-label="Panel B finish options">
              {comparisonVariations.map((variation) => (
                <ComparisonPanelCard
                  key={variation.key}
                  title={variation.title}
                  label={variation.label}
                  imageSrc={imageForFinish(variation.key)}
                  preview={comparisonOverlays.length > 0 ? (
                    variantDataComplete ? (
                      <ProductVariantScene
                        alphaMasks={EMPTY_ALPHA_MASKS}
                        backgroundImage={beforeImage}
                        layerImageUrls={getVariantPreviewLayerImageUrls("right", variation.key)}
                        overlays={comparisonOverlays}
                        selectedOverlayId={selectedComparisonOverlayId}
                        selectionFeedback="none"
                      />
                    ) : undefined
                  ) : undefined}
                  swatchClassName={variation.swatchClassName}
                  previewHex={variation.previewHex}
                  isSelected={rightVariant === variation.key}
                  isDisabled={(!variantDataComplete && variationSnapshots.length === 0) || leftVariant === variation.key}
                  disabledLabel="Selected in Panel A"
                  onClick={() => handleRightVariantChange(variation.key)}
                />
              ))}
            </div>
          </fieldset>
          </div>
        </section>
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
