/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import {
  X,
  Check,
  RotateCcw,
  Info,
  FileCheck2,
  Sparkles,
  Loader2,
} from "lucide-react";
import type {
  FiducialPaperStandard,
  Point2D,
} from "@/lib/visualization/types";
import { PAPER_STANDARD_METRICS } from "@/lib/visualization/types";
import {
  computeScaleFromPaperCorners,
  orderPaperCorners,
} from "@/lib/visualization/scaleEstimation";
import { useDocumentScrollLock } from "../hooks/useDocumentScrollLock";
import { mapPointerToCanvas, TOUCH_PROXY_OFFSET_CSS_PX } from "../mobileConfiguratorGeometry";
import {
  computeMagneticSnap,
  extractPatchImageData,
  computeEdgeFitQuality,
  calculateExtendedGuideLines,
} from "@/lib/visualization/magneticSnapping";
import { requestClickGuidedPaperDetection } from "@/lib/visualization/paperReference";

export interface FiducialPaperPickerModalProps {
  isOpen?: boolean;
  sessionId?: string;
  localBlobUrl?: string;
  backgroundImageUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  initialCorners?: [Point2D, Point2D, Point2D, Point2D] | Point2D[] | null;
  paperStandard?: FiducialPaperStandard;
  onConfirm: (
    corners: [Point2D, Point2D, Point2D, Point2D],
    result: { scaleCmPerPx: number; confidence: number },
  ) => void;
  onSkip: () => void;
  onCancel: () => void;
}

const CORNER_NAMES = [
  "Top-Left",
  "Top-Right",
  "Bottom-Right",
  "Bottom-Left",
] as const;

type ActiveCornerDrag = {
  pointerId: number;
  pointerType: string;
  index: number;
  contactX: number;
  contactY: number;
};

/**
 * Creates default centered rectangle matching the given paper standard aspect ratio.
 */
function createDefaultPaperCorners(
  canvasWidth: number,
  canvasHeight: number,
  standard: FiducialPaperStandard,
): [Point2D, Point2D, Point2D, Point2D] {
  const metrics = PAPER_STANDARD_METRICS[standard] ?? PAPER_STANDARD_METRICS.a4;
  const targetRatio = metrics.widthMm / metrics.heightMm;

  // Use ~20% of canvas width as default box width
  const boxW = Math.max(60, Math.round(canvasWidth * 0.2));
  const boxH = Math.max(80, Math.round(boxW / targetRatio));

  const cx = Math.round(canvasWidth / 2);
  const cy = Math.round(canvasHeight / 2);

  const halfW = Math.round(boxW / 2);
  const halfH = Math.round(boxH / 2);

  return [
    { x: cx - halfW, y: cy - halfH }, // TL
    { x: cx + halfW, y: cy - halfH }, // TR
    { x: cx + halfW, y: cy + halfH }, // BR
    { x: cx - halfW, y: cy + halfH }, // BL
  ];
}

/**
 * Interactive 4-point paper pin fallback modal (IMP-MS47).
 * Enables customer to pin the 4 corners of their taped Philippine paper sheet
 * on low-contrast walls and grounds workspace dimensions with precision scale.
 */
export function FiducialPaperPickerModal({
  isOpen = true,
  sessionId,
  localBlobUrl,
  backgroundImageUrl,
  canvasWidth,
  canvasHeight,
  initialCorners,
  paperStandard = "a4",
  onConfirm,
  onSkip,
  onCancel,
}: FiducialPaperPickerModalProps) {
  const [selectedStandard, setSelectedStandard] = useState<FiducialPaperStandard>(paperStandard);

  const [points, setPoints] = useState<[Point2D, Point2D, Point2D, Point2D]>(() => {
    if (initialCorners && initialCorners.length === 4) {
      return orderPaperCorners(initialCorners);
    }
    return createDefaultPaperCorners(canvasWidth, canvasHeight, paperStandard);
  });

  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const [activeCornerDrag, setActiveCornerDrag] = useState<ActiveCornerDrag | null>(null);
  const [availableCanvasSize, setAvailableCanvasSize] = useState({ width: 0, height: 0 });

  // Click-guided interactive state (IMP-MS58)
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const [isSnapping, setIsSnapping] = useState<boolean>(false);
  const [snapNotice, setSnapNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Client-side magnetic edge snapping state (IMP-MS59)
  const [isSnapped, setIsSnapped] = useState<boolean>(false);
  const [snapGradientStrength, setSnapGradientStrength] = useState<number>(0);
  const lastSnappedRef = useRef<boolean>(false);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const effectiveImageUrl = localBlobUrl || backgroundImageUrl;

  useEffect(() => {
    const srcToLoad = localBlobUrl || backgroundImageUrl;
    if (!srcToLoad || canvasWidth <= 0 || canvasHeight <= 0) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const offCanvas = document.createElement("canvas");
        offCanvas.width = canvasWidth;
        offCanvas.height = canvasHeight;
        const ctx = offCanvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
          offscreenCanvasRef.current = offCanvas;
        }
      } catch {
        // Tainted canvas or draw failure handled gracefully
      }
    };
    img.src = srcToLoad;
  }, [localBlobUrl, backgroundImageUrl, canvasWidth, canvasHeight]);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);

  useDocumentScrollLock(isOpen);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateSize = () => {
      const bounds = container.getBoundingClientRect();
      setAvailableCanvasSize({ width: bounds.width, height: bounds.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const fittedCanvasSize = (() => {
    if (availableCanvasSize.width <= 0 || availableCanvasSize.height <= 0) {
      return { width: 0, height: 0 };
    }
    const scale = Math.min(
      availableCanvasSize.width / canvasWidth,
      availableCanvasSize.height / canvasHeight,
    );
    return {
      width: Math.max(1, canvasWidth * scale),
      height: Math.max(1, canvasHeight * scale),
    };
  })();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const getCanvasCoordinates = useCallback(
    (clientX: number, clientY: number): Point2D | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      return mapPointerToCanvas({
        clientX,
        clientY,
        bounds: rect,
        canvasWidth,
        canvasHeight,
        offsetCssPx: activeCornerDrag?.pointerType === "touch"
          ? TOUCH_PROXY_OFFSET_CSS_PX
          : 0,
      });
    },
    [activeCornerDrag?.pointerType, canvasWidth, canvasHeight],
  );

  const handleHandlePointerDown = (
    index: number,
    e: React.PointerEvent<SVGCircleElement | SVGTextElement | SVGGElement>,
  ) => {
    if (activeCornerDrag !== null || !e.isPrimary || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const coord = getCanvasCoordinates(e.clientX, e.clientY);
    if (coord) {
      dragOffsetRef.current = {
        x: points[index].x - coord.x,
        y: points[index].y - coord.y,
      };
    }
    setActiveDragIndex(index);
    setActiveCornerDrag({
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      index,
      contactX: e.clientX,
      contactY: e.clientY,
    });
  };

  const handleSvgPointerMove = (
    e: React.PointerEvent<SVGSVGElement | SVGGElement>,
  ) => {
    if (activeDragIndex === null || !activeCornerDrag || e.pointerId !== activeCornerDrag.pointerId) return;
    const coord = getCanvasCoordinates(e.clientX, e.clientY);
    if (!coord) return;

    const offset = dragOffsetRef.current ?? { x: 0, y: 0 };
    let x = Math.max(0, Math.min(canvasWidth, coord.x + offset.x));
    let y = Math.max(0, Math.min(canvasHeight, coord.y + offset.y));

    // Client-side magnetic edge snapping (IMP-MS59 / QAD-TC74)
    let snappedNow = false;
    let strengthNow = 0;
    const offCanvas = offscreenCanvasRef.current;
    if (offCanvas) {
      const patch = extractPatchImageData(offCanvas, x, y, 24);
      if (patch) {
        const snap = computeMagneticSnap({ x, y }, patch, 10);
        if (snap.snapped) {
          x = Math.max(0, Math.min(canvasWidth, snap.snappedPoint.x));
          y = Math.max(0, Math.min(canvasHeight, snap.snappedPoint.y));
          snappedNow = true;
          strengthNow = snap.gradientStrength;

          if (!lastSnappedRef.current && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            try {
              navigator.vibrate(10);
            } catch {
              // Best effort
            }
          }
        }
      }
    }
    lastSnappedRef.current = snappedNow;
    setIsSnapped(snappedNow);
    setSnapGradientStrength(strengthNow);

    setPoints((prev) => {
      const next = [...prev] as [Point2D, Point2D, Point2D, Point2D];
      next[activeDragIndex] = { x, y };
      return next;
    });

    setActiveCornerDrag((current) => current && current.pointerId === e.pointerId
      ? { ...current, contactX: e.clientX, contactY: e.clientY }
      : current);
  };

  const handleSvgPointerUp = (
    e: React.PointerEvent<SVGSVGElement | SVGGElement>,
  ) => {
    if (activeDragIndex !== null && activeCornerDrag?.pointerId === e.pointerId) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Pointer capture release is best effort
      }
      dragOffsetRef.current = null;
      setActiveDragIndex(null);
      setActiveCornerDrag(null);
      lastSnappedRef.current = false;
      setIsSnapped(false);
      setSnapGradientStrength(0);
    }
  };

  const handleResetToCenter = () => {
    setPoints(createDefaultPaperCorners(canvasWidth, canvasHeight, selectedStandard));
    dragOffsetRef.current = null;
    setActiveDragIndex(null);
    setActiveCornerDrag(null);
    lastSnappedRef.current = false;
    setIsSnapped(false);
    setSnapGradientStrength(0);
    setSnapNotice(null);
  };

  const handleTapToSnap = useCallback(
    async (canvasX: number, canvasY: number) => {
      const rippleId = Date.now();
      setClickRipple({ x: canvasX, y: canvasY, id: rippleId });
      setTimeout(() => {
        setClickRipple((curr) => (curr?.id === rippleId ? null : curr));
      }, 900);

      setSnapNotice(null);

      const normX = Math.max(0, Math.min(1, canvasX / canvasWidth));
      const normY = Math.max(0, Math.min(1, canvasY / canvasHeight));
      const seedPoint = { x: normX, y: normY };

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const ac = new AbortController();
      abortControllerRef.current = ac;
      setIsSnapping(true);

      try {
        const res = await requestClickGuidedPaperDetection(
          sessionId || effectiveImageUrl,
          seedPoint,
          selectedStandard,
          ac.signal,
          sessionId,
        );

        if (res.outcome === "candidate_found" && res.candidate) {
          const ordered = orderPaperCorners(res.candidate.corners.map(([x, y]) => ({ x, y })));
          setPoints(ordered);
          setSnapNotice({
            type: "success",
            message: "Snapped pins to detected paper boundary",
          });
        } else {
          setSnapNotice({
            type: "info",
            message: "No paper boundary detected near tap. Tap directly on the sheet or drag pins manually.",
          });
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setSnapNotice({
          type: "error",
          message: "Detection was interrupted. Adjust pins manually or tap again.",
        });
      } finally {
        setIsSnapping(false);
      }
    },
    [effectiveImageUrl, sessionId, canvasHeight, canvasWidth, selectedStandard],
  );

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeCornerDrag !== null || !e.isPrimary || e.button !== 0) return;
    const coord = getCanvasCoordinates(e.clientX, e.clientY);
    if (!coord) return;
    handleTapToSnap(coord.x, coord.y);
  };

  // Live scale preview
  const liveScale = (() => {
    try {
      return computeScaleFromPaperCorners(points, selectedStandard);
    } catch {
      return null;
    }
  })();

  const handleConfirm = () => {
    try {
      const ordered = orderPaperCorners(points);
      const scaleResult = computeScaleFromPaperCorners(ordered, selectedStandard);
      onConfirm(ordered, scaleResult);
    } catch (err) {
      console.warn("Paper calibration confirmation warning:", err);
    }
  };

  if (!isOpen) return null;

  const currentMetrics = PAPER_STANDARD_METRICS[selectedStandard];
  const polygonPointsAttr = points.map((p) => `${p.x},${p.y}`).join(" ");
  const extendedGuides = calculateExtendedGuideLines(points, 20);

  // Loupe position calculation (2.5x circular loupe with magnetic snap)
  const loupeActive = activeCornerDrag !== null && activeDragIndex !== null;
  const draggedPoint = loupeActive ? points[activeDragIndex] : null;

  const loupeParams = (() => {
    if (!loupeActive || !draggedPoint) return null;
    const windowH = typeof window !== "undefined" ? window.innerHeight : 800;
    const windowW = typeof window !== "undefined" ? window.innerWidth : 1200;

    const isTopScreen = activeCornerDrag.contactY < windowH * 0.15;
    const verticalOffset = isTopScreen ? 70 : -70;

    const targetX = activeCornerDrag.contactX;
    const targetY = activeCornerDrag.contactY + verticalOffset;

    const loupeX = Math.max(60, Math.min(windowW - 60, targetX));
    const loupeY = Math.max(60, Math.min(windowH - 60, targetY));

    const zoom = 2.5;
    const loupeDiameter = 112;
    const halfD = loupeDiameter / 2;

    const pointXInFitted = (draggedPoint.x / canvasWidth) * fittedCanvasSize.width;
    const pointYInFitted = (draggedPoint.y / canvasHeight) * fittedCanvasSize.height;

    const imgLeft = halfD - pointXInFitted * zoom;
    const imgTop = halfD - pointYInFitted * zoom;
    const imgWidth = fittedCanvasSize.width * zoom;
    const imgHeight = fittedCanvasSize.height * zoom;

    return {
      loupeX,
      loupeY,
      imgLeft,
      imgTop,
      imgWidth,
      imgHeight,
      contactX: activeCornerDrag.contactX,
      contactY: activeCornerDrag.contactY,
      pointerType: activeCornerDrag.pointerType,
      cornerIndex: activeDragIndex,
    };
  })();

  // Center coordinate of polygon for badge placement
  const centerX = Math.round((points[0].x + points[1].x + points[2].x + points[3].x) / 4);
  const centerY = Math.round((points[0].y + points[1].y + points[2].y + points[3].y) / 4);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-between select-none animate-in fade-in duration-200 [padding-top:max(.5rem,env(safe-area-inset-top))] [padding-right:max(.5rem,env(safe-area-inset-right))] [padding-bottom:max(.5rem,env(safe-area-inset-bottom))] [padding-left:max(.5rem,env(safe-area-inset-left))] portrait:[padding-top:max(1rem,env(safe-area-inset-top))] portrait:[padding-right:max(1rem,env(safe-area-inset-right))] portrait:[padding-bottom:max(1rem,env(safe-area-inset-bottom))] portrait:[padding-left:max(1rem,env(safe-area-inset-left))] sm:portrait:p-6"
    >
      {/* Top Header Card */}
      <div className="z-10 flex w-full max-w-5xl flex-col gap-3 landscape:absolute landscape:inset-x-2 landscape:top-2 landscape:mx-auto landscape:w-auto">
        <div className="flex items-center justify-between gap-3 bg-white rounded-[20px] px-4 sm:px-6 py-2.5 portrait:py-3 shadow-xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="size-9 rounded-[12px] bg-emerald-500/15 flex items-center justify-center text-emerald-600">
              <FileCheck2 className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[#0f1422] leading-tight">
                Pin Your Taped Paper Corners
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500">
                Target: {currentMetrics.label} ({currentMetrics.widthMm} x {currentMetrics.heightMm} mm)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Standard selector pills */}
            <div className="hidden sm:flex items-center gap-1 rounded-full bg-neutral-100 p-1">
              {(["short", "a4", "long"] as const).map((std) => (
                <button
                  key={std}
                  type="button"
                  onClick={() => setSelectedStandard(std)}
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedStandard === std
                      ? "bg-white text-[#0f1422] shadow-xs font-semibold"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  {std.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="cursor-pointer rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Guidance Tip Pill */}
        <div className="flex items-center justify-between gap-2 rounded-[14px] bg-neutral-900/80 backdrop-blur-md px-4 py-2 text-xs text-white shadow-md">
          <div className="flex items-center gap-2 min-w-0">
            {isSnapping ? (
              <Loader2 className="size-4 shrink-0 text-[#07b6d3] animate-spin" />
            ) : snapNotice ? (
              <Sparkles className="size-4 shrink-0 text-[#07b6d3] animate-pulse" />
            ) : (
              <Info className="size-4 shrink-0 text-[#07b6d3]" />
            )}
            <span className="truncate">
              {isSnapping
                ? "Detecting paper sheet at tap location..."
                : snapNotice
                ? snapNotice.message
                : "Tap the sheet to snap corners automatically, or drag the 4 corner handles manually."}
            </span>
          </div>
          {liveScale && (
            <span className="shrink-0 font-medium text-emerald-400">
              Scale: ~{liveScale.scaleCmPerPx} cm/px
            </span>
          )}
        </div>
      </div>

      {/* Middle Interactive Canvas Area */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full max-w-5xl flex items-center justify-center my-2 overflow-hidden"
      >
        {fittedCanvasSize.width > 0 && fittedCanvasSize.height > 0 && (
          <div
            className="relative rounded-[16px] overflow-hidden shadow-2xl bg-neutral-900"
            style={{
              width: fittedCanvasSize.width,
              height: fittedCanvasSize.height,
            }}
          >
            {/* Background Room Photo */}
            <img
              src={effectiveImageUrl}
              alt="Room photo with taped paper"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
            />

            {/* Interactive SVG Pin Overlay */}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              className="absolute inset-0 w-full h-full cursor-crosshair touch-none select-none"
              onPointerDown={handleSvgPointerDown}
              onPointerMove={handleSvgPointerMove}
              onPointerUp={handleSvgPointerUp}
              onPointerCancel={handleSvgPointerUp}
            >
              {/* Tap to Snap Ripple Animation (IMP-MS58) */}
              {clickRipple && (
                <g className="pointer-events-none">
                  <circle
                    cx={clickRipple.x}
                    cy={clickRipple.y}
                    r={28}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    className="animate-ping"
                    style={{ transformOrigin: `${clickRipple.x}px ${clickRipple.y}px` }}
                  />
                  <circle
                    cx={clickRipple.x}
                    cy={clickRipple.y}
                    r={5}
                    fill="#10b981"
                  />
                </g>
              )}

              {/* Collinearity straightness guide lines (IMP-MS59) */}
              {extendedGuides.map((guide, idx) => (
                <line
                  key={`guide-ext-${idx}`}
                  x1={guide.start.x}
                  y1={guide.start.y}
                  x2={guide.end.x}
                  y2={guide.end.y}
                  stroke={isSnapped ? "#10b981" : "#0284c7"}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  strokeOpacity="0.65"
                  className="pointer-events-none"
                />
              ))}

              {/* Shaded Calibrated Quadrilateral Polygon */}
              <polygon
                points={polygonPointsAttr}
                fill="rgba(16, 185, 129, 0.20)"
                stroke="#10b981"
                strokeWidth={Math.max(2, Math.round(canvasWidth * 0.003))}
                strokeDasharray="6 4"
              />

              {/* Center Paper Marker Tag */}
              <g transform={`translate(${centerX}, ${centerY})`}>
                <rect
                  x="-75"
                  y="-14"
                  width="150"
                  height="28"
                  rx="14"
                  fill="rgba(15, 20, 34, 0.85)"
                  stroke="#10b981"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={Math.max(11, Math.round(canvasWidth * 0.012))}
                  fontWeight="600"
                >
                  Taped Paper Marker
                </text>
              </g>

              {/* Draggable Corner Handles */}
              {points.map((pt, idx) => {
                const isActive = activeDragIndex === idx;
                const handleRadius = Math.max(10, Math.round(canvasWidth * 0.015));

                return (
                  <g
                    key={idx}
                    onPointerDown={(e) => handleHandlePointerDown(idx, e)}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    {/* Outer glow ring when active */}
                    {isActive && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={handleRadius * 1.8}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        className="animate-spin"
                        style={{ transformOrigin: `${pt.x}px ${pt.y}px` }}
                      />
                    )}

                    {/* Touch target hit proxy area */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={Math.max(24, handleRadius * 2.2)}
                      fill="transparent"
                    />

                    {/* Visible Handle Pin */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={handleRadius}
                      fill="#ffffff"
                      stroke="#10b981"
                      strokeWidth={isActive ? "3.5" : "2.5"}
                    />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={Math.max(3, handleRadius * 0.35)}
                      fill="#10b981"
                    />

                    {/* Corner Position Label Tag */}
                    <text
                      x={pt.x}
                      y={idx === 0 || idx === 1 ? pt.y - handleRadius - 6 : pt.y + handleRadius + 14}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={Math.max(10, Math.round(canvasWidth * 0.011))}
                      fontWeight="bold"
                      className="pointer-events-none select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                    >
                      {CORNER_NAMES[idx]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Bottom Control Actions */}
      <div className="z-10 flex w-full max-w-5xl flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white rounded-[20px] px-4 sm:px-6 py-3 shadow-xl">
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <button
            type="button"
            onClick={handleResetToCenter}
            className="flex cursor-pointer items-center gap-1.5 rounded-[20px] border border-neutral-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-medium text-[#0f1422] transition-colors hover:bg-neutral-100"
          >
            <RotateCcw className="size-4 text-neutral-500" />
            <span>Reset to Center</span>
          </button>

          <button
            type="button"
            onClick={onSkip}
            className="flex cursor-pointer items-center gap-1 rounded-[20px] border border-neutral-200 bg-transparent px-3.5 py-2.5 text-xs sm:text-sm font-normal text-neutral-600 transition-colors hover:bg-neutral-100"
          >
            <span>Skip to Quick Preview</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-[20px] bg-[#0f1422] hover:bg-black px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors"
        >
          <Check className="size-4 text-emerald-400" />
          <span>Confirm & Calibrate</span>
        </button>
      </div>

      {/* 2.5x Circular Loupe Magnifier with Magnetic Snapping */}
      {loupeParams && (
        <div className="pointer-events-none fixed inset-0 z-[70]" aria-hidden="true">
          {loupeParams.pointerType === "touch" && (
            <span
              className="absolute h-0.5 origin-left bg-white shadow-[0_0_3px_#0f1422]"
              style={{
                left: loupeParams.contactX,
                top: loupeParams.contactY,
                width: Math.hypot(
                  loupeParams.loupeX - loupeParams.contactX,
                  loupeParams.loupeY - loupeParams.contactY,
                ),
                transform: `rotate(${
                  (Math.atan2(
                    loupeParams.loupeY - loupeParams.contactY,
                    loupeParams.loupeX - loupeParams.contactX,
                  ) *
                    180) /
                  Math.PI
                }deg)`,
              }}
            />
          )}

          <div
            className={`absolute size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-neutral-900 shadow-2xl overflow-hidden ring-2 transition-all ${
              isSnapped
                ? "ring-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.5)]"
                : "ring-sky-500/80"
            }`}
            style={{ left: loupeParams.loupeX, top: loupeParams.loupeY }}
          >
            <img
              src={effectiveImageUrl}
              alt="Magnified corner view"
              className="absolute max-w-none pointer-events-none select-none"
              style={{
                left: loupeParams.imgLeft,
                top: loupeParams.imgTop,
                width: loupeParams.imgWidth,
                height: loupeParams.imgHeight,
              }}
            />

            {/* Fine Center Crosshairs */}
            <span
              className={`absolute left-0 top-1/2 h-[1px] w-full -translate-y-1/2 transition-colors ${
                isSnapped
                  ? "bg-emerald-400 shadow-[0_0_4px_#10b981]"
                  : "bg-sky-400/90 shadow-xs"
              }`}
            />
            <span
              className={`absolute left-1/2 top-0 h-full w-[1px] -translate-x-1/2 transition-colors ${
                isSnapped
                  ? "bg-emerald-400 shadow-[0_0_4px_#10b981]"
                  : "bg-sky-400/90 shadow-xs"
              }`}
            />
            <span
              className={`absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white transition-all ${
                isSnapped
                  ? "bg-emerald-500 ring-2 ring-emerald-300 scale-110"
                  : "bg-sky-500"
              }`}
            />

            {/* Edge Fit Quality percentage badge */}
            {(() => {
              const quality = computeEdgeFitQuality(snapGradientStrength, isSnapped);
              const badgeBg =
                quality.badgeVariant === "green"
                  ? "bg-emerald-600/90 text-white border-emerald-400/60"
                  : quality.badgeVariant === "yellow"
                  ? "bg-amber-500/90 text-white border-amber-300/60"
                  : "bg-black/75 text-neutral-300 border-white/20";

              return (
                <span
                  className={`absolute top-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold border shadow-xs whitespace-nowrap ${badgeBg}`}
                >
                  {isSnapped ? `Edge Fit ${quality.percentage}%` : "Manual"}
                </span>
              );
            })()}

            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/75 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow-xs">
              Pin {loupeParams.cornerIndex + 1}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
