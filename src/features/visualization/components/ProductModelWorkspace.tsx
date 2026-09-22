"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  motion,
  AnimatePresence,
  useDragControls,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { ChevronDown, RotateCw, FlipHorizontal, RotateCcw, Trash2, MousePointer2, Maximize, Move } from "lucide-react";
import Button from "@/components/shared/Button";
import { AddProductModal } from "./AddProductModal";
import { ManualOcclusionPointPicker } from "./ManualOcclusionPointPicker";
import { PerspectivePlanePicker } from "./PerspectivePlanePicker";
import { useNavbarVisibility } from "@/components/shared/NavbarVisibilityContext";
import type { CatalogProduct } from "@/lib/products/types";
import type { SpaceImageSession, LightingAnalysis } from "@/lib/imageApi";
import { ProductModelRenderer } from "@/lib/visualization/modelRenderer";
import {
  GlassAppearanceMode,
  GlassColorKey,
  GlassThicknessMm,
  GlassTypeKey,
  ProductConfigurationSeed,
  ProductConfigurationSnapshot,
  ProductStructuralDefinition,
  ProductVariationSnapshot,
  PlacedOverlay,
  QuadrilateralCorners,
  ManualOcclusionPolygon,
} from "@/lib/visualization/types";
import {
  homographyToCssMatrix3d,
  denormalizeCorners,
  drawPerspectiveWarpedImage,
  estimateDimensionsFromCorners,
  scaleCornersAlongAxis,
} from "@/lib/visualization/perspectiveTransform";
import {
  applyNoiseToCanvas,
  GRAIN_FILTER_SVG_ID,
} from "@/lib/visualization/noiseGenerator";
import { applyContactOcclusionAndReveals } from "@/lib/visualization/contactShadow";
import {
  getAluminumVariationMetadata,
  getVariationFinishes,
  normalizeAluminumFinish,
  type AluminumFinishKey,
} from "@/lib/visualization/colorVariations";
import {
  DEFAULT_SCENE_ZOOM,
  createDuplicateConfiguration,
  getPlacedLayerImageUrls,
  getOverlaySizeFromConfiguration,
  preserveActivePlacedLayer,
} from "@/lib/visualization/multiProductPresentation";
import {
  validateEngineeringGuardrails,
  type EngineeringValidationResult,
} from "@/lib/visualization/guardrailEngine";
import {
  computeEstimatedDimensions,
  sampleDepthAtPoint,
  getScaleAwareInitialDimensions,
  computePhotoGroundedCm,
} from "@/lib/visualization/scaleEstimation";
import {
  calculateBOMFromStructuralDefinition,
  calculateOverlayPricing,
} from "@/lib/pricing/pricingEngine";
import { StructuralGuardrailModal } from "./StructuralGuardrailModal";
import { MeasurementConfirmationModal } from "./MeasurementConfirmationModal";
import {
  buildMeasurementEntries,
  applyMeasurementOverridesToOverlays,
  convertInToCm,
} from "@/lib/visualization/measurementConfirmation";
import type { MeasurementConfirmationEntry } from "@/lib/visualization/types";
import {
  ALUMINUM_FINISH_OPTIONS,
  GLASS_COLOR_OPTIONS,
  GLASS_THICKNESS_OPTIONS,
  getAvailableFinishOptions,
  getAvailableGlassTypeOptions,
  isRrdSupportedProductType,
  mapGlassTypeToAppearanceMode,
} from "@/lib/products/materialMapping";
import {
  deriveGlassTypeFromAppearance,
  hydrateProductVariationConfiguration,
  normalizeGlassColor,
  normalizeGlassThickness,
  normalizeGlassType,
} from "@/lib/visualization/configurationPropagation";
import type { ProductMaterialCapabilities } from "@/lib/visualization/materialClassifier";

export type ProjectedModelBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

interface ProductModelWorkspaceProps {
  uploadedImage: string | null;
  spaceImageSession?: SpaceImageSession | null;
  structuralDefinition?: ProductStructuralDefinition | null;
  catalogProducts?: CatalogProduct[];
  currentProductId?: string;
  selectedProductName?: string;
  initialSnapshotDataUrl?: string | null;
  initialConfiguration?: ProductConfigurationSnapshot | null;
  initialProductConfiguration?: ProductConfigurationSeed | null;
  placedOverlays?: PlacedOverlay[];
  onConfigurationChange?: (configuration: ProductConfigurationSnapshot) => void;
  onVariationSnapshotsChange?: (snapshots: ProductVariationSnapshot[]) => void;
  onSnapshotChange?: (dataUrl: string) => void;
  onPlacedOverlaysChange?: (overlays: PlacedOverlay[]) => void;
  onComparisonOverlaysChange?: (overlays: PlacedOverlay[]) => void;
  onProductSelect?: (
    productId: string,
    mode: "add" | "change" | "edit",
    newPlacedOverlay?: PlacedOverlay,
    configuration?: ProductConfigurationSnapshot,
    targetOverlayId?: string,
  ) => void;
  onBack: () => void;
}

interface OcclusionItem {
  id: string;
  label: string;
  confidence: string;
  active: boolean;
}

type ResizeMode = "scale" | "width" | "height";

type ResizeSession = {
  mode: ResizeMode;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startWidthCm: number;
  startHeightCm: number;
  startZoomLevel: number;
  signX: number;
  signY: number;
  aspectRatio: number;
};

type RotationSession = {
  centerX: number;
  centerY: number;
  startPointerAngle: number;
  startRotation: number;
};

const MIN_OVERLAY_WIDTH = 120;
const MIN_OVERLAY_HEIGHT = 90;
const MAX_OVERLAY_WIDTH = 1800;
const MAX_OVERLAY_HEIGHT = 1400;
const MIN_SCENE_ZOOM = -55;
const MAX_SCENE_ZOOM = 150;
const DEFAULT_PRODUCT_WIDTH_CM = 210;
const DEFAULT_PRODUCT_HEIGHT_CM = 150;
const DEFAULT_OVERLAY_WIDTH_PX = 540;
const DEFAULT_OVERLAY_HEIGHT_PX = 385;
const MAX_MODEL_RENDER_SIDE = 2048;
const MIN_MODEL_RENDER_SIDE = 512;
const MODEL_CONTROLS_PADDING_PX = 8;

export function ProductModelWorkspace({
  uploadedImage,
  spaceImageSession,
  structuralDefinition,
  catalogProducts = [],
  currentProductId,
  selectedProductName,
  initialSnapshotDataUrl: _initialSnapshotDataUrl,
  initialConfiguration,
  initialProductConfiguration,
  placedOverlays = [],
  onConfigurationChange,
  onVariationSnapshotsChange,
  onSnapshotChange,
  onPlacedOverlaysChange,
  onComparisonOverlaysChange,
  onProductSelect,
  onBack,
}: ProductModelWorkspaceProps) {
  const seedConfiguration = initialConfiguration ? null : initialProductConfiguration;
  const hydratedVariation = hydrateProductVariationConfiguration(
    initialConfiguration,
    seedConfiguration,
  );
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const overlayBoxRef = useRef<HTMLDivElement>(null);
  const outlineControlsRef = useRef<HTMLDivElement>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const rotationSessionRef = useRef<RotationSession | null>(null);
  const appliedTemplateDefaultsRef = useRef<string | null>(
    initialConfiguration || (seedConfiguration?.widthCm && seedConfiguration.heightCm)
      ? structuralDefinition?.template.templateId ?? null
      : null,
  );
  const dragControls = useDragControls();
  const prefersReducedMotion = useReducedMotion();
  const [zoomLevel, setZoomLevel] = useState(
    initialConfiguration?.zoomLevel ?? DEFAULT_SCENE_ZOOM,
  );
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);

  // Accordion State Values
  const [ambientLight, setAmbientLight] = useState(
    initialConfiguration?.ambientLight ?? true,
  );
  const [autoShadow, setAutoShadow] = useState(
    initialConfiguration?.autoShadow ?? true,
  );
  const [autoRealism, setAutoRealism] = useState(
    initialConfiguration?.autoRealism ?? true,
  );
  const [yaw, setYaw] = useState(initialConfiguration?.yaw ?? 0);
  const [pitch, setPitch] = useState(initialConfiguration?.pitch ?? 0);
  const [alumFinish, setAlumFinish] = useState(
    hydratedVariation.aluminumFinish,
  );
  const [glassAppearance, setGlassAppearance] = useState<GlassAppearanceMode>(
    hydratedVariation.glassAppearance,
  );
  const [glassType, setGlassType] = useState<GlassTypeKey | undefined>(hydratedVariation.glassType);
  const [glassColor, setGlassColor] = useState<GlassColorKey>(
    hydratedVariation.glassColor,
  );
  const [glassThicknessMm, setGlassThicknessMm] = useState<GlassThicknessMm>(
    hydratedVariation.glassThicknessMm,
  );
  const [includeSill, setIncludeSill] = useState(
    initialConfiguration?.includeSill ?? true,
  );
  const [panelCount, setPanelCount] = useState<number>(
    initialConfiguration?.panelCount ?? 2,
  );
  const [structuralWaiver, setStructuralWaiver] = useState<boolean>(
    initialConfiguration?.structuralWaiver ?? false,
  );
  const [isGuardrailModalOpen, setIsGuardrailModalOpen] = useState<boolean>(false);
  const [guardrailValidation, setGuardrailValidation] = useState<EngineeringValidationResult | null>(null);
  const [isMeasurementModalOpen, setIsMeasurementModalOpen] = useState(false);
  const [measurementEntries, setMeasurementEntries] = useState<MeasurementConfirmationEntry[]>([]);
  const pendingComparisonOverlaysRef = useRef<PlacedOverlay[]>([]);
  const [widthCm, setWidthCm] = useState(() => {
    const hydratedWidth = hydratedVariation.widthCm;
    if (hydratedWidth) {
      return String(hydratedWidth);
    }
    const photoWidthPx = spaceImageSession?.workspaceImage?.width ?? 0;
    const photoHeightPx = spaceImageSession?.workspaceImage?.height ?? 0;
    const initialDims = getScaleAwareInitialDimensions(
      spaceImageSession?.scaleEstimation ?? null,
      DEFAULT_PRODUCT_WIDTH_CM,
      DEFAULT_PRODUCT_HEIGHT_CM,
      DEFAULT_OVERLAY_WIDTH_PX,
      DEFAULT_OVERLAY_HEIGHT_PX,
      photoWidthPx || 636,
      photoHeightPx || 579,
      photoWidthPx,
      photoHeightPx,
    );
    return String(initialDims.widthCm);
  });
  const [heightCm, setHeightCm] = useState(() => {
    const hydratedHeight = hydratedVariation.heightCm;
    if (hydratedHeight) {
      return String(hydratedHeight);
    }
    const photoWidthPx = spaceImageSession?.workspaceImage?.width ?? 0;
    const photoHeightPx = spaceImageSession?.workspaceImage?.height ?? 0;
    const initialDims = getScaleAwareInitialDimensions(
      spaceImageSession?.scaleEstimation ?? null,
      DEFAULT_PRODUCT_WIDTH_CM,
      DEFAULT_PRODUCT_HEIGHT_CM,
      DEFAULT_OVERLAY_WIDTH_PX,
      DEFAULT_OVERLAY_HEIGHT_PX,
      photoWidthPx || 636,
      photoHeightPx || 579,
      photoWidthPx,
      photoHeightPx,
    );
    return String(initialDims.heightCm);
  });
  const [thicknessMm, setThicknessMm] = useState(
    initialConfiguration?.thicknessMm
      ? String(initialConfiguration.thicknessMm)
      : "3",
  );
  const [quantity, setQuantity] = useState(hydratedVariation.quantity);
  const [activeOcclusionIds, setActiveOcclusionIds] = useState<string[]>(
    initialConfiguration?.activeOcclusionIds ?? [],
  );
  const [manualMaskDataUrl, setManualMaskDataUrl] = useState<string | null>(
    initialConfiguration?.manualOcclusionMaskDataUrl ?? null,
  );
  const [manualOcclusionPolygons, setManualOcclusionPolygons] = useState<
    ManualOcclusionPolygon[]
  >(initialConfiguration?.manualOcclusionPolygons ?? []);
  const [showOcclusionPointPicker, setShowOcclusionPointPicker] = useState(false);
  const [perspectiveCorners, setPerspectiveCorners] = useState<QuadrilateralCorners | null>(
    initialConfiguration?.perspectiveFitCorners ?? null,
  );
  const [showPerspectivePicker, setShowPerspectivePicker] = useState(false);
  const { setNavbarHidden } = useNavbarVisibility();

  useEffect(() => {
    setNavbarHidden(
      showPerspectivePicker ||
      showOcclusionPointPicker ||
      isMeasurementModalOpen ||
      isGuardrailModalOpen,
    );
    return () => setNavbarHidden(false);
  }, [
    showPerspectivePicker,
    showOcclusionPointPicker,
    isMeasurementModalOpen,
    isGuardrailModalOpen,
    setNavbarHidden,
  ]);

  const [selectedProduct, setSelectedProduct] = useState(
    Boolean(currentProductId || structuralDefinition),
  );
  const [productInstanceRevision, setProductInstanceRevision] = useState(0);
  const [activeOverlayId, setActiveOverlayId] = useState(
    `active-${currentProductId ?? "product"}`,
  );
  const initialLayerState = useMemo(() => {
    let maxNum = 0;
    const used = new Set<number>();
    for (let i = 0; i < placedOverlays.length; i += 1) {
      const ov = placedOverlays[i];
      let num = ov.layerNumber;
      if (!num || used.has(num)) {
        let next = 1;
        while (used.has(next)) next += 1;
        num = next;
      }
      used.add(num);
      if (num > maxNum) {
        maxNum = num;
      }
    }
    return {
      activeNum: maxNum + 1,
      nextNum: maxNum + 2,
    };
  }, [placedOverlays]); // Initial calculation
  const [activeLayerNumber, setActiveLayerNumber] = useState(initialLayerState.activeNum);
  const nextLayerNumberRef = useRef(initialLayerState.nextNum);
  const [activeFocusPulse, setActiveFocusPulse] = useState(false);
  const [overlayPosition, setOverlayPosition] = useState({
    x: initialConfiguration?.positionX ?? 0,
    y: initialConfiguration?.positionY ?? 0,
  });
  const overlayX = useMotionValue(overlayPosition.x);
  const overlayY = useMotionValue(overlayPosition.y);
  const [rotateAngle, setRotateAngle] = useState(
    initialConfiguration?.rotateAngle ?? 0,
  );
  const [isFlipped, setIsFlipped] = useState(
    initialConfiguration?.isFlipped ?? false,
  );

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);

  const [modalTitle, setModalTitle] = useState("Add Product");
  const [productBuildError, setProductBuildError] = useState<string | null>(null);
  const initialOverlaySize = useMemo(() => {
    const wStr = initialConfiguration?.widthCm
      ? String(initialConfiguration.widthCm)
      : widthCm;
    const hStr = initialConfiguration?.heightCm
      ? String(initialConfiguration.heightCm)
      : heightCm;
    const baseSize = getOverlaySizeFromDimensions(wStr, hStr);
    const zoom = initialConfiguration?.zoomLevel ?? DEFAULT_SCENE_ZOOM;
    const scale = 1 + zoom / 100;
    return {
      width: Math.round(baseSize.width * scale),
      height: Math.round(baseSize.height * scale),
    };
  }, [
    initialConfiguration?.heightCm,
    initialConfiguration?.widthCm,
    initialConfiguration?.zoomLevel,
    widthCm,
    heightCm,
  ]);
  const [overlaySize, setOverlaySize] = useState(initialOverlaySize);
  const renderFrameSize = useMemo(
    () => getModelRenderFrameSize(overlaySize),
    [overlaySize],
  );
  const renderFrameSizeRef = useRef(renderFrameSize);
  // We simulate a static 100% bounding box for the MVP engine
  const [projectedModelBounds, setProjectedModelBounds] =
    useState<ProjectedModelBounds | null>({ left: 0, top: 0, width: 1, height: 1 });
  const [modelRevision, setModelRevision] = useState(0);
  const [materialCapabilities, setMaterialCapabilities] = useState<ProductMaterialCapabilities | null>(null);

  const mvpCanvasRef = useRef<HTMLCanvasElement>(null);
  const mvpRendererRef = useRef<ProductModelRenderer | null>(null);
  const [isUsingTransformHandle, setIsUsingTransformHandle] = useState(false);
  const [isOutlineMeasurementPaused, setIsOutlineMeasurementPaused] = useState(false);
  const [isSnapshotApplied, setIsSnapshotApplied] = useState(false);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);

  useEffect(() => {
    overlayX.set(overlayPosition.x);
    overlayY.set(overlayPosition.y);
  }, [overlayPosition.x, overlayPosition.y, overlayX, overlayY]);

  const bgImage = uploadedImage || "/comparison_assets/room_without_furniture.png";
  const productOverlayImage =
    structuralDefinition?.product.catalogImageUrl || "/images/modular_cabinets.png";
  const overlayName = selectedProductName ?? "Selected Product";
  const aspectWidth = spaceImageSession?.workspaceImage?.width ?? 636;
  const aspectHeight = spaceImageSession?.workspaceImage?.height ?? 579;
  const workspaceAspectRatio = `${aspectWidth} / ${aspectHeight}`;
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({
    width: aspectWidth,
    height: aspectHeight,
  });

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasDisplaySize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [aspectWidth, aspectHeight]);

  const perspectiveToolbarPosition = useMemo(() => {
    if (!perspectiveCorners) return null;
    const currentWidth = canvasDisplaySize.width;
    const currentHeight = canvasDisplaySize.height;
    const pxCorners = denormalizeCorners(
      perspectiveCorners,
      currentWidth,
      currentHeight,
    );
    const minX = Math.min(...pxCorners.map((p) => p.x));
    const maxX = Math.max(...pxCorners.map((p) => p.x));
    const minY = Math.min(...pxCorners.map((p) => p.y));
    return {
      left: Math.max(160, Math.min(currentWidth - 160, (minX + maxX) / 2)),
      top: Math.max(12, minY - 48),
    };
  }, [perspectiveCorners, canvasDisplaySize.width, canvasDisplaySize.height]);

  const perspectiveHandlePoints = useMemo(() => {
    if (!perspectiveCorners) return null;
    const currentW = canvasDisplaySize.width;
    const currentH = canvasDisplaySize.height;
    if (currentW <= 0 || currentH <= 0) return null;

    const pxCorners = denormalizeCorners(perspectiveCorners, currentW, currentH);
    const [p0, p1, p2, p3] = pxCorners;

    return {
      corners: [
        { id: "tl", x: p0.x, y: p0.y, cursor: "cursor-nwse-resize", signX: -1, signY: -1 },
        { id: "tr", x: p1.x, y: p1.y, cursor: "cursor-nesw-resize", signX: 1, signY: -1 },
        { id: "br", x: p2.x, y: p2.y, cursor: "cursor-nwse-resize", signX: 1, signY: 1 },
        { id: "bl", x: p3.x, y: p3.y, cursor: "cursor-nesw-resize", signX: -1, signY: 1 },
      ],
      edges: [
        { id: "top", x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, mode: "height" as const, signX: 0, signY: -1, cursor: "cursor-ns-resize" },
        { id: "bottom", x: (p3.x + p2.x) / 2, y: (p3.y + p2.y) / 2, mode: "height" as const, signX: 0, signY: 1, cursor: "cursor-ns-resize" },
        { id: "left", x: (p0.x + p3.x) / 2, y: (p0.y + p3.y) / 2, mode: "width" as const, signX: -1, signY: 0, cursor: "cursor-ew-resize" },
        { id: "right", x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, mode: "width" as const, signX: 1, signY: 0, cursor: "cursor-ew-resize" },
      ],
      center: {
        x: (p0.x + p1.x + p2.x + p3.x) / 4,
        y: (p0.y + p1.y + p2.y + p3.y) / 4,
      },
    };
  }, [perspectiveCorners, canvasDisplaySize.width, canvasDisplaySize.height]);

  const effectiveLighting = (autoRealism && ambientLight) ? spaceImageSession?.lighting : null;
  const isWindowProduct =
    structuralDefinition?.product.productType === "Window" ||
    Boolean(
      structuralDefinition?.components.some(
        (component) => component.componentKey.replace(/_/g, "-") === "window-sill",
      ),
    );
  const isDoorProduct =
    structuralDefinition?.product.productType === "Door" ||
    (structuralDefinition?.product.productType || "").toLowerCase().includes("door") ||
    (structuralDefinition?.product.productName || "").toLowerCase().includes("door") ||
    (selectedProductName || "").toLowerCase().includes("door") ||
    Boolean(
      structuralDefinition?.components.some((component) =>
        component.componentKey.replace(/_/g, "-").includes("door"),
      ),
    );
  const structuralProductType = structuralDefinition?.product.productType ?? "";
  const supportedProductType = isRrdSupportedProductType(structuralProductType)
    ? structuralProductType
    : null;
  const workspaceFinishOptions = supportedProductType
    ? getAvailableFinishOptions(supportedProductType)
    : ALUMINUM_FINISH_OPTIONS.filter((option) =>
        option.id === "white" || option.id === "al_1009" || option.id === "al_1001",
      );
  const workspaceGlassTypeOptions = supportedProductType
    ? getAvailableGlassTypeOptions(supportedProductType)
    : [];
  const glassControlsDisabled = materialCapabilities?.hasGlass === false;

  const handleGlassTypeChange = useCallback((nextType: GlassTypeKey) => {
    setGlassType(nextType);
    setGlassAppearance(mapGlassTypeToAppearanceMode(nextType));
  }, []);

  const handleAdvancedGlassAppearanceChange = useCallback(
    (appearance: "opaque" | "outdoor") => {
      setGlassType(undefined);
      setGlassAppearance(appearance);
    },
    [],
  );
  const supportsPerspectivePlane = isWindowProduct || isDoorProduct;
  const modelEffectStyle = useMemo(
    () => getModelEffectStyle({
      autoRealism,
      autoShadow,
      lighting: spaceImageSession?.lighting,
    }),
    [autoRealism, autoShadow, spaceImageSession?.lighting],
  );

  // The cyan selection-guide drop-shadows are UI-only and must NOT appear in
  // the exported snapshot: same as the MVP's "output" renderMode skipping the
  // guide layer. We strip them by rebuilding the filter without the guide shadows.
  const exportModelFilter = useMemo(
    () => getExportModelFilter({
      autoRealism,
      autoShadow,
      lighting: spaceImageSession?.lighting,
    }),
    [autoRealism, autoShadow, spaceImageSession?.lighting],
  );

  const occlusions = useMemo<OcclusionItem[]>(
    () =>
      (spaceImageSession?.objects || []).map((object) => ({
        id: object.id,
        label: object.label,
        confidence: `${Math.round(object.confidence * 100)}%`,
        active: activeOcclusionIds.includes(object.id),
      })),
    [activeOcclusionIds, spaceImageSession],
  );
  const activeOcclusionObjects = useMemo(
    () =>
      (spaceImageSession?.objects || []).filter((object) =>
        activeOcclusionIds.includes(object.id),
      ),
    [activeOcclusionIds, spaceImageSession?.objects],
  );

  // Real-time Parametric BOM Pricing Calculation
  const realtimePricing = useMemo(() => {
    const widthValCm = Number(widthCm) || DEFAULT_PRODUCT_WIDTH_CM;
    const heightValCm = Number(heightCm) || DEFAULT_PRODUCT_HEIGHT_CM;
    const thicknessValMm = Number(thicknessMm) || 3;
    const widthMm = Math.round(widthValCm * 10);
    const heightMm = Math.round(heightValCm * 10);
    const finishType = alumFinish === "white" ? "PowderCoatedWhite" : "Analok";
    const glassType = thicknessValMm >= 6 && glassAppearance === "clear"
      ? "6mm_clear"
      : "6mm_bronze";

    if (structuralDefinition) {
      const bomCalc = calculateBOMFromStructuralDefinition(structuralDefinition, {
        widthMm,
        heightMm,
        panelCount,
        hasSill: includeSill,
        finishType,
        glassType,
        structuralWaiver,
      });

      const unitPrice = bomCalc.finalQuotation > 0
        ? bomCalc.finalQuotation
        : (structuralDefinition.product.basePrice ?? 0);

      const totalPrice = unitPrice * Math.max(1, quantity);

      return {
        unitPrice,
        totalPrice,
        bomCalc,
      };
    }

    return {
      unitPrice: 0,
      totalPrice: 0,
      bomCalc: null,
    };
  }, [
    structuralDefinition,
    widthCm,
    heightCm,
    thicknessMm,
    quantity,
    alumFinish,
    glassAppearance,
    includeSill,
    panelCount,
    structuralWaiver,
  ]);

  const formattedPrice = useMemo(() => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    })
      .format(realtimePricing.totalPrice)
      .replace("PHP", "Php");
  }, [realtimePricing.totalPrice]);

  const formattedUnitPrice = useMemo(() => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    })
      .format(realtimePricing.unitPrice)
      .replace("PHP", "Php");
  }, [realtimePricing.unitPrice]);

  // Filter out any overlay that matches the activeOverlayId to avoid double-counting active product
  const nonActivePlacedOverlays = useMemo(() => {
    return placedOverlays.filter((overlay) => overlay.overlayId !== activeOverlayId);
  }, [placedOverlays, activeOverlayId]);

  // Total price of all placed overlays currently on the canvas
  const placedOverlaysTotalPrice = useMemo(() => {
    return nonActivePlacedOverlays.reduce((sum, overlay) => {
      if (overlay.totalPrice !== undefined && !Number.isNaN(overlay.totalPrice)) {
        return sum + overlay.totalPrice;
      }
      return sum + calculateOverlayPricing(overlay).totalPrice;
    }, 0);
  }, [nonActivePlacedOverlays]);

  // Combined total price across all products present in the space
  const totalScenePrice = useMemo(() => {
    const activePrice = selectedProduct ? realtimePricing.totalPrice : 0;
    return placedOverlaysTotalPrice + activePrice;
  }, [placedOverlaysTotalPrice, selectedProduct, realtimePricing.totalPrice]);

  const totalSceneProductCount = useMemo(() => {
    return nonActivePlacedOverlays.length + (selectedProduct ? 1 : 0);
  }, [nonActivePlacedOverlays.length, selectedProduct]);

  // Unified, stable layer list for the Layers panel (never shuffles when switching active layer)
  const sceneLayers = useMemo(() => {
    const layers: {
      id: string;
      name: string;
      layerNumber: number;
      isActive: boolean;
      overlay?: PlacedOverlay;
    }[] = [];

    const usedNumbers = new Set<number>();
    if (selectedProduct) {
      usedNumbers.add(activeLayerNumber);
      layers.push({
        id: activeOverlayId,
        name: overlayName,
        layerNumber: activeLayerNumber,
        isActive: true,
      });
    }

    let nextAvailable = 1;
    const getNextAvailable = () => {
      while (usedNumbers.has(nextAvailable)) {
        nextAvailable += 1;
      }
      usedNumbers.add(nextAvailable);
      return nextAvailable;
    };

    for (let i = 0; i < nonActivePlacedOverlays.length; i += 1) {
      const ov = nonActivePlacedOverlays[i];
      let assignedNum = ov.layerNumber;
      if (!assignedNum || usedNumbers.has(assignedNum)) {
        assignedNum = getNextAvailable();
      } else {
        usedNumbers.add(assignedNum);
      }

      layers.push({
        id: ov.overlayId,
        name: ov.productName,
        layerNumber: assignedNum,
        isActive: false,
        overlay: ov,
      });
    }

    // Stably sort by layerNumber ascending so the layer pills never shuffle
    layers.sort((a, b) => a.layerNumber - b.layerNumber);
    return layers;
  }, [selectedProduct, activeOverlayId, overlayName, activeLayerNumber, nonActivePlacedOverlays]);

  // Dynamic price card presentation: single product while editing, sum of all products when applied
  const displayPriceData = useMemo(() => {
    const isApplied = isSnapshotApplied;
    const isMultiProduct = totalSceneProductCount > 1;

    if (isApplied) {
      const formattedTotal = new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
      })
        .format(totalScenePrice)
        .replace("PHP", "Php");

      return {
        title: isMultiProduct
          ? `Total Price (${totalSceneProductCount} products):`
          : "Total Price:",
        formattedPrice: formattedTotal,
        badgeText: isMultiProduct
          ? `${totalSceneProductCount} Products on Canvas`
          : quantity > 1
            ? `Qty: ${quantity}`
            : null,
        subtext: isMultiProduct
          ? "Combined sum of all products present on canvas"
          : "Applied to canvas. Click 'Edit' to adjust.",
        isOverall: true,
      };
    }

    return {
      title: "Price:",
      formattedPrice: formattedPrice,
      badgeText: quantity > 1 ? `Qty: ${quantity}` : null,
      subtext: quantity > 1 ? `${formattedUnitPrice} each` : "excl. install, final after consultation, etc",
      isOverall: false,
    };
  }, [
    isSnapshotApplied,
    totalSceneProductCount,
    totalScenePrice,
    formattedPrice,
    formattedUnitPrice,
    quantity,
  ]);

  // Removed unused structuralProductModels variable
  useEffect(() => {
    mvpRendererRef.current = new ProductModelRenderer(2048, 2048);
    return () => {
      mvpRendererRef.current?.dispose();
      mvpRendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    renderFrameSizeRef.current = renderFrameSize;
  }, [renderFrameSize]);

  useEffect(() => {
    if (!mvpRendererRef.current || !structuralDefinition) return;
    setMaterialCapabilities(null);
    mvpRendererRef.current.setSize(
      renderFrameSizeRef.current.width,
      renderFrameSizeRef.current.height,
    );

    mvpRendererRef.current.loadModel(
      structuralDefinition,
      {
        width: Number(widthCm) * 10,
        height: Number(heightCm) * 10,
        pane_count: panelCount,
        includeSill,
        include_sill: includeSill,
      },
      {
        aluminumFinish: alumFinish,
        glassAppearance,
        glassColor,
        glassThicknessMm,
        includeSill,
      },
    ).then((result) => {
      if (!result) return;
      setMaterialCapabilities(result.capabilities);
      // Preserve the last measured outline while resize interactions pause measurement.
      // The revision redraw measures the rebuilt model as soon as measurement resumes.
      setModelRevision((prev) => prev + 1);
      setProductBuildError(null);
    });
  }, [structuralDefinition, widthCm, heightCm, panelCount, includeSill, glassAppearance, glassColor, glassThicknessMm, alumFinish]);

  useEffect(() => {
    if (!mvpRendererRef.current) return;
    mvpRendererRef.current.applyLighting(effectiveLighting ?? null);
  }, [effectiveLighting]);

  const handleCanvasMount = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      (mvpCanvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = canvas;
      if (canvas && mvpRendererRef.current && structuralDefinition) {
        const isPlanar = Boolean(perspectiveCorners);
        const sourceCanvas = mvpRendererRef.current.render(yaw, pitch, isPlanar);
        if (sourceCanvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(
              sourceCanvas,
              0,
              0,
              sourceCanvas.width,
              sourceCanvas.height,
              0,
              0,
              canvas.width,
              canvas.height,
            );

            // Measure visible bounds directly from clean 2D canvas before noise/shadows
            if (!isOutlineMeasurementPaused && !perspectiveCorners) {
              const computedBounds = getVisibleModelBounds(canvas);
              if (computedBounds) {
                setProjectedModelBounds(computedBounds);
              }
            }

            if (isPlanar && autoRealism && autoShadow && effectiveLighting) {
              applyContactOcclusionAndReveals(ctx, canvas.width, canvas.height, {
                lightDirection: effectiveLighting.light_direction,
                shadowOpacity: effectiveLighting.suggested?.shadow_opacity ?? 0.28,
              });
            }
            if (autoRealism && effectiveLighting?.suggested?.grain) {
              applyNoiseToCanvas(ctx, canvas.width, canvas.height, effectiveLighting.suggested.grain);
            }
          }
        }
      }
    },
    [yaw, pitch, structuralDefinition, perspectiveCorners, autoRealism, autoShadow, effectiveLighting, isOutlineMeasurementPaused],
  );

  useLayoutEffect(() => {
    if (!mvpRendererRef.current || !mvpCanvasRef.current || !structuralDefinition) return;

    mvpRendererRef.current.setSize(renderFrameSize.width, renderFrameSize.height);

    const isPlanar = Boolean(perspectiveCorners);
    const sourceCanvas = mvpRendererRef.current.render(yaw, pitch, isPlanar);
    if (!sourceCanvas) return;

    const targetCanvas = mvpCanvasRef.current;
    const ctx = targetCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.drawImage(
      sourceCanvas,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
      0,
      0,
      targetCanvas.width,
      targetCanvas.height
    );

    // Measure visible bounds directly from clean 2D canvas before noise/shadows
    if (!isOutlineMeasurementPaused && !perspectiveCorners) {
      const computedBounds = getVisibleModelBounds(targetCanvas);
      if (computedBounds) {
        setProjectedModelBounds(computedBounds);
      }
    }

    if (isPlanar && autoRealism && autoShadow && effectiveLighting) {
      applyContactOcclusionAndReveals(ctx, targetCanvas.width, targetCanvas.height, {
        lightDirection: effectiveLighting.light_direction,
        shadowOpacity: effectiveLighting.suggested?.shadow_opacity ?? 0.28,
      });
    }

    if (autoRealism && effectiveLighting?.suggested?.grain) {
      applyNoiseToCanvas(ctx, targetCanvas.width, targetCanvas.height, effectiveLighting.suggested.grain);
    }
  }, [
    yaw,
    pitch,
    structuralDefinition,
    widthCm,
    heightCm,
    includeSill,
    glassAppearance,
    alumFinish,
    effectiveLighting,
    autoRealism,
    autoShadow,
    modelRevision,
    renderFrameSize,
    isOutlineMeasurementPaused,
    selectedProduct,
    perspectiveCorners,
  ]);

  const outlineControlsStyle = useMemo(
    () => getOutlineControlsStyle(structuralDefinition ? projectedModelBounds : null),
    [projectedModelBounds, structuralDefinition],
  );
  const toolbarControlsStyle = useMemo(
    () => getToolbarControlsStyle(structuralDefinition ? projectedModelBounds : null),
    [projectedModelBounds, structuralDefinition],
  );
  const isEditingProduct = !isSnapshotApplied;

  useEffect(() => {
    if (!structuralDefinition) {
      return;
    }

    const templateId = structuralDefinition.template.templateId;
    if (appliedTemplateDefaultsRef.current === templateId) {
      return;
    }

    const defaultWFallback = isDoorProduct ? 900 : 2100;
    const defaultHFallback = isDoorProduct ? 2100 : 1500;
    const nextWidthCm = String(
      Math.round(getStructuralDefaultMm(structuralDefinition, "width", defaultWFallback) / 10),
    );
    const nextHeightCm = String(
      Math.round(getStructuralDefaultMm(structuralDefinition, "height", defaultHFallback) / 10),
    );

    setWidthCm(nextWidthCm);
    setHeightCm(nextHeightCm);
    setOverlaySize(getOverlaySizeFromDimensions(nextWidthCm, nextHeightCm));
    appliedTemplateDefaultsRef.current = templateId;
  }, [structuralDefinition, isDoorProduct]);

  const currentConfiguration = useMemo<ProductConfigurationSnapshot>(() => {
    const width = Number(widthCm) || DEFAULT_PRODUCT_WIDTH_CM;
    const height = Number(heightCm) || DEFAULT_PRODUCT_HEIGHT_CM;
    const thickness = Number(thicknessMm) || 3;

    return {
      widthCm: width,
      heightCm: height,
      thicknessMm: thickness,
      quantity,
      panelCount,
      structuralWaiver,
      aluminumFinish: alumFinish,
      glassAppearance,
      glassColor,
      glassThicknessMm,
      ...(glassType ? { glassType } : {}),
      includeSill,
      yaw,
      pitch,
      rotateAngle,
      isFlipped,
      zoomLevel,
      activeOcclusionIds,
      manualOcclusionMaskDataUrl: manualMaskDataUrl,
      manualOcclusionPolygons,
      perspectiveFitCorners: perspectiveCorners,
      ambientLight,
      autoShadow,
      autoRealism,
      positionX: overlayPosition.x,
      positionY: overlayPosition.y,
      visualParameterValues: {
        width: width * 10,
        height: height * 10,
        thickness: thickness,
        pane_count: panelCount,
        includeSill,
        include_sill: includeSill,
      },
    };
  }, [
    activeOcclusionIds,
    manualMaskDataUrl,
    manualOcclusionPolygons,
    perspectiveCorners,
    alumFinish,
    ambientLight,
    autoRealism,
    autoShadow,
    glassAppearance,
    glassColor,
    glassThicknessMm,
    glassType,
    heightCm,
    includeSill,
    isFlipped,
    overlayPosition.x,
    overlayPosition.y,
    panelCount,
    pitch,
    quantity,
    rotateAngle,
    structuralWaiver,
    thicknessMm,
    widthCm,
    yaw,
    zoomLevel,
  ]);

  useEffect(() => {
    if (!structuralDefinition || !onConfigurationChange) {
      return;
    }

    onConfigurationChange(currentConfiguration);
  }, [currentConfiguration, onConfigurationChange, structuralDefinition]);

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotateAngle((prev) => prev + 90);
  };

  const handleFlip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFlipped((prev) => !prev);
  };

  const resetProductPlacement = useCallback(() => {
    const baseSize = getOverlaySizeFromDimensions(widthCm, heightCm);
    const defaultScale = 1 + DEFAULT_SCENE_ZOOM / 100;

    resizeSessionRef.current = null;
    rotationSessionRef.current = null;
    setIsUsingTransformHandle(false);
    setIsOutlineMeasurementPaused(false);
    setRotateAngle(0);
    setIsFlipped(false);
    setYaw(0);
    setPitch(0);
    setOverlayPosition({ x: 0, y: 0 });
    overlayX.set(0);
    overlayY.set(0);
    setPerspectiveCorners(null);
    setZoomLevel(DEFAULT_SCENE_ZOOM);
    setOverlaySize({
      width: Math.round(baseSize.width * defaultScale),
      height: Math.round(baseSize.height * defaultScale),
    });
    setProjectedModelBounds({ left: 0, top: 0, width: 1, height: 1 });
    setProductInstanceRevision((current) => current + 1);
  }, [heightCm, overlayX, overlayY, widthCm]);

  const applyProductConfiguration = useCallback(
    (configuration: ProductConfigurationSnapshot) => {
      const nextWidth = String(configuration.widthCm);
      const nextHeight = String(configuration.heightCm);
      const baseSize = getOverlaySizeFromDimensions(nextWidth, nextHeight);
      const nextZoom = configuration.zoomLevel ?? DEFAULT_SCENE_ZOOM;
      const scale = 1 + nextZoom / 100;
      const posX = configuration.positionX ?? 0;
      const posY = configuration.positionY ?? 0;

      setWidthCm(nextWidth);
      setHeightCm(nextHeight);
      setThicknessMm(String(configuration.thicknessMm));
      setQuantity(configuration.quantity);
      setPanelCount(configuration.panelCount ?? 2);
      setStructuralWaiver(configuration.structuralWaiver ?? false);
      setAlumFinish(normalizeAluminumFinish(configuration.aluminumFinish));
      setGlassAppearance(configuration.glassAppearance);
      setGlassType(
        normalizeGlassType(configuration.glassType)
          ?? deriveGlassTypeFromAppearance(configuration.glassAppearance),
      );
      setGlassColor(normalizeGlassColor(configuration.glassColor));
      setGlassThicknessMm(normalizeGlassThickness(configuration.glassThicknessMm));
      setIncludeSill(configuration.includeSill);
      setYaw(configuration.yaw);
      setPitch(configuration.pitch);
      setRotateAngle(configuration.rotateAngle);
      setIsFlipped(configuration.isFlipped);
      setZoomLevel(nextZoom);
      setActiveOcclusionIds(configuration.activeOcclusionIds ?? []);
      setManualMaskDataUrl(configuration.manualOcclusionMaskDataUrl ?? null);
      setManualOcclusionPolygons(configuration.manualOcclusionPolygons ?? []);
      setPerspectiveCorners(configuration.perspectiveFitCorners ?? null);
      setAmbientLight(configuration.ambientLight ?? true);
      setAutoShadow(configuration.autoShadow ?? true);
      setAutoRealism(configuration.autoRealism ?? true);
      setOverlayPosition({
        x: posX,
        y: posY,
      });
      overlayX.set(posX);
      overlayY.set(posY);
      setOverlaySize({
        width: Math.round(baseSize.width * scale),
        height: Math.round(baseSize.height * scale),
      });
      setSelectedProduct(true);
      setIsSnapshotApplied(false);
      setProductInstanceRevision((current) => current + 1);
    },
    [overlayX, overlayY],
  );

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    resetProductPlacement();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProduct(false);
  };

  const handleOpenAddModal = (title: string) => {
    setModalTitle(title);
    setIsAddModalOpen(true);
  };

  const handleSelectProduct = async (product: CatalogProduct) => {
    const mode = modalTitle === "Add Product" ? "add" : "change";

    if (product.id === currentProductId && !selectedProduct) {
      resetProductPlacement();
      setSelectedProduct(true);
      setIsSnapshotApplied(false);
      return;
    }

    if (
      !onProductSelect ||
      (product.id === currentProductId && mode === "change")
    ) {
      return;
    }

    let newlyPlacedOverlay: PlacedOverlay | undefined;
    if (mode === "add" && selectedProduct) {
      try {
        newlyPlacedOverlay = await createPlacedOverlay(activeLayerNumber);
        onPlacedOverlaysChange?.([...placedOverlays, newlyPlacedOverlay]);
      } catch (err) {
        console.error("Failed to place active product before adding:", err);
      }
    }

    const nextActiveOverlayId = `active-${product.id}-${crypto.randomUUID()}`;
    setActiveOverlayId(nextActiveOverlayId);

    if (mode === "add") {
      let maxNum = activeLayerNumber;
      for (const ov of placedOverlays) {
        if (ov.layerNumber && ov.layerNumber > maxNum) {
          maxNum = ov.layerNumber;
        }
      }
      const nextNum = maxNum + 1;
      nextLayerNumberRef.current = nextNum + 1;
      setActiveLayerNumber(nextNum);
    }

    if (product.id === currentProductId) {
      applyProductConfiguration(createDuplicateConfiguration(currentConfiguration));
    }

    setSelectedProduct(true);
    setIsSnapshotApplied(false);
    onProductSelect(product.id, mode, newlyPlacedOverlay);
  };

  const captureCurrentSnapshot = useCallback(async () => {
    const snapshot = await captureWorkspaceSnapshot({
      canvasElement: canvasRef.current,
      overlayElement: overlayBoxRef.current,
      backgroundImageUrl: bgImage,
      fallbackProductImageUrl: productOverlayImage,
      hasGeneratedProduct: Boolean(structuralDefinition),
      activeOcclusionObjects,
      manualMaskDataUrl,
      perspectiveCorners,
      rotateAngle,
      isFlipped,
      // Use the export filter - stripped of selection-guide outlines.
      modelFilter: exportModelFilter,
      structuralDefinition: structuralDefinition ?? null,
      yaw,
      pitch,
      lighting: effectiveLighting ?? null,
      glassAppearance,
      includeSill,
      widthCm: Number(widthCm),
      heightCm: Number(heightCm),
      placedLayerImageUrls: placedOverlays.map(
        (overlay) => overlay.flattenedImageDataUrl,
      ),
    });

    onSnapshotChange?.(snapshot);
    return snapshot;
  }, [
    activeOcclusionObjects,
    manualMaskDataUrl,
    perspectiveCorners,
    bgImage,
    exportModelFilter,
    isFlipped,
    onSnapshotChange,
    placedOverlays,
    productOverlayImage,
    rotateAngle,
    structuralDefinition,
    yaw,
    pitch,
    effectiveLighting,
    glassAppearance,
    includeSill,
    widthCm,
    heightCm,
  ]);

  const captureCurrentProductLayer = useCallback(
    () =>
      captureWorkspaceSnapshot({
        canvasElement: canvasRef.current,
        overlayElement: overlayBoxRef.current,
        backgroundImageUrl: null,
        fallbackProductImageUrl: productOverlayImage,
        hasGeneratedProduct: Boolean(structuralDefinition),
        activeOcclusionObjects: [],
        perspectiveCorners,
        rotateAngle,
        isFlipped,
        modelFilter: exportModelFilter,
        structuralDefinition: structuralDefinition ?? null,
        yaw,
        pitch,
        lighting: effectiveLighting ?? null,
        glassAppearance,
        includeSill,
        widthCm: Number(widthCm),
        heightCm: Number(heightCm),
      }),
    [
      effectiveLighting,
      exportModelFilter,
      glassAppearance,
      heightCm,
      includeSill,
      isFlipped,
      perspectiveCorners,
      pitch,
      productOverlayImage,
      rotateAngle,
      structuralDefinition,
      widthCm,
      yaw,
    ],
  );

  const captureCurrentProductVariationLayers = useCallback(async () => {
    const variationImageDataUrls: Partial<Record<AluminumFinishKey, string>> = {};
    const variations = getVariationFinishes(alumFinish).map(getAluminumVariationMetadata);

    if (!structuralDefinition) {
      const fallbackLayer = await captureCurrentProductLayer();
      if (!fallbackLayer) {
        throw new Error(
          "Unable to capture the product variations. Try Edit Placement and prepare the comparison again.",
        );
      }
      for (const variation of variations) {
        variationImageDataUrls[variation.key] = fallbackLayer;
      }
      return variationImageDataUrls;
    }

    const width = Number(widthCm) || DEFAULT_PRODUCT_WIDTH_CM;
    const height = Number(heightCm) || DEFAULT_PRODUCT_HEIGHT_CM;

    for (const variation of variations) {
      const renderer = new ProductModelRenderer(
        renderFrameSize.width,
        renderFrameSize.height,
      );

      try {
        const cameraFraming = mvpRendererRef.current?.getCameraFraming();
        if (cameraFraming !== null && cameraFraming !== undefined) {
          renderer.setCameraFraming(cameraFraming);
        }
        renderer.setSize(renderFrameSize.width, renderFrameSize.height);
        renderer.applyLighting(effectiveLighting ?? null);
        await renderer.loadModel(
          structuralDefinition,
          {
            width: width * 10,
            height: height * 10,
            pane_count: panelCount,
            includeSill,
            include_sill: includeSill,
          },
          {
            aluminumFinish: variation.key,
            glassAppearance,
            glassColor,
            glassThicknessMm,
            includeSill,
          },
        );

        const isPlanar = Boolean(perspectiveCorners);
        const renderedCanvas = renderer.render(yaw, pitch, isPlanar);
        if (!renderedCanvas) {
          throw new Error(
            `Unable to capture the ${variation.title} product variation. Try Edit Placement and prepare the comparison again.`,
          );
        }

        variationImageDataUrls[variation.key] = await captureWorkspaceSnapshot({
          canvasElement: canvasRef.current,
          overlayElement: overlayBoxRef.current,
          backgroundImageUrl: null,
          fallbackProductImageUrl: productOverlayImage,
          hasGeneratedProduct: true,
          activeOcclusionObjects: [],
          perspectiveCorners,
          rotateAngle,
          isFlipped,
          modelFilter: exportModelFilter,
          generatedCanvasOverride: cloneCanvas(renderedCanvas, {
            autoRealism,
            autoShadow,
            lighting: effectiveLighting,
          }),
          structuralDefinition,
          yaw,
          pitch,
          lighting: effectiveLighting ?? null,
          glassAppearance,
          includeSill,
          widthCm: width,
          heightCm: height,
        });
      } finally {
        renderer.dispose();
      }
    }

    const missingVariation = variations.find(
      (variation) => !variationImageDataUrls[variation.key],
    );
    if (missingVariation) {
      throw new Error(
        `Unable to capture the ${missingVariation.title} product variation. Try Edit Placement and prepare the comparison again.`,
      );
    }

    return variationImageDataUrls;
  }, [
    autoRealism,
    autoShadow,
    captureCurrentProductLayer,
    effectiveLighting,
    exportModelFilter,
    alumFinish,
    glassAppearance,
    glassColor,
    glassThicknessMm,
    heightCm,
    includeSill,
    isFlipped,
    panelCount,
    perspectiveCorners,
    pitch,
    productOverlayImage,
    renderFrameSize,
    rotateAngle,
    structuralDefinition,
    widthCm,
    yaw,
  ]);

  const createPlacedOverlay = useCallback(
    async (explicitLayerNumber?: number): Promise<PlacedOverlay> => {
      const overlayElement = overlayBoxRef.current;
      const overlayBounds = overlayElement?.getBoundingClientRect();
      const sourceOverlayWidth =
        overlayElement?.offsetWidth || overlayBounds?.width || overlaySize.width;
      const sourceOverlayHeight =
        overlayElement?.offsetHeight || overlayBounds?.height || overlaySize.height;
      const visibleModelBounds = projectedModelBounds
        ? { ...projectedModelBounds }
        : (mvpCanvasRef.current ? getVisibleModelBounds(mvpCanvasRef.current) ?? undefined : undefined);
      const activeImageDataUrl = await captureCurrentProductLayer();
      const currentFinish = normalizeAluminumFinish(
        currentConfiguration.aluminumFinish,
      );
      const variationLayers = await captureCurrentProductVariationLayers();
      const variationImageDataUrls: Partial<Record<AluminumFinishKey, string>> = {
        ...variationLayers,
        [currentFinish]: activeImageDataUrl,
      };
      const placedLayer = preserveActivePlacedLayer({
        activeImageDataUrl,
        currentFinish,
        variationImageDataUrls,
      });

      const uniqueOverlayId = crypto.randomUUID();
      const posX = overlayX.get();
      const posY = overlayY.get();
      const prodId = currentProductId ?? structuralDefinition?.product.productId ?? "";
      const glbUrl =
        structuralDefinition?.product.preview_glb_url ??
        structuralDefinition?.assets?.find(
          (a) =>
            (a.assetType === "Catalog 3D Preview" || a.assetType === "Whole Model") &&
            a.status === "Active" &&
            Boolean(a.url),
        )?.url ??
        catalogProducts.find((p) => p.id === prodId)?.previewGlbUrl ??
        null;

      return {
        overlayId: uniqueOverlayId,
        productId: prodId,
        productName: overlayName,
        layerNumber: explicitLayerNumber ?? activeLayerNumber,
        templateId: structuralDefinition?.template.templateId ?? "catalog-image",
        configuration: {
          ...currentConfiguration,
          positionX: posX,
          positionY: posY,
        },
        ...placedLayer,
        sourceCanvasWidth: canvasRef.current?.getBoundingClientRect().width,
        sourceCanvasHeight: canvasRef.current?.getBoundingClientRect().height,
        sourceOverlayWidth,
        sourceOverlayHeight,
        visibleModelBounds,
        bomResult: realtimePricing.bomCalc ?? undefined,
        unitPrice: realtimePricing.unitPrice,
        totalPrice: realtimePricing.totalPrice,
        previewGlbUrl: glbUrl,
      };
    },
    [
      activeLayerNumber,
      captureCurrentProductLayer,
      captureCurrentProductVariationLayers,
      catalogProducts,
      currentConfiguration,
      currentProductId,
      overlayName,
      overlaySize.height,
      overlaySize.width,
      overlayX,
      overlayY,
      projectedModelBounds,
      realtimePricing,
      structuralDefinition,
    ],
  );

  const handleEditPlacedOverlay = useCallback(
    async (overlay: PlacedOverlay) => {
      const targetIndex = placedOverlays.findIndex(
        (placedOverlay) => placedOverlay.overlayId === overlay.overlayId,
      );

      const targetLayerNumber =
        overlay.layerNumber ?? (targetIndex >= 0 ? targetIndex + 1 : 1);
      const currentActiveNum = activeLayerNumber;

      let newlyPlaced: PlacedOverlay | undefined;
      let nextOverlays: PlacedOverlay[];

      if (selectedProduct) {
        try {
          newlyPlaced = await createPlacedOverlay(currentActiveNum);
        } catch (err) {
          console.error("Failed to place active product before editing layer:", err);
        }
      }

      if (newlyPlaced) {
        newlyPlaced.layerNumber = currentActiveNum;
        nextOverlays = [...placedOverlays];
        if (targetIndex >= 0) {
          nextOverlays[targetIndex] = newlyPlaced;
        } else {
          nextOverlays.push(newlyPlaced);
        }
      } else {
        nextOverlays = placedOverlays.filter(
          (placedOverlay) => placedOverlay.overlayId !== overlay.overlayId,
        );
      }

      onPlacedOverlaysChange?.(nextOverlays);
      setActiveOverlayId(overlay.overlayId);
      setActiveLayerNumber(targetLayerNumber);
      setIsSnapshotApplied(false);
      applyProductConfiguration(overlay.configuration);

      if (overlay.productId !== currentProductId) {
        onProductSelect?.(
          overlay.productId,
          "edit",
          newlyPlaced,
          overlay.configuration,
          overlay.overlayId,
        );
      }
    },
    [
      activeLayerNumber,
      applyProductConfiguration,
      createPlacedOverlay,
      currentProductId,
      onPlacedOverlaysChange,
      onProductSelect,
      placedOverlays,
      selectedProduct,
    ],
  );

  const handleDeletePlacedOverlay = useCallback((overlayId: string) => {
    onPlacedOverlaysChange?.(
      placedOverlays.filter((overlay) => overlay.overlayId !== overlayId),
    );
  }, [onPlacedOverlaysChange, placedOverlays]);

  const applyVisualizationSnapshot = useCallback(async () => {
    setIsCapturingSnapshot(true);
    setIsSnapshotApplied(true);

    try {
      await captureCurrentSnapshot();
      setProductBuildError(null);
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to generate the visualization snapshot.";
      setProductBuildError(message);
      return false;
    } finally {
      setIsCapturingSnapshot(false);
    }
  }, [captureCurrentSnapshot]);

  const handleApplySnapshotClick = useCallback(async () => {
    if (isSnapshotApplied) {
      setIsSnapshotApplied(false);
      return;
    }

    await applyVisualizationSnapshot();
  }, [applyVisualizationSnapshot, isSnapshotApplied]);

  const handleSaveSnapshot = useCallback(async () => {
    setIsCapturingSnapshot(true);

    try {
      const dataUrl = await captureCurrentSnapshot();

      if (dataUrl) {
        // Trigger a browser file download with the snapshot data URL.
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `glassfit-visualization-${Date.now()}.jpg`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to generate the visualization snapshot.";
      setProductBuildError(message);
    } finally {
      setIsCapturingSnapshot(false);
    }
  }, [captureCurrentSnapshot]);

  const generateVariationSnapshots = useCallback(async () => {
    if (!structuralDefinition) {
      onVariationSnapshotsChange?.([]);
      return [];
    }

    const snapshots: ProductVariationSnapshot[] = [];
    const width = Number(widthCm) || DEFAULT_PRODUCT_WIDTH_CM;
    const height = Number(heightCm) || DEFAULT_PRODUCT_HEIGHT_CM;

    const variations = getVariationFinishes(alumFinish).map(getAluminumVariationMetadata);
    for (const variation of variations) {
      const renderer = new ProductModelRenderer(
        renderFrameSize.width,
        renderFrameSize.height,
      );

      try {
        const cameraFraming = mvpRendererRef.current?.getCameraFraming();
        if (cameraFraming !== null && cameraFraming !== undefined) {
          renderer.setCameraFraming(cameraFraming);
        }
        renderer.setSize(renderFrameSize.width, renderFrameSize.height);
        renderer.applyLighting(effectiveLighting ?? null);
        await renderer.loadModel(
          structuralDefinition,
          {
            width: width * 10,
            height: height * 10,
            pane_count: panelCount,
            includeSill,
            include_sill: includeSill,
          },
          {
            aluminumFinish: variation.key,
            glassAppearance,
            glassColor,
            glassThicknessMm,
            includeSill,
          },
        );

        const isPlanar = Boolean(perspectiveCorners);
        const renderedCanvas = renderer.render(yaw, pitch, isPlanar);
        if (!renderedCanvas) {
          continue;
        }

        const generatedCanvasOverride = cloneCanvas(renderedCanvas, {
          autoRealism,
          autoShadow,
          lighting: effectiveLighting,
        });
        const imageDataUrl = await captureWorkspaceSnapshot({
          canvasElement: canvasRef.current,
          overlayElement: overlayBoxRef.current,
          backgroundImageUrl: bgImage,
          fallbackProductImageUrl: productOverlayImage,
          hasGeneratedProduct: true,
          activeOcclusionObjects,
          manualMaskDataUrl,
          perspectiveCorners,
          rotateAngle,
          isFlipped,
          modelFilter: exportModelFilter,
          generatedCanvasOverride,
          structuralDefinition,
          yaw,
          pitch,
          lighting: effectiveLighting ?? null,
          glassAppearance,
          includeSill,
          widthCm: width,
          heightCm: height,
          placedLayerImageUrls: getPlacedLayerImageUrls(
            placedOverlays,
            variation.key,
          ),
        });

        snapshots.push({
          key: variation.key,
          title: variation.title,
          label: variation.label,
          swatchClassName: variation.swatchClassName,
          previewHex: variation.previewHex,
          imageDataUrl,
        });
      } finally {
        renderer.dispose();
      }
    }

    onVariationSnapshotsChange?.(snapshots);
    return snapshots;
  }, [
    activeOcclusionObjects,
    autoRealism,
    autoShadow,
    manualMaskDataUrl,
    perspectiveCorners,
    bgImage,
    effectiveLighting,
    exportModelFilter,
    alumFinish,
    glassAppearance,
    glassColor,
    glassThicknessMm,
    heightCm,
    includeSill,
    isFlipped,
    onVariationSnapshotsChange,
    placedOverlays,
    panelCount,
    pitch,
    productOverlayImage,
    renderFrameSize,
    rotateAngle,
    structuralDefinition,
    widthCm,
    yaw,
  ]);

  const handleContinueToComparison = useCallback(async () => {
    setIsCapturingSnapshot(true);

    try {
      await captureCurrentSnapshot();
      setIsSnapshotApplied(true);
      if (!selectedProduct && placedOverlays.length === 0) {
        await generateVariationSnapshots();
      }
      const comparisonOverlays = selectedProduct
        ? [
          ...placedOverlays,
          { ...(await createPlacedOverlay()), isActive: true },
        ]
        : placedOverlays;

      // Stash complete overlay set with variationImageDataUrls and flattenedImageDataUrl
      pendingComparisonOverlaysRef.current = comparisonOverlays;

      const entries = buildMeasurementEntries(
        comparisonOverlays,
        structuralDefinition ?? null,
        widthCm,
        heightCm,
        realtimePricing.totalPrice,
        catalogProducts,
        currentConfiguration,
      );

      setMeasurementEntries(entries);
      setIsMeasurementModalOpen(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to prepare the visualization comparison.";
      setProductBuildError(message);
    } finally {
      setIsCapturingSnapshot(false);
    }
  }, [
    captureCurrentSnapshot,
    catalogProducts,
    createPlacedOverlay,
    currentConfiguration,
    generateVariationSnapshots,
    heightCm,
    placedOverlays,
    realtimePricing.totalPrice,
    selectedProduct,
    structuralDefinition,
    widthCm,
  ]);

  const handleMeasurementConfirmAll = useCallback(
    (confirmedEntries: MeasurementConfirmationEntry[]) => {
      setIsMeasurementModalOpen(false);

      const activeEntry = confirmedEntries.find((e) => e.isActiveProduct);
      if (activeEntry?.override.widthOverridden) {
        setWidthCm(String(convertInToCm(activeEntry.override.widthIn)));
      }
      if (activeEntry?.override.heightOverridden) {
        setHeightCm(String(convertInToCm(activeEntry.override.heightIn)));
      }

      const patchedOverlays = applyMeasurementOverridesToOverlays(
        confirmedEntries.filter((e) => !e.isActiveProduct),
        placedOverlays,
      );

      // Use pre-captured overlays that contain genuine variationImageDataUrls and flattenedImageDataUrl
      const baseOverlays = pendingComparisonOverlaysRef.current.length > 0
        ? pendingComparisonOverlaysRef.current
        : (selectedProduct ? [...placedOverlays] : placedOverlays);

      // Apply measurement overrides directly onto the intact overlays
      const patchedComparisonOverlays = applyMeasurementOverridesToOverlays(
        confirmedEntries,
        baseOverlays,
      );

      // Synchronize canonical placed overlays list
      const activeComparisonOverlay = patchedComparisonOverlays.find((o) => o.isActive);
      const completePlacedOverlays = activeComparisonOverlay
        ? [
            ...patchedOverlays.filter((o) => o.overlayId !== activeComparisonOverlay.overlayId),
            activeComparisonOverlay,
          ]
        : patchedOverlays;

      // Clear the pending ref
      pendingComparisonOverlaysRef.current = [];

      onPlacedOverlaysChange?.(completePlacedOverlays);
      onComparisonOverlaysChange?.(patchedComparisonOverlays);
      router.push("/comparison");
    },
    [
      onComparisonOverlaysChange,
      onPlacedOverlaysChange,
      placedOverlays,
      router,
      selectedProduct,
      setHeightCm,
      setWidthCm,
    ],
  );

  const handleMeasurementModalCancel = useCallback(() => {
    setIsMeasurementModalOpen(false);
    setIsSnapshotApplied(false);
    pendingComparisonOverlaysRef.current = [];
  }, []);

  const applySceneZoom = useCallback((nextZoomLevel: number) => {
    setZoomLevel((currentZoomLevel) => {
      const nextZoom = clampNumber(nextZoomLevel, MIN_SCENE_ZOOM, MAX_SCENE_ZOOM);
      const currentScale = 1 + currentZoomLevel / 100;
      const nextScale = 1 + nextZoom / 100;
      const scaleRatio = nextScale / Math.max(currentScale, 0.01);

      setOverlaySize((currentSize) => ({
        width: Math.round(
          clampNumber(currentSize.width * scaleRatio, MIN_OVERLAY_WIDTH, MAX_OVERLAY_WIDTH),
        ),
        height: Math.round(
          clampNumber(currentSize.height * scaleRatio, MIN_OVERLAY_HEIGHT, MAX_OVERLAY_HEIGHT),
        ),
      }));

      return nextZoom;
    });
  }, []);

  const handleZoomIn = () => {
    applySceneZoom(zoomLevel + 5);
  };

  const handleZoomOut = () => {
    applySceneZoom(zoomLevel - 5);
  };

  const checkAndTriggerGuardrails = useCallback(
    (widthValCm: number, heightValCm: number, currentPanelCount: number) => {
      const valMm = widthValCm * 10;
      const heightMm = heightValCm * 10;
      const validation = validateEngineeringGuardrails({
        widthMm: valMm,
        heightMm: heightMm,
        panelCount: currentPanelCount,
        glassThicknessMm: Number(thicknessMm) || 6,
      });

      setGuardrailValidation(validation);

      // Trigger prompt modal if 2-panel configuration reaches or exceeds 2400mm
      if (validation.isSpanLimitExceeded && currentPanelCount === 2) {
        setIsGuardrailModalOpen(true);
      }
    },
    [thicknessMm],
  );

  const handleWidthCmChange = (value: string) => {
    const prevW = Number(widthCm) || 120;
    setWidthCm(value);
    setOverlaySize(getOverlaySizeFromDimensions(value, heightCm));

    const numericWidth = Number(value);
    const numericHeight = Number(heightCm);
    if (!Number.isNaN(numericWidth) && numericWidth > 0) {
      checkAndTriggerGuardrails(numericWidth, numericHeight || DEFAULT_PRODUCT_HEIGHT_CM, panelCount);
    }

    if (perspectiveCorners && prevW > 0 && numericWidth > 0) {
      const ratio = numericWidth / prevW;
      setPerspectiveCorners((current) =>
        current ? scaleCornersAlongAxis(current, ratio, "width") : null
      );
    }
  };

  const handleHeightCmChange = (value: string) => {
    const prevH = Number(heightCm) || 120;
    setHeightCm(value);
    setOverlaySize(getOverlaySizeFromDimensions(widthCm, value));

    const numericWidth = Number(widthCm);
    const numericHeight = Number(value);
    if (!Number.isNaN(numericHeight) && numericHeight > 0) {
      checkAndTriggerGuardrails(numericWidth || DEFAULT_PRODUCT_WIDTH_CM, numericHeight, panelCount);
    }

    if (perspectiveCorners && prevH > 0 && numericHeight > 0) {
      const ratio = numericHeight / prevH;
      setPerspectiveCorners((current) =>
        current ? scaleCornersAlongAxis(current, ratio, "height") : null
      );
    }
  };

  const handleSwitchTo3Panels = useCallback(() => {
    setPanelCount(3);
    setStructuralWaiver(false);
    setIsGuardrailModalOpen(false);
  }, []);

  const handleAcknowledgeAndProceed = useCallback(() => {
    setPanelCount(2);
    setStructuralWaiver(true);
    setIsGuardrailModalOpen(false);
  }, []);

  const handleIncludeSillToggle = useCallback(() => {
    setIncludeSill((current) => !current);
  }, []);

  const toggleAccordion = (title: string) => {
    setOpenAccordions((prev) =>
      prev.includes(title)
        ? prev.filter((t) => t !== title)
        : [...prev, title]
    );
  };

  const toggleOcclusion = (id: string) => {
    setActiveOcclusionIds((prev) =>
      prev.includes(id)
        ? prev.filter((activeId) => activeId !== id)
        : [...prev, id]
    );
  };

  const applyOverlaySize = useCallback(
    (width: number, height: number, session: ResizeSession) => {
      const nextWidth = clampNumber(width, MIN_OVERLAY_WIDTH, MAX_OVERLAY_WIDTH);
      const nextHeight = clampNumber(height, MIN_OVERLAY_HEIGHT, MAX_OVERLAY_HEIGHT);

      setOverlaySize({ width: nextWidth, height: nextHeight });

      const scaleSignal = spaceImageSession?.scaleEstimation;
      const photoWidthPx = spaceImageSession?.workspaceImage?.width ?? 0;
      const photoHeightPx = spaceImageSession?.workspaceImage?.height ?? 0;
      const canvasWidthPx = canvasDisplaySize.width;
      const canvasHeightPx = canvasDisplaySize.height;

      const hasScale = Boolean(
        scaleSignal &&
        scaleSignal.best_scale_cm_per_px !== null &&
        scaleSignal.confidence >= 0.2 &&
        photoWidthPx > 0 &&
        photoHeightPx > 0,
      );

      if (session.mode === "scale" || session.mode === "width") {
        const widthRatio = nextWidth / Math.max(session.startWidth, 1);
        const proportionalWidthCm = Math.max(1, Math.round(session.startWidthCm * widthRatio));

        if (hasScale && scaleSignal && scaleSignal.best_scale_cm_per_px !== null) {
          const photoGrounded = computePhotoGroundedCm(
            nextWidth,
            nextHeight,
            canvasWidthPx,
            canvasHeightPx,
            photoWidthPx,
            photoHeightPx,
            scaleSignal.best_scale_cm_per_px,
          );
          const photoWeight = Math.min(scaleSignal.confidence * 0.4, 0.35);
          const blendedWidthCm = Math.max(
            1,
            Math.round((1 - photoWeight) * proportionalWidthCm + photoWeight * photoGrounded.widthCm),
          );
          setWidthCm(String(blendedWidthCm));
        } else {
          setWidthCm(String(proportionalWidthCm));
        }
      }

      if (session.mode === "scale" || session.mode === "height") {
        const heightRatio = nextHeight / Math.max(session.startHeight, 1);
        const proportionalHeightCm = Math.max(1, Math.round(session.startHeightCm * heightRatio));

        if (hasScale && scaleSignal && scaleSignal.best_scale_cm_per_px !== null) {
          const photoGrounded = computePhotoGroundedCm(
            nextWidth,
            nextHeight,
            canvasWidthPx,
            canvasHeightPx,
            photoWidthPx,
            photoHeightPx,
            scaleSignal.best_scale_cm_per_px,
          );
          const photoWeight = Math.min(scaleSignal.confidence * 0.4, 0.35);
          const blendedHeightCm = Math.max(
            1,
            Math.round((1 - photoWeight) * proportionalHeightCm + photoWeight * photoGrounded.heightCm),
          );
          setHeightCm(String(blendedHeightCm));
        } else {
          setHeightCm(String(proportionalHeightCm));
        }
      }
    },
    [spaceImageSession, canvasDisplaySize],
  );

  const startResize = useCallback(
    (
      event: React.PointerEvent,
      mode: ResizeMode,
      signX: number,
      signY: number,
    ) => {
      event.preventDefault();
      event.stopPropagation();

      const resizeSession: ResizeSession = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: overlaySize.width,
        startHeight: overlaySize.height,
        startWidthCm: Number(widthCm) || 1,
        startHeightCm: Number(heightCm) || 1,
        startZoomLevel: zoomLevel,
        signX,
        signY,
        aspectRatio: overlaySize.width / Math.max(overlaySize.height, 1),
      };
      resizeSessionRef.current = resizeSession;
      setIsUsingTransformHandle(true);
      setIsOutlineMeasurementPaused(mode !== "scale");

      const handleMove = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - resizeSession.startX) * resizeSession.signX;
        const dy = (moveEvent.clientY - resizeSession.startY) * resizeSession.signY;

        if (resizeSession.mode === "scale") {
          const dominantDelta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
          const startScale = 1 + resizeSession.startZoomLevel / 100;
          const nextScale = Math.max(
            1 + MIN_SCENE_ZOOM / 100,
            startScale * (1 + dominantDelta / Math.max(resizeSession.startWidth, 1)),
          );
          const scaleRatio = nextScale / Math.max(startScale, 0.01);
          setOverlaySize({
            width: Math.round(
              Math.max(
                MIN_OVERLAY_WIDTH,
                resizeSession.startWidth * scaleRatio,
              ),
            ),
            height: Math.round(
              Math.max(
                MIN_OVERLAY_HEIGHT,
                resizeSession.startHeight * scaleRatio,
              ),
            ),
          });
          setZoomLevel(Math.round((nextScale - 1) * 100));
          return;
        }

        if (resizeSession.mode === "width") {
          applyOverlaySize(
            resizeSession.startWidth + dx,
            resizeSession.startHeight,
            resizeSession,
          );
          return;
        }

        applyOverlaySize(
          resizeSession.startWidth,
          resizeSession.startHeight + dy,
          resizeSession,
        );
      };

      const handleEnd = () => {
        resizeSessionRef.current = null;
        setIsUsingTransformHandle(false);
        setIsOutlineMeasurementPaused(false);
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleEnd);
        window.removeEventListener("pointercancel", handleEnd);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleEnd);
      window.addEventListener("pointercancel", handleEnd);
    },
    [applyOverlaySize, heightCm, overlaySize, widthCm, zoomLevel],
  );

  const startOverlayDrag = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (isUsingTransformHandle) {
        return;
      }

      dragControls.start(event);
    },
    [dragControls, isUsingTransformHandle],
  );

  const startRotation = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const bounds =
        outlineControlsRef.current?.getBoundingClientRect() ??
        overlayBoxRef.current?.getBoundingClientRect();
      if (!bounds) {
        return;
      }

      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const rotationSession: RotationSession = {
        centerX,
        centerY,
        startPointerAngle: getPointerAngle(event.clientX, event.clientY, centerX, centerY),
        startRotation: rotateAngle,
      };
      rotationSessionRef.current = rotationSession;
      setIsUsingTransformHandle(true);

      const handleMove = (moveEvent: PointerEvent) => {
        const pointerAngle = getPointerAngle(
          moveEvent.clientX,
          moveEvent.clientY,
          rotationSession.centerX,
          rotationSession.centerY,
        );
        setRotateAngle(
          rotationSession.startRotation +
          pointerAngle -
          rotationSession.startPointerAngle,
        );
      };

      const handleEnd = () => {
        rotationSessionRef.current = null;
        setIsUsingTransformHandle(false);
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleEnd);
        window.removeEventListener("pointercancel", handleEnd);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleEnd);
      window.addEventListener("pointercancel", handleEnd);
    },
    [rotateAngle],
  );

  const startPerspectiveResize = useCallback(
    (
      event: React.PointerEvent,
      mode: "scale" | "width" | "height",
      signX: number,
      signY: number,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      if (!perspectiveCorners) return;

      const session = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startCorners: [...perspectiveCorners] as QuadrilateralCorners,
        startWidthCm: Number(widthCm) || 120,
        startHeightCm: Number(heightCm) || 120,
        signX,
        signY,
      };
      setIsUsingTransformHandle(true);

      const currentW = canvasRef.current?.clientWidth || canvasDisplaySize.width || 800;
      const currentH = canvasRef.current?.clientHeight || canvasDisplaySize.height || 600;

      const handleMove = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - session.startX) * session.signX;
        const dy = (moveEvent.clientY - session.startY) * session.signY;

        if (session.mode === "scale") {
          const dominantDelta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
          const initialSpan = currentW * 0.35;
          const scaleRatio = Math.max(0.15, 1 + dominantDelta / initialSpan);
          const nextCorners = scaleCornersAlongAxis(session.startCorners, scaleRatio, "scale");
          setPerspectiveCorners(nextCorners);
          const nextW = Math.max(20, Math.round(session.startWidthCm * scaleRatio));
          const nextH = Math.max(20, Math.round(session.startHeightCm * scaleRatio));
          setWidthCm(String(nextW));
          setHeightCm(String(nextH));
          setOverlaySize(getOverlaySizeFromDimensions(String(nextW), String(nextH)));
          return;
        }

        if (session.mode === "width") {
          const initialSpan = currentW * 0.30;
          const widthRatio = Math.max(0.15, 1 + dx / initialSpan);
          const nextCorners = scaleCornersAlongAxis(session.startCorners, widthRatio, "width");
          setPerspectiveCorners(nextCorners);
          const nextW = Math.max(20, Math.round(session.startWidthCm * widthRatio));
          setWidthCm(String(nextW));
          setOverlaySize(getOverlaySizeFromDimensions(String(nextW), heightCm));
          return;
        }

        if (session.mode === "height") {
          const initialSpan = currentH * 0.30;
          const heightRatio = Math.max(0.15, 1 + dy / initialSpan);
          const nextCorners = scaleCornersAlongAxis(session.startCorners, heightRatio, "height");
          setPerspectiveCorners(nextCorners);
          const nextH = Math.max(20, Math.round(session.startHeightCm * heightRatio));
          setHeightCm(String(nextH));
          setOverlaySize(getOverlaySizeFromDimensions(widthCm, String(nextH)));
          return;
        }
      };

      const handleEnd = () => {
        setIsUsingTransformHandle(false);
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleEnd);
        window.removeEventListener("pointercancel", handleEnd);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleEnd);
      window.addEventListener("pointercancel", handleEnd);
    },
    [perspectiveCorners, widthCm, heightCm, canvasDisplaySize.width, canvasDisplaySize.height],
  );

  const startPerspectiveMove = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!perspectiveCorners || isUsingTransformHandle) return;

      const session = {
        startX: event.clientX,
        startY: event.clientY,
        startCorners: [...perspectiveCorners] as QuadrilateralCorners,
      };
      setIsUsingTransformHandle(true);

      const currentW = canvasRef.current?.clientWidth || canvasDisplaySize.width || 800;
      const currentH = canvasRef.current?.clientHeight || canvasDisplaySize.height || 600;

      const handleMove = (moveEvent: PointerEvent) => {
        const normDx = (moveEvent.clientX - session.startX) / Math.max(currentW, 1);
        const normDy = (moveEvent.clientY - session.startY) / Math.max(currentH, 1);

        const nextCorners = session.startCorners.map((p) => ({
          x: clampNumber(p.x + normDx, -0.2, 1.2),
          y: clampNumber(p.y + normDy, -0.2, 1.2),
        })) as QuadrilateralCorners;

        setPerspectiveCorners(nextCorners);
      };

      const handleEnd = () => {
        setIsUsingTransformHandle(false);
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleEnd);
        window.removeEventListener("pointercancel", handleEnd);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleEnd);
      window.addEventListener("pointercancel", handleEnd);
    },
    [perspectiveCorners, isUsingTransformHandle, canvasDisplaySize.width, canvasDisplaySize.height],
  );

  return (
    <div className="w-full max-w-367 mx-auto px-4 sm:px-6">
      {/* ── Section Header ── */}
      <div className="flex flex-col gap-4 items-center justify-center text-center mb-10">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-black leading-tight">
          View <span className="text-green">Product Model</span>
        </h1>
        <p className="text-lg sm:text-2xl lg:text-[28px] font-normal text-black/90 tracking-tight leading-normal">
          Place {overlayName} over your prepared space image.
        </p>
      </div>

      {/* ── Top Toolbar Controls ── */}
      <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
        {/* Left: Undo, Redo, Zoom */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 justify-center md:justify-start">
          {/* Undo / Redo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="bg-[#0f1422] hover:bg-black text-white px-4 py-2 rounded-[10px] text-sm font-normal transition-colors cursor-pointer"
            >
              Undo
            </button>
            <button
              type="button"
              className="bg-white border border-[#c3c3c3] hover:bg-neutral-50 text-[#0f1422] px-4 py-2 rounded-[10px] text-sm font-normal transition-colors cursor-pointer"
            >
              Redo
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="bg-white border border-[#c3c3c3] flex items-center justify-center gap-3 px-4 py-2 rounded-[10px] select-none">
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Zoom out"
              className="p-1 hover:opacity-75 transition-opacity cursor-pointer"
            >
              <Image
                src="/visualization/minus-solid-full 1.svg"
                alt="Zoom out"
                width={12}
                height={12}
              />
            </button>
            <span className="text-[#0f1422] text-base font-medium min-w-10 text-center">
              {Math.round((1 + zoomLevel / 100) * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Zoom in"
              className="p-1 hover:opacity-75 transition-opacity cursor-pointer"
            >
              <Image
                src="/visualization/plus-solid-full 1.svg"
                alt="Zoom in"
                width={12}
                height={12}
              />
            </button>
          </div>
        </div>

        {/* Right: Change Product Banner */}
        <div className="bg-[#f5f5f5] flex flex-wrap items-center justify-center md:justify-end gap-4 px-4 py-2.5 rounded-[20px] shadow-xs relative">
          <span className="text-green text-lg sm:text-xl font-normal tracking-[-0.38px] whitespace-nowrap">
            Want to make changes?
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleOpenAddModal("Add Product")}
              className="bg-[#0f1422] hover:bg-black text-white px-4 py-2 rounded-[10px] text-sm font-normal transition-colors cursor-pointer whitespace-nowrap"
            >
              Add Product
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddModal("Change Product")}
              className="bg-green hover:bg-[#06a3bd] text-white px-4 py-2 rounded-[10px] text-sm font-normal transition-colors cursor-pointer whitespace-nowrap"
            >
              Change Product
            </button>
          </div>

          {/* Add / Change Product Anchored Popover */}
          <AddProductModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onSelectProduct={handleSelectProduct}
            products={catalogProducts}
            currentProductId={selectedProduct ? currentProductId : undefined}
            allowCurrentProduct={modalTitle === "Add Product"}
            title={modalTitle}
          />
        </div>
      </div>

      {placedOverlays.length > 0 && (
        <motion.section
          layout={!prefersReducedMotion}
          transition={{
            layout: {
              duration: 0.2,
              ease: [0.77, 0, 0.175, 1],
            },
          }}
          aria-label="Product layers"
          className="mb-6 rounded-[16px] border border-[#c3c3c3]/60 bg-white shadow-xs"
        >
          <button
            type="button"
            onClick={() => setIsLayersPanelOpen((current) => !current)}
            aria-expanded={isLayersPanelOpen}
            className="flex w-full items-center justify-between gap-4 p-4 text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="text-base font-medium text-[#0f1422]">
                Layers ({sceneLayers.length})
              </span>
              <span className="hidden text-xs text-neutral-500 sm:inline">
                Select products when they overlap
              </span>
            </div>
            <ChevronDown
              className="size-5 shrink-0 text-[#0f1422]"
              style={{
                transform: isLayersPanelOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: prefersReducedMotion
                  ? undefined
                  : "transform 200ms cubic-bezier(0.23, 1, 0.32, 1)",
              }}
            />
          </button>

          <AnimatePresence initial={false}>
            {isLayersPanelOpen && (
              <motion.div
                key="layers-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: {
                    duration: prefersReducedMotion ? 0 : 0.2,
                    ease: [0.23, 1, 0.32, 1],
                  },
                  opacity: {
                    duration: prefersReducedMotion ? 0.12 : 0.2,
                    ease: [0.23, 1, 0.32, 1],
                  },
                }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-4 pb-4 pt-3">
                  {sceneLayers.map((layer) => {
                    if (layer.isActive) {
                      return (
                        <div
                          key={layer.id}
                          className="flex items-center overflow-hidden rounded-full border border-[#07b6d3] bg-[#e9f9fb] ring-2 ring-[#07b6d3]/40 shadow-xs"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setIsSnapshotApplied(false);
                              setActiveFocusPulse(true);
                              setTimeout(() => setActiveFocusPulse(false), 1000);
                            }}
                            title="Currently active for 3D editing on canvas (click to focus)"
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#0f1422] hover:bg-[#d8f4f8] transition-colors cursor-pointer"
                          >
                            <span>{layer.name} {layer.layerNumber}</span>
                            <span className="rounded-full bg-[#07b6d3] px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider shadow-xs">
                              Active (Editing)
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleRemove(e)}
                            aria-label={`Remove active ${layer.name} ${layer.layerNumber}`}
                            title={`Remove ${layer.name} ${layer.layerNumber}`}
                            className="border-l border-[#07b6d3]/30 px-2 py-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={layer.id}
                        className="flex items-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-50 hover:border-[#07b6d3]/60 shadow-xs transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => void handleEditPlacedOverlay(layer.overlay!)}
                          title={`Click to select and edit ${layer.name} ${layer.layerNumber}`}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#0f1422] hover:bg-[#e9f9fb] transition-colors cursor-pointer"
                        >
                          <span>{layer.name} {layer.layerNumber}</span>
                          <span className="rounded bg-neutral-200/80 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                            Edit
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePlacedOverlay(layer.overlay!.overlayId)}
                          aria-label={`Remove ${layer.name} ${layer.layerNumber}`}
                          title={`Remove ${layer.name} ${layer.layerNumber}`}
                          className="border-l border-neutral-200 px-2 py-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      )}

      {/* ── Main Interactive Layout (Canvas + Sidebar) ── */}
      <div className="w-full flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
        {/* Left Side: Space Canvas + Instructions */}
        <div className="flex-1 min-w-0 flex flex-col gap-6 w-full lg:sticky lg:top-35 lg:self-start">
          {/* Main Space Canvas Card */}
          <div className="bg-white/10 border border-[#f5f5f5] p-3 sm:p-5 rounded-[20px] shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] relative w-full flex items-center justify-center overflow-hidden">
            <div
              ref={canvasRef}
              className="relative mx-auto rounded-[15px] overflow-hidden bg-neutral-100"
              style={{
                aspectRatio: workspaceAspectRatio,
                width: `min(100%, calc(55vh * ${aspectWidth} / ${aspectHeight}))`,
                maxWidth: "100%",
                maxHeight: "55vh",
              }}
            >
              {/* Background Space Image */}
              <img
                src={bgImage}
                alt="Space image background"
                draggable={false}
                className="w-full h-full object-cover select-none"
              />

              {nonActivePlacedOverlays.map((overlay) => {
                const layerNum = overlay.layerNumber ?? 1;

                // Scale factor between source canvas (at capture time) and current canvas display
                const sourceW = overlay.sourceCanvasWidth || canvasDisplaySize.width || 1;
                const sourceH = overlay.sourceCanvasHeight || canvasDisplaySize.height || 1;
                const scaleX = canvasDisplaySize.width / sourceW;
                const scaleY = canvasDisplaySize.height / sourceH;

                const overlayW = overlay.sourceOverlayWidth
                  ?? getOverlaySizeFromConfiguration(overlay.configuration).width;
                const overlayH = overlay.sourceOverlayHeight
                  ?? getOverlaySizeFromConfiguration(overlay.configuration).height;
                const bounds = overlay.visibleModelBounds
                  ?? { left: 0.08, top: 0.08, width: 0.84, height: 0.84 };

                return (
                  <React.Fragment key={overlay.overlayId}>
                    {/* Rendered 2D Product Layer Bitmap */}
                    {overlay.flattenedImageDataUrl ? (
                      <img
                        src={overlay.flattenedImageDataUrl}
                        alt={`Placed ${overlay.productName} ${layerNum}`}
                        draggable={false}
                        className="absolute inset-0 z-10 h-full w-full pointer-events-none select-none"
                      />
                    ) : null}

                    {/* Interactive Hit Target matching active product outline */}
                    {overlay.configuration.perspectiveFitCorners ? (
                      <div
                        className="absolute pointer-events-none z-[15]"
                        style={{
                          left: 0,
                          top: 0,
                          width: overlayW,
                          height: overlayH,
                          transformOrigin: "0 0",
                          transform: homographyToCssMatrix3d(
                            denormalizeCorners(
                              overlay.configuration.perspectiveFitCorners,
                              canvasDisplaySize.width,
                              canvasDisplaySize.height,
                            ),
                            overlayW,
                            overlayH,
                          ),
                          transformStyle: "preserve-3d",
                          WebkitTransformStyle: "preserve-3d",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => void handleEditPlacedOverlay(overlay)}
                          aria-label={`Edit placed ${overlay.productName} ${layerNum}`}
                          title={`Click to edit ${overlay.productName} ${layerNum}`}
                          className="pointer-events-auto absolute inset-0 rounded-[4px] border-2 border-dashed border-transparent bg-transparent cursor-pointer transition-all hover:border-[#07b6d3] hover:bg-[#07b6d3]/15 focus-visible:border-[#07b6d3] focus-visible:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 z-[15] flex items-center justify-center pointer-events-none">
                        <div
                          className="relative pointer-events-none"
                          style={{
                            width: overlayW * scaleX,
                            height: overlayH * scaleY,
                            transform: `translate(${(overlay.configuration.positionX ?? 0) * scaleX}px, ${(overlay.configuration.positionY ?? 0) * scaleY}px)`,
                          }}
                        >
                          <div
                            className="relative pointer-events-none"
                            style={{
                              width: "100%",
                              height: "100%",
                              transform: `rotate(${overlay.configuration.rotateAngle}deg)`,
                              transformOrigin: "center center",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => void handleEditPlacedOverlay(overlay)}
                              aria-label={`Edit placed ${overlay.productName} ${layerNum}`}
                              title={`Click to edit ${overlay.productName} ${layerNum}`}
                              className="pointer-events-auto absolute rounded-[4px] border-2 border-dashed border-transparent bg-transparent cursor-pointer transition-all hover:border-[#07b6d3] hover:bg-[#07b6d3]/15 focus-visible:border-[#07b6d3] focus-visible:outline-none"
                              style={{
                                left: `${bounds.left * 100}%`,
                                top: `${bounds.top * 100}%`,
                                width: `${bounds.width * 100}%`,
                                height: `${bounds.height * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

              {/* SVG Grain Filter Definition for Live DOM Viewport */}
              <svg className="absolute w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true">
                <defs>
                  <filter id={GRAIN_FILTER_SVG_ID} x="0%" y="0%" width="100%" height="100%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" result="noise" />
                    <feColorMatrix
                      type="matrix"
                      values={`0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 ${((effectiveLighting?.suggested?.grain ?? 0.05) * 1.5).toFixed(3)} 0`}
                      result="monoNoise"
                    />
                    <feBlend in="SourceGraphic" in2="monoNoise" mode="overlay" />
                  </filter>
                </defs>
              </svg>

              {/* Product Overlay Element on Canvas with Adjustment Tool */}
              {selectedProduct && (
                <div
                  data-visualization-layer="active-product"
                  className="absolute inset-0 pointer-events-none z-20"
                >
                  {perspectiveCorners ? (
                    <>
                      {/* Perspective-fitted overlay: uses matrix3d to warp into quadrilateral */}
                      <div
                        ref={overlayBoxRef}
                        onPointerDown={isEditingProduct ? startPerspectiveMove : undefined}
                        className={`absolute pointer-events-auto select-none transition-all ${
                          isEditingProduct ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                        } ${activeFocusPulse ? "ring-4 ring-[#07b6d3] ring-offset-2 animate-pulse rounded-[6px]" : ""}`}
                        style={{
                          left: 0,
                          top: 0,
                          width: overlaySize.width,
                          height: overlaySize.height,
                          transformOrigin: "0 0",
                          transform: homographyToCssMatrix3d(
                            denormalizeCorners(
                              perspectiveCorners,
                              canvasDisplaySize.width,
                              canvasDisplaySize.height,
                            ),
                            overlaySize.width,
                            overlaySize.height,
                          ),
                          transformStyle: "preserve-3d",
                          WebkitTransformStyle: "preserve-3d",
                          backfaceVisibility: "visible",
                          WebkitBackfaceVisibility: "visible",
                        }}
                      >
                        {/* Inner Product Image */}
                        <div className="w-full h-full overflow-visible select-none pointer-events-none">
                          {structuralDefinition ? (
                            <div
                              className="h-full w-full transition-transform duration-300"
                              style={{
                                transform: isFlipped ? "scaleX(-1)" : undefined,
                                ...modelEffectStyle,
                              }}
                            >
                              <canvas
                                ref={handleCanvasMount}
                                className="w-full h-full object-fill"
                                width={renderFrameSize.width}
                                height={renderFrameSize.height}
                              />
                            </div>
                          ) : (
                            <img
                              src={productOverlayImage}
                              alt="Selected Product Overlay"
                              draggable={false}
                              className="w-full h-full object-cover transition-transform duration-300 select-none pointer-events-none"
                              style={{
                                transform: isFlipped ? "scaleX(-1)" : undefined,
                                ...modelEffectStyle,
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <motion.div
                        key={productInstanceRevision}
                        drag={isEditingProduct && !isUsingTransformHandle}
                        dragControls={dragControls}
                        dragListener={false}
                        dragElastic={0}
                        dragMomentum={false}
                        onDragEnd={() => {
                          setOverlayPosition({
                            x: overlayX.get(),
                            y: overlayY.get(),
                          });
                        }}
                        className={[
                          "pointer-events-auto relative",
                          !isEditingProduct || isUsingTransformHandle
                            ? "cursor-default"
                            : "cursor-grab active:cursor-grabbing",
                        ].join(" ")}
                        style={{
                          width: overlaySize.width,
                          height: overlaySize.height,
                          x: overlayX,
                          y: overlayY,
                        }}
                      >
                        {/* Model render frame; controls sit on the measured model outline. */}
                        <div
                          ref={overlayBoxRef}
                          onPointerDown={isEditingProduct ? startOverlayDrag : undefined}
                          className={[
                            "relative group select-none transition-all",
                            isEditingProduct
                              ? "cursor-grab active:cursor-grabbing"
                              : "cursor-default",
                            activeFocusPulse ? "ring-4 ring-[#07b6d3] ring-offset-2 animate-pulse rounded-[8px]" : "",
                          ].join(" ")}
                          style={{
                            width: overlaySize.width,
                            height: overlaySize.height,
                            transform: `rotate(${rotateAngle}deg)`,
                            transformOrigin: "center center",
                          }}
                        >
                          {/* Inner Product Image */}
                          <div className="w-full h-full overflow-visible select-none pointer-events-none">
                            {structuralDefinition ? (
                              <div
                                className="h-full w-full transition-transform duration-300"
                                style={{
                                  transform: isFlipped ? "scaleX(-1)" : undefined,
                                  ...modelEffectStyle,
                                }}
                              >
                                <canvas
                                  ref={handleCanvasMount}
                                  className="w-full h-full object-fill"
                                  width={renderFrameSize.width}
                                  height={renderFrameSize.height}
                                />
                              </div>
                            ) : (
                              <img
                                src={productOverlayImage}
                                alt="Selected Product Overlay"
                                draggable={false}
                                className="w-full h-full object-cover transition-transform duration-300 select-none pointer-events-none"
                                style={{
                                  transform: isFlipped ? "scaleX(-1)" : undefined,
                                  ...modelEffectStyle,
                                }}
                              />
                            )}
                          </div>

                        </div>
                      </motion.div>
                    </div>
                  )}
                </div>
              )}
              {selectedProduct &&
                (activeOcclusionObjects.length > 0 || manualMaskDataUrl) && (
                  <div
                    data-visualization-layer="foreground-occlusion"
                    className="absolute inset-0 pointer-events-none z-30"
                  >
                    {activeOcclusionObjects.map((object) => (
                      <img
                        key={object.id}
                        src={bgImage}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full object-contain select-none"
                        style={{
                          WebkitMaskImage: `url(${object.mask_url})`,
                          maskImage: `url(${object.mask_url})`,
                          WebkitMaskPosition: "center",
                          maskPosition: "center",
                          WebkitMaskRepeat: "no-repeat",
                          maskRepeat: "no-repeat",
                          WebkitMaskSize: "100% 100%",
                          maskSize: "100% 100%",
                        }}
                      />
                    ))}
                    {manualMaskDataUrl && (
                      <img
                        src={bgImage}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full object-contain select-none"
                        style={{
                          WebkitMaskImage: `url(${manualMaskDataUrl})`,
                          maskImage: `url(${manualMaskDataUrl})`,
                          WebkitMaskPosition: "center",
                          maskPosition: "center",
                          WebkitMaskRepeat: "no-repeat",
                          maskRepeat: "no-repeat",
                          WebkitMaskSize: "100% 100%",
                          maskSize: "100% 100%",
                        }}
                      />
                    )}
                  </div>
                )}
              {selectedProduct && isEditingProduct && (
                <div
                  data-visualization-layer="product-controls"
                  className="absolute inset-0 z-40 pointer-events-none"
                >
                  {perspectiveCorners ? (
                    <>
                      {perspectiveToolbarPosition && (
                        <div
                          className="absolute flex items-center gap-2.5 select-none animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto"
                          style={{
                            left: perspectiveToolbarPosition.left,
                            top: perspectiveToolbarPosition.top,
                            transform: "translateX(-50%)",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setShowPerspectivePicker(true)}
                            className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                          >
                            <Maximize className="w-4 h-4 text-white" />
                            <span className="text-[13px] font-normal tracking-[-0.266px]">Edit Corners</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPerspectiveCorners(null);
                              setModelRevision((prev) => prev + 1);
                            }}
                            className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                          >
                            <Move className="w-4 h-4 text-white" />
                            <span className="text-[13px] font-normal tracking-[-0.266px]">Free Place</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleFlip}
                            className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                          >
                            <FlipHorizontal className="w-4 h-4 text-white" />
                            <span className="text-[13px] font-normal tracking-[-0.266px]">Flip</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleReset}
                            className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                          >
                            <RotateCcw className="w-4 h-4 text-white" />
                            <span className="text-[13px] font-normal tracking-[-0.266px]">Reset</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRemove}
                            className="bg-[#c50000] hover:bg-[#a30000] text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                            <span className="text-[13px] font-normal tracking-[-0.266px]">Remove</span>
                          </button>
                        </div>
                      )}

                      {/* 9 Perspective Quadrilateral Transform Handles (Picture 2 Parity) */}
                      {perspectiveHandlePoints && (
                        <>
                          {/* 4 Corner Scale Handles */}
                          {perspectiveHandlePoints.corners.map((c) => (
                            <div
                              key={c.id}
                              onPointerDown={(e) => startPerspectiveResize(e, "scale", c.signX, c.signY)}
                              className={`absolute size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 ${c.cursor} pointer-events-auto`}
                              style={{
                                left: c.x,
                                top: c.y,
                                transform: "translate(-50%, -50%)",
                              }}
                              title="Drag corner to scale"
                            />
                          ))}

                          {/* 4 Edge Midpoint Handles */}
                          {perspectiveHandlePoints.edges.map((e) => (
                            <div
                              key={e.id}
                              onPointerDown={(evt) => startPerspectiveResize(evt, e.mode, e.signX, e.signY)}
                              className={`absolute size-3 bg-[#07b6d3] rounded-full shadow-md z-20 ${e.cursor} pointer-events-auto`}
                              style={{
                                left: e.x,
                                top: e.y,
                                transform: "translate(-50%, -50%)",
                              }}
                              title={e.mode === "width" ? "Drag to resize width" : "Drag to resize length/height"}
                            />
                          ))}

                          {/* 1 Center Move Handle */}
                          <div
                            onPointerDown={startPerspectiveMove}
                            className="absolute size-6 rounded-full bg-[#07b6d3] flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing z-20 pointer-events-auto"
                            style={{
                              left: perspectiveHandlePoints.center.x,
                              top: perspectiveHandlePoints.center.y,
                              transform: "translate(-50%, -50%)",
                            }}
                            title="Drag to move"
                          >
                            <div className="size-2 bg-white rounded-full" />
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <motion.div
                        style={{
                          width: overlaySize.width,
                          height: overlaySize.height,
                          x: overlayX,
                          y: overlayY,
                        }}
                        className="relative pointer-events-none"
                      >
                        <div
                          className="absolute flex items-center gap-2.5 select-none animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto"
                          style={toolbarControlsStyle}
                        >
                          {supportsPerspectivePlane && (
                            <button
                              type="button"
                              onClick={() => setShowPerspectivePicker(true)}
                              className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                            >
                              <Maximize className="w-4 h-4 text-white" />
                              <span className="text-[13px] font-normal tracking-[-0.266px]">Fit</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleRotate}
                            className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                          >
                            <RotateCw className="w-4 h-4 text-white" />
                            <span className="text-[13px] font-normal tracking-[-0.266px]">Rotate</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleFlip}
                            className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                          >
                            <FlipHorizontal className="w-4 h-4 text-white" />
                            <span className="text-[13px] font-normal tracking-[-0.266px]">Flip</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleReset}
                            className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                          >
                            <RotateCcw className="w-4 h-4 text-white" />
                            <span className="text-[13px] font-normal tracking-[-0.266px]">Reset</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRemove}
                            className="bg-[#c50000] hover:bg-[#a30000] text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                            <span className="text-[13px] font-normal tracking-[-0.266px]">Remove</span>
                          </button>
                        </div>

                        <div
                          className="relative pointer-events-none"
                          style={{
                            width: overlaySize.width,
                            height: overlaySize.height,
                            transform: `rotate(${rotateAngle}deg)`,
                            transformOrigin: "center center",
                          }}
                        >
                          <div
                            ref={outlineControlsRef}
                            className="absolute pointer-events-none"
                            style={outlineControlsStyle}
                          >
                            <button type="button" aria-label="Rotate from top left" onPointerDown={startRotation} className="absolute -top-10 -left-10 z-30 flex size-7 items-center justify-center rounded-full border border-[#07b6d3] bg-white text-[#0f1422] shadow-md hover:bg-[#e9f9fb] cursor-grab active:cursor-grabbing pointer-events-auto"><RotateCw className="size-4" /></button>
                            <button type="button" aria-label="Rotate from top right" onPointerDown={startRotation} className="absolute -top-10 -right-10 z-30 flex size-7 items-center justify-center rounded-full border border-[#07b6d3] bg-white text-[#0f1422] shadow-md hover:bg-[#e9f9fb] cursor-grab active:cursor-grabbing pointer-events-auto"><RotateCw className="size-4" /></button>
                            <button type="button" aria-label="Rotate from bottom left" onPointerDown={startRotation} className="absolute -bottom-10 -left-10 z-30 flex size-7 items-center justify-center rounded-full border border-[#07b6d3] bg-white text-[#0f1422] shadow-md hover:bg-[#e9f9fb] cursor-grab active:cursor-grabbing pointer-events-auto"><RotateCw className="size-4" /></button>
                            <button type="button" aria-label="Rotate from bottom right" onPointerDown={startRotation} className="absolute -bottom-10 -right-10 z-30 flex size-7 items-center justify-center rounded-full border border-[#07b6d3] bg-white text-[#0f1422] shadow-md hover:bg-[#e9f9fb] cursor-grab active:cursor-grabbing pointer-events-auto"><RotateCw className="size-4" /></button>

                            <div onPointerDown={(event) => startResize(event, "scale", -1, -1)} className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 cursor-nwse-resize pointer-events-auto" />
                            <div onPointerDown={(event) => startResize(event, "scale", 1, -1)} className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 cursor-nesw-resize pointer-events-auto" />
                            <div onPointerDown={(event) => startResize(event, "scale", -1, 1)} className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 cursor-nesw-resize pointer-events-auto" />
                            <div onPointerDown={(event) => startResize(event, "scale", 1, 1)} className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 cursor-nwse-resize pointer-events-auto" />

                            <div onPointerDown={(event) => startResize(event, "height", 0, -1)} className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 size-3 bg-[#07b6d3] rounded-full shadow-md z-20 cursor-ns-resize pointer-events-auto" />
                            <div onPointerDown={(event) => startResize(event, "height", 0, 1)} className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 size-3 bg-[#07b6d3] rounded-full shadow-md z-20 cursor-ns-resize pointer-events-auto" />
                            <div onPointerDown={(event) => startResize(event, "width", -1, 0)} className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 size-3 bg-[#07b6d3] rounded-full shadow-md z-20 cursor-ew-resize pointer-events-auto" />
                            <div onPointerDown={(event) => startResize(event, "width", 1, 0)} className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 size-3 bg-[#07b6d3] rounded-full shadow-md z-20 cursor-ew-resize pointer-events-auto" />

                            <div onPointerDown={startOverlayDrag} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-6 rounded-full bg-[#07b6d3] flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing z-20 pointer-events-auto">
                              <div className="size-2 bg-white rounded-full" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Instructions Bar */}
          <div className="bg-[#f5f5f5] rounded-[20px] px-5 py-3 flex flex-wrap justify-center items-center gap-2 sm:gap-3 text-sm sm:text-base md:text-lg text-[#0f1422] font-normal tracking-[-0.38px] text-center select-none">
            {selectedProduct ? (
              <>
                <span>Click the Product</span>
                <span className="text-[#c3c3c3]">/</span>
                <span>Drag to Move</span>
                <span className="text-[#c3c3c3]">/</span>
                <span>Corner Handles the Resize</span>
                <span className="text-[#c3c3c3]">/</span>
                <span>Tap Circle Rotate</span>
              </>
            ) : (
              <span>Choose Add Product or Change Product to place a model.</span>
            )}
          </div>

          {/* Footnote text */}
          <p className="text-center text-sm sm:text-base text-black/80 font-normal leading-relaxed max-w-3xl mx-auto">
            Use the product viewer to see the selected glass or aluminum design from different angles. This helps you better understand the product’s structure, form, and overall appearance before creating a photo-based preview.
          </p>
        </div>

        {/* Right Side: Product Details & Customization Sidebar */}
        <div className="w-full lg:w-[422px] shrink-0 flex flex-col gap-6 items-end">
          {/* Status Badge */}
          <div className="bg-white rounded-[20px] px-4 py-2 text-black text-sm font-normal tracking-[-0.266px] shadow-xs border border-neutral-100">
            {selectedProduct
              ? structuralDefinition?.product.productName ?? "1 product on Canvas"
              : "No product selected"}
          </div>
          {productBuildError && (
            <p className="w-full rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {productBuildError}
            </p>
          )}

          {selectedProduct ? (
            <>
              {/* Price Card */}
              <div className="bg-grad-light rounded-[20px] p-6 sm:p-7 flex flex-col gap-2.5 w-full text-white shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xl sm:text-2xl font-normal text-white/90 tracking-[-0.456px]">
                    {displayPriceData.title}
                  </span>
                  {displayPriceData.badgeText && (
                    <span className="text-xs font-medium bg-white/20 px-2.5 py-1 rounded-full text-white">
                      {displayPriceData.badgeText}
                    </span>
                  )}
                </div>
                <span className="text-3xl sm:text-4xl font-medium tracking-[-0.608px] text-white">
                  {displayPriceData.formattedPrice}
                </span>
                <div className="flex flex-col gap-0.5 text-xs font-normal text-white/80 tracking-[-0.228px]">
                  <span>{displayPriceData.subtext}</span>
                </div>
              </div>

              {/* Workspace Accordions with Motion Animation */}
              <div className="w-full flex flex-col gap-4">
                {/* 1. Adaptive Accordion */}
                <div className="bg-[#f5f5f5]/30 border border-white rounded-[20px] shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] overflow-hidden transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleAccordion("Adaptive")}
                    className="w-full p-6 flex justify-between items-center text-left cursor-pointer"
                  >
                    <span className="text-[#0f1422] text-[18px] font-medium tracking-[-0.342px]">
                      Adaptive
                    </span>
                    <motion.div
                      animate={{ rotate: openAccordions.includes("Adaptive") ? 180 : 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <Image
                        src="/visualization/dropdown-btn.svg"
                        alt="Toggle"
                        width={20}
                        height={20}
                      />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {openAccordions.includes("Adaptive") && (
                      <motion.div
                        key="adaptive-content"
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 flex flex-col gap-4">
                          <div className="flex justify-between items-center text-sm text-[#0f1422]">
                            <span className="text-base tracking-[-0.304px]">Apply Ambient Light Adjustment</span>
                            <button
                              type="button"
                              onClick={() => setAmbientLight(!ambientLight)}
                              className={`w-[44px] h-[24px] rounded-full p-0.5 transition-colors cursor-pointer relative ${ambientLight ? "bg-[#07b6d3]" : "bg-[#c3c3c3]"
                                }`}
                            >
                              <div
                                className={`size-[20px] bg-white rounded-full shadow-xs transform transition-transform ${ambientLight ? "translate-x-[20px]" : "translate-x-0"
                                  }`}
                              />
                            </button>
                          </div>

                          <div className="flex justify-between items-center text-sm text-[#0f1422]">
                            <span className="text-base tracking-[-0.304px]">Auto Shadow</span>
                            <button
                              type="button"
                              onClick={() => setAutoShadow(!autoShadow)}
                              className={`w-[44px] h-[24px] rounded-full p-0.5 transition-colors cursor-pointer relative ${autoShadow ? "bg-[#07b6d3]" : "bg-[#c3c3c3]"
                                }`}
                            >
                              <div
                                className={`size-[20px] bg-white rounded-full shadow-xs transform transition-transform ${autoShadow ? "translate-x-[20px]" : "translate-x-0"
                                  }`}
                              />
                            </button>
                          </div>

                          <div className="flex justify-between items-center text-sm text-[#0f1422]">
                            <span className="text-base tracking-[-0.304px]">Auto Output Realism</span>
                            <button
                              type="button"
                              onClick={() => setAutoRealism(!autoRealism)}
                              className={`w-[44px] h-[24px] rounded-full p-0.5 transition-colors cursor-pointer relative ${autoRealism ? "bg-[#07b6d3]" : "bg-[#c3c3c3]"
                                }`}
                            >
                              <div
                                className={`size-[20px] bg-white rounded-full shadow-xs transform transition-transform ${autoRealism ? "translate-x-[20px]" : "translate-x-0"
                                  }`}
                              />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 2. Placement Accordion */}
                <div className="bg-[#f5f5f5]/30 border border-white rounded-[20px] shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] overflow-hidden transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleAccordion("Placement")}
                    className="w-full p-6 flex justify-between items-center text-left cursor-pointer"
                  >
                    <span className="text-[#0f1422] text-[18px] font-medium tracking-[-0.342px]">
                      Placement
                    </span>
                    <motion.div
                      animate={{ rotate: openAccordions.includes("Placement") ? 180 : 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <Image
                        src="/visualization/dropdown-btn.svg"
                        alt="Toggle"
                        width={20}
                        height={20}
                      />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {openAccordions.includes("Placement") && (
                      <motion.div
                        key="placement-content"
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 flex flex-col gap-5">
                          <div className="flex flex-col gap-2">
                            <span className="text-[#c3c3c3] text-base font-normal">3d Yaw</span>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min="-180"
                                max="180"
                                value={yaw}
                                onChange={(e) => setYaw(Number(e.target.value))}
                                className="w-full accent-[#07b6d3] h-2 bg-[#c3c3c3] rounded-lg cursor-pointer"
                              />
                              <span className="text-[#0f1422] text-xs font-normal whitespace-nowrap min-w-12 text-right">
                                {yaw} Deg
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <span className="text-[#c3c3c3] text-base font-normal">3d Pitch</span>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min="-90"
                                max="90"
                                value={pitch}
                                onChange={(e) => setPitch(Number(e.target.value))}
                                className="w-full accent-[#07b6d3] h-2 bg-[#c3c3c3] rounded-lg cursor-pointer"
                              />
                              <span className="text-[#0f1422] text-xs font-normal whitespace-nowrap min-w-12 text-right">
                                {pitch} Deg
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 3. Design and Customization Option Accordion */}
                <div className="bg-[#f5f5f5]/30 border border-white rounded-[20px] shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] overflow-hidden transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleAccordion("Design and Customization Option")}
                    className="w-full p-6 flex justify-between items-center text-left cursor-pointer"
                  >
                    <span className="text-[#0f1422] text-[18px] font-medium tracking-[-0.342px]">
                      Design and Customization Option
                    </span>
                    <motion.div
                      animate={{ rotate: openAccordions.includes("Design and Customization Option") ? 180 : 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <Image
                        src="/visualization/dropdown-btn.svg"
                        alt="Toggle"
                        width={20}
                        height={20}
                      />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {openAccordions.includes("Design and Customization Option") && (
                      <motion.div
                        key="design-content"
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 flex flex-col gap-6">
                          {/* Aluminum Finish */}
                          <div className="flex flex-col gap-2">
                            <span className="text-[#c3c3c3] text-base font-normal">Aluminum Finish</span>
                            <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto pr-1">
                              {workspaceFinishOptions.map((option) => (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => setAlumFinish(option.id)}
                                  aria-pressed={alumFinish === option.id}
                                  className={`flex items-center gap-2 rounded-[8px] border px-2 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3] ${alumFinish === option.id ? "border-[#07b6d3] bg-white" : "border-transparent hover:bg-neutral-50"}`}
                                >
                                  <span className="size-5 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: option.previewHex }} aria-hidden="true" />
                                  <span className="min-w-0 truncate font-medium text-[#0f1422]">{option.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {supportedProductType ? (
                            <div className="flex flex-col gap-5">
                              <fieldset disabled={glassControlsDisabled} aria-disabled={glassControlsDisabled} aria-describedby={glassControlsDisabled ? "workspace-glass-feedback" : undefined} className={glassControlsDisabled ? "opacity-60" : ""}>
                                <legend className="text-[#c3c3c3] text-base font-normal">Glass Type</legend>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {workspaceGlassTypeOptions.map((option) => (
                                    <button key={option.id} type="button" onClick={() => handleGlassTypeChange(option.id)} aria-pressed={glassType === option.id} className={`rounded-[20px] border border-[#c3c3c3] px-3 py-1.5 text-base capitalize transition-colors ${glassType === option.id ? "bg-[#0f1422] text-white" : "text-[#0f1422]"}`}>{option.label}</button>
                                  ))}
                                </div>
                              </fieldset>
                              <fieldset disabled={glassControlsDisabled} aria-disabled={glassControlsDisabled} aria-describedby={glassControlsDisabled ? "workspace-glass-feedback" : undefined} className={glassControlsDisabled ? "opacity-60" : ""}>
                                <legend className="text-[#c3c3c3] text-base font-normal">Advanced Glass Appearance</legend>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {(["opaque", "outdoor"] as const).map((mode) => (
                                    <button key={mode} type="button" onClick={() => handleAdvancedGlassAppearanceChange(mode)} aria-pressed={!glassType && glassAppearance === mode} className={`rounded-[20px] border border-[#c3c3c3] px-3 py-1.5 text-base capitalize transition-colors ${!glassType && glassAppearance === mode ? "bg-[#0f1422] text-white" : "text-[#0f1422]"}`}>{mode}</button>
                                  ))}
                                </div>
                              </fieldset>
                              <fieldset disabled={glassControlsDisabled} aria-disabled={glassControlsDisabled} aria-describedby={glassControlsDisabled ? "workspace-glass-feedback" : undefined} className={glassControlsDisabled ? "opacity-60" : ""}>
                                <legend className="text-[#c3c3c3] text-base font-normal">Glass Color</legend>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {GLASS_COLOR_OPTIONS.map((option) => (
                                    <button key={option.id} type="button" onClick={() => setGlassColor(option.id)} aria-pressed={glassColor === option.id} className={`flex items-center gap-1.5 rounded-[20px] border border-[#c3c3c3] px-3 py-1.5 text-base transition-colors ${glassColor === option.id ? "bg-[#0f1422] text-white" : "text-[#0f1422]"}`}><span className="size-3.5 rounded-full border border-black/15" style={{ backgroundColor: option.previewHex }} aria-hidden="true" />{option.label}</button>
                                  ))}
                                </div>
                              </fieldset>
                              <fieldset disabled={glassControlsDisabled} aria-disabled={glassControlsDisabled} aria-describedby={glassControlsDisabled ? "workspace-glass-feedback" : undefined} className={glassControlsDisabled ? "opacity-60" : ""}>
                                <legend className="text-[#c3c3c3] text-base font-normal">Glass Thickness</legend>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {GLASS_THICKNESS_OPTIONS.map((option) => (
                                    <button key={option.value} type="button" onClick={() => setGlassThicknessMm(option.value)} aria-pressed={glassThicknessMm === option.value} className={`rounded-[20px] border border-[#c3c3c3] px-3 py-1.5 text-base transition-colors ${glassThicknessMm === option.value ? "bg-[#0f1422] text-white" : "text-[#0f1422]"}`}>{option.label}</button>
                                  ))}
                                </div>
                              </fieldset>
                              {glassControlsDisabled && <p id="workspace-glass-feedback" role="status" className="text-sm text-[#777]">Glass options are unavailable because this product model has no glass components.</p>}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <span className="text-[#c3c3c3] text-base font-normal">Glass Appearance</span>
                              <div className="grid grid-cols-2 gap-2.5">
                                {(["clear", "frosted", "opaque", "reflective", "outdoor"] as GlassAppearanceMode[]).map((mode) => (
                                  <button key={mode} type="button" onClick={() => { setGlassAppearance(mode); setGlassType(deriveGlassTypeFromAppearance(mode)); }} aria-pressed={glassAppearance === mode} className={`rounded-[20px] border border-[#c3c3c3] px-3 py-1.5 text-base capitalize transition-colors ${glassAppearance === mode ? "bg-[#0f1422] text-white" : "text-[#0f1422]"}`}>{mode}</button>
                                ))}
                              </div>
                            </div>
                          )}

                          {isWindowProduct && (
                            <label className="flex items-center justify-between gap-4 rounded-[10px] bg-white px-3 py-2.5 border border-[#c3c3c3]">
                              <span className="text-[#0f1422] text-base font-normal">Include Window Sill</span>
                              <button
                                type="button"
                                onClick={handleIncludeSillToggle}
                                className={`w-[44px] h-[24px] rounded-full p-0.5 transition-colors cursor-pointer relative ${includeSill ? "bg-[#07b6d3]" : "bg-[#c3c3c3]"}`}
                                aria-pressed={includeSill}
                              >
                                <span
                                  className={`block size-[20px] bg-white rounded-full shadow-xs transform transition-transform ${includeSill ? "translate-x-[20px]" : "translate-x-0"}`}
                                />
                              </button>
                            </label>
                          )}

                          {/* Dimension */}
                          <div className="flex flex-col gap-2">
                            <span className="text-[#0f1422] text-base font-medium">Dimension</span>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-[#c3c3c3] text-sm">Width (cm)</span>
                                <input
                                  type="text"
                                  value={widthCm}
                                  onChange={(e) => handleWidthCmChange(e.target.value)}
                                  className="w-full bg-white border border-[#c3c3c3] rounded-[10px] px-3 py-1.5 text-center text-[#0f1422] text-base shadow-[0px_0px_7px_rgba(0,0,0,0.1)] focus:outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[#c3c3c3] text-sm">Height (cm)</span>
                                <input
                                  type="text"
                                  value={heightCm}
                                  onChange={(e) => handleHeightCmChange(e.target.value)}
                                  className="w-full bg-white border border-[#c3c3c3] rounded-[10px] px-3 py-1.5 text-center text-[#0f1422] text-base shadow-[0px_0px_7px_rgba(0,0,0,0.1)] focus:outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[#c3c3c3] text-sm">Thickness (mm)</span>
                                <input
                                  type="text"
                                  value={thicknessMm}
                                  onChange={(e) => setThicknessMm(e.target.value)}
                                  className="w-full bg-white border border-[#c3c3c3] rounded-[10px] px-3 py-1.5 text-center text-[#0f1422] text-base shadow-[0px_0px_7px_rgba(0,0,0,0.1)] focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Quantity */}
                          <div className="flex flex-col gap-2">
                            <span className="text-[#0f1422] text-base font-medium">Quantity</span>
                            <div className="flex flex-col gap-1">
                              <span className="text-[#c3c3c3] text-sm">Qty</span>
                              <div className="bg-white border border-[#c3c3c3] rounded-[10px] px-3 py-1.5 flex items-center justify-between w-28 shadow-[0px_0px_7px_rgba(0,0,0,0.1)]">
                                <button
                                  type="button"
                                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                  className="p-1 hover:opacity-75 transition-opacity cursor-pointer"
                                >
                                  <Image
                                    src="/visualization/minus-solid-full 1.svg"
                                    alt="Minus"
                                    width={10}
                                    height={10}
                                  />
                                </button>
                                <span className="text-[#0f1422] text-base font-medium">{quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => setQuantity((q) => q + 1)}
                                  className="p-1 hover:opacity-75 transition-opacity cursor-pointer"
                                >
                                  <Image
                                    src="/visualization/plus-solid-full 1.svg"
                                    alt="Plus"
                                    width={10}
                                    height={10}
                                  />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 4. Object Aware Occlusion Accordion */}
                <div className="bg-[#f5f5f5]/30 border border-white rounded-[20px] shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] overflow-hidden transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleAccordion("Object Aware Occlusion")}
                    className="w-full p-6 flex justify-between items-center text-left cursor-pointer"
                  >
                    <span className="text-[#0f1422] text-[18px] font-medium tracking-[-0.342px]">
                      Object Aware Occlusion
                    </span>
                    <motion.div
                      animate={{ rotate: openAccordions.includes("Object Aware Occlusion") ? 180 : 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <Image
                        src="/visualization/dropdown-btn.svg"
                        alt="Toggle"
                        width={20}
                        height={20}
                      />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {openAccordions.includes("Object Aware Occlusion") && (
                      <motion.div
                        key="occlusion-content"
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 flex flex-col gap-3">
                          {occlusions.length > 0 ? (
                            occlusions.map((item) => (
                              <div
                                key={item.id}
                                onClick={() => toggleOcclusion(item.id)}
                                className="bg-white rounded-[20px] p-5 flex justify-between items-center shadow-xs cursor-pointer hover:border-neutral-200 border border-transparent transition-colors"
                              >
                                <div className="flex flex-col gap-1">
                                  <span className="text-[#0f1422] text-[18px] font-medium tracking-[-0.342px]">
                                    {item.label}
                                  </span>
                                  <span className="text-[#c3c3c3] text-xs font-normal">
                                    Confidence: {item.confidence}
                                  </span>
                                  <span className="text-[#0f1422] text-sm font-normal">
                                    Put Product Behind
                                  </span>
                                </div>
                                <div
                                  className={`size-3.5 rounded-[2px] border transition-colors ${item.active
                                    ? "bg-[#0f1422] border-[#0f1422]"
                                    : "bg-[#c3c3c3] border-transparent"
                                    }`}
                                />
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-neutral-500 py-1">
                              No auto-detected foreground objects in this photo.
                            </p>
                          )}

                          {/* Manual Occlusion Mask Subsection */}
                          <div className="mt-2 pt-3 border-t border-neutral-200/60 flex flex-col gap-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                                Manual Occlusion Mask
                              </span>
                              {manualMaskDataUrl && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setManualMaskDataUrl(null);
                                    setManualOcclusionPolygons([]);
                                  }}
                                  className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                                >
                                  Remove Mask
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-neutral-500 leading-relaxed">
                              Outline protruding wall columns, piers, or beams that should appear in front of the product.
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowOcclusionPointPicker(true);
                              }}
                              className="w-full flex items-center justify-center gap-2 bg-[#0f1422] hover:bg-black text-white text-sm font-medium py-3 px-4 rounded-[20px] transition-colors cursor-pointer shadow-xs"
                            >
                              <MousePointer2 className="size-4 text-[#07b6d3]" />
                              <span>
                                {manualMaskDataUrl
                                  ? manualOcclusionPolygons.length > 0
                                    ? "Edit Occlusion Areas"
                                    : "Replace Legacy Mask"
                                  : "Select Occlusion Areas"}
                              </span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Apply Changes Primary CTA */}
              <button
                type="button"
                disabled={isCapturingSnapshot}
                onClick={handleApplySnapshotClick}
                className="w-full bg-green hover:bg-[#06a3bd] text-white text-lg sm:text-[20px] font-normal py-4 rounded-[25px] transition-colors cursor-pointer shadow-sm text-center tracking-[-0.38px]"
              >
                {isCapturingSnapshot
                  ? "Generating Snapshot..."
                  : isSnapshotApplied
                    ? "Edit"
                    : "Apply Changes"}
              </button>
            </>
          ) : (
            <div className="w-full rounded-[20px] border border-[#c3c3c3]/60 bg-white p-6 text-center shadow-xs">
              <p className="text-lg font-medium text-[#0f1422]">Your space is ready</p>
              <p className="mt-2 text-sm leading-6 text-black/65">
                Select Add Product or Change Product above to choose from the GlassFit catalog.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Step Navigation Bar ── */}
      <div className="bg-[#f5f5f5] w-full rounded-[20px] p-5 flex flex-col sm:flex-row items-center justify-between gap-4 select-none shadow-sm mt-4">
        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="w-full sm:w-auto bg-[#0f1422] hover:bg-black text-white font-normal text-base sm:text-[20px] tracking-[-0.38px] leading-[1.4] px-6 py-3.5 rounded-[25px] transition-colors cursor-pointer text-center"
        >
          Back
        </button>

        {/* Action Buttons Right */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3 sm:gap-5">
          <button
            type="button"
            disabled={isCapturingSnapshot || !selectedProduct}
            onClick={handleSaveSnapshot}
            className="w-full sm:w-auto bg-transparent border border-[#0f1422] hover:bg-neutral-100 text-[#0f1422] font-normal text-base sm:text-[20px] tracking-[-0.38px] leading-[1.4] px-6 py-3.5 rounded-[25px] transition-colors cursor-pointer text-center"
          >
            Save Snapshot
          </button>
          <Button
            type="button"
            disabled={isCapturingSnapshot || !selectedProduct}
            onClick={handleContinueToComparison}
            variant="lightGradWhiteText"
            value="Continue to Comparison"
            leftIcon={null}
            rightIcon={
              <Image
                src="/right_arrow.svg"
                width={25}
                height={25}
                alt="Arrow right"
              />
            }
            className="w-full sm:w-auto justify-center"
          />
        </div>
      </div>

      {/* ── Structural Guardrail Hybrid Prompt Modal (MS-6) ── */}
      <StructuralGuardrailModal
        isOpen={isGuardrailModalOpen}
        validation={guardrailValidation}
        onSwitchTo3Panels={handleSwitchTo3Panels}
        onAcknowledgeAndProceed={handleAcknowledgeAndProceed}
        onClose={() => setIsGuardrailModalOpen(false)}
      />

      {/* ── Measurement Confirmation Modal (MS-08) ── */}
      {isMeasurementModalOpen && (
        <MeasurementConfirmationModal
          isOpen={isMeasurementModalOpen}
          entries={measurementEntries}
          onConfirmAll={handleMeasurementConfirmAll}
          onCancel={handleMeasurementModalCancel}
        />
      )}


      {/* Point-based Manual Occlusion Modal (MS-03) */}
      {showOcclusionPointPicker && (
        <ManualOcclusionPointPicker
          backgroundImageUrl={bgImage}
          canvasWidth={aspectWidth}
          canvasHeight={aspectHeight}
          initialPolygons={manualOcclusionPolygons}
          legacyMaskDataUrl={manualMaskDataUrl}
          onSave={({ polygons, maskDataUrl }) => {
            setManualOcclusionPolygons(polygons);
            setManualMaskDataUrl(maskDataUrl);
            setShowOcclusionPointPicker(false);
          }}
          onCancel={() => setShowOcclusionPointPicker(false)}
        />
      )}

      {/* ── Perspective Plane Picker Modal (MS-02) ── */}
      {showPerspectivePicker && (
        <PerspectivePlanePicker
          backgroundImageUrl={bgImage}
          canvasWidth={aspectWidth}
          canvasHeight={aspectHeight}
          initialCorners={perspectiveCorners}
          openingType={isDoorProduct ? "door" : "window"}
          onConfirm={async (corners) => {
            const currentDisplayWidth = canvasRef.current?.clientWidth || canvasDisplaySize.width;
            const currentDisplayHeight = canvasRef.current?.clientHeight || canvasDisplaySize.height;
            const pxCorners = denormalizeCorners(corners, currentDisplayWidth, currentDisplayHeight);

            const photoWidth =
              spaceImageSession?.workspaceImage.width ||
              currentDisplayWidth;
            const photoHeight =
              spaceImageSession?.workspaceImage.height ||
              currentDisplayHeight;
            const photoCorners = denormalizeCorners(corners, photoWidth, photoHeight);
            const { widthRatio, heightRatio } = estimateDimensionsFromCorners(photoCorners);
            if (heightRatio > 0 && widthRatio > 0) {
              const quadCenterX = (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
              const quadCenterY = (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;
              const depthMapUrl = spaceImageSession?.depth?.depth_map_url;
              let depthAtQuadCenter: number | null = null;
              if (depthMapUrl) {
                try {
                  depthAtQuadCenter = await sampleDepthAtPoint(depthMapUrl, quadCenterX, quadCenterY);
                } catch {
                  depthAtQuadCenter = null;
                }
              }

              const templateDefaultH = Number(
                structuralDefinition?.parameters?.find((p) => p.parameterKey === "height")?.defaultValue
              ) || null;

              const scaleSignal = spaceImageSession?.scaleEstimation || spaceImageSession?.scale_estimation;

              const estimate = computeEstimatedDimensions(
                widthRatio,
                heightRatio,
                scaleSignal,
                isDoorProduct,
                templateDefaultH,
                depthAtQuadCenter,
              );

              setWidthCm(String(estimate.widthCm));
              setHeightCm(String(estimate.heightCm));
              setOverlaySize(getOverlaySizeFromDimensions(String(estimate.widthCm), String(estimate.heightCm)));
            }

            const [p0, p1, p2, p3] = pxCorners;
            const leftH = Math.hypot(p3.x - p0.x, p3.y - p0.y);
            const rightH = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const topW = Math.hypot(p1.x - p0.x, p1.y - p0.y);
            const bottomW = Math.hypot(p2.x - p3.x, p2.y - p3.y);

            const maxH = Math.max(leftH, rightH, 1);
            const maxW = Math.max(topW, bottomW, 1);
            const deltaH = (leftH - rightH) / maxH;
            const deltaW = (bottomW - topW) / maxW;

            const initialYaw = Math.round(clampNumber(deltaH * 35, -25, 25));
            const initialPitch = Math.round(clampNumber(deltaW * 25, -20, 20));

            setPerspectiveCorners(corners);
            setYaw(initialYaw);
            setPitch(initialPitch);
            setRotateAngle(0);
            setModelRevision((prev) => prev + 1);
            setShowPerspectivePicker(false);
          }}
          onCancel={() => setShowPerspectivePicker(false)}
        />
      )}
    </div>
  );
}

function getPointerAngle(
  pointerX: number,
  pointerY: number,
  centerX: number,
  centerY: number,
) {
  return (Math.atan2(pointerY - centerY, pointerX - centerX) * 180) / Math.PI;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cloneCanvas(
  source: HTMLCanvasElement,
  options?: {
    autoRealism?: boolean;
    autoShadow?: boolean;
    lighting?: SpaceImageSession["lighting"] | null;
  },
) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (context) {
    context.drawImage(source, 0, 0);
    if (options?.autoRealism && options?.autoShadow && options?.lighting) {
      applyContactOcclusionAndReveals(context, canvas.width, canvas.height, {
        lightDirection: options.lighting.light_direction,
        shadowOpacity: options.lighting.suggested?.shadow_opacity ?? 0.28,
      });
    }
    if (options?.autoRealism && options?.lighting?.suggested?.grain) {
      applyNoiseToCanvas(context, canvas.width, canvas.height, options.lighting.suggested.grain);
    }
  }

  return canvas;
}

type SnapshotOcclusionObject = SpaceImageSession["objects"][number];

// Snapshot of the overlay's DOM state captured synchronously: before any async
// operations: so both canvas and overlay positions come from the same layout frame.
type OverlayCapture = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  generatedCanvas: HTMLCanvasElement | null;
};

async function captureWorkspaceSnapshot({
  canvasElement,
  overlayElement,
  backgroundImageUrl,
  fallbackProductImageUrl,
  hasGeneratedProduct,
  activeOcclusionObjects,
  manualMaskDataUrl,
  perspectiveCorners,
  rotateAngle,
  isFlipped,
  modelFilter,
  generatedCanvasOverride,
  structuralDefinition: _structuralDefinition,
  yaw: _yaw,
  pitch: _pitch,
  lighting: _lighting,
  glassAppearance: _glassAppearance,
  includeSill: _includeSill,
  widthCm: _widthCm,
  heightCm: _heightCm,
  placedLayerImageUrls = [],
}: {
  canvasElement: HTMLDivElement | null;
  overlayElement: HTMLDivElement | null;
  backgroundImageUrl: string | null;
  fallbackProductImageUrl: string;
  hasGeneratedProduct: boolean;
  activeOcclusionObjects: SnapshotOcclusionObject[];
  manualMaskDataUrl?: string | null;
  perspectiveCorners?: QuadrilateralCorners | null;
  rotateAngle: number;
  isFlipped: boolean;
  modelFilter: React.CSSProperties["filter"];
  generatedCanvasOverride?: HTMLCanvasElement | null;
  structuralDefinition: ProductStructuralDefinition | null;
  yaw: number;
  pitch: number;
  lighting: LightingAnalysis | null;
  glassAppearance: GlassAppearanceMode;
  includeSill: boolean;
  widthCm: number;
  heightCm: number;
  placedLayerImageUrls?: string[];
}) {
  if (!canvasElement) {
    throw new Error("Visualization canvas is not ready yet.");
  }

  // Read ALL DOM positions synchronously before the first await
  // This mirrors the canvas snapshot approach where position is
  // captured at a single instant with no async gaps between measurements.
  const canvasBounds = canvasElement.getBoundingClientRect();

  let overlayCapture: OverlayCapture | null = null;
  if (overlayElement) {
    const overlayBounds = overlayElement.getBoundingClientRect();
    // offsetWidth/offsetHeight give unrotated layout dimensions.
    // getBoundingClientRect().width/height give the rotated AABB - its center
    // is still the geometric center of the element for any rotation angle.
    const width = overlayElement.offsetWidth || overlayBounds.width;
    const height = overlayElement.offsetHeight || overlayBounds.height;
    overlayCapture = {
      centerX: overlayBounds.left - canvasBounds.left + overlayBounds.width / 2,
      centerY: overlayBounds.top - canvasBounds.top + overlayBounds.height / 2,
      width,
      height,
      // querySelector is synchronous - grab the Three.js WebGL canvas now.
      generatedCanvas:
        generatedCanvasOverride ?? overlayElement.querySelector("canvas"),
    };
  }
  // End synchronous DOM capture

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(canvasBounds.width * pixelRatio));
  output.height = Math.max(1, Math.round(canvasBounds.height * pixelRatio));

  const context = output.getContext("2d");
  if (!context) {
    throw new Error("Snapshot rendering is not available in this browser.");
  }

  context.scale(pixelRatio, pixelRatio);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  let backgroundImage: HTMLImageElement | null = null;
  if (backgroundImageUrl) {
    context.fillStyle = "#f5f5f5";
    context.fillRect(0, 0, canvasBounds.width, canvasBounds.height);

    // Draw background using object-contain math to perfectly match the DOM <img>
    // rendering, even if the container aspect ratio doesn't perfectly match the image.
    backgroundImage = await loadSnapshotImage(backgroundImageUrl);
    drawObjectContainImage(
      context,
      backgroundImage,
      0,
      0,
      canvasBounds.width,
      canvasBounds.height,
    );
  }

  for (const layerImageUrl of placedLayerImageUrls) {
    if (!layerImageUrl) continue;
    try {
      const layerImage = await loadSnapshotImage(layerImageUrl);
      context.drawImage(layerImage, 0, 0, canvasBounds.width, canvasBounds.height);
    } catch {
      // Gracefully continue if an individual layer image is not ready
    }
  }

  if (overlayCapture) {
    await drawSnapshotOverlay({
      context,
      overlayCapture,
      fallbackProductImageUrl,
      hasGeneratedProduct,
      perspectiveCorners,
      canvasBounds,
      rotateAngle,
      isFlipped,
      modelFilter,
    });
  }

  if (backgroundImage) {
    for (const object of activeOcclusionObjects) {
      await drawMaskedBackgroundLayer({
        outputWidth: canvasBounds.width,
        outputHeight: canvasBounds.height,
        context,
        backgroundImage,
        maskUrl: object.mask_url,
      });
    }

    if (manualMaskDataUrl) {
      await drawMaskedBackgroundLayer({
        outputWidth: canvasBounds.width,
        outputHeight: canvasBounds.height,
        context,
        backgroundImage,
        maskUrl: manualMaskDataUrl,
      });
    }
  }

  return backgroundImageUrl
    ? output.toDataURL("image/jpeg", 0.92)
    : output.toDataURL("image/png");
}

async function drawSnapshotOverlay({
  context,
  overlayCapture,
  fallbackProductImageUrl,
  hasGeneratedProduct,
  perspectiveCorners,
  canvasBounds,
  rotateAngle,
  isFlipped,
  modelFilter,
}: {
  context: CanvasRenderingContext2D;
  // All position data was captured synchronously in captureWorkspaceSnapshot
  // before any awaits - no new DOM reads happen here.
  overlayCapture: OverlayCapture;
  fallbackProductImageUrl: string;
  hasGeneratedProduct: boolean;
  perspectiveCorners?: QuadrilateralCorners | null;
  canvasBounds?: { width: number; height: number };
  rotateAngle: number;
  isFlipped: boolean;
  modelFilter: React.CSSProperties["filter"];
}) {
  const { centerX, centerY, width, height, generatedCanvas } = overlayCapture;

  if (perspectiveCorners && canvasBounds) {
    const pixelCorners = denormalizeCorners(
      perspectiveCorners,
      canvasBounds.width,
      canvasBounds.height,
    );

    const offscreen = document.createElement("canvas");
    offscreen.width = Math.max(1, Math.round(width));
    offscreen.height = Math.max(1, Math.round(height));
    const offCtx = offscreen.getContext("2d");

    if (offCtx) {
      offCtx.save();
      if (isFlipped) {
        offCtx.translate(offscreen.width, 0);
        offCtx.scale(-1, 1);
      }
      if (typeof modelFilter === "string" && modelFilter.length > 0) {
        offCtx.filter = modelFilter;
      }

      if (hasGeneratedProduct && generatedCanvas) {
        offCtx.drawImage(generatedCanvas, 0, 0, offscreen.width, offscreen.height);
      } else {
        const fallbackProductImage = await loadSnapshotImage(fallbackProductImageUrl);
        drawObjectCoverImage(
          offCtx,
          fallbackProductImage,
          0,
          0,
          offscreen.width,
          offscreen.height,
        );
      }
      offCtx.restore();

      context.save();
      drawPerspectiveWarpedImage(context, offscreen, pixelCorners);
      context.restore();
      return;
    }
  }

  context.save();
  // Translate to the model's center (canvas-local CSS pixels), then rotate.
  context.translate(centerX, centerY);
  context.rotate((rotateAngle * Math.PI) / 180);

  if (isFlipped) {
    context.scale(-1, 1);
  }

  if (typeof modelFilter === "string" && modelFilter.length > 0) {
    context.filter = modelFilter;
  }

  if (hasGeneratedProduct && generatedCanvas) {
    // Draw the high-resolution canvas that was generated by the renderer
    context.drawImage(
      generatedCanvas,
      -width / 2,
      -height / 2,
      width,
      height,
    );
  } else {
    const fallbackProductImage = await loadSnapshotImage(fallbackProductImageUrl);
    drawObjectCoverImage(
      context,
      fallbackProductImage,
      -width / 2,
      -height / 2,
      width,
      height,
    );
  }

  context.restore();
}

async function drawMaskedBackgroundLayer({
  outputWidth,
  outputHeight,
  context,
  backgroundImage,
  maskUrl,
}: {
  outputWidth: number;
  outputHeight: number;
  context: CanvasRenderingContext2D;
  backgroundImage: HTMLImageElement;
  maskUrl: string;
}) {
  const maskImage = await loadSnapshotImage(maskUrl);
  const layer = document.createElement("canvas");
  layer.width = Math.max(1, Math.round(outputWidth));
  layer.height = Math.max(1, Math.round(outputHeight));

  const layerContext = layer.getContext("2d");
  if (!layerContext) {
    return;
  }

  drawObjectContainImage(
    layerContext,
    backgroundImage,
    0,
    0,
    outputWidth,
    outputHeight,
  );
  layerContext.globalCompositeOperation = "destination-in";
  layerContext.drawImage(maskImage, 0, 0, outputWidth, outputHeight);
  context.drawImage(layer, 0, 0, outputWidth, outputHeight);
}

function drawObjectContainImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const source = getCanvasImageSourceSize(image);
  const scale = Math.min(width / source.width, height / source.height);
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;

  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function drawObjectCoverImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const source = getCanvasImageSourceSize(image);
  const sourceRatio = source.width / source.height;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = source.width;
  let sourceHeight = source.height;

  if (sourceRatio > targetRatio) {
    sourceWidth = source.height * targetRatio;
    sourceX = (source.width - sourceWidth) / 2;
  } else {
    sourceHeight = source.width / targetRatio;
    sourceY = (source.height - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function getCanvasImageSourceSize(image: CanvasImageSource) {
  if (image instanceof HTMLImageElement) {
    return {
      width: image.naturalWidth || image.width || 1,
      height: image.naturalHeight || image.height || 1,
    };
  }

  if (image instanceof HTMLVideoElement) {
    return {
      width: image.videoWidth || image.width || 1,
      height: image.videoHeight || image.height || 1,
    };
  }

  if (typeof VideoFrame !== "undefined" && image instanceof VideoFrame) {
    return {
      width: image.displayWidth || 1,
      height: image.displayHeight || 1,
    };
  }

  const sizedSource = image as { width?: unknown; height?: unknown };
  if (
    typeof sizedSource.width === "number" &&
    typeof sizedSource.height === "number"
  ) {
    return {
      width: sizedSource.width || 1,
      height: sizedSource.height || 1,
    };
  }

  return {
    width: 1,
    height: 1,
  };
}

function loadSnapshotImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();

    if (/^https?:\/\//i.test(src)) {
      image.crossOrigin = "anonymous";
    }

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load an image for the snapshot."));
    image.src = src;
  });
}

function getOverlaySizeFromDimensions(widthCmValue: string, heightCmValue: string) {
  const width = Number(widthCmValue) || DEFAULT_PRODUCT_WIDTH_CM;
  const height = Number(heightCmValue) || DEFAULT_PRODUCT_HEIGHT_CM;
  const nextWidth = DEFAULT_OVERLAY_WIDTH_PX * (width / DEFAULT_PRODUCT_WIDTH_CM);
  const nextHeight = DEFAULT_OVERLAY_HEIGHT_PX * (height / DEFAULT_PRODUCT_HEIGHT_CM);

  return {
    width: Math.round(clampNumber(nextWidth, MIN_OVERLAY_WIDTH, MAX_OVERLAY_WIDTH)),
    height: Math.round(clampNumber(nextHeight, MIN_OVERLAY_HEIGHT, MAX_OVERLAY_HEIGHT)),
  };
}

function getModelRenderFrameSize(size: { width: number; height: number }) {
  const aspectRatio = Math.max(size.width, 1) / Math.max(size.height, 1);

  if (aspectRatio >= 1) {
    return {
      width: MAX_MODEL_RENDER_SIDE,
      height: Math.max(
        MIN_MODEL_RENDER_SIDE,
        Math.round(MAX_MODEL_RENDER_SIDE / aspectRatio),
      ),
    };
  }

  return {
    width: Math.max(
      MIN_MODEL_RENDER_SIDE,
      Math.round(MAX_MODEL_RENDER_SIDE * aspectRatio),
    ),
    height: MAX_MODEL_RENDER_SIDE,
  };
}

function getVisibleModelBounds(canvas: HTMLCanvasElement): ProjectedModelBounds | null {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  try {
    const { width, height } = canvas;
    const imageData = context.getImageData(0, 0, width, height);
    const { data } = imageData;

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let hasVisiblePixels = false;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 5) {
          hasVisiblePixels = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasVisiblePixels) {
      return null;
    }

    const left = Math.max(0, minX - MODEL_CONTROLS_PADDING_PX);
    const top = Math.max(0, minY - MODEL_CONTROLS_PADDING_PX);
    const right = Math.min(width, maxX + MODEL_CONTROLS_PADDING_PX);
    const bottom = Math.min(height, maxY + MODEL_CONTROLS_PADDING_PX);

    return {
      left: left / width,
      top: top / height,
      width: Math.max(0.04, (right - left) / width),
      height: Math.max(0.04, (bottom - top) / height),
    };
  } catch {
    return null;
  }
}

function getStructuralDefaultMm(
  definition: ProductStructuralDefinition,
  parameterKey: string,
  fallbackMm: number,
) {
  const parameter = definition.parameters.find(
    (item) => item.parameterKey === parameterKey,
  );
  const rawDefault =
    parameter?.defaultValue ??
    definition.template.baseConfiguration[parameterKey] ??
    fallbackMm;
  const numericDefault = toFiniteNumber(rawDefault, fallbackMm);

  return toMillimeters(numericDefault, parameter?.unit ?? definition.template.measurementUnit);
}

function toMillimeters(value: number, unit: string) {
  switch (unit) {
    case "m":
      return value * 1000;
    case "cm":
      return value * 10;
    case "mm":
    default:
      return value;
  }
}

function toFiniteNumber(value: unknown, fallback: number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function getOutlineControlsStyle(
  bounds: ProjectedModelBounds | null,
): React.CSSProperties {
  const resolvedBounds = bounds ?? {
    left: 0.08,
    top: 0.08,
    width: 0.84,
    height: 0.84,
  };

  return {
    left: `${resolvedBounds.left * 100}%`,
    top: `${resolvedBounds.top * 100}%`,
    width: `${resolvedBounds.width * 100}%`,
    height: `${resolvedBounds.height * 100}%`,
  };
}

function getToolbarControlsStyle(
  bounds: ProjectedModelBounds | null,
): React.CSSProperties {
  const resolvedBounds = bounds ?? {
    left: 0.08,
    top: 0.08,
    width: 0.84,
    height: 0.84,
  };

  return {
    left: `${(resolvedBounds.left + resolvedBounds.width / 2) * 100}%`,
    top: `${resolvedBounds.top * 100}%`,
    transform: "translate(-50%, calc(-100% - 12px))",
  };
}

function getModelEffectStyle({
  autoRealism,
  autoShadow,
  lighting,
}: {
  autoRealism: boolean;
  autoShadow: boolean;
  lighting: SpaceImageSession["lighting"] | undefined;
}): React.CSSProperties {
  const filters: string[] = [];

  filters.push(
    "drop-shadow(1px 0 0 rgba(7, 182, 211, 0.9))",
    "drop-shadow(-1px 0 0 rgba(7, 182, 211, 0.9))",
    "drop-shadow(0 1px 0 rgba(7, 182, 211, 0.9))",
    "drop-shadow(0 -1px 0 rgba(7, 182, 211, 0.9))",
  );

  if (autoRealism && lighting) {
    filters.push(
      `brightness(${clampNumber(lighting.suggested.brightness, 0.82, 1.22)})`,
      `contrast(${clampNumber(lighting.suggested.contrast, 0.9, 1.22)})`,
      `saturate(${clampNumber(lighting.suggested.saturation, 0.82, 1.18)})`,
    );

    if (lighting.sharpness < 0.40 && lighting.suggested.blur_px > 0) {
      filters.push(`blur(${clampNumber(lighting.suggested.blur_px, 0.15, 0.35)}px)`);
    }
  }

  if (autoShadow) {
    const opacity = clampNumber(lighting?.suggested.shadow_opacity ?? 0.28, 0.12, 0.42);
    const directionX = lighting?.light_direction.x ?? 0.35;
    const directionY = lighting?.light_direction.y ?? 0.45;
    filters.push(
      `drop-shadow(${Math.round(directionX * 12)}px ${Math.round(10 + directionY * 10)}px 14px rgba(15, 20, 34, ${opacity}))`,
    );
  }

  return {
    filter: filters.length ? filters.join(" ") : undefined,
  };
}

function getExportModelFilter({
  autoRealism,
  autoShadow,
  lighting,
}: {
  autoRealism: boolean;
  autoShadow: boolean;
  lighting: SpaceImageSession["lighting"] | undefined;
}): React.CSSProperties["filter"] {
  const filters: string[] = [];

  // NO cyan selection guide drop-shadows here!

  if (autoRealism && lighting) {
    filters.push(
      `brightness(${clampNumber(lighting.suggested.brightness, 0.82, 1.22)})`,
      `contrast(${clampNumber(lighting.suggested.contrast, 0.9, 1.22)})`,
      `saturate(${clampNumber(lighting.suggested.saturation, 0.82, 1.18)})`,
    );

    if (lighting.sharpness < 0.40 && lighting.suggested.blur_px > 0) {
      filters.push(`blur(${clampNumber(lighting.suggested.blur_px, 0.15, 0.35)}px)`);
    }
  }

  if (autoShadow) {
    const opacity = clampNumber(lighting?.suggested.shadow_opacity ?? 0.28, 0.12, 0.42);
    const directionX = lighting?.light_direction.x ?? 0.35;
    const directionY = lighting?.light_direction.y ?? 0.45;
    filters.push(
      `drop-shadow(${Math.round(directionX * 12)}px ${Math.round(10 + directionY * 10)}px 14px rgba(15, 20, 34, ${opacity}))`,
    );
  }

  return filters.length ? filters.join(" ") : undefined;
}
