"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Paintbrush,
  Eraser,
  Undo2,
  Trash2,
  Check,
  X,
  Info,
} from "lucide-react";

interface ManualMaskPainterProps {
  backgroundImageUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  initialMaskDataUrl?: string | null;
  onSave: (maskDataUrl: string) => void;
  onCancel: () => void;
}

type ToolMode = "brush" | "eraser";

const PREVIEW_STROKE_COLOR = "rgba(7, 182, 211, 0.65)";
const MAX_UNDO_STACK = 20;
const MIN_BRUSH_SIZE = 10;
const MAX_BRUSH_SIZE = 80;
const DEFAULT_BRUSH_SIZE = 35;

export function ManualMaskPainter({
  backgroundImageUrl,
  canvasWidth,
  canvasHeight,
  initialMaskDataUrl,
  onSave,
  onCancel,
}: ManualMaskPainterProps) {
  const [tool, setTool] = useState<ToolMode>("brush");
  const [brushSize, setBrushSize] = useState<number>(DEFAULT_BRUSH_SIZE);
  const [canUndo, setCanUndo] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; radius: number } | null>(null);
  const [isPointerOverCanvas, setIsPointerOverCanvas] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);

  const saveUndoState = useCallback(() => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(currentState);
    if (undoStackRef.current.length > MAX_UNDO_STACK) {
      undoStackRef.current.shift();
    }
    setCanUndo(undoStackRef.current.length > 0);
  }, []);

  const handleUndo = useCallback(() => {
    const canvas = paintCanvasRef.current;
    if (!canvas || undoStackRef.current.length === 0) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const previousState = undoStackRef.current.pop();
    if (previousState) {
      ctx.putImageData(previousState, 0, 0);
    }
    setCanUndo(undoStackRef.current.length > 0);
  }, []);

  const handleClearAll = useCallback(() => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    saveUndoState();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [saveUndoState]);

  // Load initial mask if provided
  useEffect(() => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    undoStackRef.current = [];
    setCanUndo(false);

    if (!initialMaskDataUrl) {
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
      if (!tempCtx) return;

      tempCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imgData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Convert white mask pixels to semi-transparent cyan preview color
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 10) {
          data[i] = 7; // R
          data[i + 1] = 182; // G
          data[i + 2] = 211; // B
          data[i + 3] = 165; // A (semi-transparent)
        } else {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imgData, 0, 0);
    };
    img.src = initialMaskDataUrl;
  }, [initialMaskDataUrl, canvasWidth, canvasHeight]);

  // Keyboard shortcut for Undo (Ctrl+Z or Cmd+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo]);

  const getCanvasCoordinates = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = paintCanvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const drawSegment = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      from: { x: number; y: number },
      to: { x: number; y: number },
    ) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);

      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0, 0, 0, 1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = PREVIEW_STROKE_COLOR;
      }

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;
      ctx.stroke();

      // Ensure dot is filled even without movement
      ctx.beginPath();
      ctx.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2);
      if (tool === "eraser") {
        ctx.fillStyle = "rgba(0, 0, 0, 1)";
      } else {
        ctx.fillStyle = PREVIEW_STROKE_COLOR;
      }
      ctx.fill();

      ctx.restore();
    },
    [brushSize, tool],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = paintCanvasRef.current;
    if (!canvas) return;

    saveUndoState();

    isDrawingRef.current = true;
    const coords = getCanvasCoordinates(e);
    lastPointRef.current = coords;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    drawSegment(ctx, coords, coords);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = rect.width / canvasWidth;
    const radius = Math.max(4, (brushSize / 2) * scale);
    setCursorPos({ x: e.clientX, y: e.clientY, radius });

    if (!isDrawingRef.current) return;
    const canvas = paintCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !lastPointRef.current) return;

    drawSegment(ctx, lastPointRef.current, coords);
    lastPointRef.current = coords;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleDone = () => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    let hasPixels = false;
    // Convert preview overlay to white-on-transparent mask PNG
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;

    const exportImgData = exportCtx.createImageData(canvas.width, canvas.height);
    const exportData = exportImgData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 10) {
        exportData[i] = 255;
        exportData[i + 1] = 255;
        exportData[i + 2] = 255;
        exportData[i + 3] = 255;
        hasPixels = true;
      } else {
        exportData[i] = 0;
        exportData[i + 1] = 0;
        exportData[i + 2] = 0;
        exportData[i + 3] = 0;
      }
    }

    if (!hasPixels) {
      onSave("");
      return;
    }

    exportCtx.putImageData(exportImgData, 0, 0);
    const maskDataUrl = exportCanvas.toDataURL("image/png");
    onSave(maskDataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-between p-3 sm:p-5 select-none animate-in fade-in duration-200">
      {/* Top Header & Guidance Banner */}
      <div className="w-full max-w-5xl flex flex-col gap-2 z-10">
        <div className="flex items-center justify-between bg-white/95 backdrop-blur-md rounded-[20px] px-5 py-3 shadow-lg border border-white/20">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#07b6d3]/10 border border-[#07b6d3]/30 flex items-center justify-center text-[#07b6d3]">
              <Paintbrush className="size-5" />
            </div>
            <div>
              <h2 className="text-[#0f1422] text-base sm:text-lg font-semibold tracking-tight">
                Paint Occlusion Mask
              </h2>
              <p className="text-xs text-neutral-500 hidden sm:block">
                Foreground columns, piers, or beams will cover the product
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
        <div className="bg-[#0f1422] text-white rounded-[16px] px-4 py-2.5 flex items-center gap-3 text-xs sm:text-sm shadow-md border border-neutral-700/50">
          <Info className="size-4 text-[#07b6d3] shrink-0" />
          <span className="leading-snug">
            Paint only protruding elements (columns, piers, soffits, beams) that stand in front of your installation. Do not paint the back wall where the product sits.
          </span>
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
          <img
            src={backgroundImageUrl}
            alt="Room background"
            className="w-full h-full object-contain pointer-events-none select-none block"
          />

          {/* Interactive Painting Canvas */}
          <canvas
            ref={paintCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrawing}
            onPointerLeave={() => {
              stopDrawing();
              setIsPointerOverCanvas(false);
            }}
            onPointerEnter={(e) => {
              setIsPointerOverCanvas(true);
              const rect = e.currentTarget.getBoundingClientRect();
              const scale = rect.width / canvasWidth;
              const radius = Math.max(4, (brushSize / 2) * scale);
              setCursorPos({ x: e.clientX, y: e.clientY, radius });
            }}
            onPointerCancel={stopDrawing}
            style={{ touchAction: "none" }}
            className="absolute inset-0 w-full h-full object-contain cursor-crosshair z-10"
          />
        </div>

        {/* Circular Brush Size Pointer Indicator */}
        {isPointerOverCanvas && cursorPos && (
          <div
            className="fixed pointer-events-none rounded-full border-2 border-[#07b6d3] bg-[#07b6d3]/20 shadow-xs -translate-x-1/2 -translate-y-1/2 z-50"
            style={{
              left: cursorPos.x,
              top: cursorPos.y,
              width: cursorPos.radius * 2,
              height: cursorPos.radius * 2,
            }}
          />
        )}
      </div>

      {/* Bottom Floating Control Toolbar */}
      <div className="w-full max-w-3xl bg-[#0f1422] border border-white/15 rounded-[25px] p-3 sm:p-4 shadow-2xl flex flex-wrap items-center justify-between gap-3 sm:gap-4 z-10">
        {/* Tool Mode: Brush / Eraser */}
        <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-[18px]">
          <button
            type="button"
            onClick={() => setTool("brush")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-[14px] text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              tool === "brush"
                ? "bg-[#07b6d3] text-white shadow-sm"
                : "text-neutral-300 hover:text-white"
            }`}
          >
            <Paintbrush className="size-4" />
            <span>Brush</span>
          </button>

          <button
            type="button"
            onClick={() => setTool("eraser")}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-[14px] text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              tool === "eraser"
                ? "bg-[#07b6d3] text-white shadow-sm"
                : "text-neutral-300 hover:text-white"
            }`}
          >
            <Eraser className="size-4" />
            <span>Eraser</span>
          </button>
        </div>

        {/* Brush Size Slider */}
        <div className="flex items-center gap-2.5 bg-white/5 px-3.5 py-1.5 rounded-[18px] flex-1 min-w-[170px] sm:min-w-[220px]">
          <span className="text-xs text-neutral-400 shrink-0 font-medium">
            Size:
          </span>
          <input
            type="range"
            min={MIN_BRUSH_SIZE}
            max={MAX_BRUSH_SIZE}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#07b6d3]"
          />
          <span className="text-xs text-neutral-300 shrink-0 w-8 text-right font-semibold">
            {brushSize}px
          </span>
        </div>

        {/* Actions: Undo & Clear */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={`p-2 sm:p-2.5 rounded-[14px] border transition-colors ${
              canUndo
                ? "border-white/20 bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                : "border-white/5 bg-white/5 text-neutral-500 cursor-not-allowed"
            }`}
          >
            <Undo2 className="size-4" />
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            title="Clear all painted areas"
            className="p-2 sm:p-2.5 rounded-[14px] border border-white/20 bg-white/10 text-white hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400 transition-colors cursor-pointer"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        {/* Save & Cancel CTAs */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-[20px] text-xs sm:text-sm font-medium text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDone}
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-[20px] text-xs sm:text-sm font-semibold bg-[#07b6d3] hover:bg-[#06a3bd] text-white shadow-md transition-colors cursor-pointer"
          >
            <Check className="size-4" />
            <span>Apply Mask</span>
          </button>
        </div>
      </div>
    </div>
  );
}
