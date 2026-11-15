import type { ProductConfigurationSnapshot } from "./types";

// PRD-F6 / SDD-C5 / QAD-TC6: reset uses original display geometry, not edited dimensions.
export interface WorkspaceResetState {
  configuration: ProductConfigurationSnapshot;
  overlaySize: { width: number; height: number };
  canvasWidth: number;
}

export function isWorkspaceResetCaptureReady({ modelReady, canvasWidth, measuredCanvasWidth }: {
  modelReady: boolean;
  canvasWidth: number;
  measuredCanvasWidth: number;
}): boolean {
  // Effects may replay before template defaults and ResizeObserver updates commit.
  // Pair geometry with the canvas measurement from the same committed render.
  return modelReady && canvasWidth > 0 && canvasWidth === measuredCanvasWidth;
}

export function captureWorkspaceResetState(
  configuration: ProductConfigurationSnapshot,
  overlaySize: WorkspaceResetState["overlaySize"],
  canvasWidth: number,
): WorkspaceResetState {
  return structuredClone({ configuration, overlaySize, canvasWidth });
}

export function restoreWorkspaceResetState(
  initialState: WorkspaceResetState,
  canvasWidth: number,
): WorkspaceResetState {
  const restored = structuredClone(initialState);
  const scale = canvasWidth > 0 && initialState.canvasWidth > 0
    ? canvasWidth / initialState.canvasWidth : 1;
  restored.configuration.positionX = (restored.configuration.positionX ?? 0) * scale;
  restored.configuration.positionY = (restored.configuration.positionY ?? 0) * scale;
  restored.overlaySize.width *= scale;
  restored.overlaySize.height *= scale;
  restored.canvasWidth = canvasWidth;
  return restored;
}
