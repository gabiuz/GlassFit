"use client";

import { useSyncExternalStore } from "react";
import {
  classifyCompactViewport,
  type CompactViewportState,
} from "../mobileConfiguratorGeometry";

const SERVER_SNAPSHOT: CompactViewportState = {
  isCompactViewport: false,
  orientation: "landscape",
};

function subscribe(callback: () => void) {
  const portrait = window.matchMedia("(orientation: portrait) and (max-width: 767px)");
  const landscape = window.matchMedia("(orientation: landscape) and (max-width: 899px) and (max-height: 599px)");
  portrait.addEventListener("change", callback);
  landscape.addEventListener("change", callback);
  window.addEventListener("resize", callback);
  return () => {
    portrait.removeEventListener("change", callback);
    landscape.removeEventListener("change", callback);
    window.removeEventListener("resize", callback);
  };
}

function getSnapshot() {
  return `${window.innerWidth}:${window.innerHeight}`;
}

export function useCompactViewport(): CompactViewportState {
  const dimensions = useSyncExternalStore(subscribe, getSnapshot, () => "server");
  if (dimensions === "server") return SERVER_SNAPSHOT;
  return classifyCompactViewport(window.innerWidth, window.innerHeight);
}
