"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SpaceImageSession } from "@/lib/imageApi";
import type {
  ActiveOverlay,
  PlacedOverlay,
  ProductConfigurationSnapshot,
  ProductStructuralDefinition,
  ProductVariationSnapshot,
  VisualizationSessionState,
} from "./types";

export interface TransitionWorkspaceProductOptions {
  nextProductId: string;
  mode: "add" | "change" | "edit";
  newPlacedOverlay?: PlacedOverlay;
  targetOverlayId?: string;
  nextConfiguration?: ProductConfigurationSnapshot;
  placedOverlays?: PlacedOverlay[];
}

export type VisualizationSessionContextValue = VisualizationSessionState & {
  setPreparedSpaceImage: (productId: string, session: SpaceImageSession) => void;
  selectWorkspaceProduct: (
    productId: string,
    workspaceBackgroundDataUrl?: string,
    productConfiguration?: ProductConfigurationSnapshot,
  ) => void;
  transitionWorkspaceProduct: (options: TransitionWorkspaceProductOptions) => void;
  setStructuralDefinition: (definition: ProductStructuralDefinition | null) => void;
  setProductConfiguration: (configuration: ProductConfigurationSnapshot | null) => void;
  setVariationSnapshots: (snapshots: ProductVariationSnapshot[]) => void;
  setActiveOverlay: (overlay: ActiveOverlay | null) => void;
  setPlacedOverlays: (overlays: PlacedOverlay[]) => void;
  setComparisonOverlays: (overlays: PlacedOverlay[]) => void;
  setFinalSnapshotDataUrl: (dataUrl: string | null) => void;
  resetVisualizationSession: () => void;
};

const VisualizationSessionContext =
  createContext<VisualizationSessionContextValue | null>(null);

export const initialState: VisualizationSessionState = {
  selectedProductId: null,
  spaceImageSession: null,
  workspaceBackgroundDataUrl: null,
  structuralDefinition: null,
  productConfiguration: null,
  variationSnapshots: [],
  activeOverlay: null,
  placedOverlays: [],
  comparisonOverlays: [],
  finalSnapshotDataUrl: null,
};

export const SESSION_STORAGE_KEY = "glassfit.visualization.session";

export function transitionSessionState(
  current: VisualizationSessionState,
  options: TransitionWorkspaceProductOptions,
): VisualizationSessionState {
  const {
    nextProductId,
    mode,
    newPlacedOverlay,
    targetOverlayId,
    nextConfiguration,
    placedOverlays: explicitPlacedOverlays,
  } = options;

  let updatedPlacedOverlays = current.placedOverlays;

  if (explicitPlacedOverlays) {
    updatedPlacedOverlays = explicitPlacedOverlays;
  } else if (mode === "add" && newPlacedOverlay) {
    // Prevent duplicate overlay insertions
    const exists = current.placedOverlays.some(
      (overlay) => overlay.overlayId === newPlacedOverlay.overlayId,
    );
    updatedPlacedOverlays = exists
      ? current.placedOverlays
      : [...current.placedOverlays, newPlacedOverlay];
  } else if (mode === "edit") {
    if (targetOverlayId) {
      const targetIdx = updatedPlacedOverlays.findIndex(
        (overlay) => overlay.overlayId === targetOverlayId,
      );
      if (targetIdx >= 0) {
        if (newPlacedOverlay) {
          updatedPlacedOverlays = [...updatedPlacedOverlays];
          updatedPlacedOverlays[targetIdx] = newPlacedOverlay;
        } else {
          updatedPlacedOverlays = updatedPlacedOverlays.filter(
            (overlay) => overlay.overlayId !== targetOverlayId,
          );
        }
      } else if (newPlacedOverlay) {
        const exists = updatedPlacedOverlays.some(
          (overlay) => overlay.overlayId === newPlacedOverlay.overlayId,
        );
        if (!exists) {
          updatedPlacedOverlays = [...updatedPlacedOverlays, newPlacedOverlay];
        }
      }
    } else if (newPlacedOverlay) {
      const exists = updatedPlacedOverlays.some(
        (overlay) => overlay.overlayId === newPlacedOverlay.overlayId,
      );
      if (!exists) {
        updatedPlacedOverlays = [...updatedPlacedOverlays, newPlacedOverlay];
      }
    }
  }

  const isSameProduct = current.selectedProductId === nextProductId;
  return {
    ...current,
    selectedProductId: nextProductId,
    placedOverlays: updatedPlacedOverlays,
    structuralDefinition: isSameProduct ? current.structuralDefinition : null,
    productConfiguration: nextConfiguration ?? null,
    variationSnapshots: [],
    activeOverlay: null,
    comparisonOverlays: mode === "add" ? current.comparisonOverlays : [],
    finalSnapshotDataUrl: null,
  };
}

export function VisualizationSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<VisualizationSessionState>(() =>
    readStoredVisualizationSession(),
  );

  const setPreparedSpaceImage = useCallback(
    (productId: string, session: SpaceImageSession) => {
      const nextState: VisualizationSessionState = {
        selectedProductId: productId,
        spaceImageSession: session,
        workspaceBackgroundDataUrl: null,
        structuralDefinition: null,
        productConfiguration: null,
        variationSnapshots: [],
        activeOverlay: null,
        placedOverlays: [],
        comparisonOverlays: [],
        finalSnapshotDataUrl: null,
      };

      writeStoredVisualizationSession(nextState);
      setState(nextState);
    },
    [],
  );

  const selectWorkspaceProduct = useCallback(
    (
      productId: string,
      workspaceBackgroundDataUrl?: string,
      productConfiguration?: ProductConfigurationSnapshot,
    ) => {
      setState((current) => {
        const isCurrentProduct = current.selectedProductId === productId;
        const nextState: VisualizationSessionState = {
          ...current,
          selectedProductId: productId,
          workspaceBackgroundDataUrl:
            workspaceBackgroundDataUrl ?? current.workspaceBackgroundDataUrl,
          structuralDefinition: isCurrentProduct
            ? current.structuralDefinition
            : null,
          productConfiguration: productConfiguration ?? null,
          variationSnapshots: [],
          activeOverlay: null,
          comparisonOverlays: current.comparisonOverlays,
          finalSnapshotDataUrl: null,
        };

        writeStoredVisualizationSession(nextState);
        return nextState;
      });
    },
    [],
  );

  const transitionWorkspaceProduct = useCallback(
    (options: TransitionWorkspaceProductOptions) => {
      setState((current) => {
        const nextState = transitionSessionState(current, options);
        writeStoredVisualizationSession(nextState);
        return nextState;
      });
    },
    [],
  );

  const setStructuralDefinition = useCallback(
    (definition: ProductStructuralDefinition | null) => {
      setState((current) => {
        const nextState = {
          ...current,
          structuralDefinition: definition,
        };
        writeStoredVisualizationSession(nextState);
        return nextState;
      });
    },
    [],
  );

  const setProductConfiguration = useCallback(
    (configuration: ProductConfigurationSnapshot | null) => {
      setState((current) => {
        const nextState = {
          ...current,
          productConfiguration: configuration,
        };
        writeStoredVisualizationSession(nextState);
        return nextState;
      });
    },
    [],
  );

  const setVariationSnapshots = useCallback((snapshots: ProductVariationSnapshot[]) => {
    setState((current) => {
      const nextState = {
        ...current,
        variationSnapshots: snapshots,
      };
      writeStoredVisualizationSession(nextState);
      return nextState;
    });
  }, []);

  const setActiveOverlay = useCallback((overlay: ActiveOverlay | null) => {
    setState((current) => ({
      ...current,
      activeOverlay: overlay,
    }));
  }, []);

  const setPlacedOverlays = useCallback((overlays: PlacedOverlay[]) => {
    setState((current) => {
      const nextState = {
        ...current,
        placedOverlays: overlays,
      };
      writeStoredVisualizationSession(nextState);
      return nextState;
    });
  }, []);

  const setComparisonOverlays = useCallback((overlays: PlacedOverlay[]) => {
    setState((current) => {
      const nextState = {
        ...current,
        comparisonOverlays: overlays,
      };
      writeStoredVisualizationSession(nextState);
      return nextState;
    });
  }, []);

  const setFinalSnapshotDataUrl = useCallback((dataUrl: string | null) => {
    setState((current) => {
      const nextState = {
        ...current,
        finalSnapshotDataUrl: dataUrl,
      };
      writeStoredVisualizationSession(nextState);
      return nextState;
    });
  }, []);

  const resetVisualizationSession = useCallback(() => {
    clearStoredVisualizationSession();
    setState(initialState);
  }, []);

  const value = useMemo<VisualizationSessionContextValue>(
    () => ({
      ...state,
      setPreparedSpaceImage,
      selectWorkspaceProduct,
      transitionWorkspaceProduct,
      setStructuralDefinition,
      setProductConfiguration,
      setVariationSnapshots,
      setActiveOverlay,
      setPlacedOverlays,
      setComparisonOverlays,
      setFinalSnapshotDataUrl,
      resetVisualizationSession,
    }),
    [
      state,
      setPreparedSpaceImage,
      selectWorkspaceProduct,
      transitionWorkspaceProduct,
      setStructuralDefinition,
      setProductConfiguration,
      setVariationSnapshots,
      setActiveOverlay,
      setPlacedOverlays,
      setComparisonOverlays,
      setFinalSnapshotDataUrl,
      resetVisualizationSession,
    ],
  );

  return (
    <VisualizationSessionContext.Provider value={value}>
      {children}
    </VisualizationSessionContext.Provider>
  );
}

export function readStoredVisualizationSession(): VisualizationSessionState {
  if (typeof window === "undefined") {
    return initialState;
  }

  try {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      return initialState;
    }

    const parsed = JSON.parse(stored) as Partial<VisualizationSessionState>;
    if (!parsed.selectedProductId || !parsed.spaceImageSession) {
      return initialState;
    }

    return {
      selectedProductId: parsed.selectedProductId,
      spaceImageSession: parsed.spaceImageSession,
      workspaceBackgroundDataUrl:
        typeof parsed.workspaceBackgroundDataUrl === "string"
          ? parsed.workspaceBackgroundDataUrl
          : null,
      structuralDefinition:
        parsed.structuralDefinition &&
        typeof parsed.structuralDefinition === "object"
          ? parsed.structuralDefinition
          : null,
      productConfiguration:
        parsed.productConfiguration &&
        typeof parsed.productConfiguration === "object"
          ? parsed.productConfiguration
          : null,
      variationSnapshots: Array.isArray(parsed.variationSnapshots)
        ? parsed.variationSnapshots
        : [],
      activeOverlay: null,
      placedOverlays: Array.isArray(parsed.placedOverlays)
        ? parsed.placedOverlays
        : [],
      comparisonOverlays: Array.isArray(parsed.comparisonOverlays)
        ? parsed.comparisonOverlays
        : [],
      finalSnapshotDataUrl:
        typeof parsed.finalSnapshotDataUrl === "string"
          ? parsed.finalSnapshotDataUrl
          : null,
    };
  } catch {
    return initialState;
  }
}

export function writeStoredVisualizationSession(state: VisualizationSessionState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        selectedProductId: state.selectedProductId,
        spaceImageSession: state.spaceImageSession,
        workspaceBackgroundDataUrl: state.workspaceBackgroundDataUrl,
        structuralDefinition: state.structuralDefinition,
        productConfiguration: state.productConfiguration,
        variationSnapshots: state.variationSnapshots,
        placedOverlays: state.placedOverlays,
        comparisonOverlays: state.comparisonOverlays,
        finalSnapshotDataUrl: state.finalSnapshotDataUrl,
      }),
    );
  } catch {
    // Quota exceeded: serialize lightweight representations
    try {
      const lightweightState: VisualizationSessionState = {
        ...state,
        // Retain space image URL if reasonable, or fallback to relative URL
        spaceImageSession: state.spaceImageSession
          ? {
              ...state.spaceImageSession,
              workspaceImage: {
                ...state.spaceImageSession.workspaceImage,
                url:
                  state.spaceImageSession.workspaceImage.url.length > 500000
                    ? ""
                    : state.spaceImageSession.workspaceImage.url,
              },
            }
          : null,
        workspaceBackgroundDataUrl: null,
        variationSnapshots: [],
        finalSnapshotDataUrl: null,
        // Retain overlay transforms and pricing BOM, omitting oversized base64 data URLs in storage
        placedOverlays: state.placedOverlays.map((overlay) => ({
          ...overlay,
          flattenedImageDataUrl:
            overlay.flattenedImageDataUrl.length > 200000
              ? ""
              : overlay.flattenedImageDataUrl,
          variationImageDataUrls: undefined,
        })),
        comparisonOverlays: state.comparisonOverlays.map((overlay) => ({
          ...overlay,
          flattenedImageDataUrl:
            overlay.flattenedImageDataUrl.length > 200000
              ? ""
              : overlay.flattenedImageDataUrl,
          variationImageDataUrls: undefined,
        })),
      };

      window.sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(lightweightState),
      );
    } catch {
      console.warn(
        "[GlassFit] sessionStorage quota exceeded even for lightweight session. " +
        "Attempting minimal config-only write.",
      );
      try {
        window.sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            selectedProductId: state.selectedProductId,
            spaceImageSession: state.spaceImageSession
              ? {
                  ...state.spaceImageSession,
                  workspaceImage: { ...state.spaceImageSession.workspaceImage, url: "" },
                }
              : null,
            workspaceBackgroundDataUrl: null,
            structuralDefinition: state.structuralDefinition,
            productConfiguration: state.productConfiguration,
            variationSnapshots: [],
            placedOverlays: state.placedOverlays.map((overlay) => ({
              ...overlay,
              flattenedImageDataUrl: "",
              variationImageDataUrls: undefined,
            })),
            comparisonOverlays: state.comparisonOverlays.map((overlay) => ({
              ...overlay,
              flattenedImageDataUrl: "",
              variationImageDataUrls: undefined,
            })),
            finalSnapshotDataUrl: null,
          }),
        );
      } catch {
        // Minimal write also failed. In-memory session remains valid for the current page.
      }
    }
  }
}

export function clearStoredVisualizationSession() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function useVisualizationSession() {
  const context = useContext(VisualizationSessionContext);
  if (!context) {
    throw new Error(
      "useVisualizationSession must be used inside VisualizationSessionProvider.",
    );
  }

  return context;
}
