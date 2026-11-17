"use client";

import { useSyncExternalStore } from "react";

export type TourViewportVariant = "desktop" | "mobile";

/**
 * Returns `"mobile"` when viewport width is strictly below `compactBreakpointPx`
 * (default 768px) and `"desktop"` otherwise. SSR-safe initial snapshot is `"desktop"`.
 */
export function useTourViewportVariant(
  compactBreakpointPx = 768,
): TourViewportVariant {
  const query = `(max-width: ${Math.max(1, compactBreakpointPx - 1)}px)`;

  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {};
      }
      const mql = window.matchMedia(query);
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onStoreChange);
        return () => mql.removeEventListener("change", onStoreChange);
      }
      // Fallback for older Safari / jsdom environments
      mql.addListener(onStoreChange);
      return () => mql.removeListener(onStoreChange);
    },
    () => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return "desktop";
      }
      return window.matchMedia(query).matches ? "mobile" : "desktop";
    },
    () => "desktop",
  );
}
