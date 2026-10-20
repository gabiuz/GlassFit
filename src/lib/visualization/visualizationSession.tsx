"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SpaceImageSession } from "@/lib/imageApi";
import type {
  ActiveOverlay,
  PlacedOverlay,
  PaperCalibrationResult,
  ProductConfigurationSeed,
  ProductConfigurationSnapshot,
  ProductStructuralDefinition,
  ProductVariationSnapshot,
  ScaleEstimationSignal,
  VisualizationSessionState,
} from "./types";
import {
  normalizePendingProductConfiguration,
  normalizeProductConfigurationSeed,
} from "./configurationPropagation";
import {
  VARIATION_ASSET_EXPIRY_MS,
  variationAssetStore,
} from "./variationAssetStore";
import { variationAssetRegistry } from "./variationAssetRegistry";
import { variationRenderQueue } from "./variationRenderQueue";
import { normalizeAluminumFinish } from "./colorVariations";
import { clearWorkspaceDefinitions } from "./workspaceDefinitionCache";
import { recalculateMetricConfiguration, recalculateMetricOverlay } from "./scaleEstimation";
export type { CalibrationMetadata } from "./types";
import type { CalibrationMetadata } from "./types";

export interface TransitionWorkspaceProductOptions {
  nextProductId: string;
  mode: "add" | "change" | "edit";
  newPlacedOverlay?: PlacedOverlay;
  targetOverlayId?: string;
  nextConfiguration?: ProductConfigurationSnapshot;
  nextDefinition?: ProductStructuralDefinition;
  placedOverlays?: PlacedOverlay[];
}

export type VisualizationSessionContextValue = VisualizationSessionState & {
  setPreparedSpaceImage: (productId: string, session: SpaceImageSession) => void;
  setPendingProductConfiguration: (productId: string, configuration: ProductConfigurationSeed) => void;
  clearPendingProductConfiguration: () => void;
  selectWorkspaceProduct: (
    productId: string,
    workspaceBackgroundDataUrl?: string,
    productConfiguration?: ProductConfigurationSnapshot,
  ) => void;
  transitionWorkspaceProduct: (options: TransitionWorkspaceProductOptions) => void;
  updateSessionCalibration: (
    calibrationMeta: CalibrationMetadata,
    scaleSignal: ScaleEstimationSignal,
  ) => void;
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
  assetSessionId: null,
  selectedProductId: null,
  pendingProductConfiguration: null,
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
    nextDefinition,
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
  if (nextDefinition && nextDefinition.product.productId !== nextProductId) {
    throw new Error("Workspace product definition mismatch.");
  }
  return {
    ...current,
    selectedProductId: nextProductId,
    pendingProductConfiguration: null,
    spaceImageSession: current.spaceImageSession
      ? {
          ...current.spaceImageSession,
          calibrationMeta: current.spaceImageSession.calibrationMeta,
          scaleEstimation:
            current.spaceImageSession.scaleEstimation ??
            current.spaceImageSession.scale_estimation,
          scale_estimation:
            current.spaceImageSession.scale_estimation ??
            current.spaceImageSession.scaleEstimation,
        }
      : null,
    placedOverlays: updatedPlacedOverlays,
    structuralDefinition: nextDefinition ?? (isSameProduct ? current.structuralDefinition : null),
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

  useEffect(() => {
    void variationAssetStore.removeExpired(Date.now() - VARIATION_ASSET_EXPIRY_MS);
    return () => variationAssetRegistry.revokeAll();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async (overlays: PlacedOverlay[]) => Promise.all(overlays.map(async (overlay) => {
      if (overlay.flattenedImageDataUrl) return overlay;
      const finish = normalizeAluminumFinish(overlay.configuration.aluminumFinish);
      const asset = overlay.variationAssetRefs?.[finish];
      if (!asset) return overlay;
      const blob = await variationAssetStore.get(asset);
      if (!blob || cancelled) return overlay;
      const objectUrl = variationAssetRegistry.peek(asset.cacheKey)
        ?? variationAssetRegistry.acquire(asset.cacheKey, blob);
      return { ...overlay, flattenedImageDataUrl: objectUrl };
    }));

    if (
      state.assetSessionId
      && [...state.placedOverlays, ...state.comparisonOverlays].some(
        (overlay) => !overlay.flattenedImageDataUrl,
      )
    ) {
      void Promise.all([
        hydrate(state.placedOverlays),
        hydrate(state.comparisonOverlays),
      ]).then(([placedOverlays, comparisonOverlays]) => {
        if (cancelled) return;
        const changed = placedOverlays.some((overlay, index) => (
          overlay !== state.placedOverlays[index]
        )) || comparisonOverlays.some((overlay, index) => (
          overlay !== state.comparisonOverlays[index]
        ));
        if (!changed) return;
        const placedById = new Map(placedOverlays.map((overlay) => [overlay.overlayId, overlay]));
        const comparisonById = new Map(comparisonOverlays.map((overlay) => [overlay.overlayId, overlay]));
        setState((current) => ({
          ...current,
          placedOverlays: current.placedOverlays.map((overlay) => {
            const hydrated = placedById.get(overlay.overlayId);
            return !overlay.flattenedImageDataUrl && hydrated?.flattenedImageDataUrl
              ? { ...overlay, flattenedImageDataUrl: hydrated.flattenedImageDataUrl }
              : overlay;
          }),
          comparisonOverlays: current.comparisonOverlays.map((overlay) => {
            const hydrated = comparisonById.get(overlay.overlayId);
            return !overlay.flattenedImageDataUrl && hydrated?.flattenedImageDataUrl
              ? { ...overlay, flattenedImageDataUrl: hydrated.flattenedImageDataUrl }
              : overlay;
          }),
        }));
      });
    }
    return () => { cancelled = true; };
  }, [state.assetSessionId, state.comparisonOverlays, state.placedOverlays]);

  const setPreparedSpaceImage = useCallback(
    (productId: string, session: SpaceImageSession) => {
      clearWorkspaceDefinitions();
      setState((current) => {
        const nextState = createPreparedSpaceImageState(current, productId, session);
        writeStoredVisualizationSession(nextState);
        if (current.assetSessionId && current.assetSessionId !== nextState.assetSessionId) {
          variationRenderQueue.cancelNamespacePrefix(current.assetSessionId);
          void variationAssetStore.removeSession(current.assetSessionId);
          variationAssetRegistry.revokeAll();
        }
        return nextState;
      });
    },
    [],
  );

  const setPendingProductConfiguration = useCallback(
    (productId: string, configuration: ProductConfigurationSeed) => {
      const normalized = normalizeProductConfigurationSeed(configuration);
      if (!normalized) return;
      const nextState = {
        ...state,
        pendingProductConfiguration: { productId, configuration: normalized },
      };
      writeStoredVisualizationSession(nextState);
      setState(nextState);
    },
    [state],
  );

  const clearPendingProductConfiguration = useCallback(() => {
    if (!state.pendingProductConfiguration) return;
    const nextState = { ...state, pendingProductConfiguration: null };
    writeStoredVisualizationSession(nextState);
    setState(nextState);
  }, [state]);

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

  const updateSessionCalibration = useCallback(
    (calibrationMeta: CalibrationMetadata, scaleSignal: ScaleEstimationSignal) => {
      setState((current) => {
        if (!current.spaceImageSession) {
          return current;
        }

        const baseSession = current.spaceImageSession;
        const incoming = calibrationMeta.metricReference;
        const existing = baseSession.calibrationMeta?.metricReference;
        if (incoming && (incoming.frame.imageId !== baseSession.sessionId ||
            incoming.frame.width !== baseSession.workspaceImage.width || incoming.frame.height !== baseSession.workspaceImage.height ||
            (existing?.planeId === incoming.planeId && incoming.revision < existing.revision))) return current;

        const paper: PaperCalibrationResult | undefined = calibrationMeta.user_verified ? {
          ...baseSession.paperCalibration,
          status: "verified_calibrated", paper_standard: calibrationMeta.paperStandard,
          paper_standard_confirmed: calibrationMeta.paperStandardConfirmed === true,
          reference_source: calibrationMeta.referenceSource ?? "manual_corners",
          selected_candidate_id: calibrationMeta.selectedCandidateId ?? null,
          detected_corners: calibrationMeta.detectedCorners ?? null,
          scale_cm_per_px: calibrationMeta.verified_scale_cm_per_px ?? null,
          confidence: 0, homography_matrix: null, metric_reference: calibrationMeta.metricReference ?? null, user_verified: true,
          verified_corners: calibrationMeta.verified_corners ?? null,
          verified_scale_cm_per_px: calibrationMeta.verified_scale_cm_per_px ?? null,
        } : undefined;
        const updatedSession: SpaceImageSession = {
          ...baseSession,
          paperCalibration: paper,
          paper_calibration: paper,
          scaleEstimation: scaleSignal,
          scale_estimation: scaleSignal,
          calibrationMeta: { ...calibrationMeta },
        };

        const reference = calibrationMeta.metricReference;
        const frame = { imageId: updatedSession.sessionId, width: updatedSession.workspaceImage.width,
          height: updatedSession.workspaceImage.height };
        const rescaledPlacedOverlays = current.placedOverlays.map(overlay => recalculateMetricOverlay(overlay, reference, frame, calibrationMeta));
        const rescaledProductConfig = current.productConfiguration
          ? recalculateMetricConfiguration(current.productConfiguration, reference, frame, calibrationMeta) : null;

        const nextState: VisualizationSessionState = {
          ...current,
          spaceImageSession: updatedSession,
          placedOverlays: rescaledPlacedOverlays,
          productConfiguration: rescaledProductConfig,
          comparisonOverlays: current.comparisonOverlays.map(overlay => recalculateMetricOverlay(overlay, reference, frame, calibrationMeta)),
        };

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
    clearWorkspaceDefinitions();
    if (state.assetSessionId) {
      variationRenderQueue.cancelNamespacePrefix(state.assetSessionId);
      void variationAssetStore.removeSession(state.assetSessionId);
    }
    variationAssetRegistry.revokeAll();
    clearStoredVisualizationSession();
    setState(initialState);
  }, [state.assetSessionId]);

  const value = useMemo<VisualizationSessionContextValue>(
    () => ({
      ...state,
      setPreparedSpaceImage,
      setPendingProductConfiguration,
      clearPendingProductConfiguration,
      selectWorkspaceProduct,
      transitionWorkspaceProduct,
      updateSessionCalibration,
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
      setPendingProductConfiguration,
      clearPendingProductConfiguration,
      selectWorkspaceProduct,
      transitionWorkspaceProduct,
      updateSessionCalibration,
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

/** IMP-MS55: stale and legacy persisted readings never inherit metric eligibility. */
export function validateSessionPlaneEligibility(state: VisualizationSessionState): VisualizationSessionState {
  const session = state.spaceImageSession;
  const meta = session?.workspaceImage?.url ? session.calibrationMeta : null;
  const frame = { imageId: session?.sessionId ?? "", width: session?.workspaceImage.width ?? 0,
    height: session?.workspaceImage.height ?? 0 };
  const validate = (configuration: ProductConfigurationSnapshot) =>
    recalculateMetricConfiguration(configuration, meta?.metricReference, frame, meta);
  const overlays = (items: PlacedOverlay[]) => items.map(overlay => ({ ...overlay,
    configuration: validate(overlay.configuration),
    variationRenderRecipe: overlay.variationRenderRecipe ? { ...overlay.variationRenderRecipe,
      configuration: validate(overlay.variationRenderRecipe.configuration) } : undefined,
  }));
  return { ...state, productConfiguration: state.productConfiguration ? validate(state.productConfiguration) : null,
    placedOverlays: overlays(state.placedOverlays), comparisonOverlays: overlays(state.comparisonOverlays) };
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
    const restored: VisualizationSessionState = {
      assetSessionId: typeof parsed.assetSessionId === "string" ? parsed.assetSessionId : null,
      selectedProductId: typeof parsed.selectedProductId === "string" ? parsed.selectedProductId : null,
      pendingProductConfiguration: normalizePendingProductConfiguration(parsed.pendingProductConfiguration),
      spaceImageSession: parsed.spaceImageSession && typeof parsed.spaceImageSession === "object"
        ? {
            ...parsed.spaceImageSession,
            calibrationMeta: parsed.spaceImageSession.calibrationMeta,
            scaleEstimation:
              parsed.spaceImageSession.scaleEstimation ??
              parsed.spaceImageSession.scale_estimation,
            scale_estimation:
              parsed.spaceImageSession.scale_estimation ??
              parsed.spaceImageSession.scaleEstimation,
          }
        : null,
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
    return validateSessionPlaneEligibility(restored);
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
      JSON.stringify(serializeVisualizationSession(state)),
    );
  } catch {
    // Metadata can still exceed quota when the room photo itself is an embedded data URL.
    try {
      const lightweightState: VisualizationSessionState = {
        ...state,
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
              calibrationMeta: state.spaceImageSession.calibrationMeta,
              scaleEstimation:
                state.spaceImageSession.scaleEstimation ??
                state.spaceImageSession.scale_estimation,
              scale_estimation:
                state.spaceImageSession.scale_estimation ??
                state.spaceImageSession.scaleEstimation,
            }
          : null,
        workspaceBackgroundDataUrl: null,
        variationSnapshots: [],
        finalSnapshotDataUrl: null,
        placedOverlays: state.placedOverlays.map(sanitizeOverlayForStorage),
        comparisonOverlays: state.comparisonOverlays.map(sanitizeOverlayForStorage),
      };

      window.sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(serializeVisualizationSession(lightweightState)),
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
            assetSessionId: state.assetSessionId,
            pendingProductConfiguration: state.pendingProductConfiguration,
            spaceImageSession: state.spaceImageSession
              ? {
                  ...state.spaceImageSession,
                  workspaceImage: { ...state.spaceImageSession.workspaceImage, url: "" },
                  calibrationMeta: state.spaceImageSession.calibrationMeta,
                  scaleEstimation:
                    state.spaceImageSession.scaleEstimation ??
                    state.spaceImageSession.scale_estimation,
                  scale_estimation:
                    state.spaceImageSession.scale_estimation ??
                    state.spaceImageSession.scaleEstimation,
                }
              : null,
            workspaceBackgroundDataUrl: null,
            structuralDefinition: state.structuralDefinition,
            productConfiguration: state.productConfiguration,
            variationSnapshots: [],
            placedOverlays: state.placedOverlays.map(sanitizeOverlayForStorage),
            comparisonOverlays: state.comparisonOverlays.map(sanitizeOverlayForStorage),
            finalSnapshotDataUrl: null,
          }),
        );
      } catch {
        // Minimal write also failed. In-memory session remains valid for the current page.
      }
    }
  }
}

export function createPreparedSpaceImageState(
  current: VisualizationSessionState,
  productId: string,
  session: SpaceImageSession,
): VisualizationSessionState {
  return {
    assetSessionId: createAssetSessionId(),
    selectedProductId: productId,
    pendingProductConfiguration:
      current.pendingProductConfiguration?.productId === productId
        ? current.pendingProductConfiguration
        : null,
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
}

function createAssetSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isPersistableSmallUrl(value: string) {
  return value.length <= 200_000 && !value.startsWith("data:") && !value.startsWith("blob:");
}

function sanitizeOverlayForStorage(overlay: PlacedOverlay): PlacedOverlay {
  return {
    ...overlay,
    configuration: sanitizeConfigurationForStorage(overlay.configuration),
    flattenedImageDataUrl: isPersistableSmallUrl(overlay.flattenedImageDataUrl)
      ? overlay.flattenedImageDataUrl
      : "",
    variationImageDataUrls: undefined,
    variationRenderRecipe: overlay.variationRenderRecipe
      ? {
          ...overlay.variationRenderRecipe,
          configuration: sanitizeConfigurationForStorage(
            overlay.variationRenderRecipe.configuration,
          ),
        }
      : undefined,
  };
}

function sanitizeConfigurationForStorage(
  configuration: ProductConfigurationSnapshot,
): ProductConfigurationSnapshot {
  return {
    ...configuration,
    manualOcclusionMaskDataUrl: null,
  };
}

export function serializeVisualizationSession(state: VisualizationSessionState) {
  return {
    assetSessionId: state.assetSessionId,
    selectedProductId: state.selectedProductId,
    pendingProductConfiguration: state.pendingProductConfiguration,
    spaceImageSession: state.spaceImageSession
      ? {
          ...state.spaceImageSession,
          calibrationMeta: state.spaceImageSession.calibrationMeta,
          scaleEstimation:
            state.spaceImageSession.scaleEstimation ??
            state.spaceImageSession.scale_estimation,
          scale_estimation:
            state.spaceImageSession.scale_estimation ??
            state.spaceImageSession.scaleEstimation,
        }
      : null,
    workspaceBackgroundDataUrl: state.workspaceBackgroundDataUrl?.startsWith("data:")
      || state.workspaceBackgroundDataUrl?.startsWith("blob:")
      ? null
      : state.workspaceBackgroundDataUrl,
    structuralDefinition: state.structuralDefinition,
    productConfiguration: state.productConfiguration
      ? sanitizeConfigurationForStorage(state.productConfiguration)
      : null,
    variationSnapshots: [],
    placedOverlays: state.placedOverlays.map(sanitizeOverlayForStorage),
    comparisonOverlays: state.comparisonOverlays.map(sanitizeOverlayForStorage),
    finalSnapshotDataUrl: state.finalSnapshotDataUrl,
  };
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

export function useOptionalVisualizationSession() {
  return useContext(VisualizationSessionContext);
}

