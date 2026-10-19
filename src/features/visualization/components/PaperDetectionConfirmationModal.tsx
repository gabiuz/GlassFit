/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import {
  X,
  Check,
  RotateCcw,
  FileCheck2,
  AlertTriangle,
  Sparkles,
  Loader2,
} from "lucide-react";
import type {
  FiducialPaperStandard,
  PaperCalibrationStatus,
  Point2D,
  PaperCandidate,
  PaperReferenceSource,
} from "@/lib/visualization/types";
import { PAPER_STANDARD_METRICS } from "@/lib/visualization/types";
import {
  computeScaleFromPaperCorners,
  orderPaperCorners,
} from "@/lib/visualization/scaleEstimation";
import { isValidQuadrilateral } from "@/lib/visualization/perspectiveTransform";
import { useDocumentScrollLock } from "../hooks/useDocumentScrollLock";
import { mapPointerToCanvas, TOUCH_PROXY_OFFSET_CSS_PX } from "../mobileConfiguratorGeometry";
import {
  computeMagneticSnap,
  extractPatchImageData,
  computeEdgeFitQuality,
  calculateExtendedGuideLines,
} from "@/lib/visualization/magneticSnapping";
import type { PaperReviewResult } from "@/lib/visualization/paperReference";
import {
  findSeedEnclosingCandidate,
  requestClickGuidedPaperDetection,
} from "@/lib/visualization/paperReference";
import {
  computeUnwarpedAspectRatio,
  CANONICAL_PAPER_DIMENSIONS_MM,
} from "@/lib/visualization/paperAspectMatcher";

export interface PaperDetectionConfirmationModalProps {
  candidates?: PaperCandidate[];
  selectedCandidateId?: string | null;
  paperStandardConfirmed?: boolean;
  suggestedPaperStandard?: FiducialPaperStandard | null;
  aspectRatioMatchConfidence?: number;
  unwarpedAspectRatio?: number | null;
  isOpen?: boolean;
  backgroundImageUrl: string;
  canvasWidth: number;
  canvasHeight: number;
  initialCorners?: [Point2D, Point2D, Point2D, Point2D] | Point2D[] | null;
  paperStandard?: FiducialPaperStandard;
  confidence?: number;
  status?: PaperCalibrationStatus;
  referenceSource?: PaperReferenceSource;
  onConfirm: (
    corners: [Point2D, Point2D, Point2D, Point2D],
    result: PaperReviewResult,
    paperStandard: FiducialPaperStandard,
  ) => void;
  onSkip: (review?: PaperReviewResult) => void;
  onRetake?: () => void;
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
  confidence = 0,
  candidates = [],
  selectedCandidateId = null,
  paperStandardConfirmed = false,
  suggestedPaperStandard = null,
  aspectRatioMatchConfidence = 0,
  unwarpedAspectRatio = null,
  status,
  referenceSource: propsReferenceSource,
  onConfirm,
  onSkip,
  onCancel,
  onRetake,
}: PaperDetectionConfirmationModalProps) {
  const [firstEdge, setFirstEdge] = useState<"short" | "long">("short");
  const [orientationConfirmed, setOrientationConfirmed] = useState(false);
  const [formatConfirmed, setFormatConfirmed] = useState(paperStandardConfirmed);
  const [placement, setPlacement] = useState<"unknown" | "user_confirmed_same_plane" | "mismatch_reported">("unknown");
  const [boundaryUnsafe, setBoundaryUnsafe] = useState(false);
  const samePlane = placement === "user_confirmed_same_plane" && !boundaryUnsafe;
  const recoveryReview: PaperReviewResult = { scaleCmPerPx: 0, confidence: 0,
    placementAssessment: placement, placementRiskReasons: boundaryUnsafe ? ["warped_paper"] :
      placement === "mismatch_reported" ? ["handheld_or_offset"] : placement === "unknown" ? ["unknown_offset"] : [] };
  const [candidateId, setCandidateId] = useState(selectedCandidateId);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [manualMode, setManualMode] = useState(Boolean(initialCorners?.length === 4 && status === "verified_calibrated"));
  const [hasBoundarySeed, setHasBoundarySeed] = useState(Boolean(initialCorners?.length === 4));
  const [adjustedIndices, setAdjustedIndices] = useState<number[]>([]);
  const [selectedStandard, setSelectedStandard] = useState<FiducialPaperStandard>(paperStandard);

  const userSelectedStandardRef = useRef(false);
  const userOrientationToggledRef = useRef(false);

  // Click-guided interactive state (IMP-MS58)
  const [activeCandidates, setActiveCandidates] = useState<PaperCandidate[]>(candidates || []);
  const [prevCandidates, setPrevCandidates] = useState<PaperCandidate[] | undefined>(candidates);
  if (candidates !== prevCandidates) {
    setPrevCandidates(candidates);
    if (candidates && candidates.length > 0) {
      setActiveCandidates(candidates);
    }
  }
  const [currentReferenceSource, setCurrentReferenceSource] = useState<PaperReferenceSource | null>(
    () => propsReferenceSource || (status === "detected" && selectedCandidateId ? "auto_detected" : null)
  );
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const [isSnapping, setIsSnapping] = useState<boolean>(false);
  const [snapNotice, setSnapNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const hasAutoDetection = Boolean(
    initialCorners &&
      initialCorners.length === 4 &&
      status !== "manual_pin_required" &&
      confidence > 0 && !manualMode,
  );

  const orderedInitial = initialCorners && initialCorners.length === 4
    ? orderPaperCorners(initialCorners)
    : null;

  const [points, setPoints] = useState<[Point2D, Point2D, Point2D, Point2D]>(() => {
    if (orderedInitial) {
      return orderedInitial;
    }
    return createDefaultPaperCorners(canvasWidth, canvasHeight, paperStandard);
  });

  // Perspective unwarping aspect ratio matcher and auto-suggestion (IMP-MS60 / QAD-TC75)
  const matchResult = useMemo(() => {
    if (!points || points.length !== 4) return null;
    try {
      return computeUnwarpedAspectRatio(points, canvasWidth, canvasHeight);
    } catch {
      return null;
    }
  }, [points, canvasWidth, canvasHeight]);

  const effectiveSuggestedStandard = suggestedPaperStandard ?? matchResult?.suggestedStandard ?? null;
  const effectiveMatchConfidence = aspectRatioMatchConfidence > 0 ? aspectRatioMatchConfidence : (matchResult?.confidenceMatch ?? 0);
  const effectiveUnwarpedRatio = unwarpedAspectRatio ?? matchResult?.unwarpedRatio ?? null;

  // Auto-suggest paper standard if customer hasn't explicitly selected one yet
  useEffect(() => {
    if (!userSelectedStandardRef.current && !paperStandardConfirmed && effectiveSuggestedStandard) {
      setSelectedStandard(effectiveSuggestedStandard);
    }
  }, [effectiveSuggestedStandard, paperStandardConfirmed]);

  // Auto-detect principal orientation unless customer manually swapped orientation
  useEffect(() => {
    if (!userOrientationToggledRef.current && matchResult?.recommendedFirstEdge) {
      setFirstEdge(matchResult.recommendedFirstEdge);
    }
  }, [matchResult?.recommendedFirstEdge]);

  const [hasUserAdjusted, setHasUserAdjusted] = useState<boolean>(false);
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const [activeCornerDrag, setActiveCornerDrag] = useState<ActiveCornerDrag | null>(null);
  const [availableCanvasSize, setAvailableCanvasSize] = useState({ width: 0, height: 0 });

  // Client-side magnetic edge snapping state (IMP-MS59)
  const [isSnapped, setIsSnapped] = useState<boolean>(false);
  const [snapGradientStrength, setSnapGradientStrength] = useState<number>(0);
  const lastSnappedRef = useRef<boolean>(false);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!backgroundImageUrl || canvasWidth <= 0 || canvasHeight <= 0) return;
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
    img.src = backgroundImageUrl;
  }, [backgroundImageUrl, canvasWidth, canvasHeight]);

  const dialogRef = useRef<HTMLDivElement>(null);
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
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), [tabindex=\"0\"]") ?? []);
    focusables()[0]?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const items = focusables();
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); previousFocus?.focus(); };
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
    setManualMode(true);
    setCandidateId(null);
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

    setAdjustedIndices((indices) => indices.includes(activeDragIndex) ? indices : [...indices, activeDragIndex]);
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

      // IMP-MS54: preserve the displayed edge correspondence through corner edits.
      dragOffsetRef.current = null;
      setActiveDragIndex(null);
      setActiveCornerDrag(null);
      lastSnappedRef.current = false;
      setIsSnapped(false);
      setSnapGradientStrength(0);
    }
  };

  const handleResetCorners = () => {
    if (candidateId) setRejectedIds((ids) => [...ids, candidateId]);
    setCandidateId(null);
    setHasBoundarySeed(false);
    setPoints(createDefaultPaperCorners(canvasWidth, canvasHeight, selectedStandard));
    setManualMode(true);
    setHasUserAdjusted(true);
    setAdjustedIndices([]);
    dragOffsetRef.current = null;
    setActiveDragIndex(null);
    setActiveCornerDrag(null);
    lastSnappedRef.current = false;
    setIsSnapped(false);
    setSnapGradientStrength(0);
  };

  const selectCandidate = (candidate: PaperCandidate) => {
    setOrientationConfirmed(false);
    setPoints(orderPaperCorners(candidate.corners.map(([x, y]) => ({ x, y }))));
    setCandidateId(candidate.id);
    setManualMode(false);
    setHasBoundarySeed(true);
    setHasUserAdjusted(false);
    setAdjustedIndices([]);
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
      const diagonal = Math.hypot(canvasWidth, canvasHeight);

      // Tier 1 Fast Proposal Spatial Query (Instant < 100ms)
      const matched = findSeedEnclosingCandidate(activeCandidates, { x: canvasX, y: canvasY }, diagonal);
      if (matched) {
        selectCandidate(matched);
        setCurrentReferenceSource("click_guided");
        setSnapNotice({
          type: "success",
          message: `Snapped to Outline ${matched.id.replace("candidate-", "")}`,
        });
        return;
      }

      // Tier 2 Localized Seed-Based Extraction via CV Service
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const ac = new AbortController();
      abortControllerRef.current = ac;
      setIsSnapping(true);

      try {
        const res = await requestClickGuidedPaperDetection(
          backgroundImageUrl,
          seedPoint,
          selectedStandard,
          ac.signal,
        );

        if (res.outcome === "candidate_found" && res.candidate) {
          const newCandidate = res.candidate;
          setActiveCandidates((prev) => {
            const filtered = prev.filter((c) => c.id !== newCandidate.id);
            return [newCandidate, ...filtered];
          });
          selectCandidate(newCandidate);
          setCurrentReferenceSource("click_guided");
          setSnapNotice({
            type: "success",
            message: "Snapped corners to paper sheet boundary",
          });
        } else {
          setSnapNotice({
            type: "info",
            message: "No paper boundary detected near tap. Tap directly on the sheet or adjust pins manually.",
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
    [activeCandidates, backgroundImageUrl, canvasHeight, canvasWidth, selectedStandard],
  );

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeCornerDrag !== null || !e.isPrimary || e.button !== 0) return;
    const coord = getCanvasCoordinates(e.clientX, e.clientY);
    if (!coord) return;
    handleTapToSnap(coord.x, coord.y);
  };

  const boundaryReviewed = Boolean(candidateId) ||
    (manualMode && (hasBoundarySeed || adjustedIndices.length === 4));
  const canConfirm = formatConfirmed && samePlane && boundaryReviewed && orientationConfirmed;

  // Convexity check
  const isValidQuad = isValidQuadrilateral(points);

  // Live scale preview
  const liveScale = (() => {
    if (!isValidQuad || !formatConfirmed || !boundaryReviewed) return null;
    try {
      return computeScaleFromPaperCorners(points, selectedStandard);
    } catch {
      return null;
    }
  })();

  const handleConfirm = () => {
    if (!isValidQuad || !canConfirm) return;
    try {
      const ordered = points;
      const scaleResult = computeScaleFromPaperCorners(ordered, selectedStandard);
      onConfirm(ordered, { ...scaleResult, confidence: 0,
        referenceSource: manualMode
          ? "manual_corners"
          : currentReferenceSource === "click_guided"
          ? "click_guided"
          : candidateId === selectedCandidateId
          ? "auto_detected"
          : "candidate_selected",
        selectedCandidateId: manualMode ? null : candidateId,
        placementAssessment: recoveryReview.placementAssessment, placementRiskReasons: recoveryReview.placementRiskReasons, paperStandardConfirmed: true, samePlaneConfirmed: true, firstEdge, orientationConfirmed,
      }, selectedStandard);
    } catch (err) {
      console.warn("Paper calibration confirmation warning:", err);
    }
  };

  if (!isOpen) return null;

  const polygonPointsAttr = points.map((p) => `${p.x},${p.y}`).join(" ");
  const extendedGuides = calculateExtendedGuideLines(points, 20);

  // Detection state badge label & styling
  let badgeLabel = "Review Reference Outline";
  let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (hasUserAdjusted || manualMode) {
    badgeLabel = "Manual Corner Review";
    badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (currentReferenceSource === "click_guided") {
    badgeLabel = "Click-Guided Snapped Reference";
    badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (!candidateId) {
    badgeLabel = "Tap Paper Sheet to Snap Corners";
    badgeStyle = "bg-sky-50 text-sky-700 border-sky-200";
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


  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Review paper reference" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-between select-none animate-in fade-in duration-200 p-2 sm:p-4 md:p-6 overflow-hidden">
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
                Review the sheet boundary, actual format, and placement. Dimensions remain estimates.
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

            {/* Edge straightness collinearity trust badge (IMP-MS59) */}
            {isValidQuad && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Edge Alignment: Sharp
              </span>
            )}

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
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            <span className="text-neutral-400 text-xs font-medium mr-1 hidden sm:inline">
              Paper Standard:
            </span>
            <div className="flex items-center gap-1 rounded-full bg-neutral-800/80 p-0.5 border border-white/10 flex-wrap sm:flex-nowrap">
              {(["short", "a4", "long"] as const).map((std) => {
                const isBestMatch = effectiveSuggestedStandard === std && effectiveMatchConfidence >= 0.85;
                return (
                  <button
                    key={std}
                    type="button"
                    onClick={() => {
                      userSelectedStandardRef.current = true;
                      setSelectedStandard(std);
                      setFormatConfirmed(true);
                      setOrientationConfirmed(false);
                    }}
                    className={`cursor-pointer rounded-full px-2.5 py-1 text-xs transition-all flex items-center gap-1.5 ${
                      selectedStandard === std
                        ? "bg-white text-[#0f1422] font-bold shadow-xs"
                        : "text-neutral-300 hover:text-white"
                    }`}
                  >
                    <span>
                      {std === "short"
                        ? "Short Bond (8.5x11in)"
                        : std === "a4"
                        ? "A4 (210x297mm)"
                        : "Long Bond (8.5x13in)"}
                    </span>
                    {isBestMatch && (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.2 font-semibold border border-emerald-500/30">
                        Best Match {Math.round(effectiveMatchConfidence * 100)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Metric Scale Readout, Best Match Notification, or Error */}
          <div className="flex items-center gap-2 font-mono text-xs">
            {isValidQuad && liveScale ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                {effectiveSuggestedStandard && effectiveMatchConfidence >= 0.85 && (
                  <span className="text-emerald-300">
                    Recommended: {effectiveSuggestedStandard === "short" ? "Short Bond" : effectiveSuggestedStandard === "a4" ? "A4 Standard" : "Long Bond"} ({Math.round(effectiveMatchConfidence * 100)}% match{effectiveUnwarpedRatio ? `, ratio ${effectiveUnwarpedRatio.toFixed(2)}` : ""}) :{" "}
                  </span>
                )}
                Reference ready
              </span>
            ) : (
              <span className="text-rose-400 font-medium flex items-center gap-1">
                <AlertTriangle className="size-3.5" />
                {formatConfirmed ? "Review all four sheet corners" : "Choose the actual paper format"}
              </span>
            )}
          </div>
        </div>

        {/* ── Tap to Snap Guidance Banner (IMP-MS58) ── */}
        <div className="flex items-center justify-between gap-2.5 rounded-[16px] bg-neutral-900/90 border border-emerald-500/20 px-4 py-2 text-xs text-white shadow-md">
          <div className="flex items-center gap-2 min-w-0">
            {isSnapping ? (
              <Loader2 className="size-4 text-emerald-400 shrink-0 animate-spin" />
            ) : (
              <Sparkles className="size-4 text-emerald-400 shrink-0 animate-pulse" />
            )}
            <span className="truncate">
              {isSnapping
                ? "Snapping corners to paper sheet boundary..."
                : snapNotice
                ? snapNotice.message
                : (!hasAutoDetection || manualMode || !candidateId)
                ? "Automatic detection uncertain. Tap directly on the paper sheet to snap corners automatically."
                : "Tap anywhere on the paper sheet to re-snap corners automatically, or drag pins to adjust."}
            </span>
          </div>
          {snapNotice && (
            <button
              type="button"
              onClick={() => setSnapNotice(null)}
              className="text-neutral-400 hover:text-white p-1"
              aria-label="Dismiss notice"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Middle Interactive Canvas Viewport ── */}
      <div className="z-10 flex max-h-40 w-full max-w-5xl flex-wrap gap-2 overflow-y-auto rounded-[16px] bg-white px-4 py-2 text-xs text-neutral-700">
        {activeCandidates.filter((c) => !rejectedIds.includes(c.id) && !c.rejection_reasons.includes("cropped_boundary")).map((candidate) => (
          <button key={candidate.id} type="button" aria-pressed={candidateId === candidate.id}
            onClick={() => selectCandidate(candidate)}
            className="min-h-11 rounded-full border border-neutral-300 px-3 hover:bg-neutral-100">
            Outline {candidate.id.replace("candidate-", "")}
          </button>
        ))}
        {(() => {
          const dims = CANONICAL_PAPER_DIMENSIONS_MM[selectedStandard];
          const curWidthMm = firstEdge === "short" ? dims.shortMm : dims.longMm;
          const curHeightMm = firstEdge === "short" ? dims.longMm : dims.shortMm;
          const curOrient = firstEdge === "short" ? "Portrait" : "Landscape";
          return (
            <>
              <button
                type="button"
                onClick={() => {
                  userOrientationToggledRef.current = true;
                  setFirstEdge(firstEdge === "short" ? "long" : "short");
                  setOrientationConfirmed(false);
                }}
                className="min-h-11 rounded-full border border-neutral-300 px-3 hover:bg-neutral-100 flex items-center gap-1.5 font-medium"
              >
                <span>⇄ Swap Orientation ({curOrient}: {curWidthMm}mm W x {curHeightMm}mm H)</span>
              </button>
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" checked={orientationConfirmed} onChange={(e) => setOrientationConfirmed(e.target.checked)} />
                I confirm edge 1 to 2 follows the physical {firstEdge} side of the sheet ({curWidthMm}mm horizontal width)
              </label>
            </>
          );
        })()}
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={formatConfirmed} onChange={(e) => setFormatConfirmed(e.target.checked)} />
          I confirm the selected paper format
        </label>
        <fieldset>
          <legend>Was the paper flat against the same surface as the opening? Holding it in front can change the measurements.</legend>
          {([
            ["user_confirmed_same_plane", "Flat against the same installation surface"],
            ["mismatch_reported", "Held in front, another wall, or known offset"],
            ["unknown", "Unsure"],
          ] as const).map(([value, label]) => (
            <label key={value} className="flex min-h-11 items-center gap-2">
              <input type="radio" name="paper-placement" checked={placement === value} onChange={() => setPlacement(value)} />{label}
            </label>
          ))}
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={boundaryUnsafe} onChange={(e) => setBoundaryUnsafe(e.target.checked)} />
            Paper is curled or some corners are hidden
          </label>
          {!samePlane && <p role="status">Paper measurement is unavailable. Retake with all corners visible on the front installation surface, continue approximate preview, or enter both tape-measured dimensions during dimension confirmation. A recessed jamb or back wall needs its own reference.</p>}
          <button type="button" onClick={onRetake ?? onCancel} className="min-h-11 rounded-full border border-neutral-300 px-3 hover:bg-neutral-100">Retake photo</button>
        </fieldset>
      </div>

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
              onPointerDown={handleSvgPointerDown}
              onPointerMove={handleSvgPointerMove}
              onPointerUp={handleSvgPointerUp}
              onPointerCancel={handleSvgPointerUp}
            >
              {activeCandidates.filter((c) => c.id !== candidateId && !rejectedIds.includes(c.id)).map((candidate) => (
                <polygon key={candidate.id} points={candidate.corners.map(([x, y]) => `${x},${y}`).join(" ")}
                  fill="transparent" stroke="#06a3bd" strokeWidth={2} strokeDasharray="6 4"
                  onClick={(e) => { e.stopPropagation(); selectCandidate(candidate); }} />
              ))}
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
                      {idx + 1}: {CORNER_NAMES[idx]}
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
            className={`absolute size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-neutral-900 shadow-2xl overflow-hidden ring-2 transition-all ${
              isSnapped
                ? "ring-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.5)]"
                : "ring-sky-500/80"
            }`}
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

            {/* Edge Fit Quality percentage badge (IMP-MS59 / QAD-TC74) */}
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
            <span>Wrong outline / Map corners</span>
          </button>

          {/* Tertiary Action: Skip Calibration */}
          <button
            type="button"
            onClick={() => onSkip(recoveryReview)}
            className="flex cursor-pointer items-center gap-1 rounded-[20px] border border-neutral-200 bg-transparent px-3.5 py-2.5 text-xs sm:text-sm font-normal text-neutral-600 transition-colors hover:bg-neutral-100"
          >
            <span>Continue Approximate Preview</span>
          </button>
        </div>

        {/* Primary Action: Looks Right / Confirm & Enter Workspace */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isValidQuad || !canConfirm}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-[25px] bg-green hover:bg-[#06a3bd] disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3.5 font-medium text-base shadow-md transition-colors"
        >
          <Check className="size-5" />
          <span>Looks Right / Confirm & Enter Workspace</span>
        </button>
      </div>
    </div>
  );
}
