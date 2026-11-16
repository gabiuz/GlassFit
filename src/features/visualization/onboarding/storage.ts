import type {
  GuideInstanceProgress,
  GuidePreferenceRecord,
  GuidePreferenceStatus,
  GuideSessionProgressRecord,
} from "./types";

/**
 * Versioned storage helpers for onboarding display preferences and session progress
 * (IMP-MS89 Sections 4.2 and 4.3).
 *
 * Stores zero photos, customer details, geometry, or measurement evidence.
 */

export const GUIDE_STORAGE_VERSION = 1 as const;
export const GUIDE_PREFERENCE_STORAGE_KEY = "glassfit.onboarding.preference.v1";
export const GUIDE_PROGRESS_STORAGE_KEY = "glassfit.onboarding.progress.v1";

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

let inMemoryPreferenceFallback: GuidePreferenceStatus = "unseen";

function getDefaultLocalStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getDefaultSessionStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidPreferenceStatus(value: unknown): value is GuidePreferenceStatus {
  return value === "unseen" || value === "completed" || value === "dont_show_again";
}

function sanitizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) return null;
    items.push(item);
  }
  return items;
}

function parseInstanceProgress(
  key: string,
  value: unknown,
): GuideInstanceProgress | null {
  if (!isPlainRecord(value)) return null;
  if (
    typeof value.guideInstanceId !== "string" ||
    value.guideInstanceId !== key ||
    typeof value.productId !== "string" ||
    value.productId.length === 0
  ) {
    return null;
  }
  if (
    value.activeOverlayId !== null &&
    typeof value.activeOverlayId !== "string"
  ) {
    return null;
  }
  const placedOverlayIds = sanitizeStringArray(value.placedOverlayIds);
  const comparisonOverlayIds = sanitizeStringArray(value.comparisonOverlayIds);
  if (!placedOverlayIds || !comparisonOverlayIds) return null;
  if (
    typeof value.fitCompleted !== "boolean" ||
    typeof value.manualPlacementRequested !== "boolean" ||
    typeof value.placementAccepted !== "boolean" ||
    typeof value.updatedAt !== "number" ||
    !Number.isFinite(value.updatedAt)
  ) {
    return null;
  }

  return {
    guideInstanceId: value.guideInstanceId,
    productId: value.productId,
    activeOverlayId: value.activeOverlayId,
    placedOverlayIds,
    comparisonOverlayIds,
    fitCompleted: value.fitCompleted,
    manualPlacementRequested: value.manualPlacementRequested,
    placementAccepted: value.placementAccepted,
    updatedAt: value.updatedAt,
  };
}

export function createEmptyGuideProgressRecord(
  imageId: string | null = null,
  guideGeneration = 1,
): GuideSessionProgressRecord {
  return {
    version: GUIDE_STORAGE_VERSION,
    imageId,
    guideGeneration,
    runSkipped: false,
    comparisonSuspended: false,
    paperTourCompletedForRun: false,
    activeGuideInstanceId: null,
    instances: {},
    overlayAliasToInstance: {},
  };
}

export function parseGuidePreferenceRecord(raw: string | null): GuidePreferenceStatus | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainRecord(parsed)) return null;
    if (parsed.version !== GUIDE_STORAGE_VERSION) return null;
    if (!isValidPreferenceStatus(parsed.status)) return null;
    return parsed.status;
  } catch {
    return null;
  }
}

export function readGuidePreference(
  storage: StorageLike | null = getDefaultLocalStorage(),
): GuidePreferenceStatus {
  if (!storage) return inMemoryPreferenceFallback;
  try {
    const parsed = parseGuidePreferenceRecord(
      storage.getItem(GUIDE_PREFERENCE_STORAGE_KEY),
    );
    if (parsed) {
      inMemoryPreferenceFallback = parsed;
      return parsed;
    }
    return "unseen";
  } catch {
    return inMemoryPreferenceFallback;
  }
}

export function writeGuidePreference(
  status: GuidePreferenceStatus,
  storage: StorageLike | null = getDefaultLocalStorage(),
): boolean {
  inMemoryPreferenceFallback = status;
  if (!storage) return false;
  const record: GuidePreferenceRecord = {
    version: GUIDE_STORAGE_VERSION,
    status,
  };
  try {
    storage.setItem(GUIDE_PREFERENCE_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function parseGuideProgressRecord(raw: string | null): GuideSessionProgressRecord | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainRecord(parsed)) return null;
    if (parsed.version !== GUIDE_STORAGE_VERSION) return null;
    if (parsed.imageId !== null && typeof parsed.imageId !== "string") return null;
    if (
      typeof parsed.guideGeneration !== "number" ||
      !Number.isInteger(parsed.guideGeneration) ||
      parsed.guideGeneration < 1
    ) {
      return null;
    }
    if (
      typeof parsed.runSkipped !== "boolean" ||
      typeof parsed.comparisonSuspended !== "boolean" ||
      typeof parsed.paperTourCompletedForRun !== "boolean"
    ) {
      return null;
    }
    if (
      parsed.activeGuideInstanceId !== null &&
      typeof parsed.activeGuideInstanceId !== "string"
    ) {
      return null;
    }
    if (!isPlainRecord(parsed.instances) || !isPlainRecord(parsed.overlayAliasToInstance)) {
      return null;
    }

    const instances: Record<string, GuideInstanceProgress> = {};
    for (const [key, value] of Object.entries(parsed.instances)) {
      const instance = parseInstanceProgress(key, value);
      if (!instance) return null;
      instances[key] = instance;
    }

    const overlayAliasToInstance: Record<string, string> = {};
    for (const [overlayId, instanceId] of Object.entries(parsed.overlayAliasToInstance)) {
      if (
        typeof overlayId !== "string" ||
        overlayId.length === 0 ||
        typeof instanceId !== "string" ||
        !instances[instanceId]
      ) {
        return null;
      }
      overlayAliasToInstance[overlayId] = instanceId;
    }

    if (
      parsed.activeGuideInstanceId !== null &&
      !instances[parsed.activeGuideInstanceId]
    ) {
      return null;
    }

    return {
      version: GUIDE_STORAGE_VERSION,
      imageId: parsed.imageId,
      guideGeneration: parsed.guideGeneration,
      runSkipped: parsed.runSkipped,
      comparisonSuspended: parsed.comparisonSuspended,
      paperTourCompletedForRun: parsed.paperTourCompletedForRun,
      activeGuideInstanceId: parsed.activeGuideInstanceId,
      instances,
      overlayAliasToInstance,
    };
  } catch {
    return null;
  }
}

export function readGuideProgress(
  storage: StorageLike | null = getDefaultSessionStorage(),
): GuideSessionProgressRecord | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(GUIDE_PROGRESS_STORAGE_KEY);
    const parsed = parseGuideProgressRecord(raw);
    if (!parsed && raw !== null) {
      try {
        storage.removeItem(GUIDE_PROGRESS_STORAGE_KEY);
      } catch {
        // Ignore cleanup failures when storage is read-only
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeGuideProgress(
  record: GuideSessionProgressRecord,
  storage: StorageLike | null = getDefaultSessionStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(GUIDE_PROGRESS_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function clearGuideProgress(
  storage: StorageLike | null = getDefaultSessionStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(GUIDE_PROGRESS_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
}

export function resetInMemoryPreferenceFallbackForTests(): void {
  inMemoryPreferenceFallback = "unseen";
}
