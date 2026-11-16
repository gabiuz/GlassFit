"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useOptionalVisualizationSession } from "@/lib/visualization/visualizationSession";
import {
  readGuidePreference,
  readGuideProgress,
  writeGuidePreference,
  writeGuideProgress,
} from "./storage";
import {
  acceptFreePlacementState,
  acknowledgeActionAttempt,
  activateOverlayForEditing,
  adoptOrEnsureActiveProductInstance,
  beginActionAttempt,
  cancelActionAttempt,
  completeWorkspaceTourState,
  createInitialGuideRuntimeState,
  duplicateActiveProductInstance,
  markPaperTourCompletedForRunState,
  optOutDontShowAgainState,
  registerOverlayAlias,
  removeActiveProductState,
  removePlacedOverlayReference,
  replaceProductInstance,
  requestManualPlacementState,
  resetGuideForNewImage,
  restartGuideManuallyState,
  reserveFirstProductHandoff,
  skipCurrentRunState,
  syncImageIdentity,
  type GuideRuntimeState,
} from "./store";
import type {
  GuideActionAttempt,
  GuideInstanceProgress,
  GuidePreferenceStatus,
} from "./types";

export interface VisualizationOnboardingContextValue {
  isHydrated: boolean;
  preferenceStatus: GuidePreferenceStatus;
  imageId: string | null;
  guideGeneration: number;
  runSkipped: boolean;
  comparisonSuspended: boolean;
  paperTourCompletedForRun: boolean;
  manualRunActive: boolean;
  isComparisonPreparing: boolean;
  activeGuideInstanceId: string | null;
  activeInstanceProgress: GuideInstanceProgress | null;
  syncImageSession: (imageId: string | null) => void;
  resetForFreshImage: (nextImageId: string | null) => void;
  reserveFirstProductHandoff: (imageId: string, productId: string) => string;
  adoptWorkspaceProduct: (options: {
    imageId: string | null;
    productId: string | null;
    activeOverlayId: string | null;
  }) => void;
  registerOverlayAlias: (
    guideInstanceId: string | null,
    overlayId: string,
    role: "active" | "placed" | "comparison",
  ) => void;
  duplicateProductInstance: (
    productId: string,
    newActiveOverlayId: string | null,
  ) => string;
  replaceProductInstance: (
    oldGuideInstanceId: string | null,
    newProductId: string,
    newActiveOverlayId: string | null,
  ) => string;
  activatePlacedOverlay: (overlayId: string, productId: string) => string;
  removePlacedOverlay: (overlayId: string) => void;
  removeActiveProduct: (guideInstanceId: string | null) => void;
  beginActionAttempt: (
    action: GuideActionAttempt["action"],
    guideInstanceId: string | null,
  ) => GuideActionAttempt | null;
  cancelActionAttempt: (attemptId: string) => void;
  acknowledgeActionAttempt: (attempt: GuideActionAttempt | null) => boolean;
  requestManualPlacement: (guideInstanceId: string | null) => void;
  acceptFreePlacement: (guideInstanceId: string | null) => void;
  completePaperTourForRun: () => void;
  skipCurrentRun: () => void;
  optOutDontShowAgain: () => void;
  completeWorkspaceTour: () => void;
  restartGuideManually: () => void;
  beginComparisonPreparation: () => void;
  cancelOrFailComparisonPreparation: () => void;
  completeComparisonNavigation: () => void;
}

const VisualizationOnboardingContext =
  createContext<VisualizationOnboardingContextValue | null>(null);

const emptySubscribe = () => () => {};

export function VisualizationOnboardingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const session = useOptionalVisualizationSession();
  const sessionImageId = session?.spaceImageSession?.sessionId ?? null;
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const [initialRuntime] = useState<GuideRuntimeState>(() =>
    createInitialGuideRuntimeState({
      storedPreference: readGuidePreference(),
      storedProgress: readGuideProgress(),
      sessionImageId,
    }),
  );
  const [state, setState] = useState<GuideRuntimeState>(initialRuntime);
  const stateRef = useRef<GuideRuntimeState>(initialRuntime);

  const commitState = useCallback(
    (updater: (prev: GuideRuntimeState) => GuideRuntimeState) => {
      const next = updater(stateRef.current);
      if (next === stateRef.current) return next;
      stateRef.current = next;
      setState(next);
      return next;
    },
    [],
  );

  // Sync shared session image identity when session context updates after hydration.
  useEffect(() => {
    if (!isHydrated || !sessionImageId) return;
    const timer = window.setTimeout(() => {
      commitState((prev) => syncImageIdentity(prev, sessionImageId));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [commitState, isHydrated, sessionImageId]);

  // Persist progress record whenever it changes after hydration.
  useEffect(() => {
    if (!isHydrated) return;
    writeGuideProgress(state.progress);
  }, [isHydrated, state.progress]);

  const syncImageSession = useCallback(
    (imageId: string | null) => {
      commitState((prev) => syncImageIdentity(prev, imageId));
    },
    [commitState],
  );

  const resetForFreshImage = useCallback(
    (nextImageId: string | null) => {
      commitState((prev) => resetGuideForNewImage(prev, nextImageId));
    },
    [commitState],
  );

  const handleReserveFirstProductHandoff = useCallback(
    (imageId: string, productId: string) => {
      let allocated = "";
      commitState((prev) => {
        const result = reserveFirstProductHandoff(prev, imageId, productId);
        allocated = result.guideInstanceId;
        return result.state;
      });
      return allocated;
    },
    [commitState],
  );

  const adoptWorkspaceProduct = useCallback(
    (options: {
      imageId: string | null;
      productId: string | null;
      activeOverlayId: string | null;
    }) => {
      commitState((prev) => adoptOrEnsureActiveProductInstance(prev, options));
    },
    [commitState],
  );

  const handleRegisterOverlayAlias = useCallback(
    (
      guideInstanceId: string | null,
      overlayId: string,
      role: "active" | "placed" | "comparison",
    ) => {
      commitState((prev) =>
        registerOverlayAlias(prev, guideInstanceId, overlayId, role),
      );
    },
    [commitState],
  );

  const duplicateProductInstance = useCallback(
    (productId: string, newActiveOverlayId: string | null) => {
      let allocated = "";
      commitState((prev) => {
        const result = duplicateActiveProductInstance(
          prev,
          productId,
          newActiveOverlayId,
        );
        allocated = result.guideInstanceId;
        return result.state;
      });
      return allocated;
    },
    [commitState],
  );

  const handleReplaceProductInstance = useCallback(
    (
      oldGuideInstanceId: string | null,
      newProductId: string,
      newActiveOverlayId: string | null,
    ) => {
      let allocated = "";
      commitState((prev) => {
        const result = replaceProductInstance(
          prev,
          oldGuideInstanceId,
          newProductId,
          newActiveOverlayId,
        );
        allocated = result.guideInstanceId;
        return result.state;
      });
      return allocated;
    },
    [commitState],
  );

  const activatePlacedOverlay = useCallback(
    (overlayId: string, productId: string) => {
      let resolvedId = "";
      commitState((prev) => {
        const result = activateOverlayForEditing(prev, overlayId, productId);
        resolvedId = result.guideInstanceId;
        return result.state;
      });
      return resolvedId;
    },
    [commitState],
  );

  const removePlacedOverlay = useCallback(
    (overlayId: string) => {
      commitState((prev) => removePlacedOverlayReference(prev, overlayId));
    },
    [commitState],
  );

  const removeActiveProduct = useCallback(
    (guideInstanceId: string | null) => {
      commitState((prev) => removeActiveProductState(prev, guideInstanceId));
    },
    [commitState],
  );

  const handleBeginActionAttempt = useCallback(
    (
      action: GuideActionAttempt["action"],
      guideInstanceId: string | null,
    ): GuideActionAttempt | null => {
      let created: GuideActionAttempt | null = null;
      commitState((prev) => {
        const result = beginActionAttempt(prev, action, guideInstanceId);
        created = result.attempt;
        return result.state;
      });
      return created;
    },
    [commitState],
  );

  const handleCancelActionAttempt = useCallback(
    (attemptId: string) => {
      commitState((prev) => cancelActionAttempt(prev, attemptId));
    },
    [commitState],
  );

  const handleAcknowledgeActionAttempt = useCallback(
    (attempt: GuideActionAttempt | null): boolean => {
      let accepted = false;
      commitState((prev) => {
        const result = acknowledgeActionAttempt(prev, attempt);
        accepted = result.accepted;
        return result.state;
      });
      return accepted;
    },
    [commitState],
  );

  const requestManualPlacement = useCallback(
    (guideInstanceId: string | null) => {
      commitState((prev) => requestManualPlacementState(prev, guideInstanceId));
    },
    [commitState],
  );

  const acceptFreePlacement = useCallback(
    (guideInstanceId: string | null) => {
      commitState((prev) => acceptFreePlacementState(prev, guideInstanceId));
    },
    [commitState],
  );

  const completePaperTourForRun = useCallback(() => {
    commitState((prev) => markPaperTourCompletedForRunState(prev));
  }, [commitState]);

  const skipCurrentRun = useCallback(() => {
    commitState((prev) => skipCurrentRunState(prev));
  }, [commitState]);

  const optOutDontShowAgain = useCallback(() => {
    writeGuidePreference("dont_show_again");
    commitState((prev) => optOutDontShowAgainState(prev));
  }, [commitState]);

  const completeWorkspaceTour = useCallback(() => {
    writeGuidePreference("completed");
    commitState((prev) => completeWorkspaceTourState(prev));
  }, [commitState]);

  const restartGuideManually = useCallback(() => {
    commitState((prev) => restartGuideManuallyState(prev));
  }, [commitState]);

  const beginComparisonPreparation = useCallback(() => {
    commitState((prev) => ({ ...prev, isComparisonPreparing: true }));
  }, [commitState]);

  const cancelOrFailComparisonPreparation = useCallback(() => {
    commitState((prev) => ({ ...prev, isComparisonPreparing: false }));
  }, [commitState]);

  const completeComparisonNavigation = useCallback(() => {
    const next = commitState((prev) => ({
      ...prev,
      isComparisonPreparing: false,
      manualRunActive: false,
      progress: {
        ...prev.progress,
        comparisonSuspended: true,
      },
    }));
    writeGuideProgress(next.progress);
  }, [commitState]);

  const activeInstanceProgress = state.progress.activeGuideInstanceId
    ? state.progress.instances[state.progress.activeGuideInstanceId] ?? null
    : null;

  const value = useMemo<VisualizationOnboardingContextValue>(
    () => ({
      isHydrated,
      preferenceStatus: state.preferenceStatus,
      imageId: state.progress.imageId,
      guideGeneration: state.progress.guideGeneration,
      runSkipped: state.progress.runSkipped,
      comparisonSuspended: state.progress.comparisonSuspended,
      paperTourCompletedForRun: state.progress.paperTourCompletedForRun,
      manualRunActive: state.manualRunActive,
      isComparisonPreparing: state.isComparisonPreparing,
      activeGuideInstanceId: state.progress.activeGuideInstanceId,
      activeInstanceProgress,
      syncImageSession,
      resetForFreshImage,
      reserveFirstProductHandoff: handleReserveFirstProductHandoff,
      adoptWorkspaceProduct,
      registerOverlayAlias: handleRegisterOverlayAlias,
      duplicateProductInstance,
      replaceProductInstance: handleReplaceProductInstance,
      activatePlacedOverlay,
      removePlacedOverlay,
      removeActiveProduct,
      beginActionAttempt: handleBeginActionAttempt,
      cancelActionAttempt: handleCancelActionAttempt,
      acknowledgeActionAttempt: handleAcknowledgeActionAttempt,
      requestManualPlacement,
      acceptFreePlacement,
      completePaperTourForRun,
      skipCurrentRun,
      optOutDontShowAgain,
      completeWorkspaceTour,
      restartGuideManually,
      beginComparisonPreparation,
      cancelOrFailComparisonPreparation,
      completeComparisonNavigation,
    }),
    [
      isHydrated,
      state,
      activeInstanceProgress,
      syncImageSession,
      resetForFreshImage,
      handleReserveFirstProductHandoff,
      adoptWorkspaceProduct,
      handleRegisterOverlayAlias,
      duplicateProductInstance,
      handleReplaceProductInstance,
      activatePlacedOverlay,
      removePlacedOverlay,
      removeActiveProduct,
      handleBeginActionAttempt,
      handleCancelActionAttempt,
      handleAcknowledgeActionAttempt,
      requestManualPlacement,
      acceptFreePlacement,
      completePaperTourForRun,
      skipCurrentRun,
      optOutDontShowAgain,
      completeWorkspaceTour,
      restartGuideManually,
      beginComparisonPreparation,
      cancelOrFailComparisonPreparation,
      completeComparisonNavigation,
    ],
  );

  return (
    <VisualizationOnboardingContext.Provider value={value}>
      {children}
    </VisualizationOnboardingContext.Provider>
  );
}

export function useOptionalVisualizationOnboarding(): VisualizationOnboardingContextValue | null {
  return useContext(VisualizationOnboardingContext);
}
