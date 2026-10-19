/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import {
  X,
  Check,
  RotateCcw,
  FileCheck2,
  AlertTriangle,
} from "lucide-react";
import type {
  FiducialPaperStandard,
  PaperCalibrationStatus,
  Point2D,
} from "@/lib/visualization/types";
import { PAPER_STANDARD_METRICS } from "@/lib/visualization/types";
import {
  computeScaleFromPaperCorners,
  orderPaperCorners,
} from "@/lib/visualization/scaleEstimation";
import { isValidQuadrilateral } from "@/lib/visualization/perspectiveTransform";
import { useDocumentScrollLock } from "../hooks/useDocumentScrollLock";
import { mapPointerToCanvas, TOUCH_PROXY_OFFSET_CSS_PX } from "../mobileConfiguratorGeometry";

export interface PaperDetectionConfirmationModalProps {
  isOpen?: boolean;
  backgroundImageUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  initialCorners?: [Point2D, Point2D, Point2D, Point2D] | Point2D[] | null;
  paperStandard?: FiducialPaperStandard;
  confidence?: number;
  status?: PaperCalibrationStatus;
  onConfirm: (
    corners: [Point2D, Point2D, Point2D, Point2D],
    result: { scaleCmPerPx: number; confidence: number },
    paperStandard: FiducialPaperStandard,
  ) => void;
  onSkip: () => void;
  onCancel: () => void;
}

const CORNER_NAMES = [
  "1: Top-Left",
  "2: Top-Right",
  "3: Bottom-Right",
  "4: Bottom-Left",
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
  const metrics = PAPER_STANDARD_METRICS[standard] ?? PAPER_STANDARD_METRICS.short;
  const targetRatio = metrics.widthMm / metrics.heightMm;

  // Use ~22% of canvas width as default box width
  const boxW = Math.max(70, Math.round(canvasWidth * 0.22));
  const boxH = Math.max(90, Math.round(boxW / targetRatio));

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
 * Interactive Pre-Workspace Fiducial Paper Detection Confirmation Gateway (IMP-MS51).
 * Displays auto-detected paper quadrilateral boundary with touch/pointer loupe magnification,
 * paper standard selection, convexity guardrails, and one-click scale verification.
 */
export function PaperDetectionConfirmationModal({
  isOpen = true,
  backgroundImageUrl,
  canvasWidth,
  canvasHeight,
  initialCorners,
  paperStandard = "short",
  confidence = 0.95,
  status,
  onConfirm,
  onSkip,
  onCancel,
}: PaperDetectionConfirmationModalProps) {
  const [selectedStandard, setSelectedStandard] = useState<FiducialPaperStandard>(paperStandard);

  const hasAutoDetection = Boolean(
    initialCorners &&
      initialCorners.length === 4 &&
      status !== "manual_pin_required" &&
      confidence >= 0.65,
  );

  const orderedInitial = initialCorners && initialCorners.length === 4
    ? orderPaperCorners(initialCorners)
    : null;
  const initialDetectedRef = useRef<[Point2D, Point2D, Point2D, Point2D] | null>(orderedInitial);

  const [points, setPoints] = useState<[Point2D, Point2D, Point2D, Point2D]>(() => {
    if (orderedInitial) {
      return orderedInitial;
    }
    return createDefaultPaperCorners(canvasWidth, canvasHeight, paperStandard);
  });

  const [hasUserAdjusted, setHasUserAdjusted] = useState<boolean>(false);
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const [activeCornerDrag, setActiveCornerDrag] = useState<ActiveCornerDrag | null>(null);
  const [availableCanvasSize, setAvailableCanvasSize] = useState({ width: 0, height: 0 });

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
        offsetCssPx:
          activeCornerDrag?.pointerType === "touch" ? TOUCH_PROXY_OFFSET_CSS_PX : 0,
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
    setHasUserAdjusted(true);
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement | SVGGElement>) => {
    if (
      activeDragIndex === null ||
      !activeCornerDrag ||
      e.pointerId !== activeCornerDrag.pointerId
    )
      return;
    const coord = getCanvasCoordinates(e.clientX, e.clientY);
    if (!coord) return;

    const offset = dragOffsetRef.current ?? { x: 0, y: 0 };
    const x = Math.max(0, Math.min(canvasWidth, coord.x + offset.x));
    const y = Math.max(0, Math.min(canvasHeight, coord.y + offset.y));

    setPoints((prev) => {
      const next = [...prev] as [Point2D, Point2D, Point2D, Point2D];
      next[activeDragIndex] = { x, y };
      return next;
    });

    setActiveCornerDrag((current) =>
      current && current.pointerId === e.pointerId
        ? { ...current, contactX: e.clientX, contactY: e.clientY }
        : current,
    );
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement | SVGGElement>) => {
    if (activeDragIndex !== null && activeCornerDrag?.pointerId === e.pointerId) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Pointer capture release is best effort
      }

      // Re-order canonical corners on release
      setPoints((prev) => {
        try {
          return orderPaperCorners(prev);
        } catch {
          return prev;
        }
      });

      dragOffsetRef.current = null;
      setActiveDragIndex(null);
      setActiveCornerDrag(null);
    }
  };

  const handleResetCorners = () => {
    if (initialDetectedRef.current) {
      setPoints(initialDetectedRef.current);
      setHasUserAdjusted(false);
    } else {
      setPoints(createDefaultPaperCorners(canvasWidth, canvasHeight, selectedStandard));
      setHasUserAdjusted(false);
    }
    dragOffsetRef.current = null;
    setActiveDragIndex(null);
    setActiveCornerDrag(null);
  };

  // Convexity check
  const isValidQuad = isValidQuadrilateral(points);

  // Live scale preview
  const liveScale = (() => {
    if (!isValidQuad) return null;
    try {
      return computeScaleFromPaperCorners(points, selectedStandard);
    } catch {
      return null;
    }
  })();

  const handleConfirm = () => {
    if (!isValidQuad) return;
    try {
      const ordered = orderPaperCorners(points);
      const scaleResult = computeScaleFromPaperCorners(ordered, selectedStandard);
      onConfirm(ordered, scaleResult, selectedStandard);
    } catch (err) {
      console.warn("Paper calibration confirmation warning:", err);
    }
  };

  if (!isOpen) return null;

  const polygonPointsAttr = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Detection state badge label & styling
  let badgeLabel = "Auto-Detected (95% Match)";
  let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";

  if (hasUserAdjusted) {
    badgeLabel = "Manual Adjustment Active";
    badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (!hasAutoDetection) {
    badgeLabel = "Manual Pin Placement";
    badgeStyle = "bg-sky-50 text-sky-700 border-sky-200";
  } else {
    const matchPct = Math.min(99, Math.max(65, Math.round(confidence * 100)));
    badgeLabel = `Auto-Detected (${matchPct}% Match)`;
    badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  // Loupe position calculation
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

    // Magnification 2.5x
    const zoom = 2.5;
    const loupeDiameter = 112; // 28 * 4px
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

  const scaleMmPerPx = liveScale
    ? (liveScale.scaleCmPerPx * 10).toFixed(2)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-between select-none animate-in fade-in duration-200 p-2 sm:p-4 md:p-6 overflow-hidden">
      {/* ── Top Header Card ── */}
      <div className="z-10 flex w-full max-w-5xl flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-[20px] px-4 sm:px-6 py-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-[12px] bg-emerald-500/15 flex items-center justify-center text-emerald-600 shrink-0">
              <FileCheck2 className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[#0f1422] leading-tight">
                {hasAutoDetection && !hasUserAdjusted
                  ? "Confirm Reference Paper Marker"
                  : "Refine Reference Paper Marker"}
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 truncate">
                Verify the detected paper boundary to ensure millimeter-accurate 3D model sizing.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2.5">
            {/* Detection status badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badgeStyle} shadow-xs`}
            >
              <span className="size-2 rounded-full bg-current" />
              {badgeLabel}
            </span>

            {/* Close button */}
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

        {/* ── Guidance & Paper Standard Selector HUD ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-[16px] bg-neutral-900/90 backdrop-blur-md px-4 py-2 text-xs text-white shadow-md">
          {/* Paper Standard Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-400 text-xs font-medium mr-1 hidden sm:inline">
              Paper Standard:
            </span>
            <div className="flex items-center gap-1 rounded-full bg-neutral-800/80 p-0.5 border border-white/10">
              {(["short", "a4", "long"] as const).map((std) => (
                <button
                  key={std}
                  type="button"
                  onClick={() => setSelectedStandard(std)}
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-xs transition-all ${
                    selectedStandard === std
                      ? "bg-white text-[#0f1422] font-bold shadow-xs"
                      : "text-neutral-300 hover:text-white"
                  }`}
                >
                  {std === "short"
                    ? "Short Bond (8.5x11in)"
                    : std === "a4"
                    ? "A4 (210x297mm)"
                    : "Long Bond (8.5x13in)"}
                </button>
              ))}
            </div>
          </div>

          {/* Metric Scale Readout or Error */}
          <div className="flex items-center gap-2 font-mono text-xs">
            {isValidQuad && liveScale ? (
              <span className="text-emerald-400 font-medium">
                Scale: {liveScale.scaleCmPerPx} cm/px (1 px = {scaleMmPerPx} mm)
              </span>
            ) : (
              <span className="text-rose-400 font-medium flex items-center gap-1">
                <AlertTriangle className="size-3.5" />
                Invalid 4-sided rectangle
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Middle Interactive Canvas Viewport ── */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full max-w-5xl flex items-center justify-center my-2 overflow-hidden"
      >
        {fittedCanvasSize.width > 0 && fittedCanvasSize.height > 0 && (
          <div
            className="relative rounded-[16px] overflow-hidden shadow-2xl bg-neutral-950 border border-white/10"
            style={{
              width: fittedCanvasSize.width,
              height: fittedCanvasSize.height,
            }}
          >
            {/* Background Room Photo */}
            <img
              src={backgroundImageUrl}
              alt="Uploaded room space"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
            />

            {/* Non-convex warning overlay banner */}
            {!isValidQuad && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-rose-600/90 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-1.5 font-medium animate-pulse">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Please ensure corner pins form a valid 4-sided rectangle.</span>
              </div>
            )}

            {/* Interactive SVG Pin Overlay */}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              className="absolute inset-0 w-full h-full cursor-crosshair touch-none select-none"
              onPointerMove={handleSvgPointerMove}
              onPointerUp={handleSvgPointerUp}
              onPointerCancel={handleSvgPointerUp}
            >
              {/* Semi-transparent Polygon Fill & Glowing Perimeter */}
              <polygon
                points={polygonPointsAttr}
                fill={isValidQuad ? "rgba(16, 185, 129, 0.20)" : "rgba(239, 68, 68, 0.20)"}
                stroke={isValidQuad ? "#10b981" : "#ef4444"}
                strokeWidth={Math.max(2.5, Math.round(canvasWidth * 0.003))}
                strokeDasharray="none"
              />

              {/* Labeled Corner Handles (1 to 4) */}
              {points.map((pt, idx) => {
                const isActive = activeDragIndex === idx;
                const handleRadius = Math.max(14, Math.round(canvasWidth * 0.016));

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
                        r={handleRadius * 1.9}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                        className="animate-spin"
                        style={{ transformOrigin: `${pt.x}px ${pt.y}px` }}
                      />
                    )}

                    {/* Touch hit proxy area */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={Math.max(26, handleRadius * 2.2)}
                      fill="transparent"
                    />

                    {/* Outer white ring */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={handleRadius}
                      fill="#ffffff"
                      stroke={isValidQuad ? "#10b981" : "#ef4444"}
                      strokeWidth={isActive ? "3.5" : "2.5"}
                      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}
                    />

                    {/* Emerald center core */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={Math.max(7, Math.round(handleRadius * 0.55))}
                      fill={isValidQuad ? "#10b981" : "#ef4444"}
                    />

                    {/* Corner Number & Name Label */}
                    <text
                      x={pt.x}
                      y={idx === 0 || idx === 1 ? pt.y - handleRadius - 6 : pt.y + handleRadius + 14}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={Math.max(11, Math.round(canvasWidth * 0.012))}
                      fontWeight="700"
                      className="pointer-events-none select-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
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

      {/* ── Loupe Magnifier (2.5x Zoom with Crosshairs) ── */}
      {loupeParams && (
        <div className="pointer-events-none fixed inset-0 z-[70]" aria-hidden="true">
          {/* Connecting line on touch devices */}
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

          {/* 2.5x Circular Loupe */}
          <div
            className="absolute size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-neutral-900 shadow-2xl overflow-hidden ring-2 ring-emerald-500/80"
            style={{ left: loupeParams.loupeX, top: loupeParams.loupeY }}
          >
            {/* Magnified Image View */}
            <img
              src={backgroundImageUrl}
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
            <span className="absolute left-0 top-1/2 h-[1px] w-full -translate-y-1/2 bg-emerald-400/90 shadow-xs" />
            <span className="absolute left-1/2 top-0 h-full w-[1px] -translate-x-1/2 bg-emerald-400/90 shadow-xs" />
            <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-emerald-500" />

            {/* Corner Tag */}
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/75 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow-xs">
              Pin {loupeParams.cornerIndex + 1}
            </span>
          </div>
        </div>
      )}

      {/* ── Interactive Action Bar (Modal Footer) ── */}
      <div className="z-10 flex w-full max-w-5xl flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white rounded-[20px] px-4 sm:px-6 py-3 shadow-xl">
        <div className="flex items-center justify-between sm:justify-start gap-2.5">
          {/* Secondary Action: Reset Corners */}
          <button
            type="button"
            onClick={handleResetCorners}
            className="flex cursor-pointer items-center gap-1.5 rounded-[20px] border border-neutral-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-medium text-[#0f1422] transition-colors hover:bg-neutral-100"
          >
            <RotateCcw className="size-4 text-neutral-500" />
            <span>Reset Corners</span>
          </button>

          {/* Tertiary Action: Skip Calibration */}
          <button
            type="button"
            onClick={onSkip}
            className="flex cursor-pointer items-center gap-1 rounded-[20px] border border-neutral-200 bg-transparent px-3.5 py-2.5 text-xs sm:text-sm font-normal text-neutral-600 transition-colors hover:bg-neutral-100"
          >
            <span>Skip Calibration</span>
          </button>
        </div>

        {/* Primary Action: Looks Right / Confirm & Enter Workspace */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isValidQuad}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-[25px] bg-green hover:bg-[#06a3bd] disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3.5 font-medium text-base shadow-md transition-colors"
        >
          <Check className="size-5" />
          <span>Looks Right / Confirm & Enter Workspace</span>
        </button>
      </div>
    </div>
  );
}
