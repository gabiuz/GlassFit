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
  ProductStructuralDefinition,
  VisualizationSessionState,
} from "./types";

type VisualizationSessionContextValue = VisualizationSessionState & {
  setPreparedSpaceImage: (productId: string, session: SpaceImageSession) => void;
  setStructuralDefinition: (definition: ProductStructuralDefinition | null) => void;
  setActiveOverlay: (overlay: ActiveOverlay | null) => void;
  setPlacedOverlays: (overlays: PlacedOverlay[]) => void;
  resetVisualizationSession: () => void;
};

const VisualizationSessionContext =
  createContext<VisualizationSessionContextValue | null>(null);

const initialState: VisualizationSessionState = {
  selectedProductId: null,
  spaceImageSession: null,
  structuralDefinition: null,
  activeOverlay: null,
  placedOverlays: [],
};

export function VisualizationSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<VisualizationSessionState>(initialState);

  const setPreparedSpaceImage = useCallback(
    (productId: string, session: SpaceImageSession) => {
      setState({
        selectedProductId: productId,
        spaceImageSession: session,
        structuralDefinition: null,
        activeOverlay: null,
        placedOverlays: [],
      });
    },
    [],
  );

  const setStructuralDefinition = useCallback(
    (definition: ProductStructuralDefinition | null) => {
      setState((current) => ({
        ...current,
        structuralDefinition: definition,
      }));
    },
    [],
  );

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

  const resetVisualizationSession = useCallback(() => {
    setState(initialState);
  }, []);

  const value = useMemo<VisualizationSessionContextValue>(
    () => ({
      ...state,
      setPreparedSpaceImage,
      setStructuralDefinition,
      setActiveOverlay,
      setPlacedOverlays,
      resetVisualizationSession,
    }),
    [
      state,
      setPreparedSpaceImage,
      setStructuralDefinition,
      setActiveOverlay,
      setPlacedOverlays,
      resetVisualizationSession,
    ],
  );

  return (
    <VisualizationSessionContext.Provider value={value}>
      {children}
    </VisualizationSessionContext.Provider>
  );
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
