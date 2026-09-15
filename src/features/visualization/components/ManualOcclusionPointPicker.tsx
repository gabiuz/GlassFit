"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Info,
  MousePointer2,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type {
  ManualOcclusionMaskResult,
  ManualOcclusionPolygon,
  Point2D,
} from "@/lib/visualization/types";
import {
  denormalizeOcclusionPolygon,
  normalizeOcclusionPolygon,
  rasterizeOcclusionPolygons,
  validateOcclusionPolygon,
  type OcclusionPolygonValidation,
} from "@/lib/visualization/occlusionPolygon";

interface ManualOcclusionPointPickerProps {
  backgroundImageUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  initialPolygons?: ManualOcclusionPolygon[];
  legacyMaskDataUrl?: string | null;
  onSave: (result: ManualOcclusionMaskResult) => void;
  onCancel: () => void;
}

type DragTarget = {
  polygonIndex: number | "active";
  pointIndex: number;
  offsetX: number;
  offsetY: number;
};

type EditorSnapshot = {
  completedPolygons: Point2D[][];
  activePoints: Point2D[];
  selectedPolygonIndex: number | null;
  isAddingRegion: boolean;
  isReplacingLegacyMask: boolean;
};

const MAX_UNDO_STATES = 20;

function clonePoints(points: Point2D[]) {
  return points.map((point) => ({ ...point }));
}

function clonePolygons(polygons: Point2D[][]) {
  return polygons.map(clonePoints);
}

function getValidationMessage(validation: OcclusionPolygonValidation) {
  if (validation.valid) {
    return null;
  }

  switch (validation.reason) {
    case "too_few_points":
      return "Add at least 3 points before finishing this region.";
    case "duplicate_points":
      return "Two points overlap. Drag one point to a distinct boundary position.";
    case "zero_area":
      return "The points do not enclose an area. Move a point away from the line.";
    case "self_intersection":
      return "The boundary crosses itself. Drag points until the edges no longer cross.";
    case "non_finite":
      return "A point has an invalid position. Reset the active region and try again.";
  }
}

export function ManualOcclusionPointPicker({
  backgroundImageUrl,
  canvasWidth,
  canvasHeight,
  initialPolygons = [],
  legacyMaskDataUrl,
  onSave,
  onCancel,
}: ManualOcclusionPointPickerProps) {
  const [completedPolygons, setCompletedPolygons] = useState<Point2D[][]>(() =>
    initialPolygons.map((polygon) =>
      denormalizeOcclusionPolygon(polygon, canvasWidth, canvasHeight),
    ),
  );
  const [activePoints, setActivePoints] = useState<Point2D[]>([]);
  const [selectedPolygonIndex, setSelectedPolygonIndex] = useState<number | null>(
    null,
  );
  const [isAddingRegion, setIsAddingRegion] = useState(initialPolygons.length === 0);
  const hasLegacyMask = Boolean(legacyMaskDataUrl && initialPolygons.length === 0);
  const [isReplacingLegacyMask, setIsReplacingLegacyMask] = useState(!hasLegacyMask);
  const [canUndo, setCanUndo] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragTargetRef = useRef<DragTarget | null>(null);
  const undoStackRef = useRef<EditorSnapshot[]>([]);

  const recordUndoState = useCallback(() => {
    undoStackRef.current.push({
      completedPolygons: clonePolygons(completedPolygons),
      activePoints: clonePoints(activePoints),
      selectedPolygonIndex,
      isAddingRegion,
      isReplacingLegacyMask,
    });
    if (undoStackRef.current.length > MAX_UNDO_STATES) {
      undoStackRef.current.shift();
    }
    setCanUndo(true);
  }, [
    activePoints,
    completedPolygons,
    isAddingRegion,
    isReplacingLegacyMask,
    selectedPolygonIndex,
  ]);

  const handleUndo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) {
      return;
    }

    setCompletedPolygons(clonePolygons(previous.completedPolygons));
    setActivePoints(clonePoints(previous.activePoints));
    setSelectedPolygonIndex(previous.selectedPolygonIndex);
    setIsAddingRegion(previous.isAddingRegion);
    setIsReplacingLegacyMask(previous.isReplacingLegacyMask);
    setValidationMessage(null);
    setCanUndo(undoStackRef.current.length > 0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, onCancel]);

  const getCanvasCoordinates = useCallback(
    (clientX: number, clientY: number): Point2D | null => {
      const svg = svgRef.current;
      if (!svg) {
        return null;
      }

      const bounds = svg.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) {
        return null;
      }

      return {
        x: Math.min(
          canvasWidth,
          Math.max(0, ((clientX - bounds.left) / bounds.width) * canvasWidth),
        ),
        y: Math.min(
          canvasHeight,
          Math.max(0, ((clientY - bounds.top) / bounds.height) * canvasHeight),
        ),
      };
    },
    [canvasHeight, canvasWidth],
  );

  const handleCanvasClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!isReplacingLegacyMask || !isAddingRegion || dragTargetRef.current) {
      return;
    }

    const point = getCanvasCoordinates(event.clientX, event.clientY);
    if (!point) {
      return;
    }

    recordUndoState();
    setActivePoints((current) => [...current, point]);
    setSelectedPolygonIndex(null);
    setValidationMessage(null);
  };

  const handlePointPointerDown = (
    target: Pick<DragTarget, "polygonIndex" | "pointIndex">,
    event: React.PointerEvent<SVGGElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const pointer = getCanvasCoordinates(event.clientX, event.clientY);
    const point =
      target.polygonIndex === "active"
        ? activePoints[target.pointIndex]
        : completedPolygons[target.polygonIndex]?.[target.pointIndex];
    if (!pointer || !point) {
      return;
    }

    recordUndoState();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragTargetRef.current = {
      ...target,
      offsetX: point.x - pointer.x,
      offsetY: point.y - pointer.y,
    };
    if (target.polygonIndex !== "active") {
      setSelectedPolygonIndex(target.polygonIndex);
    }
  };

  const handlePointPointerMove = (event: React.PointerEvent<SVGGElement>) => {
    const target = dragTargetRef.current;
    if (!target) {
      return;
    }

    const pointer = getCanvasCoordinates(event.clientX, event.clientY);
    if (!pointer) {
      return;
    }
    const point = {
      x: Math.min(canvasWidth, Math.max(0, pointer.x + target.offsetX)),
      y: Math.min(canvasHeight, Math.max(0, pointer.y + target.offsetY)),
    };

    if (target.polygonIndex === "active") {
      setActivePoints((current) =>
        current.map((existingPoint, index) =>
          index === target.pointIndex ? point : existingPoint,
        ),
      );
    } else {
      setCompletedPolygons((current) =>
        current.map((polygon, polygonIndex) =>
          polygonIndex === target.polygonIndex
            ? polygon.map((existingPoint, pointIndex) =>
                pointIndex === target.pointIndex ? point : existingPoint,
              )
            : polygon,
        ),
      );
    }
    setValidationMessage(null);
  };

  const handlePointPointerUp = (event: React.PointerEvent<SVGGElement>) => {
    if (!dragTargetRef.current) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragTargetRef.current = null;
  };

  const handleFinishRegion = () => {
    const validation = validateOcclusionPolygon(activePoints);
    if (!validation.valid) {
      setValidationMessage(getValidationMessage(validation));
      return;
    }

    recordUndoState();
    setCompletedPolygons((current) => [...current, clonePoints(activePoints)]);
    setSelectedPolygonIndex(completedPolygons.length);
    setActivePoints([]);
    setIsAddingRegion(false);
    setValidationMessage(null);
  };

  const handleAddRegion = () => {
    recordUndoState();
    setActivePoints([]);
    setSelectedPolygonIndex(null);
    setIsAddingRegion(true);
    setIsReplacingLegacyMask(true);
    setValidationMessage(null);
  };

  const handleReplaceLegacyMask = () => {
    recordUndoState();
    setCompletedPolygons([]);
    setActivePoints([]);
    setSelectedPolygonIndex(null);
    setIsAddingRegion(true);
    setIsReplacingLegacyMask(true);
    setValidationMessage(null);
  };

  const handleDeleteRegion = () => {
    if (selectedPolygonIndex === null) {
      return;
    }

    recordUndoState();
    setCompletedPolygons((current) =>
      current.filter((_, index) => index !== selectedPolygonIndex),
    );
    setSelectedPolygonIndex(null);
    setIsAddingRegion(completedPolygons.length === 1);
    setValidationMessage(null);
  };

  const handleClearAll = () => {
    if (completedPolygons.length === 0 && activePoints.length === 0) {
      return;
    }

    recordUndoState();
    setCompletedPolygons([]);
    setActivePoints([]);
    setSelectedPolygonIndex(null);
    setIsAddingRegion(true);
    setValidationMessage(null);
  };

  const handleApply = () => {
    if (completedPolygons.length === 0 || activePoints.length > 0) {
      return;
    }

    const normalizedPolygons = completedPolygons.map((polygon) =>
      normalizeOcclusionPolygon(polygon, canvasWidth, canvasHeight),
    );
    const invalidPolygon = completedPolygons.find(
      (polygon) => !validateOcclusionPolygon(polygon).valid,
    );
    if (invalidPolygon) {
      setValidationMessage("One region is invalid. Select its handles and correct the boundary.");
      return;
    }

    const maskDataUrl = rasterizeOcclusionPolygons(
      normalizedPolygons,
      canvasWidth,
      canvasHeight,
    );
    if (!maskDataUrl) {
      setValidationMessage("The mask could not be generated. Please try again.");
      return;
    }

    onSave({ polygons: normalizedPolygons, maskDataUrl });
  };

  const activeValidation = validateOcclusionPolygon(activePoints);
  const canAttemptFinishRegion = activePoints.length >= 3;
  const canApply = completedPolygons.length > 0 && activePoints.length === 0;
  const showLegacyPreview = hasLegacyMask && !isReplacingLegacyMask;

  const instructionText = showLegacyPreview
    ? "This mask was painted in the previous editor. Replace it to create editable point regions."
    : activePoints.length > 0
      ? "Continue around the foreground edge, then choose Finish Region."
      : completedPolygons.length > 0 && !isAddingRegion
        ? "Drag any handle to refine a region, or add another foreground region."
        : "Click or tap around one protruding foreground structure. Add at least 3 points.";

  const renderPoint = (
    point: Point2D,
    pointIndex: number,
    polygonIndex: number | "active",
    selected: boolean,
  ) => (
    <g
      key={`${polygonIndex}-${pointIndex}`}
      transform={`translate(${point.x}, ${point.y})`}
      onPointerDown={(event) =>
        handlePointPointerDown({ polygonIndex, pointIndex }, event)
      }
      onPointerMove={handlePointPointerMove}
      onPointerUp={handlePointPointerUp}
      onPointerCancel={handlePointPointerUp}
      onClick={(event) => event.stopPropagation()}
      className="cursor-grab active:cursor-grabbing"
      style={{ touchAction: "none" }}
      role="button"
      aria-label={`Region ${polygonIndex === "active" ? "in progress" : polygonIndex + 1}, point ${pointIndex + 1}`}
    >
      <circle r={18} fill="transparent" />
      <circle
        r={13}
        fill={selected ? "rgba(7, 182, 211, 0.34)" : "rgba(7, 182, 211, 0.22)"}
      />
      <circle r={8} fill="#07b6d3" stroke="#ffffff" strokeWidth={2} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize={9}
        fontWeight="bold"
        pointerEvents="none"
      >
        {pointIndex + 1}
      </text>
    </g>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-between p-3 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-5xl flex flex-col gap-3 z-10">
        <div className="flex items-center justify-between bg-white rounded-[20px] px-4 sm:px-6 py-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-[12px] bg-[#07b6d3]/15 flex items-center justify-center text-[#07b6d3]">
              <MousePointer2 className="size-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0f1422] leading-tight">
                Select Occlusion Areas
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500">
                Outline columns, piers, beams, or other foreground structures
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer active:scale-95"
            aria-label="Close point editor"
          >
            <X className="size-5" />
          </button>
        </div>

        <div
          className={`rounded-[16px] px-4 py-2.5 flex items-center gap-3 text-xs sm:text-sm shadow-md border ${
            validationMessage
              ? "bg-red-950/90 text-red-100 border-red-500/50"
              : "bg-[#0f1422] text-white border-neutral-700/50"
          }`}
          role={validationMessage ? "alert" : "status"}
        >
          <Info
            className={`size-4 shrink-0 ${validationMessage ? "text-red-300" : "text-[#07b6d3]"}`}
          />
          <span className="leading-snug">{validationMessage ?? instructionText}</span>
        </div>
      </div>

      <div className="relative flex-1 w-full max-w-5xl flex items-center justify-center my-2 min-h-0 overflow-hidden">
        <div
          className="relative max-h-full max-w-full rounded-[16px] overflow-hidden shadow-2xl border border-white/20 bg-neutral-900"
          style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundImageUrl}
            alt="Room background"
            className="w-full h-full object-contain pointer-events-none select-none block"
          />

          {showLegacyPreview && legacyMaskDataUrl && (
            <div
              className="absolute inset-0 bg-[#07b6d3]/55 pointer-events-none z-10"
              style={{
                WebkitMaskImage: `url(${legacyMaskDataUrl})`,
                maskImage: `url(${legacyMaskDataUrl})`,
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "100% 100%",
                maskSize: "100% 100%",
              }}
            />
          )}

          <svg
            ref={svgRef}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            onClick={handleCanvasClick}
            className={`absolute inset-0 w-full h-full object-contain z-20 ${
              isReplacingLegacyMask && isAddingRegion
                ? "cursor-crosshair"
                : "cursor-default"
            }`}
            style={{ touchAction: "none" }}
            aria-label="Manual occlusion point editor"
          >
            {completedPolygons.map((polygon, polygonIndex) => {
              const selected = selectedPolygonIndex === polygonIndex;
              const validation = validateOcclusionPolygon(polygon);
              return (
                <React.Fragment key={`polygon-${polygonIndex}`}>
                  <polygon
                    points={polygon.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill={
                      validation.valid
                        ? selected
                          ? "rgba(7, 182, 211, 0.32)"
                          : "rgba(7, 182, 211, 0.18)"
                        : "rgba(239, 68, 68, 0.22)"
                    }
                    stroke={validation.valid ? "#07b6d3" : "#ef4444"}
                    strokeWidth={selected ? 3 : 2}
                    strokeDasharray={validation.valid ? undefined : "6 4"}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedPolygonIndex(polygonIndex);
                      setValidationMessage(
                        validation.valid ? null : getValidationMessage(validation),
                      );
                    }}
                    className="cursor-pointer"
                  />
                  {polygon.map((point, pointIndex) =>
                    renderPoint(point, pointIndex, polygonIndex, selected),
                  )}
                </React.Fragment>
              );
            })}

            {activePoints.length > 1 && (
              <polyline
                points={activePoints.map((point) => `${point.x},${point.y}`).join(" ")}
                fill={activePoints.length >= 3 ? "rgba(7, 182, 211, 0.12)" : "none"}
                stroke={activeValidation.valid ? "#07b6d3" : "#67e8f9"}
                strokeWidth={2}
                strokeDasharray="5 4"
                pointerEvents="none"
              />
            )}
            {activePoints.map((point, pointIndex) =>
              renderPoint(point, pointIndex, "active", true),
            )}
          </svg>
        </div>
      </div>

      <div className="w-full max-w-5xl bg-[#0f1422] border border-white/15 rounded-[25px] p-3 sm:p-4 shadow-2xl flex flex-wrap items-center justify-between gap-3 z-10">
        {showLegacyPreview ? (
          <button
            type="button"
            onClick={handleReplaceLegacyMask}
            className="flex items-center gap-2 rounded-[16px] bg-[#07b6d3] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md hover:bg-[#06a3bd] active:scale-[0.98]"
          >
            <MousePointer2 className="size-4" />
            Replace Legacy Mask
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className={`flex items-center gap-2 rounded-[16px] px-3 py-2 text-xs sm:text-sm font-medium active:scale-[0.98] ${
                canUndo
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-white/5 text-neutral-500 cursor-not-allowed"
              }`}
            >
              <Undo2 className="size-4" />
              Undo
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={completedPolygons.length === 0 && activePoints.length === 0}
              className="flex items-center gap-2 rounded-[16px] bg-white/10 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-red-500/20 hover:text-red-300 disabled:bg-white/5 disabled:text-neutral-500 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              <RotateCcw className="size-4" />
              Clear All
            </button>
            <button
              type="button"
              onClick={handleDeleteRegion}
              disabled={selectedPolygonIndex === null}
              className="flex items-center gap-2 rounded-[16px] bg-white/10 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-red-500/20 hover:text-red-300 disabled:bg-white/5 disabled:text-neutral-500 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              <Trash2 className="size-4" />
              Delete Region
            </button>
          </div>
        )}

        {!showLegacyPreview && (
          <div className="text-xs sm:text-sm text-neutral-400 font-medium">
            Regions: <span className="text-[#07b6d3] font-bold">{completedPolygons.length}</span>
            {activePoints.length > 0 && (
              <span className="ml-2">Points: {activePoints.length}</span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
          {!showLegacyPreview && activePoints.length > 0 && (
            <button
              type="button"
              onClick={handleFinishRegion}
              disabled={!canAttemptFinishRegion}
              className={`flex items-center gap-2 rounded-[20px] px-4 py-2.5 text-xs sm:text-sm font-semibold active:scale-[0.98] ${
                canAttemptFinishRegion
                  ? "bg-white text-[#0f1422] hover:bg-neutral-100"
                  : "bg-white/10 text-neutral-500 cursor-not-allowed"
              }`}
            >
              <Check className="size-4" />
              Finish Region
            </button>
          )}
          {!showLegacyPreview && completedPolygons.length > 0 && !isAddingRegion && (
            <button
              type="button"
              onClick={handleAddRegion}
              className="flex items-center gap-2 rounded-[20px] bg-white/10 px-4 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-white/20 active:scale-[0.98]"
            >
              <Plus className="size-4" />
              Add Region
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[20px] px-4 py-2.5 text-xs sm:text-sm font-medium text-neutral-300 hover:bg-white/10 hover:text-white active:scale-[0.98]"
          >
            Cancel
          </button>
          {!showLegacyPreview && (
            <button
              type="button"
              onClick={handleApply}
              disabled={!canApply}
              className={`flex items-center gap-2 rounded-[20px] px-5 py-2.5 text-xs sm:text-sm font-semibold active:scale-[0.98] ${
                canApply
                  ? "bg-[#07b6d3] text-white shadow-md hover:bg-[#06a3bd]"
                  : "bg-white/10 text-neutral-500 cursor-not-allowed"
              }`}
            >
              <Check className="size-4" />
              Apply Mask
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
