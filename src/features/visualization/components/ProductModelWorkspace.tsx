"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useDragControls } from "motion/react";
import { RotateCw, FlipHorizontal, RotateCcw, Trash2 } from "lucide-react";
import Button from "@/components/shared/Button";
import { AddProductModal, type Product } from "./AddProductModal";
import type { SpaceImageSession, LightingAnalysis } from "@/lib/imageApi";
import { ProductModelRenderer } from "@/lib/visualization/modelRenderer";
import {
  GlassAppearanceMode,
  ProductConfigurationSnapshot,
  ProductStructuralDefinition,
  ProductVariationSnapshot,
} from "@/lib/visualization/types";
import { ALUMINUM_COLOR_VARIATIONS } from "@/lib/visualization/colorVariations";
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
  selectedProductName?: string;
  initialSnapshotDataUrl?: string | null;
  onConfigurationChange?: (configuration: ProductConfigurationSnapshot) => void;
  onVariationSnapshotsChange?: (snapshots: ProductVariationSnapshot[]) => void;
  onSnapshotChange?: (dataUrl: string) => void;
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
  selectedProductName,
  initialSnapshotDataUrl,
  onConfigurationChange,
  onVariationSnapshotsChange,
  onSnapshotChange,
  onBack,
}: ProductModelWorkspaceProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const overlayBoxRef = useRef<HTMLDivElement>(null);
  const outlineControlsRef = useRef<HTMLDivElement>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const rotationSessionRef = useRef<RotationSession | null>(null);
  const appliedTemplateDefaultsRef = useRef<string | null>(null);
  const dragControls = useDragControls();
  const [zoomLevel, setZoomLevel] = useState(10);
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);

  // Accordion State Values
  const [ambientLight, setAmbientLight] = useState(true);
  const [autoShadow, setAutoShadow] = useState(true);
  const [autoRealism, setAutoRealism] = useState(true);
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [alumFinish, setAlumFinish] = useState<"black" | "white" | "silver">("white");
  const [glassAppearance, setGlassAppearance] = useState<GlassAppearanceMode>("clear");
  const [includeSill, setIncludeSill] = useState(true);
  const [widthCm, setWidthCm] = useState(String(DEFAULT_PRODUCT_WIDTH_CM));
  const [heightCm, setHeightCm] = useState(String(DEFAULT_PRODUCT_HEIGHT_CM));
  const [thicknessMm, setThicknessMm] = useState("3");
  const [quantity, setQuantity] = useState(1);
  const [activeOcclusionIds, setActiveOcclusionIds] = useState<string[]>([]);

  const [selectedProduct, setSelectedProduct] = useState(true);
  const [rotateAngle, setRotateAngle] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Add Product");
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [productBuildError, setProductBuildError] = useState<string | null>(null);
  const initialOverlaySize = getOverlaySizeFromDimensions(widthCm, heightCm);
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

  const mvpCanvasRef = useRef<HTMLCanvasElement>(null);
  const mvpRendererRef = useRef<ProductModelRenderer | null>(null);
  const [isUsingTransformHandle, setIsUsingTransformHandle] = useState(false);
  const [isOutlineMeasurementPaused, setIsOutlineMeasurementPaused] = useState(false);
  const [isSnapshotApplied, setIsSnapshotApplied] = useState(
    Boolean(initialSnapshotDataUrl),
  );
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);

  const bgImage = uploadedImage || "/comparison_assets/room_without_furniture.png";
  const productOverlayImage = activeProduct?.image || "/images/modular_cabinets.png";
  const overlayName = selectedProductName ?? activeProduct?.name ?? "Selected Product";
  const aspectWidth = spaceImageSession?.workspaceImage?.width ?? 636;
  const aspectHeight = spaceImageSession?.workspaceImage?.height ?? 579;
  const workspaceAspectRatio = `${aspectWidth} / ${aspectHeight}`;
  const effectiveLighting = ambientLight ? spaceImageSession?.lighting : null;
  const isWindowProduct =
    structuralDefinition?.product.productType === "Window" ||
    Boolean(
      structuralDefinition?.components.some(
        (component) => component.componentKey.replace(/_/g, "-") === "window-sill",
      ),
    );
  const modelEffectStyle = useMemo(
    () => getModelEffectStyle({
      autoRealism,
      autoShadow,
      lighting: spaceImageSession?.lighting,
    }),
    [autoRealism, autoShadow, spaceImageSession?.lighting],
  );

  // The cyan selection-guide drop-shadows are UI-only and must NOT appear in
  // the exported snapshot — same as the MVP's "output" renderMode skipping the
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
    mvpRendererRef.current.setSize(
      renderFrameSizeRef.current.width,
      renderFrameSizeRef.current.height,
    );

    mvpRendererRef.current.loadModel(
      structuralDefinition,
      {
        width: Number(widthCm) * 10,
        height: Number(heightCm) * 10,
        includeSill,
        include_sill: includeSill,
      },
      glassAppearance,
      includeSill,
      alumFinish
    ).then(() => {
      // Trigger a re-render
      setProjectedModelBounds({ left: 0, top: 0, width: 1, height: 1 });
      setModelRevision((prev) => prev + 1);
      setProductBuildError(null);
    });
  }, [structuralDefinition, widthCm, heightCm, includeSill, glassAppearance, alumFinish]);

  useEffect(() => {
    if (!mvpRendererRef.current) return;
    mvpRendererRef.current.applyLighting(effectiveLighting ?? null);
  }, [effectiveLighting]);

  useLayoutEffect(() => {
    if (!mvpRendererRef.current || !mvpCanvasRef.current || !structuralDefinition) return;

    mvpRendererRef.current.setSize(renderFrameSize.width, renderFrameSize.height);

    const sourceCanvas = mvpRendererRef.current.render(yaw, pitch);
    if (!sourceCanvas) return;

    const ctx = mvpCanvasRef.current.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, mvpCanvasRef.current.width, mvpCanvasRef.current.height);
    ctx.drawImage(
      sourceCanvas,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
      0,
      0,
      mvpCanvasRef.current.width,
      mvpCanvasRef.current.height
    );

    if (!isOutlineMeasurementPaused) {
      setProjectedModelBounds(getVisibleModelBounds(mvpCanvasRef.current));
    }
  }, [yaw, pitch, structuralDefinition, widthCm, heightCm, includeSill, glassAppearance, alumFinish, effectiveLighting, modelRevision, renderFrameSize, isOutlineMeasurementPaused]);

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

    const nextWidthCm = String(
      Math.round(getStructuralDefaultMm(structuralDefinition, "width", 2100) / 10),
    );
    const nextHeightCm = String(
      Math.round(getStructuralDefaultMm(structuralDefinition, "height", 1500) / 10),
    );

    setWidthCm(nextWidthCm);
    setHeightCm(nextHeightCm);
    setOverlaySize(getOverlaySizeFromDimensions(nextWidthCm, nextHeightCm));
    appliedTemplateDefaultsRef.current = templateId;
  }, [structuralDefinition]);

  useEffect(() => {
    if (!structuralDefinition || !onConfigurationChange) {
      return;
    }

    const width = Number(widthCm) || DEFAULT_PRODUCT_WIDTH_CM;
    const height = Number(heightCm) || DEFAULT_PRODUCT_HEIGHT_CM;
    const thickness = Number(thicknessMm) || 3;

    onConfigurationChange({
      widthCm: width,
      heightCm: height,
      thicknessMm: thickness,
      quantity,
      aluminumFinish: alumFinish,
      glassAppearance,
      includeSill,
      yaw,
      pitch,
      rotateAngle,
      isFlipped,
      visualParameterValues: {
        width: width * 10,
        height: height * 10,
        thickness: thickness,
        includeSill,
        include_sill: includeSill,
      },
    });
  }, [
    alumFinish,
    glassAppearance,
    heightCm,
    includeSill,
    isFlipped,
    onConfigurationChange,
    pitch,
    quantity,
    rotateAngle,
    structuralDefinition,
    thicknessMm,
    widthCm,
    yaw,
  ]);

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotateAngle((prev) => prev + 90);
  };

  const handleFlip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFlipped((prev) => !prev);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotateAngle(0);
    setIsFlipped(false);
    setZoomLevel(10);
    setOverlaySize(getOverlaySizeFromDimensions(widthCm, heightCm));
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProduct(false);
  };

  const handleOpenAddModal = (title: string) => {
    setModalTitle(title);
    setIsAddModalOpen(true);
  };

  const handleSelectProduct = (product: Product) => {
    setActiveProduct(product);
    setSelectedProduct(true);
    setIsSnapshotApplied(false);
  };

  const captureCurrentSnapshot = useCallback(async () => {
    const snapshot = await captureWorkspaceSnapshot({
      canvasElement: canvasRef.current,
      overlayElement: overlayBoxRef.current,
      backgroundImageUrl: bgImage,
      fallbackProductImageUrl: productOverlayImage,
      hasGeneratedProduct: Boolean(structuralDefinition),
      activeOcclusionObjects,
      rotateAngle,
      isFlipped,
      // Use the export filter — stripped of selection-guide outlines.
      modelFilter: exportModelFilter,
      structuralDefinition: structuralDefinition ?? null,
      yaw,
      pitch,
      lighting: effectiveLighting ?? null,
      glassAppearance,
      includeSill,
      widthCm: Number(widthCm),
      heightCm: Number(heightCm),
    });

    onSnapshotChange?.(snapshot);
    return snapshot;
  }, [
    activeOcclusionObjects,
    bgImage,
    exportModelFilter,
    isFlipped,
    onSnapshotChange,
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

  const applyVisualizationSnapshot = useCallback(async () => {
    setIsCapturingSnapshot(true);

    try {
      await captureCurrentSnapshot();
      setIsSnapshotApplied(true);
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

    for (const variation of ALUMINUM_COLOR_VARIATIONS) {
      const renderer = new ProductModelRenderer(
        renderFrameSize.width,
        renderFrameSize.height,
      );

      try {
        renderer.setSize(renderFrameSize.width, renderFrameSize.height);
        renderer.applyLighting(effectiveLighting ?? null);
        await renderer.loadModel(
          structuralDefinition,
          {
            width: width * 10,
            height: height * 10,
            includeSill,
            include_sill: includeSill,
          },
          glassAppearance,
          includeSill,
          variation.key,
        );

        const renderedCanvas = renderer.render(yaw, pitch);
        if (!renderedCanvas) {
          continue;
        }

        const generatedCanvasOverride = cloneCanvas(renderedCanvas);
        const imageDataUrl = await captureWorkspaceSnapshot({
          canvasElement: canvasRef.current,
          overlayElement: overlayBoxRef.current,
          backgroundImageUrl: bgImage,
          fallbackProductImageUrl: productOverlayImage,
          hasGeneratedProduct: true,
          activeOcclusionObjects,
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
        });

        snapshots.push({
          key: variation.key,
          title: variation.title,
          label: variation.label,
          swatchClassName: variation.swatchClassName,
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
    bgImage,
    effectiveLighting,
    exportModelFilter,
    glassAppearance,
    heightCm,
    includeSill,
    isFlipped,
    onVariationSnapshotsChange,
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
      if (!isSnapshotApplied) {
        await captureCurrentSnapshot();
        setIsSnapshotApplied(true);
      }

      await generateVariationSnapshots();
      router.push("/comparison");
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
    generateVariationSnapshots,
    isSnapshotApplied,
    router,
  ]);

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

  const handleWidthCmChange = (value: string) => {
    setWidthCm(value);
    setOverlaySize(getOverlaySizeFromDimensions(value, heightCm));
  };

  const handleHeightCmChange = (value: string) => {
    setHeightCm(value);
    setOverlaySize(getOverlaySizeFromDimensions(widthCm, value));
  };

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

      if (session.mode === "scale" || session.mode === "width") {
        const widthRatio = nextWidth / Math.max(session.startWidth, 1);
        setWidthCm(String(Math.max(1, Math.round(session.startWidthCm * widthRatio))));
      }

      if (session.mode === "scale" || session.mode === "height") {
        const heightRatio = nextHeight / Math.max(session.startHeight, 1);
        setHeightCm(String(Math.max(1, Math.round(session.startHeightCm * heightRatio))));
      }
    },
    [],
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
            title={modalTitle}
          />
        </div>
      </div>

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

              {/* Product Overlay Element on Canvas with Adjustment Tool (Figma 605:4867) */}
              {selectedProduct && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <motion.div
                    drag={isEditingProduct && !isUsingTransformHandle}
                    dragControls={dragControls}
                    dragListener={false}
                    dragElastic={0}
                    dragMomentum={false}
                    className={[
                      "pointer-events-auto relative",
                      !isEditingProduct || isUsingTransformHandle
                        ? "cursor-default"
                        : "cursor-grab active:cursor-grabbing",
                    ].join(" ")}
                    style={{
                      width: overlaySize.width,
                      height: overlaySize.height,
                    }}
                  >
                    <div
                      className={[
                        "absolute flex items-center gap-2.5 z-30 select-none animate-in fade-in slide-in-from-bottom-2 duration-200",
                        isEditingProduct ? "" : "invisible pointer-events-none",
                      ].join(" ")}
                      style={toolbarControlsStyle}
                    >
                      {/* Rotate Button */}
                      <button
                        type="button"
                        onClick={handleRotate}
                        className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                      >
                        <RotateCw className="w-4 h-4 text-white" />
                        <span className="text-[13px] font-normal tracking-[-0.266px]">Rotate</span>
                      </button>

                      {/* Flip Button */}
                      <button
                        type="button"
                        onClick={handleFlip}
                        className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                      >
                        <FlipHorizontal className="w-4 h-4 text-white" />
                        <span className="text-[13px] font-normal tracking-[-0.266px]">Flip</span>
                      </button>

                      {/* Reset Button */}
                      <button
                        type="button"
                        onClick={handleReset}
                        className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                      >
                        <RotateCcw className="w-4 h-4 text-white" />
                        <span className="text-[13px] font-normal tracking-[-0.266px]">Reset</span>
                      </button>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={handleRemove}
                        className="bg-[#c50000] hover:bg-[#a30000] text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                        <span className="text-[13px] font-normal tracking-[-0.266px]">Remove</span>
                      </button>
                    </div>

                    {/* Model render frame; controls sit on the measured model outline. */}
                    <div
                      ref={overlayBoxRef}
                      onPointerDown={isEditingProduct ? startOverlayDrag : undefined}
                      className={[
                        "relative group select-none",
                        isEditingProduct
                          ? "cursor-grab active:cursor-grabbing"
                          : "cursor-default",
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
                              ref={mvpCanvasRef}
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

                      {isEditingProduct && (
                        <div
                          ref={outlineControlsRef}
                          className="absolute pointer-events-none"
                          style={outlineControlsStyle}
                        >
                          {/* Rotation handles attached to the outlined model layer. */}
                          <button
                            type="button"
                            aria-label="Rotate from top left"
                            onPointerDown={startRotation}
                            className="absolute -top-10 -left-10 z-30 flex size-7 items-center justify-center rounded-full border border-[#07b6d3] bg-white text-[#0f1422] shadow-md hover:bg-[#e9f9fb] cursor-grab active:cursor-grabbing pointer-events-auto"
                          >
                            <RotateCw className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Rotate from top right"
                            onPointerDown={startRotation}
                            className="absolute -top-10 -right-10 z-30 flex size-7 items-center justify-center rounded-full border border-[#07b6d3] bg-white text-[#0f1422] shadow-md hover:bg-[#e9f9fb] cursor-grab active:cursor-grabbing pointer-events-auto"
                          >
                            <RotateCw className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Rotate from bottom left"
                            onPointerDown={startRotation}
                            className="absolute -bottom-10 -left-10 z-30 flex size-7 items-center justify-center rounded-full border border-[#07b6d3] bg-white text-[#0f1422] shadow-md hover:bg-[#e9f9fb] cursor-grab active:cursor-grabbing pointer-events-auto"
                          >
                            <RotateCw className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Rotate from bottom right"
                            onPointerDown={startRotation}
                            className="absolute -bottom-10 -right-10 z-30 flex size-7 items-center justify-center rounded-full border border-[#07b6d3] bg-white text-[#0f1422] shadow-md hover:bg-[#e9f9fb] cursor-grab active:cursor-grabbing pointer-events-auto"
                          >
                            <RotateCw className="size-4" />
                          </button>

                          {/* Corner handles scale the scene, matching the MVP scene-size control. */}
                          <div onPointerDown={(event) => startResize(event, "scale", -1, -1)} className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 cursor-nwse-resize pointer-events-auto" />
                          <div onPointerDown={(event) => startResize(event, "scale", 1, -1)} className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 cursor-nesw-resize pointer-events-auto" />
                          <div onPointerDown={(event) => startResize(event, "scale", -1, 1)} className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 cursor-nesw-resize pointer-events-auto" />
                          <div onPointerDown={(event) => startResize(event, "scale", 1, 1)} className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 size-4 rounded-[2px] bg-white border border-[#06e5ff] shadow-md z-40 cursor-nwse-resize pointer-events-auto" />

                          {/* Edge handles adjust structural width/height. */}
                          <div onPointerDown={(event) => startResize(event, "height", 0, -1)} className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 size-3 bg-[#07b6d3] rounded-full shadow-md z-20 cursor-ns-resize pointer-events-auto" />
                          <div onPointerDown={(event) => startResize(event, "height", 0, 1)} className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 size-3 bg-[#07b6d3] rounded-full shadow-md z-20 cursor-ns-resize pointer-events-auto" />
                          <div onPointerDown={(event) => startResize(event, "width", -1, 0)} className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 size-3 bg-[#07b6d3] rounded-full shadow-md z-20 cursor-ew-resize pointer-events-auto" />
                          <div onPointerDown={(event) => startResize(event, "width", 1, 0)} className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 size-3 bg-[#07b6d3] rounded-full shadow-md z-20 cursor-ew-resize pointer-events-auto" />

                          {/* Center Movement Handle Badge */}
                          <div onPointerDown={startOverlayDrag} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-6 rounded-full bg-[#07b6d3] flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing z-20 pointer-events-auto">
                            <div className="size-2 bg-white rounded-full" />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
              {selectedProduct && activeOcclusionObjects.length > 0 && (
                <div className="absolute inset-0 pointer-events-none z-30">
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
                </div>
              )}
            </div>
          </div>

          {/* Action Instructions Bar */}
          <div className="bg-[#f5f5f5] rounded-[20px] px-5 py-3 flex flex-wrap justify-center items-center gap-2 sm:gap-3 text-sm sm:text-base md:text-lg text-[#0f1422] font-normal tracking-[-0.38px] text-center select-none">
            <span>Click the Product</span>
            <span className="text-[#c3c3c3]">/</span>
            <span>Drag to Move</span>
            <span className="text-[#c3c3c3]">/</span>
            <span>Corner Handles the Resize</span>
            <span className="text-[#c3c3c3]">/</span>
            <span>Tap Circle Rotate</span>
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
            {structuralDefinition ? structuralDefinition.product.productName : "1 product on Canvas"}
          </div>
          {productBuildError && (
            <p className="w-full rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {productBuildError}
            </p>
          )}

          {/* Price Card */}
          <div className="bg-grad-light rounded-[20px] p-6 sm:p-7 flex flex-col gap-2.5 w-full text-white shadow-md">
            <span className="text-xl sm:text-2xl font-normal text-white/90 tracking-[-0.456px]">
              Price:
            </span>
            <span className="text-3xl sm:text-4xl font-medium tracking-[-0.608px] text-white">
              ₱ 18,000
            </span>
            <span className="text-xs font-normal text-white/80 tracking-[-0.228px]">
              excl. install, final after consultation, etc
            </span>
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
                        <div className="flex flex-col gap-2.5">
                          {/* Option 1: Black */}
                          <label
                            onClick={() => setAlumFinish("black")}
                            className="flex items-center gap-3 cursor-pointer select-none"
                          >
                            <div className="w-3 h-3 rounded-full border border-[#0f1422] flex items-center justify-center p-0.5">
                              {alumFinish === "black" && (
                                <div className="w-full h-full rounded-full bg-[#0f1422]" />
                              )}
                            </div>
                            {/* Swatch circle */}
                            <div className="size-6 rounded-full bg-[#151719] shadow-xs border border-gray-300" />
                            <span className="text-[#0f1422] text-base font-normal">
                              Black
                            </span>
                          </label>

                          {/* Option 2: White */}
                          <label
                            onClick={() => setAlumFinish("white")}
                            className="flex items-center gap-3 cursor-pointer select-none"
                          >
                            <div className="w-3 h-3 rounded-full border border-[#0f1422] flex items-center justify-center p-0.5">
                              {alumFinish === "white" && (
                                <div className="w-full h-full rounded-full bg-[#0f1422]" />
                              )}
                            </div>
                            {/* Swatch circle */}
                            <div className="size-6 rounded-full bg-[#f4f1ea] shadow-xs border border-gray-300" />
                            <span className="text-[#0f1422] text-base font-normal">
                              White
                            </span>
                          </label>

                          {/* Option 3: Silver */}
                          <label
                            onClick={() => setAlumFinish("silver")}
                            className="flex items-center gap-3 cursor-pointer select-none"
                          >
                            <div className="w-3 h-3 rounded-full border border-[#0f1422] flex items-center justify-center p-0.5">
                              {alumFinish === "silver" && (
                                <div className="w-full h-full rounded-full bg-[#0f1422]" />
                              )}
                            </div>
                            {/* Swatch circle */}
                            <div className="size-6 rounded-full bg-[#9aa3a5] shadow-xs border border-gray-300" />
                            <span className="text-[#0f1422] text-base font-normal">
                              Silver
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Glass Appearance */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[#c3c3c3] text-base font-normal">Glass Appearance</span>
                        <div className="grid grid-cols-2 gap-2.5">
                          {(["clear", "frosted", "opaque", "reflective", "outdoor"] as GlassAppearanceMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setGlassAppearance(mode)}
                              className={`px-3 py-1.5 rounded-[20px] border border-[#c3c3c3] text-base font-normal capitalize transition-colors cursor-pointer ${glassAppearance === mode
                                ? "bg-[#0f1422] text-white"
                                : "bg-transparent text-[#0f1422]"
                                }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>

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
                      {occlusions.map((item) => (
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
                      ))}
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
            disabled={isCapturingSnapshot}
            onClick={handleSaveSnapshot}
            className="w-full sm:w-auto bg-transparent border border-[#0f1422] hover:bg-neutral-100 text-[#0f1422] font-normal text-base sm:text-[20px] tracking-[-0.38px] leading-[1.4] px-6 py-3.5 rounded-[25px] transition-colors cursor-pointer text-center"
          >
            Save Snapshot
          </button>
          <Button
            type="button"
            disabled={isCapturingSnapshot}
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

function cloneCanvas(source: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (context) {
    context.drawImage(source, 0, 0);
  }

  return canvas;
}

type SnapshotOcclusionObject = SpaceImageSession["objects"][number];

// Snapshot of the overlay's DOM state captured synchronously — before any async
// operations — so both canvas and overlay positions come from the same layout frame.
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
  rotateAngle,
  isFlipped,
  modelFilter,
  generatedCanvasOverride,
  structuralDefinition,
  yaw,
  pitch,
  lighting,
  glassAppearance,
  includeSill,
  widthCm,
  heightCm,
}: {
  canvasElement: HTMLDivElement | null;
  overlayElement: HTMLDivElement | null;
  backgroundImageUrl: string;
  fallbackProductImageUrl: string;
  hasGeneratedProduct: boolean;
  activeOcclusionObjects: SnapshotOcclusionObject[];
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
}) {
  if (!canvasElement) {
    throw new Error("Visualization canvas is not ready yet.");
  }

  // ── Read ALL DOM positions synchronously before the first await ──────────
  // This mirrors the MVP's canvas.toDataURL() approach where the position is
  // captured at a single instant in time with no async gaps between measurements.
  const canvasBounds = canvasElement.getBoundingClientRect();

  let overlayCapture: OverlayCapture | null = null;
  if (overlayElement) {
    const overlayBounds = overlayElement.getBoundingClientRect();
    // offsetWidth/offsetHeight give the unrotated layout dimensions.
    // getBoundingClientRect().width/height give the rotated AABB — its center
    // is still the geometric center of the element for any rotation angle.
    const width = overlayElement.offsetWidth || overlayBounds.width;
    const height = overlayElement.offsetHeight || overlayBounds.height;
    overlayCapture = {
      centerX: overlayBounds.left - canvasBounds.left + overlayBounds.width / 2,
      centerY: overlayBounds.top - canvasBounds.top + overlayBounds.height / 2,
      width,
      height,
      // querySelector is synchronous — grab the Three.js WebGL canvas now.
      generatedCanvas:
        generatedCanvasOverride ?? overlayElement.querySelector("canvas"),
    };
  }
  // ── End synchronous DOM capture ──────────────────────────────────────────

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
  context.fillStyle = "#f5f5f5";
  context.fillRect(0, 0, canvasBounds.width, canvasBounds.height);

  // Draw background using object-contain math to perfectly match the DOM <img>
  // rendering, even if the container aspect ratio doesn't perfectly match the image.
  const backgroundImage = await loadSnapshotImage(backgroundImageUrl);
  drawObjectContainImage(
    context,
    backgroundImage,
    0,
    0,
    canvasBounds.width,
    canvasBounds.height,
  );

  if (overlayCapture) {
    await drawSnapshotOverlay({
      context,
      overlayCapture,
      fallbackProductImageUrl,
      hasGeneratedProduct,
      rotateAngle,
      isFlipped,
      modelFilter,
      structuralDefinition,
      yaw,
      pitch,
      lighting,
      glassAppearance,
      includeSill,
      widthCm,
      heightCm,
    });
  }

  for (const object of activeOcclusionObjects) {
    await drawMaskedBackgroundLayer({
      outputWidth: canvasBounds.width,
      outputHeight: canvasBounds.height,
      context,
      backgroundImage,
      maskUrl: object.mask_url,
    });
  }

  return output.toDataURL("image/jpeg", 0.92);
}

async function drawSnapshotOverlay({
  context,
  overlayCapture,
  fallbackProductImageUrl,
  hasGeneratedProduct,
  rotateAngle,
  isFlipped,
  modelFilter,
  structuralDefinition,
  yaw,
  pitch,
  lighting,
  glassAppearance,
  includeSill,
  widthCm,
  heightCm,
}: {
  context: CanvasRenderingContext2D;
  // All position data was captured synchronously in captureWorkspaceSnapshot
  // before any awaits — no new DOM reads happen here.
  overlayCapture: OverlayCapture;
  fallbackProductImageUrl: string;
  hasGeneratedProduct: boolean;
  rotateAngle: number;
  isFlipped: boolean;
  modelFilter: React.CSSProperties["filter"];
  structuralDefinition: ProductStructuralDefinition | null;
  yaw: number;
  pitch: number;
  lighting: LightingAnalysis | null;
  glassAppearance: GlassAppearanceMode;
  includeSill: boolean;
  widthCm: number;
  heightCm: number;
}) {
  const { centerX, centerY, width, height, generatedCanvas } = overlayCapture;

  context.save();
  // Translate to the model's center (canvas-local CSS pixels), then rotate.
  // This matches the MVP: context.translate(transform.x, transform.y) +
  // context.rotate(rotation) + drawImage centered at origin.
  context.translate(centerX, centerY);
  context.rotate((rotateAngle * Math.PI) / 180);

  if (isFlipped) {
    context.scale(-1, 1);
  }

  if (typeof modelFilter === "string" && modelFilter.length > 0) {
    context.filter = modelFilter;
  }

  if (hasGeneratedProduct && generatedCanvas) {
    // Draw the high-resolution canvas that was generated by the MVP renderer
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

    if (lighting.suggested.blur_px > 0) {
      filters.push(`blur(${clampNumber(lighting.suggested.blur_px, 0, 0.45)}px)`);
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

    if (lighting.suggested.blur_px > 0) {
      filters.push(`blur(${clampNumber(lighting.suggested.blur_px, 0, 0.45)}px)`);
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
