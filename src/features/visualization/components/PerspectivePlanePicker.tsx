"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Check,
  RotateCcw,
  Info,
  Maximize,
} from "lucide-react";
import type { Point2D, QuadrilateralCorners, PerspectiveOpeningType } from "@/lib/visualization/types";
import {
  denormalizeCorners,
  normalizeCorners,
  isValidQuadrilateral,
} from "@/lib/visualization/perspectiveTransform";
import { rectangleToQuadrilateral } from "@/lib/visualization/perspectiveSelection";

interface PerspectivePlanePickerProps {
  canvasWidth: number;
  canvasHeight: number;
  backgroundImageUrl: string;
  initialCorners?: QuadrilateralCorners | null;
  openingType?: PerspectiveOpeningType;
  onConfirm: (corners: QuadrilateralCorners) => void;
  onCancel: () => void;
}

const CORNER_NAMES = [
  "Top-Left",
  "Top-Right",
  "Bottom-Right",
  "Bottom-Left",
] as const;

const MIN_SELECTION_SIZE_CSS_PX = 8;

type SelectionDraft = { start: Point2D; current: Point2D };
type SelectionSession = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCanvasPoint: Point2D;
};

export function PerspectivePlanePicker({
  canvasWidth,
  canvasHeight,
  backgroundImageUrl,
  initialCorners,
  openingType = "window",
  onConfirm,
  onCancel,
}: PerspectivePlanePickerProps) {
  // Store corner coordinates in pixel space (0..canvasWidth, 0..canvasHeight)
  const [points, setPoints] = useState<Point2D[]>(() => {
    if (initialCorners && initialCorners.length === 4) {
      return denormalizeCorners(initialCorners, canvasWidth, canvasHeight);
    }
    return [];
  });

  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const selectionSessionRef = useRef<SelectionSession | null>(null);

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

  // Convert client pointer event coordinates to SVG/canvas pixel coordinates
  const getCanvasCoordinates = useCallback(
    (clientX: number, clientY: number): Point2D | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;
      const scaleY = canvasHeight / rect.height;

      const x = Math.max(0, Math.min(canvasWidth, (clientX - rect.left) * scaleX));
      const y = Math.max(0, Math.min(canvasHeight, (clientY - rect.top) * scaleY));

      return { x, y };
    },
    [canvasWidth, canvasHeight],
  );

  const releaseSelectionCapture = useCallback((pointerId: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    try {
      if (svg.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId);
    } catch {
      // Pointer capture may have already been released
    }
  }, []);

  const clearSelection = useCallback(() => {
    const session = selectionSessionRef.current;
    if (session) releaseSelectionCapture(session.pointerId);
    selectionSessionRef.current = null;
    setSelectionDraft(null);
  }, [releaseSelectionCapture]);

  // PRD-F6: create the initial plane with one primary drag gesture.
  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (
      points.length !== 0 ||
      activeDragIndex !== null ||
      selectionSessionRef.current !== null ||
      !e.isPrimary ||
      e.button !== 0
    ) {
      return;
    }

    const coord = getCanvasCoordinates(e.clientX, e.clientY);
    if (!coord) return;
    e.preventDefault();
    selectionSessionRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCanvasPoint: coord,
    };
    setSelectionDraft({ start: coord, current: coord });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture is best effort on older browsers
    }
  };

  // Start dragging an existing corner handle
  const handleHandlePointerDown = (
    index: number,
    e: React.PointerEvent<SVGCircleElement | SVGTextElement | SVGGElement>,
  ) => {
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
  };

  const handleSvgPointerMove = (
    e: React.PointerEvent<SVGSVGElement | SVGGElement>,
  ) => {
    const selectionSession = selectionSessionRef.current;
    if (selectionSession && points.length === 0) {
      if (e.pointerId !== selectionSession.pointerId) return;
      const coord = getCanvasCoordinates(e.clientX, e.clientY);
      if (!coord) return;
      setSelectionDraft((draft) =>
        draft ? { ...draft, current: coord } : draft,
      );
      return;
    }
    if (activeDragIndex === null) return;
    const coord = getCanvasCoordinates(e.clientX, e.clientY);
    if (!coord) return;

    const offset = dragOffsetRef.current ?? { x: 0, y: 0 };
    const x = Math.max(0, Math.min(canvasWidth, coord.x + offset.x));
    const y = Math.max(0, Math.min(canvasHeight, coord.y + offset.y));

    setPoints((prev) => {
      const next = [...prev];
      next[activeDragIndex] = { x, y };
      return next;
    });
  };

  const handleSvgPointerUp = (
    e: React.PointerEvent<SVGSVGElement | SVGGElement>,
  ) => {
    const selectionSession = selectionSessionRef.current;
    if (selectionSession && points.length === 0) {
      if (e.pointerId !== selectionSession.pointerId) return;
      const finalPoint = getCanvasCoordinates(e.clientX, e.clientY);
      const width = Math.abs(e.clientX - selectionSession.startClientX);
      const height = Math.abs(e.clientY - selectionSession.startClientY);
      clearSelection();
      if (
        finalPoint &&
        width >= MIN_SELECTION_SIZE_CSS_PX &&
        height >= MIN_SELECTION_SIZE_CSS_PX
      ) {
        setPoints(
          rectangleToQuadrilateral(
            selectionSession.startCanvasPoint,
            finalPoint,
          ),
        );
      }
      return;
    }
    if (activeDragIndex !== null) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Pointer capture may have already been released
      }
      dragOffsetRef.current = null;
      setActiveDragIndex(null);
    }
  };

  const handleSvgPointerCancel = (
    e: React.PointerEvent<SVGSVGElement | SVGGElement>,
  ) => {
    const selectionSession = selectionSessionRef.current;
    if (selectionSession) {
      if (e.pointerId !== selectionSession.pointerId) return;
      clearSelection();
      return;
    }
    handleSvgPointerUp(e);
  };

  const handleReset = () => {
    clearSelection();
    setPoints([]);
    dragOffsetRef.current = null;
    setActiveDragIndex(null);
  };

  const isComplete = points.length === 4;
  const currentQuad = isComplete
    ? ([points[0], points[1], points[2], points[3]] as QuadrilateralCorners)
    : null;
  const isValidQuad = currentQuad ? isValidQuadrilateral(currentQuad) : false;
  const selectionBounds = selectionDraft
    ? rectangleToQuadrilateral(selectionDraft.start, selectionDraft.current)
    : null;

  const handleConfirm = () => {
    if (!currentQuad || !isValidQuad) return;
    const normalized = normalizeCorners(currentQuad, canvasWidth, canvasHeight);
    onConfirm(normalized);
  };

  // Dynamic instruction message
  const openingLabel =
    openingType === "door"
      ? "door"
      : openingType === "opening"
      ? "wall"
      : "window";

  const getInstructionText = () => {
    if (selectionDraft) {
      return `Drag to roughly select the ${openingLabel} area.`;
    }
    if (points.length === 0) {
      return `Click and drag over the ${openingLabel} opening.`;
    }
    if (!isValidQuad) {
      return "The corners do not form a valid convex quadrilateral. Drag handles or click Reset Points.";
    }
    return `Adjust the corners to match the ${openingLabel} perspective.`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="w-full max-w-5xl flex flex-col gap-3 z-10">
        <div className="flex items-center justify-between gap-3 bg-white rounded-[20px] px-4 sm:px-6 py-3 shadow-xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="size-9 rounded-[12px] bg-[#07b6d3]/15 flex items-center justify-center text-[#07b6d3]">
              <Maximize className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[#0f1422] leading-tight">
                Fit to Opening (Perspective Plane)
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500">
                Drag over the {openingLabel} opening, then refine its corners
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Guidance Alert Banner */}
        <div
          className={`rounded-[16px] px-4 py-2.5 flex items-center gap-3 text-xs sm:text-sm shadow-md border transition-colors ${
            isComplete && !isValidQuad
              ? "bg-amber-950/80 text-amber-200 border-amber-500/40"
              : "bg-[#0f1422] text-white border-neutral-700/50"
          }`}
        >
          <Info
            className={`size-4 shrink-0 ${
              isComplete && !isValidQuad ? "text-amber-400" : "text-[#07b6d3]"
            }`}
          />
          <span className="leading-snug">{getInstructionText()}</span>
        </div>
      </div>

      {/* Center Canvas Viewport */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full max-w-5xl flex items-center justify-center my-2 min-h-0 overflow-hidden"
      >
        <div
          className="relative max-h-full max-w-full rounded-[16px] overflow-hidden shadow-2xl border border-white/20 bg-neutral-900"
          style={{
            aspectRatio: `${canvasWidth} / ${canvasHeight}`,
          }}
        >
          {/* Room Background Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundImageUrl}
            alt="Room background"
            className="w-full h-full object-contain pointer-events-none select-none block"
          />

          {/* Interactive SVG Overlay */}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerCancel={handleSvgPointerCancel}
            className={`absolute inset-0 w-full h-full object-contain z-10 ${
              points.length < 4
                ? "cursor-crosshair"
                : activeDragIndex !== null
                ? "cursor-grabbing"
                : "cursor-default"
            }`}
            style={{ touchAction: "none" }}
          >
            {selectionBounds && (
              <rect
                x={selectionBounds[0].x}
                y={selectionBounds[0].y}
                width={selectionBounds[1].x - selectionBounds[0].x}
                height={selectionBounds[3].y - selectionBounds[0].y}
                fill="rgba(7, 182, 211, 0.20)"
                stroke="#07b6d3"
                strokeWidth={2}
                strokeDasharray="6 4"
                pointerEvents="none"
              />
            )}
            {/* Connecting Polygon Fill (when 4 points placed) */}
            {isComplete && (
              <polygon
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={isValidQuad ? "rgba(7, 182, 211, 0.20)" : "rgba(239, 68, 68, 0.20)"}
                stroke={isValidQuad ? "#07b6d3" : "#ef4444"}
                strokeWidth={2}
                strokeDasharray={isValidQuad ? undefined : "6 4"}
              />
            )}

            {/* Placed Corner Markers & Drag Handles */}
            {points.map((point, index) => {
              const isDraggable = isComplete;
              return (
                <g
                  key={index}
                  transform={`translate(${point.x}, ${point.y})`}
                  onPointerDown={(e) => {
                    if (!isDraggable) return;
                    handleHandlePointerDown(index, e);
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      // Pointer capture fallback
                    }
                  }}
                  onPointerMove={isDraggable ? handleSvgPointerMove : undefined}
                  onPointerUp={isDraggable ? handleSvgPointerUp : undefined}
                  onPointerCancel={isDraggable ? handleSvgPointerCancel : undefined}
                  onClick={(e) => e.stopPropagation()}
                  className={
                    isDraggable
                      ? "cursor-grab active:cursor-grabbing"
                      : "cursor-default"
                  }
                  style={{ touchAction: "none" }}
                  role="button"
                  aria-label={`Corner ${index + 1}: ${CORNER_NAMES[index]}`}
                >
                  {/* Invisible generous hit target */}
                  <circle r={18} fill="transparent" />

                  {/* Outer pulse circle on active point */}
                  <circle
                    r={14}
                    fill={isValidQuad ? "rgba(7, 182, 211, 0.25)" : "rgba(239, 68, 68, 0.25)"}
                  />

                  {/* Core handle badge */}
                  <circle
                    r={8}
                    fill={isValidQuad ? "#07b6d3" : "#ef4444"}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />

                  {/* Corner index number */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontSize={9}
                    fontWeight="bold"
                    pointerEvents="none"
                  >
                    {index + 1}
                  </text>

                  {/* Corner role label */}
                  <text
                    y={-14}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={11}
                    fontWeight="600"
                    stroke="#000000"
                    strokeWidth={0.5}
                    className="select-none pointer-events-none drop-shadow-sm"
                  >
                    {CORNER_NAMES[index]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Bottom Floating Control Toolbar */}
      <div className="w-full max-w-3xl bg-[#0f1422] border border-white/15 rounded-[25px] p-3 sm:p-4 shadow-2xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4 z-10">
        {/* Reset Action */}
        <button
          type="button"
          onClick={handleReset}
          disabled={points.length === 0 && !selectionDraft}
          className={`flex min-h-11 items-center gap-2 px-4 py-2 rounded-[16px] text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
            points.length > 0 || selectionDraft
              ? "bg-white/10 text-white hover:bg-white/20"
              : "bg-white/5 text-neutral-500 cursor-not-allowed"
          }`}
        >
          <RotateCcw className="size-4" />
          <span>Reset Points</span>
        </button>

        {/* Progress Counter */}
        <div className="text-xs sm:text-sm text-neutral-400 font-medium whitespace-nowrap">
          Corners: <span className="text-[#07b6d3] font-bold">{points.length}</span> / 4
        </div>

        {/* Actions: Cancel and Confirm */}
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-4 py-2.5 rounded-[20px] text-xs sm:text-sm font-medium text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isComplete || !isValidQuad}
            className={`flex min-h-11 items-center justify-center gap-1.5 px-5 py-2.5 rounded-[20px] text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              isComplete && isValidQuad
                ? "bg-[#07b6d3] hover:bg-[#06a3bd] text-white shadow-md cursor-pointer"
                : "bg-white/10 text-neutral-500 cursor-not-allowed"
            }`}
          >
            <Check className="size-4" />
            <span>Confirm Fit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
