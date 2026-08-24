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

type VisualizationSessionContextValue = VisualizationSessionState & {
  setPreparedSpaceImage: (productId: string, session: SpaceImageSession) => void;
  setStructuralDefinition: (definition: ProductStructuralDefinition | null) => void;
  setProductConfiguration: (configuration: ProductConfigurationSnapshot | null) => void;
  setVariationSnapshots: (snapshots: ProductVariationSnapshot[]) => void;
  setActiveOverlay: (overlay: ActiveOverlay | null) => void;
  setPlacedOverlays: (overlays: PlacedOverlay[]) => void;
  setFinalSnapshotDataUrl: (dataUrl: string | null) => void;
  resetVisualizationSession: () => void;
};

const VisualizationSessionContext =
  createContext<VisualizationSessionContextValue | null>(null);

const initialState: VisualizationSessionState = {
  selectedProductId: null,
  spaceImageSession: null,
  structuralDefinition: null,
  productConfiguration: null,
  variationSnapshots: [],
  activeOverlay: null,
  placedOverlays: [],
  finalSnapshotDataUrl: null,
};

const SESSION_STORAGE_KEY = "glassfit.visualization.session";

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
        structuralDefinition: null,
        productConfiguration: null,
        variationSnapshots: [],
        activeOverlay: null,
        placedOverlays: [],
        finalSnapshotDataUrl: null,
      };

      writeStoredVisualizationSession(nextState);
      setState(nextState);
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
    setState((current) => ({
      ...current,
      placedOverlays: overlays,
    }));
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
      setStructuralDefinition,
      setProductConfiguration,
      setVariationSnapshots,
      setActiveOverlay,
      setPlacedOverlays,
      setFinalSnapshotDataUrl,
      resetVisualizationSession,
    }),
    [
      state,
      setPreparedSpaceImage,
      setStructuralDefinition,
      setProductConfiguration,
      setVariationSnapshots,
      setActiveOverlay,
      setPlacedOverlays,
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

function readStoredVisualizationSession(): VisualizationSessionState {
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
      placedOverlays: [],
      finalSnapshotDataUrl:
        typeof parsed.finalSnapshotDataUrl === "string"
          ? parsed.finalSnapshotDataUrl
          : null,
    };
  } catch {
    return initialState;
  }
}

function writeStoredVisualizationSession(state: VisualizationSessionState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        selectedProductId: state.selectedProductId,
        spaceImageSession: state.spaceImageSession,
        structuralDefinition: state.structuralDefinition,
        productConfiguration: state.productConfiguration,
        variationSnapshots: state.variationSnapshots,
        finalSnapshotDataUrl: state.finalSnapshotDataUrl,
      }),
    );
  } catch {
    // Session persistence is a convenience; visualization still works in memory.
  }
}

function clearStoredVisualizationSession() {
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
