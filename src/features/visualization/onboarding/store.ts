import { createEmptyGuideProgressRecord } from "./storage";
import type {
  GuideActionAttempt,
  GuideInstanceProgress,
  GuidePreferenceStatus,
  GuideSessionProgressRecord,
} from "./types";

/**
 * Pure onboarding state machine and identity/alias coordinator
 * (IMP-MS89 Sections 4.2 and 4.3).
 */

export interface GuideRuntimeState {
  preferenceStatus: GuidePreferenceStatus;
  progress: GuideSessionProgressRecord;
  manualRunActive: boolean;
  isComparisonPreparing: boolean;
  reservedHandoff: {
    imageId: string;
    productId: string;
    guideInstanceId: string;
  } | null;
  pendingAttempts: Record<string, GuideActionAttempt>;
}

let fallbackCounter = 0;

export function generateGuideId(prefix: string): string {
  fallbackCounter += 1;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${fallbackCounter}`;
}

function createInstanceProgress(
  guideInstanceId: string,
  productId: string,
  activeOverlayId: string | null = null,
): GuideInstanceProgress {
  return {
    guideInstanceId,
    productId,
    activeOverlayId,
    placedOverlayIds: [],
    comparisonOverlayIds: [],
    fitCompleted: false,
    manualPlacementRequested: false,
    placementAccepted: false,
    updatedAt: Date.now(),
  };
}

export function createInitialGuideRuntimeState(options: {
  storedPreference: GuidePreferenceStatus;
  storedProgress: GuideSessionProgressRecord | null;
  sessionImageId: string | null;
}): GuideRuntimeState {
  const { storedPreference, storedProgress, sessionImageId } = options;
  const canRestoreProgress = Boolean(
    storedProgress &&
      sessionImageId &&
      storedProgress.imageId === sessionImageId,
  );

  return {
    preferenceStatus: storedPreference,
    progress: canRestoreProgress && storedProgress
      ? storedProgress
      : createEmptyGuideProgressRecord(sessionImageId, 1),
    manualRunActive: false,
    isComparisonPreparing: false,
    reservedHandoff: null,
    pendingAttempts: {},
  };
}

export function resetGuideForNewImage(
  state: GuideRuntimeState,
  nextImageId: string | null,
): GuideRuntimeState {
  return {
    ...state,
    progress: createEmptyGuideProgressRecord(
      nextImageId,
      state.progress.guideGeneration + 1,
    ),
    manualRunActive: false,
    isComparisonPreparing: false,
    reservedHandoff: null,
    pendingAttempts: {},
  };
}

export function syncImageIdentity(
  state: GuideRuntimeState,
  imageId: string | null,
): GuideRuntimeState {
  if (imageId === state.progress.imageId) {
    return state;
  }
  return resetGuideForNewImage(state, imageId);
}

export function reserveFirstProductHandoff(
  state: GuideRuntimeState,
  imageId: string,
  productId: string,
): { state: GuideRuntimeState; guideInstanceId: string } {
  const baseState = syncImageIdentity(state, imageId);
  const guideInstanceId = generateGuideId("guide-inst");
  const instance = createInstanceProgress(guideInstanceId, productId, null);

  return {
    guideInstanceId,
    state: {
      ...baseState,
      progress: {
        ...baseState.progress,
        activeGuideInstanceId: guideInstanceId,
        instances: {
          ...baseState.progress.instances,
          [guideInstanceId]: instance,
        },
      },
      reservedHandoff: {
        imageId,
        productId,
        guideInstanceId,
      },
    },
  };
}

export function adoptOrEnsureActiveProductInstance(
  state: GuideRuntimeState,
  options: {
    imageId: string | null;
    productId: string | null;
    activeOverlayId: string | null;
  },
): GuideRuntimeState {
  const { imageId, productId, activeOverlayId } = options;
  const baseState = syncImageIdentity(state, imageId);

  if (!imageId || !productId) {
    if (baseState.progress.activeGuideInstanceId === null) {
      return baseState;
    }
    return {
      ...baseState,
      progress: {
        ...baseState.progress,
        activeGuideInstanceId: null,
      },
    };
  }

  // 1. Adopt reserved first-product handoff across route transition.
  if (
    baseState.reservedHandoff &&
    baseState.reservedHandoff.imageId === imageId &&
    baseState.reservedHandoff.productId === productId
  ) {
    const { guideInstanceId } = baseState.reservedHandoff;
    const existing =
      baseState.progress.instances[guideInstanceId] ??
      createInstanceProgress(guideInstanceId, productId, activeOverlayId);
    const nextOverlayAliasToInstance = { ...baseState.progress.overlayAliasToInstance };
    if (activeOverlayId) {
      nextOverlayAliasToInstance[activeOverlayId] = guideInstanceId;
    }

    return {
      ...baseState,
      reservedHandoff: null,
      progress: {
        ...baseState.progress,
        activeGuideInstanceId: guideInstanceId,
        instances: {
          ...baseState.progress.instances,
          [guideInstanceId]: {
            ...existing,
            activeOverlayId: activeOverlayId ?? existing.activeOverlayId,
            updatedAt: Date.now(),
          },
        },
        overlayAliasToInstance: nextOverlayAliasToInstance,
      },
    };
  }

  // 2. Resolve existing alias if activeOverlayId is already mapped (e.g. editing placed overlay).
  if (activeOverlayId && baseState.progress.overlayAliasToInstance[activeOverlayId]) {
    const mappedId = baseState.progress.overlayAliasToInstance[activeOverlayId];
    const mappedInstance = baseState.progress.instances[mappedId];
    if (mappedInstance && mappedInstance.productId === productId) {
      if (
        baseState.progress.activeGuideInstanceId === mappedId &&
        mappedInstance.activeOverlayId === activeOverlayId
      ) {
        return baseState;
      }
      return {
        ...baseState,
        progress: {
          ...baseState.progress,
          activeGuideInstanceId: mappedId,
          instances: {
            ...baseState.progress.instances,
            [mappedId]: {
              ...mappedInstance,
              activeOverlayId,
              updatedAt: Date.now(),
            },
          },
        },
      };
    }
  }

  // 3. Preserve active instance when productId matches and no replacement occurred.
  const currentActiveId = baseState.progress.activeGuideInstanceId;
  if (currentActiveId && baseState.progress.instances[currentActiveId]?.productId === productId) {
    const currentInstance = baseState.progress.instances[currentActiveId];
    if (
      activeOverlayId &&
      currentInstance.activeOverlayId === activeOverlayId &&
      baseState.progress.overlayAliasToInstance[activeOverlayId] === currentActiveId
    ) {
      return baseState;
    }
    const nextOverlayAliasToInstance = { ...baseState.progress.overlayAliasToInstance };
    if (activeOverlayId) {
      nextOverlayAliasToInstance[activeOverlayId] = currentActiveId;
    }
    return {
      ...baseState,
      progress: {
        ...baseState.progress,
        instances: {
          ...baseState.progress.instances,
          [currentActiveId]: {
            ...currentInstance,
            activeOverlayId: activeOverlayId ?? currentInstance.activeOverlayId,
            updatedAt: Date.now(),
          },
        },
        overlayAliasToInstance: nextOverlayAliasToInstance,
      },
    };
  }

  // 4. Allocate a fresh guide instance.
  const newInstanceId = generateGuideId("guide-inst");
  const newInstance = createInstanceProgress(newInstanceId, productId, activeOverlayId);
  const nextOverlayAliasToInstance = { ...baseState.progress.overlayAliasToInstance };
  if (activeOverlayId) {
    nextOverlayAliasToInstance[activeOverlayId] = newInstanceId;
  }

  return {
    ...baseState,
    progress: {
      ...baseState.progress,
      activeGuideInstanceId: newInstanceId,
      instances: {
        ...baseState.progress.instances,
        [newInstanceId]: newInstance,
      },
      overlayAliasToInstance: nextOverlayAliasToInstance,
    },
  };
}

export function registerOverlayAlias(
  state: GuideRuntimeState,
  guideInstanceId: string | null,
  overlayId: string,
  role: "active" | "placed" | "comparison",
): GuideRuntimeState {
  if (!guideInstanceId || !overlayId) return state;
  const instance = state.progress.instances[guideInstanceId];
  if (!instance) return state;

  const placedOverlayIds =
    role === "placed" && !instance.placedOverlayIds.includes(overlayId)
      ? [...instance.placedOverlayIds, overlayId]
      : instance.placedOverlayIds;
  const comparisonOverlayIds =
    role === "comparison" && !instance.comparisonOverlayIds.includes(overlayId)
      ? [...instance.comparisonOverlayIds, overlayId]
      : instance.comparisonOverlayIds;

  return {
    ...state,
    progress: {
      ...state.progress,
      instances: {
        ...state.progress.instances,
        [guideInstanceId]: {
          ...instance,
          activeOverlayId: role === "active" ? overlayId : instance.activeOverlayId,
          placedOverlayIds,
          comparisonOverlayIds,
          updatedAt: Date.now(),
        },
      },
      overlayAliasToInstance: {
        ...state.progress.overlayAliasToInstance,
        [overlayId]: guideInstanceId,
      },
    },
  };
}

export function duplicateActiveProductInstance(
  state: GuideRuntimeState,
  productId: string,
  newActiveOverlayId: string | null,
): { state: GuideRuntimeState; guideInstanceId: string } {
  const newInstanceId = generateGuideId("guide-inst");
  const newInstance = createInstanceProgress(newInstanceId, productId, newActiveOverlayId);
  const nextAliases = { ...state.progress.overlayAliasToInstance };
  if (newActiveOverlayId) {
    nextAliases[newActiveOverlayId] = newInstanceId;
  }

  return {
    guideInstanceId: newInstanceId,
    state: {
      ...state,
      progress: {
        ...state.progress,
        activeGuideInstanceId: newInstanceId,
        instances: {
          ...state.progress.instances,
          [newInstanceId]: newInstance,
        },
        overlayAliasToInstance: nextAliases,
      },
    },
  };
}

function invalidateAttemptsForInstance(
  attempts: Record<string, GuideActionAttempt>,
  guideInstanceId: string,
): Record<string, GuideActionAttempt> {
  const next: Record<string, GuideActionAttempt> = {};
  for (const [id, attempt] of Object.entries(attempts)) {
    if (attempt.guideInstanceId !== guideInstanceId) {
      next[id] = attempt;
    }
  }
  return next;
}

export function replaceProductInstance(
  state: GuideRuntimeState,
  oldGuideInstanceId: string | null,
  newProductId: string,
  newActiveOverlayId: string | null,
): { state: GuideRuntimeState; guideInstanceId: string } {
  const nextInstances = { ...state.progress.instances };
  const nextAliases = { ...state.progress.overlayAliasToInstance };
  let nextAttempts = state.pendingAttempts;

  if (oldGuideInstanceId) {
    delete nextInstances[oldGuideInstanceId];
    for (const [overlayId, mappedId] of Object.entries(nextAliases)) {
      if (mappedId === oldGuideInstanceId) {
        delete nextAliases[overlayId];
      }
    }
    nextAttempts = invalidateAttemptsForInstance(nextAttempts, oldGuideInstanceId);
  }

  const newInstanceId = generateGuideId("guide-inst");
  nextInstances[newInstanceId] = createInstanceProgress(
    newInstanceId,
    newProductId,
    newActiveOverlayId,
  );
  if (newActiveOverlayId) {
    nextAliases[newActiveOverlayId] = newInstanceId;
  }

  return {
    guideInstanceId: newInstanceId,
    state: {
      ...state,
      pendingAttempts: nextAttempts,
      progress: {
        ...state.progress,
        activeGuideInstanceId: newInstanceId,
        instances: nextInstances,
        overlayAliasToInstance: nextAliases,
      },
    },
  };
}

export function activateOverlayForEditing(
  state: GuideRuntimeState,
  overlayId: string,
  productId: string,
): { state: GuideRuntimeState; guideInstanceId: string } {
  const existingId = state.progress.overlayAliasToInstance[overlayId];
  if (existingId && state.progress.instances[existingId]) {
    const existing = state.progress.instances[existingId];
    return {
      guideInstanceId: existingId,
      state: {
        ...state,
        progress: {
          ...state.progress,
          activeGuideInstanceId: existingId,
          instances: {
            ...state.progress.instances,
            [existingId]: {
              ...existing,
              activeOverlayId: overlayId,
              updatedAt: Date.now(),
            },
          },
        },
      },
    };
  }

  const newInstanceId = generateGuideId("guide-inst");
  const newInstance = createInstanceProgress(newInstanceId, productId, overlayId);
  return {
    guideInstanceId: newInstanceId,
    state: {
      ...state,
      progress: {
        ...state.progress,
        activeGuideInstanceId: newInstanceId,
        instances: {
          ...state.progress.instances,
          [newInstanceId]: newInstance,
        },
        overlayAliasToInstance: {
          ...state.progress.overlayAliasToInstance,
          [overlayId]: newInstanceId,
        },
      },
    },
  };
}

export function removePlacedOverlayReference(
  state: GuideRuntimeState,
  overlayId: string,
): GuideRuntimeState {
  const mappedId = state.progress.overlayAliasToInstance[overlayId];
  const nextAliases = { ...state.progress.overlayAliasToInstance };
  delete nextAliases[overlayId];

  if (!mappedId || !state.progress.instances[mappedId]) {
    return {
      ...state,
      progress: {
        ...state.progress,
        overlayAliasToInstance: nextAliases,
      },
    };
  }

  const instance = state.progress.instances[mappedId];
  const nextPlaced = instance.placedOverlayIds.filter((id) => id !== overlayId);
  const nextComparison = instance.comparisonOverlayIds.filter((id) => id !== overlayId);
  const isActive =
    state.progress.activeGuideInstanceId === mappedId &&
    instance.activeOverlayId !== overlayId;

  const nextInstances = { ...state.progress.instances };
  let nextAttempts = state.pendingAttempts;

  if (!isActive && nextPlaced.length === 0 && nextComparison.length === 0) {
    delete nextInstances[mappedId];
    nextAttempts = invalidateAttemptsForInstance(nextAttempts, mappedId);
  } else {
    nextInstances[mappedId] = {
      ...instance,
      placedOverlayIds: nextPlaced,
      comparisonOverlayIds: nextComparison,
      updatedAt: Date.now(),
    };
  }

  return {
    ...state,
    pendingAttempts: nextAttempts,
    progress: {
      ...state.progress,
      instances: nextInstances,
      overlayAliasToInstance: nextAliases,
    },
  };
}

export function removeActiveProductState(
  state: GuideRuntimeState,
  guideInstanceId: string | null,
): GuideRuntimeState {
  const targetId = guideInstanceId ?? state.progress.activeGuideInstanceId;
  if (!targetId) {
    return state;
  }

  const nextInstances = { ...state.progress.instances };
  const nextAliases = { ...state.progress.overlayAliasToInstance };
  const target = nextInstances[targetId];
  const nextAttempts = invalidateAttemptsForInstance(state.pendingAttempts, targetId);

  if (target) {
    if (target.activeOverlayId) {
      delete nextAliases[target.activeOverlayId];
    }
    if (
      target.placedOverlayIds.length === 0 &&
      target.comparisonOverlayIds.length === 0
    ) {
      delete nextInstances[targetId];
    } else {
      nextInstances[targetId] = {
        ...target,
        activeOverlayId: null,
        updatedAt: Date.now(),
      };
    }
  }

  return {
    ...state,
    pendingAttempts: nextAttempts,
    progress: {
      ...state.progress,
      activeGuideInstanceId: null,
      instances: nextInstances,
      overlayAliasToInstance: nextAliases,
    },
  };
}

export function beginActionAttempt(
  state: GuideRuntimeState,
  action: GuideActionAttempt["action"],
  guideInstanceId: string | null,
): { state: GuideRuntimeState; attempt: GuideActionAttempt | null } {
  const imageId = state.progress.imageId;
  if (!imageId) {
    return { state, attempt: null };
  }
  const attempt: GuideActionAttempt = {
    attemptId: generateGuideId("attempt"),
    action,
    imageId,
    guideGeneration: state.progress.guideGeneration,
    guideInstanceId,
  };
  return {
    attempt,
    state: {
      ...state,
      pendingAttempts: {
        ...state.pendingAttempts,
        [attempt.attemptId]: attempt,
      },
    },
  };
}

export function cancelActionAttempt(
  state: GuideRuntimeState,
  attemptId: string,
): GuideRuntimeState {
  if (!state.pendingAttempts[attemptId]) return state;
  const nextAttempts = { ...state.pendingAttempts };
  delete nextAttempts[attemptId];
  return {
    ...state,
    pendingAttempts: nextAttempts,
  };
}

export function acknowledgeActionAttempt(
  state: GuideRuntimeState,
  attempt: GuideActionAttempt | null,
): { state: GuideRuntimeState; accepted: boolean } {
  if (!attempt) return { state, accepted: false };
  if (!state.pendingAttempts[attempt.attemptId]) return { state, accepted: false };
  if (state.progress.imageId !== attempt.imageId) return { state, accepted: false };
  if (state.progress.guideGeneration !== attempt.guideGeneration) {
    return { state, accepted: false };
  }
  if (attempt.guideInstanceId !== null) {
    const instance = state.progress.instances[attempt.guideInstanceId];
    if (!instance || state.progress.activeGuideInstanceId !== attempt.guideInstanceId) {
      return { state, accepted: false };
    }
  }

  const nextAttempts = { ...state.pendingAttempts };
  delete nextAttempts[attempt.attemptId];

  if (attempt.action === "paper_review") {
    return {
      accepted: true,
      state: {
        ...state,
        pendingAttempts: nextAttempts,
        progress: {
          ...state.progress,
          paperTourCompletedForRun: true,
        },
      },
    };
  }

  if (attempt.action === "fit_opening" && attempt.guideInstanceId) {
    const instance = state.progress.instances[attempt.guideInstanceId];
    if (!instance) return { state, accepted: false };
    return {
      accepted: true,
      state: {
        ...state,
        pendingAttempts: nextAttempts,
        progress: {
          ...state.progress,
          instances: {
            ...state.progress.instances,
            [attempt.guideInstanceId]: {
              ...instance,
              fitCompleted: true,
              manualPlacementRequested: false,
              placementAccepted: false,
              updatedAt: Date.now(),
            },
          },
        },
      },
    };
  }

  return {
    accepted: true,
    state: {
      ...state,
      pendingAttempts: nextAttempts,
    },
  };
}

export function requestManualPlacementState(
  state: GuideRuntimeState,
  guideInstanceId: string | null,
): GuideRuntimeState {
  const targetId = guideInstanceId ?? state.progress.activeGuideInstanceId;
  if (!targetId) return state;
  const instance = state.progress.instances[targetId];
  if (!instance) return state;
  return {
    ...state,
    progress: {
      ...state.progress,
      instances: {
        ...state.progress.instances,
        [targetId]: {
          ...instance,
          manualPlacementRequested: true,
          placementAccepted: false,
          updatedAt: Date.now(),
        },
      },
    },
  };
}

export function acceptFreePlacementState(
  state: GuideRuntimeState,
  guideInstanceId: string | null,
): GuideRuntimeState {
  const targetId = guideInstanceId ?? state.progress.activeGuideInstanceId;
  if (!targetId) return state;
  const instance = state.progress.instances[targetId];
  if (!instance) return state;
  return {
    ...state,
    progress: {
      ...state.progress,
      instances: {
        ...state.progress.instances,
        [targetId]: {
          ...instance,
          placementAccepted: true,
          updatedAt: Date.now(),
        },
      },
    },
  };
}

export function markPaperTourCompletedForRunState(
  state: GuideRuntimeState,
): GuideRuntimeState {
  if (state.progress.paperTourCompletedForRun) return state;
  return {
    ...state,
    progress: {
      ...state.progress,
      paperTourCompletedForRun: true,
    },
  };
}

export function skipCurrentRunState(state: GuideRuntimeState): GuideRuntimeState {
  return {
    ...state,
    manualRunActive: false,
    progress: {
      ...state.progress,
      runSkipped: true,
    },
  };
}

export function optOutDontShowAgainState(state: GuideRuntimeState): GuideRuntimeState {
  return {
    ...state,
    preferenceStatus: "dont_show_again",
    manualRunActive: false,
  };
}

export function completeWorkspaceTourState(state: GuideRuntimeState): GuideRuntimeState {
  const activeId = state.progress.activeGuideInstanceId;
  const activeInstance = activeId ? state.progress.instances[activeId] : undefined;
  const nextPreferenceStatus: GuidePreferenceStatus =
    state.preferenceStatus === "dont_show_again" ? "dont_show_again" : "completed";
  return {
    ...state,
    preferenceStatus: nextPreferenceStatus,
    manualRunActive: false,
    progress: {
      ...state.progress,
      instances:
        activeId && activeInstance
          ? {
              ...state.progress.instances,
              [activeId]: {
                ...activeInstance,
                placementAccepted: true,
                updatedAt: Date.now(),
              },
            }
          : state.progress.instances,
    },
  };
}

export function restartGuideManuallyState(state: GuideRuntimeState): GuideRuntimeState {
  const activeId = state.progress.activeGuideInstanceId;
  const activeInstance = activeId ? state.progress.instances[activeId] : undefined;
  return {
    ...state,
    manualRunActive: true,
    progress: {
      ...state.progress,
      runSkipped: false,
      comparisonSuspended: false,
      paperTourCompletedForRun: false,
      instances:
        activeId && activeInstance
          ? {
              ...state.progress.instances,
              [activeId]: {
                ...activeInstance,
                placementAccepted: false,
                updatedAt: Date.now(),
              },
            }
          : state.progress.instances,
    },
  };
}
