"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Check,
  RotateCcw,
  Info,
  Maximize,
} from "lucide-react";
import type { Point2D, QuadrilateralCorners } from "@/lib/visualization/types";
import {
  denormalizeCorners,
  normalizeCorners,
  isValidQuadrilateral,
} from "@/lib/visualization/perspectiveTransform";

interface PerspectivePlanePickerProps {
  canvasWidth: number;
  canvasHeight: number;
  backgroundImageUrl: string;
  initialCorners?: QuadrilateralCorners | null;
  onConfirm: (corners: QuadrilateralCorners) => void;
  onCancel: () => void;
}

const CORNER_NAMES = [
  "Top-Left",
  "Top-Right",
  "Bottom-Right",
  "Bottom-Left",
] as const;

export function PerspectivePlanePicker({
  canvasWidth,
  canvasHeight,
  backgroundImageUrl,
  initialCorners,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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

  // Click on SVG to place points sequentially (1 through 4)
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length >= 4 || activeDragIndex !== null) {
      return;
    }

    const coord = getCanvasCoordinates(e.clientX, e.clientY);
    if (!coord) return;

    setPoints((prev) => [...prev, coord]);
  };

  // Start dragging an existing corner handle
  const handleHandlePointerDown = (
    index: number,
    e: React.PointerEvent<SVGCircleElement | SVGTextElement | SVGGElement>,
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveDragIndex(index);
  };

  const handleHandlePointerMove = (
    e: React.PointerEvent<SVGCircleElement | SVGTextElement | SVGGElement>,
  ) => {
    if (activeDragIndex === null) return;
    const coord = getCanvasCoordinates(e.clientX, e.clientY);
    if (!coord) return;

    setPoints((prev) => {
      const next = [...prev];
      next[activeDragIndex] = coord;
      return next;
    });
  };

  const handleHandlePointerUp = (
    e: React.PointerEvent<SVGCircleElement | SVGTextElement | SVGGElement>,
  ) => {
    if (activeDragIndex !== null) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may have already been released
      }
      setActiveDragIndex(null);
    }
  };

  const handleReset = () => {
    setPoints([]);
    setActiveDragIndex(null);
  };

  const isComplete = points.length === 4;
  const currentQuad = isComplete
    ? ([points[0], points[1], points[2], points[3]] as QuadrilateralCorners)
    : null;
  const isValidQuad = currentQuad ? isValidQuadrilateral(currentQuad) : false;

  const handleConfirm = () => {
    if (!currentQuad || !isValidQuad) return;
    const normalized = normalizeCorners(currentQuad, canvasWidth, canvasHeight);
    onConfirm(normalized);
  };

  // Dynamic instruction message
  const getInstructionText = () => {
    if (points.length < 4) {
      return `Step ${points.length + 1} of 4: Click the ${CORNER_NAMES[points.length]} corner of the window opening.`;
    }
    if (!isValidQuad) {
      return "The corners do not form a valid convex quadrilateral. Drag handles or click Reset.";
    }
    return "All 4 corners placed. Drag handles to fine-tune opening boundary, then click Confirm.";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="w-full max-w-5xl flex flex-col gap-3 z-10">
        <div className="flex items-center justify-between bg-white rounded-[20px] px-4 sm:px-6 py-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-[12px] bg-[#07b6d3]/15 flex items-center justify-center text-[#07b6d3]">
              <Maximize className="size-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0f1422] leading-tight">
                Fit to Opening (Perspective Plane)
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500">
                Click 4 corners of the window opening on your room photo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
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
            onClick={handleSvgClick}
            className={`absolute inset-0 w-full h-full object-contain z-10 ${
              points.length < 4 ? "cursor-crosshair" : "cursor-default"
            }`}
            style={{ touchAction: "none" }}
          >
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

            {/* Connecting lines for 2 or 3 placed points */}
            {!isComplete && points.length > 1 && (
              <polyline
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#07b6d3"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            )}

            {/* Placed Corner Markers & Drag Handles */}
            {points.map((point, index) => {
              const isDraggable = isComplete;
              return (
                <g
                  key={index}
                  transform={`translate(${point.x}, ${point.y})`}
                  onPointerDown={(e) => isDraggable && handleHandlePointerDown(index, e)}
                  onPointerMove={isDraggable ? handleHandlePointerMove : undefined}
                  onPointerUp={isDraggable ? handleHandlePointerUp : undefined}
                  className={
                    isDraggable
                      ? "cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                      : "cursor-default"
                  }
                  style={{ touchAction: "none" }}
                >
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
      <div className="w-full max-w-3xl bg-[#0f1422] border border-white/15 rounded-[25px] p-3 sm:p-4 shadow-2xl flex items-center justify-between gap-3 sm:gap-4 z-10">
        {/* Reset Action */}
        <button
          type="button"
          onClick={handleReset}
          disabled={points.length === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-[16px] text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
            points.length > 0
              ? "bg-white/10 text-white hover:bg-white/20"
              : "bg-white/5 text-neutral-500 cursor-not-allowed"
          }`}
        >
          <RotateCcw className="size-4" />
          <span>Reset Points</span>
        </button>

        {/* Progress Counter */}
        <div className="text-xs sm:text-sm text-neutral-400 font-medium">
          Corners: <span className="text-[#07b6d3] font-bold">{points.length}</span> / 4
        </div>

        {/* Actions: Cancel and Confirm */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-[20px] text-xs sm:text-sm font-medium text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isComplete || !isValidQuad}
            className={`flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-[20px] text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
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
