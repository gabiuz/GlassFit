"use client";

import React, { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Compass, HelpCircle, X } from "lucide-react";
import { useReducedMotion } from "motion/react";

export type TourPlacement = "top" | "bottom" | "left" | "right" | "auto";
type ResolvedSide = "top" | "bottom" | "left" | "right" | "fallback";

interface RectSnapshot {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface MeasurementSnapshot {
  targetViewportRect: RectSnapshot | null;
  popoverWidth: number;
  popoverHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollX: number;
  scrollY: number;
  docHeight: number;
  usesDocumentCoords: boolean;
}

const subscribeNoop = () => () => {};

function hasFixedAncestor(element: HTMLElement | null): boolean {
  let node: HTMLElement | null = element;
  while (node && node !== document.documentElement) {
    if (window.getComputedStyle(node).position === "fixed") {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

function rectsEqual(a: RectSnapshot | null, b: RectSnapshot | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function ensureTargetInViewport(el: HTMLElement, vh: number): void {
  const initialRect = el.getBoundingClientRect();
  if (initialRect.top >= 24 && initialRect.bottom <= vh - 24) {
    return;
  }
  el.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior: "auto",
  });
  const afterRect = el.getBoundingClientRect();
  if (afterRect.top < 24 || afterRect.bottom > vh - 24) {
    const deltaY = afterRect.top + afterRect.height / 2 - vh / 2;
    window.scrollTo({
      top: Math.max(0, window.scrollY + deltaY),
      behavior: "auto",
    });
  }
}

export interface OnboardingTourPopupProps {
  isOpen: boolean;
  title: string;
  description: string;
  helperNote?: string;
  stepIndex?: number;
  totalSteps?: number;
  /** CSS selector for the target control/region to spotlight and point to. */
  targetSelector?: string;
  /** Preferred side relative to the target element on desktop. */
  preferredPlacement?: TourPlacement;
  /** Optional explicit action button (not required when the target control itself advances the step). */
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  onSkip: () => void;
  onDontShowAgain: () => void;
  variant?: "desktop" | "mobile";
  /**
   * When true, darkens surrounding UI with a 4-quadrant spotlight cutout around targetSelector
   * so the highlighted control stays directly clickable/draggable.
   * When false (e.g. Preview Ready), renders a non-blocking anchored popover with an arrow.
   */
  blocking?: boolean;
  zIndexBase?: number;
  /** Optional CSS selector to restore focus to when the tour closes (e.g. header Help button). */
  restoreFocusSelector?: string;
}

function clamp(value: number, min: number, max: number): number {
  if (max <= min) return min;
  return Math.min(max, Math.max(min, value));
}

function computeAnchoredLayout(options: {
  targetRect: RectSnapshot | null;
  popoverWidth: number;
  popoverHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  variant: "desktop" | "mobile";
  preferredPlacement: TourPlacement;
}): {
  side: ResolvedSide;
  top: number;
  left: number;
  arrowOffset: number;
} {
  const {
    targetRect,
    popoverWidth,
    popoverHeight,
    viewportWidth,
    viewportHeight,
    variant,
    preferredPlacement,
  } = options;

  const margin = variant === "mobile" ? 8 : 14;
  const gap = 16;

  if (!targetRect) {
    return {
      side: "fallback",
      top: Math.max(margin, Math.round((viewportHeight - popoverHeight) / 2)),
      left: Math.max(margin, Math.round((viewportWidth - popoverWidth) / 2)),
      arrowOffset: 0,
    };
  }

  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  if (variant === "mobile") {
    const placeAbove = targetCenterY >= viewportHeight * 0.48;
    const rawLeft = targetCenterX - popoverWidth / 2;
    const left = clamp(rawLeft, margin, viewportWidth - popoverWidth - margin);
    const arrowOffset = clamp(targetCenterX - left, 24, popoverWidth - 24);

    if (placeAbove) {
      const rawTop = targetRect.top - gap - popoverHeight;
      const top = clamp(rawTop, margin, Math.max(margin, targetRect.top - popoverHeight - 8));
      return { side: "top", top, left, arrowOffset };
    }

    const rawTop = targetRect.bottom + gap;
    const top = clamp(rawTop, margin, viewportHeight - popoverHeight - margin);
    return { side: "bottom", top, left, arrowOffset };
  }

  const candidates: Array<"left" | "right" | "bottom" | "top"> = [];
  if (preferredPlacement !== "auto") {
    candidates.push(preferredPlacement);
  }
  for (const side of ["left", "right", "bottom", "top"] as const) {
    if (!candidates.includes(side)) candidates.push(side);
  }

  const fitsSide = (side: "left" | "right" | "bottom" | "top"): boolean => {
    if (side === "left") return targetRect.left - gap - popoverWidth >= margin;
    if (side === "right") return targetRect.right + gap + popoverWidth <= viewportWidth - margin;
    if (side === "bottom") return targetRect.bottom + gap + popoverHeight <= viewportHeight - margin;
    return targetRect.top - gap - popoverHeight >= margin;
  };

  let chosen: "left" | "right" | "bottom" | "top" | undefined = candidates.find(fitsSide);

  if (!chosen) {
    const spaceBySide = {
      left: targetRect.left,
      right: viewportWidth - targetRect.right,
      bottom: viewportHeight - targetRect.bottom,
      top: targetRect.top,
    };
    chosen = candidates.reduce((best, next) =>
      spaceBySide[next] > spaceBySide[best] ? next : best,
    );
  }

  if (chosen === "left") {
    const left = clamp(
      targetRect.left - gap - popoverWidth,
      margin,
      viewportWidth - popoverWidth - margin,
    );
    const top = clamp(
      targetCenterY - popoverHeight / 2,
      margin,
      viewportHeight - popoverHeight - margin,
    );
    const arrowOffset = clamp(targetCenterY - top, 24, popoverHeight - 24);
    return { side: "left", top, left, arrowOffset };
  }

  if (chosen === "right") {
    const left = clamp(
      targetRect.right + gap,
      margin,
      viewportWidth - popoverWidth - margin,
    );
    const top = clamp(
      targetCenterY - popoverHeight / 2,
      margin,
      viewportHeight - popoverHeight - margin,
    );
    const arrowOffset = clamp(targetCenterY - top, 24, popoverHeight - 24);
    return { side: "right", top, left, arrowOffset };
  }

  if (chosen === "top") {
    const top = clamp(
      targetRect.top - gap - popoverHeight,
      margin,
      viewportHeight - popoverHeight - margin,
    );
    const left = clamp(
      targetCenterX - popoverWidth / 2,
      margin,
      viewportWidth - popoverWidth - margin,
    );
    const arrowOffset = clamp(targetCenterX - left, 24, popoverWidth - 24);
    return { side: "top", top, left, arrowOffset };
  }

  const top = clamp(
    targetRect.bottom + gap,
    margin,
    viewportHeight - popoverHeight - margin,
  );
  const left = clamp(
    targetCenterX - popoverWidth / 2,
    margin,
    viewportWidth - popoverWidth - margin,
  );
  const arrowOffset = clamp(targetCenterX - left, 24, popoverWidth - 24);
  return { side: "bottom", top, left, arrowOffset };
}

/**
 * Anchored, action-driven onboarding popover with spotlight cutout and directional arrow
 * pointing at the next UI control to interact with (IMP-MS89, DSD-UI3, DSD-UI4).
 */
export function OnboardingTourPopup({
  isOpen,
  title,
  description,
  helperNote,
  stepIndex,
  totalSteps,
  targetSelector,
  preferredPlacement = "auto",
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  onSkip,
  onDontShowAgain,
  variant = "desktop",
  blocking = true,
  zIndexBase = 70,
  restoreFocusSelector,
}: OnboardingTourPopupProps) {
  const titleId = useId();
  const descId = useId();
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const [measurement, setMeasurement] = useState<MeasurementSnapshot>(() => ({
    targetViewportRect: null,
    popoverWidth: variant === "mobile" ? 340 : 350,
    popoverHeight: 210,
    viewportWidth: 1280,
    viewportHeight: 800,
    scrollX: 0,
    scrollY: 0,
    docHeight: 800,
    usesDocumentCoords: false,
  }));

  // Lock user page scrolling while a blocking tour step is active.
  useEffect(() => {
    if (!isOpen || !blocking) return;

    const htmlEl = document.documentElement;
    const prevHtmlOverflow = htmlEl.style.overflow;
    const prevHtmlOverscroll = htmlEl.style.overscrollBehavior;

    htmlEl.style.overflow = "hidden";
    htmlEl.style.overscrollBehavior = "none";

    const isInsideNode = (container: HTMLElement | null, node: EventTarget | null): boolean =>
      Boolean(container && node instanceof Node && container.contains(node));

    const handleWheel = (event: WheelEvent) => {
      if (isInsideNode(cardRef.current, event.target)) return;
      event.preventDefault();
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (isInsideNode(cardRef.current, event.target)) return;
      const spotlightEl = targetSelector
        ? document.querySelector<HTMLElement>(targetSelector)
        : null;
      if (isInsideNode(spotlightEl, event.target)) return;
      event.preventDefault();
    };

    const handleScrollKeys = (event: KeyboardEvent) => {
      if (
        event.key !== "PageUp" &&
        event.key !== "PageDown" &&
        event.key !== "Home" &&
        event.key !== "End" &&
        event.key !== "ArrowUp" &&
        event.key !== "ArrowDown" &&
        event.key !== " "
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (isInsideNode(cardRef.current, target)) return;
      event.preventDefault();
    };

    window.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    window.addEventListener("touchmove", handleTouchMove, { capture: true, passive: false });
    window.addEventListener("keydown", handleScrollKeys, true);

    return () => {
      htmlEl.style.overflow = prevHtmlOverflow;
      htmlEl.style.overscrollBehavior = prevHtmlOverscroll;
      window.removeEventListener("wheel", handleWheel, true);
      window.removeEventListener("touchmove", handleTouchMove, true);
      window.removeEventListener("keydown", handleScrollKeys, true);
    };
  }, [blocking, isOpen, targetSelector]);

  // Frame target comfortably in view when step / targetSelector changes.
  useEffect(() => {
    if (!isOpen || !targetSelector) return;
    const el = document.querySelector<HTMLElement>(targetSelector);
    if (!el) return;
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
    ensureTargetInViewport(el, window.innerHeight);
  }, [isOpen, targetSelector]);

  // Continuously track target bounds, card dimensions, and document/viewport geometry.
  useEffect(() => {
    if (!isOpen) return;

    let rafId = 0;
    const readDocumentMode = (el: HTMLElement | null): boolean =>
      Boolean(el && !hasFixedAncestor(el));

    const measure = () => {
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const vh = window.innerHeight;
      let sx = window.scrollX;
      let sy = window.scrollY;
      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0,
        vh,
      );

      let nextCardW = 0;
      let nextCardH = 0;
      if (cardRef.current) {
        const cardBounds = cardRef.current.getBoundingClientRect();
        if (cardBounds.width > 0 && cardBounds.height > 0) {
          nextCardW = Math.round(cardBounds.width);
          nextCardH = Math.round(cardBounds.height);
        }
      }

      let nextTargetRect: RectSnapshot | null = null;
      let usesDocumentCoords = false;
      if (targetSelector) {
        const el = document.querySelector<HTMLElement>(targetSelector);
        if (el) {
          let rect = el.getBoundingClientRect();
          if (blocking && rect.width > 0 && rect.height > 0 && (rect.top < 24 || rect.bottom > vh - 24)) {
            ensureTargetInViewport(el, vh);
            rect = el.getBoundingClientRect();
            sx = window.scrollX;
            sy = window.scrollY;
          }
          if (rect.width > 0 && rect.height > 0) {
            usesDocumentCoords = readDocumentMode(el);
            nextTargetRect = {
              top: rect.top,
              left: rect.left,
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
            };
          }
        }
      }

      setMeasurement((prev) => {
        const popoverWidth = nextCardW > 0 ? nextCardW : prev.popoverWidth;
        const popoverHeight = nextCardH > 0 ? nextCardH : prev.popoverHeight;
        if (
          rectsEqual(prev.targetViewportRect, nextTargetRect) &&
          prev.popoverWidth === popoverWidth &&
          prev.popoverHeight === popoverHeight &&
          prev.viewportWidth === vw &&
          prev.viewportHeight === vh &&
          prev.scrollX === sx &&
          prev.scrollY === sy &&
          prev.docHeight === docHeight &&
          prev.usesDocumentCoords === usesDocumentCoords
        ) {
          return prev;
        }
        return {
          targetViewportRect: nextTargetRect,
          popoverWidth,
          popoverHeight,
          viewportWidth: vw,
          viewportHeight: vh,
          scrollX: sx,
          scrollY: sy,
          docHeight,
          usesDocumentCoords,
        };
      });
    };

    const scheduleMeasure = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(measure);
    };

    const handleScroll = (event: Event) => {
      // Document-flow overlays ride on the GPU compositor during page scroll with zero JS lag.
      if (event.target === document || event.target === window) {
        const targetEl = targetSelector
          ? document.querySelector<HTMLElement>(targetSelector)
          : null;
        if (readDocumentMode(targetEl)) {
          return;
        }
      }
      measure();
    };

    scheduleMeasure();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleMeasure)
        : null;

    if (observer) {
      observer.observe(document.documentElement);
      if (cardRef.current) observer.observe(cardRef.current);
      if (targetSelector) {
        const targetEl = document.querySelector<HTMLElement>(targetSelector);
        if (targetEl) {
          observer.observe(targetEl);
          let ancestor = targetEl.parentElement;
          while (ancestor && ancestor !== document.body) {
            observer.observe(ancestor);
            ancestor = ancestor.parentElement;
          }
        }
      }
    }

    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [blocking, isOpen, targetSelector, title, description]);

  // Capture Escape exclusively so parent modals stay open when dismissing the guide.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        onSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, onSkip]);

  // Restore focus to the surface Help trigger (or prior active element) when the tour closes.
  useEffect(() => {
    if (isOpen) {
      if (!wasOpenRef.current && typeof document !== "undefined") {
        const active = document.activeElement;
        lastActiveElementRef.current = active instanceof HTMLElement ? active : null;
      }
      wasOpenRef.current = true;
      return;
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      const restoreTarget = restoreFocusSelector
        ? document.querySelector<HTMLElement>(restoreFocusSelector)
        : lastActiveElementRef.current;
      if (
        restoreTarget &&
        restoreTarget.isConnected &&
        !(restoreTarget as HTMLButtonElement).disabled
      ) {
        restoreTarget.focus({ preventScroll: true });
      }
      lastActiveElementRef.current = null;
    }
  }, [isOpen, restoreFocusSelector]);

  const targetRect = measurement.targetViewportRect;
  const layout = useMemo(
    () =>
      computeAnchoredLayout({
        targetRect,
        popoverWidth: measurement.popoverWidth,
        popoverHeight: measurement.popoverHeight,
        viewportWidth: measurement.viewportWidth,
        viewportHeight: measurement.viewportHeight,
        variant,
        preferredPlacement,
      }),
    [
      measurement.popoverHeight,
      measurement.popoverWidth,
      measurement.viewportHeight,
      measurement.viewportWidth,
      preferredPlacement,
      targetRect,
      variant,
    ],
  );

  if (!isOpen) return null;

  const hasStepCounter =
    typeof stepIndex === "number" &&
    typeof totalSteps === "number" &&
    totalSteps > 1;
  const stepLabel = hasStepCounter
    ? `Step ${stepIndex + 1} of ${totalSteps}`
    : "Guided step";

  const usesDocumentCoords = isClient && measurement.usesDocumentCoords && Boolean(targetRect);
  const posClass = usesDocumentCoords ? "absolute" : "fixed";
  const offsetX = usesDocumentCoords ? measurement.scrollX : 0;
  const offsetY = usesDocumentCoords ? measurement.scrollY : 0;
  const maxRight = usesDocumentCoords
    ? measurement.viewportWidth + measurement.scrollX
    : measurement.viewportWidth;
  const maxBottom = usesDocumentCoords
    ? measurement.docHeight
    : measurement.viewportHeight;

  const spotlightPad = 6;
  const cutTop = targetRect ? Math.max(0, targetRect.top + offsetY - spotlightPad) : 0;
  const cutLeft = targetRect ? Math.max(0, targetRect.left + offsetX - spotlightPad) : 0;
  const cutRight = targetRect
    ? Math.max(cutLeft, Math.min(maxRight, targetRect.right + offsetX + spotlightPad))
    : 0;
  const cutBottom = targetRect
    ? Math.max(cutTop, Math.min(maxBottom, targetRect.bottom + offsetY + spotlightPad))
    : 0;

  const motionClass = prefersReducedMotion
    ? ""
    : "animate-in fade-in duration-150";

  const DirectionArrowIcon =
    layout.side === "top"
      ? ArrowDown
      : layout.side === "bottom"
        ? ArrowUp
        : layout.side === "left"
          ? ArrowRight
          : layout.side === "right"
            ? ArrowLeft
            : null;

  const popoverWidthClass =
    variant === "mobile"
      ? "w-[min(calc(100vw-16px),380px)] max-h-[45dvh] overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      : "w-[min(calc(100vw-28px),360px)] p-5";

  const overlayContent = (
    <>
      {/* Darkened backdrop or 4-strip spotlight cutout leaving target interactive */}
      {blocking && !targetRect && (
        <div
          aria-hidden="true"
          className="pointer-events-auto fixed inset-0 bg-black/60 backdrop-blur-xs"
          style={{ zIndex: zIndexBase - 2 }}
        />
      )}

      {blocking && targetRect && (
        <div aria-hidden="true">
          <div
            className={`pointer-events-auto ${posClass} bg-transparent`}
            style={{
              zIndex: zIndexBase - 2,
              top: 0,
              left: 0,
              right: 0,
              height: cutTop,
            }}
          />
          <div
            className={`pointer-events-auto ${posClass} bg-transparent`}
            style={
              usesDocumentCoords
                ? {
                    zIndex: zIndexBase - 2,
                    top: cutBottom,
                    left: 0,
                    right: 0,
                    height: Math.max(0, measurement.docHeight - cutBottom),
                  }
                : {
                    zIndex: zIndexBase - 2,
                    top: cutBottom,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }
            }
          />
          <div
            className={`pointer-events-auto ${posClass} bg-transparent`}
            style={{
              zIndex: zIndexBase - 2,
              top: cutTop,
              left: 0,
              width: cutLeft,
              height: Math.max(0, cutBottom - cutTop),
            }}
          />
          <div
            className={`pointer-events-auto ${posClass} bg-transparent`}
            style={{
              zIndex: zIndexBase - 2,
              top: cutTop,
              left: cutRight,
              right: 0,
              height: Math.max(0, cutBottom - cutTop),
            }}
          />
        </div>
      )}

      {/* Spotlight ring + rounded darkened cutout (zero corner mismatch, zero scroll lag) */}
      {targetRect && (
        <div
          aria-hidden="true"
          className={`pointer-events-none ${usesDocumentCoords ? "absolute inset-0" : "fixed inset-0"} overflow-hidden`}
          style={{ zIndex: zIndexBase - 1 }}
        >
          <div
            className={`pointer-events-none ${posClass} rounded-[14px] border-2 border-[#07b6d3]`}
            style={{
              top: cutTop,
              left: cutLeft,
              width: Math.max(0, cutRight - cutLeft),
              height: Math.max(0, cutBottom - cutTop),
              boxShadow: blocking
                ? "0 0 0 4px rgba(7,182,211,0.28), 0 0 0 9999px rgba(0,0,0,0.6)"
                : "0 0 0 4px rgba(7,182,211,0.28)",
            }}
          />
        </div>
      )}

      {/* Anchored Popover Card with Directional Arrow */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal={blocking && !targetRect ? true : undefined}
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`pointer-events-auto ${posClass} rounded-[20px] border border-[#07b6d3]/40 bg-white text-left shadow-[0px_10px_30px_rgba(0,0,0,0.28)] ${popoverWidthClass} ${motionClass}`}
        style={{
          zIndex: zIndexBase,
          top: layout.top + offsetY,
          left: layout.left + offsetX,
        }}
      >
        {/* Geometric Arrow Tail pointing directly toward the target */}
        {layout.side === "top" && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-2 size-4 -translate-x-1/2 rotate-45 border-r border-b border-[#07b6d3]/50 bg-white"
            style={{ left: layout.arrowOffset }}
          />
        )}
        {layout.side === "bottom" && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-2 size-4 -translate-x-1/2 rotate-45 border-t border-l border-[#07b6d3]/50 bg-white"
            style={{ left: layout.arrowOffset }}
          />
        )}
        {layout.side === "left" && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 size-4 -translate-y-1/2 rotate-45 border-t border-r border-[#07b6d3]/50 bg-white"
            style={{ top: layout.arrowOffset }}
          />
        )}
        {layout.side === "right" && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-2 size-4 -translate-y-1/2 rotate-45 border-b border-l border-[#07b6d3]/50 bg-white"
            style={{ top: layout.arrowOffset }}
          />
        )}

        <div className="sr-only" aria-live="polite">
          {stepLabel}: {title}. {description}
        </div>

        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-light text-green border border-green/25">
              {DirectionArrowIcon ? (
                <DirectionArrowIcon
                  className={`size-4 ${prefersReducedMotion ? "" : "animate-pulse"}`}
                  aria-hidden="true"
                />
              ) : blocking ? (
                <Compass className="size-4" aria-hidden="true" />
              ) : (
                <HelpCircle className="size-4" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center rounded-full bg-light px-2 py-0.5 text-[11px] font-semibold text-[#097283] border border-green/20">
                {stepLabel}
              </span>
              <h2
                id={titleId}
                className="mt-0.5 text-base sm:text-lg font-semibold text-[#0f1422] tracking-tight"
              >
                {title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip guide"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-[#0f1422] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3]"
          >
            <X className="size-4.5" aria-hidden="true" />
          </button>
        </div>

        <p
          id={descId}
          className="mt-2.5 text-sm leading-relaxed text-[#0f1422]/85"
        >
          {description}
        </p>

        {helperNote && (
          <p className="mt-2 rounded-[10px] border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs leading-snug text-neutral-700">
            {helperNote}
          </p>
        )}

        {(primaryActionLabel || secondaryActionLabel) && (
          <div className="mt-3.5 flex flex-col gap-2">
            {primaryActionLabel && onPrimaryAction && (
              <button
                type="button"
                onClick={onPrimaryAction}
                className="w-full min-h-11 rounded-xl bg-green hover:bg-[#06a3bd] px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1422]"
              >
                {primaryActionLabel}
              </button>
            )}

            {secondaryActionLabel && onSecondaryAction && (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="w-full min-h-11 rounded-xl border border-green/40 bg-light hover:bg-light/70 px-4 py-2 text-sm font-medium text-[#0f1422] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3]"
              >
                {secondaryActionLabel}
              </button>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2">
          <button
            type="button"
            onClick={onSkip}
            className="min-h-11 rounded-[10px] px-2.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-[#0f1422] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3]"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={onDontShowAgain}
            className="min-h-11 rounded-[10px] px-2.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-[#0f1422] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07b6d3]"
          >
            Don&apos;t show again
          </button>
        </div>
      </div>
    </>
  );

  if (usesDocumentCoords) {
    return createPortal(
      <div
        className="pointer-events-none absolute top-0 left-0 right-0"
        style={{ height: measurement.docHeight }}
      >
        {overlayContent}
      </div>,
      document.body,
    );
  }

  return overlayContent;
}
