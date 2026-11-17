import type {
  AdminOnboardingPreferenceRecord,
  AdminOnboardingSessionRecord,
  AdminOnboardingSurfaceId,
  BookingsSubGuideId,
  ComparisonGuidePreferenceRecord,
  ComparisonGuideSessionRecord,
  GuidePreferenceStatus,
  PhaseCompletionStatus,
  WizardPhaseGuideId,
} from "./types";

/**
 * Versioned, account-scoped storage helpers for Comparison and Admin onboarding
 * preferences and session skip state (IMP-MS90 Section 3).
 *
 * Preserves MS89 keys in `src/features/visualization/onboarding/storage.ts` untouched.
 */

export const ONBOARDING_STORAGE_VERSION = 1 as const;

export const COMPARISON_PREFERENCE_STORAGE_KEY =
  "glassfit.onboarding.comparison.preference.v1";
export const COMPARISON_SESSION_STORAGE_KEY =
  "glassfit.onboarding.comparison.session.v1";

export const ADMIN_PREFERENCE_KEY_PREFIX =
  "glassfit.onboarding.admin.preference.v1.";
export const ADMIN_SESSION_KEY_PREFIX =
  "glassfit.onboarding.admin.session.v1.";

export function getAdminOnboardingPreferenceKey(profileId: string): string {
  return `${ADMIN_PREFERENCE_KEY_PREFIX}${profileId}`;
}

export function getAdminOnboardingSessionKey(profileId: string): string {
  return `${ADMIN_SESSION_KEY_PREFIX}${profileId}`;
}

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const inMemoryFallbackStore = new Map<string, string>();

export function clearOnboardingMemoryFallbackForTests(): void {
  inMemoryFallbackStore.clear();
}

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

function isValidGuidePreferenceStatus(
  value: unknown,
): value is GuidePreferenceStatus {
  return (
    value === "unseen" ||
    value === "completed" ||
    value === "dont_show_again"
  );
}

function isValidPhaseCompletionStatus(
  value: unknown,
): value is PhaseCompletionStatus {
  return value === "unseen" || value === "completed";
}

const VALID_ADMIN_SURFACES = new Set<AdminOnboardingSurfaceId>([
  "dashboard",
  "bookings",
  "products",
  "product_setup",
  "materials",
  "staff",
  "settings",
]);

const VALID_WIZARD_PHASES = new Set<WizardPhaseGuideId>([
  "basic",
  "strategy",
  "assets",
  "components_intake",
  "components_inspector",
  "parameters_dimensions",
  "parameters_rules",
  "parameters_addons",
  "validation_sandbox",
  "validation_materials",
  "review",
]);

const VALID_BOOKINGS_PHASES = new Set<BookingsSubGuideId>([
  "queue_orientation",
  "inspector_negotiation",
]);

function safeGetRaw(key: string, storage: StorageLike | null): string | null {
  if (storage) {
    try {
      const value = storage.getItem(key);
      if (value !== null) {
        inMemoryFallbackStore.set(key, value);
        return value;
      }
      return null;
    } catch {
      return inMemoryFallbackStore.get(key) ?? null;
    }
  }
  return inMemoryFallbackStore.get(key) ?? null;
}

function safeSetRaw(
  key: string,
  serialized: string,
  storage: StorageLike | null,
): boolean {
  inMemoryFallbackStore.set(key, serialized);
  if (!storage) return false;
  try {
    storage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Comparison Storage Helpers
// ---------------------------------------------------------------------------

export function readComparisonGuidePreference(
  storage: StorageLike | null = getDefaultLocalStorage(),
): GuidePreferenceStatus {
  const raw = safeGetRaw(COMPARISON_PREFERENCE_STORAGE_KEY, storage);
  if (!raw) return "unseen";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainRecord(parsed)) return "unseen";
    if (parsed.version !== ONBOARDING_STORAGE_VERSION) return "unseen";
    if (!isValidGuidePreferenceStatus(parsed.status)) return "unseen";
    return parsed.status;
  } catch {
    return "unseen";
  }
}

export function writeComparisonGuidePreference(
  status: GuidePreferenceStatus,
  storage: StorageLike | null = getDefaultLocalStorage(),
): boolean {
  const record: ComparisonGuidePreferenceRecord = {
    version: ONBOARDING_STORAGE_VERSION,
    status,
  };
  return safeSetRaw(
    COMPARISON_PREFERENCE_STORAGE_KEY,
    JSON.stringify(record),
    storage,
  );
}

/**
 * Opt-out precedence: if prior status is already `dont_show_again`, completing a manual
 * Help replay must keep `dont_show_again`.
 */
export function completeComparisonGuidePreference(
  storage: StorageLike | null = getDefaultLocalStorage(),
): GuidePreferenceStatus {
  const current = readComparisonGuidePreference(storage);
  if (current === "dont_show_again") {
    return "dont_show_again";
  }
  writeComparisonGuidePreference("completed", storage);
  return "completed";
}

export function readComparisonGuideSession(
  storage: StorageLike | null = getDefaultSessionStorage(),
): ComparisonGuideSessionRecord {
  const raw = safeGetRaw(COMPARISON_SESSION_STORAGE_KEY, storage);
  if (!raw) {
    return { version: ONBOARDING_STORAGE_VERSION, runSkipped: false };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainRecord(parsed)) {
      return { version: ONBOARDING_STORAGE_VERSION, runSkipped: false };
    }
    if (parsed.version !== ONBOARDING_STORAGE_VERSION) {
      return { version: ONBOARDING_STORAGE_VERSION, runSkipped: false };
    }
    return {
      version: ONBOARDING_STORAGE_VERSION,
      runSkipped: typeof parsed.runSkipped === "boolean" ? parsed.runSkipped : false,
    };
  } catch {
    return { version: ONBOARDING_STORAGE_VERSION, runSkipped: false };
  }
}

export function writeComparisonGuideSession(
  runSkipped: boolean,
  storage: StorageLike | null = getDefaultSessionStorage(),
): boolean {
  const record: ComparisonGuideSessionRecord = {
    version: ONBOARDING_STORAGE_VERSION,
    runSkipped,
  };
  return safeSetRaw(
    COMPARISON_SESSION_STORAGE_KEY,
    JSON.stringify(record),
    storage,
  );
}

// ---------------------------------------------------------------------------
// Account-Scoped Admin Storage Helpers
// ---------------------------------------------------------------------------

export function createEmptyAdminOnboardingPreferenceRecord(
  profileId: string,
): AdminOnboardingPreferenceRecord {
  return {
    version: ONBOARDING_STORAGE_VERSION,
    profileId,
    surfaces: {},
    wizardPhases: {},
    bookingsPhases: {},
  };
}

export function createEmptyAdminOnboardingSessionRecord(
  profileId: string,
): AdminOnboardingSessionRecord {
  return {
    version: ONBOARDING_STORAGE_VERSION,
    profileId,
    skippedSurfaces: {},
    skippedWizardPhases: {},
    skippedBookingsPhases: {},
  };
}

function sanitizeSurfaceMap(
  value: unknown,
): Partial<Record<AdminOnboardingSurfaceId, GuidePreferenceStatus>> {
  const out: Partial<Record<AdminOnboardingSurfaceId, GuidePreferenceStatus>> = {};
  if (!isPlainRecord(value)) return out;
  for (const [k, v] of Object.entries(value)) {
    if (
      VALID_ADMIN_SURFACES.has(k as AdminOnboardingSurfaceId) &&
      isValidGuidePreferenceStatus(v)
    ) {
      out[k as AdminOnboardingSurfaceId] = v;
    }
  }
  return out;
}

function sanitizeWizardPhaseMap(
  value: unknown,
): Partial<Record<WizardPhaseGuideId, PhaseCompletionStatus>> {
  const out: Partial<Record<WizardPhaseGuideId, PhaseCompletionStatus>> = {};
  if (!isPlainRecord(value)) return out;
  for (const [k, v] of Object.entries(value)) {
    if (
      VALID_WIZARD_PHASES.has(k as WizardPhaseGuideId) &&
      isValidPhaseCompletionStatus(v)
    ) {
      out[k as WizardPhaseGuideId] = v;
    }
  }
  return out;
}

function sanitizeBookingsPhaseMap(
  value: unknown,
): Partial<Record<BookingsSubGuideId, PhaseCompletionStatus>> {
  const out: Partial<Record<BookingsSubGuideId, PhaseCompletionStatus>> = {};
  if (!isPlainRecord(value)) return out;
  for (const [k, v] of Object.entries(value)) {
    if (
      VALID_BOOKINGS_PHASES.has(k as BookingsSubGuideId) &&
      isValidPhaseCompletionStatus(v)
    ) {
      out[k as BookingsSubGuideId] = v;
    }
  }
  return out;
}

function sanitizeBooleanMap<K extends string>(
  value: unknown,
  validKeys: Set<K>,
): Partial<Record<K, boolean>> {
  const out: Partial<Record<K, boolean>> = {};
  if (!isPlainRecord(value)) return out;
  for (const [k, v] of Object.entries(value)) {
    if (validKeys.has(k as K) && typeof v === "boolean") {
      out[k as K] = v;
    }
  }
  return out;
}

export function readAdminOnboardingPreference(
  profileId: string,
  storage: StorageLike | null = getDefaultLocalStorage(),
): AdminOnboardingPreferenceRecord {
  if (!profileId) {
    return createEmptyAdminOnboardingPreferenceRecord("");
  }
  const key = getAdminOnboardingPreferenceKey(profileId);
  const raw = safeGetRaw(key, storage);
  if (!raw) {
    return createEmptyAdminOnboardingPreferenceRecord(profileId);
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainRecord(parsed)) {
      return createEmptyAdminOnboardingPreferenceRecord(profileId);
    }
    if (
      parsed.version !== ONBOARDING_STORAGE_VERSION ||
      parsed.profileId !== profileId
    ) {
      return createEmptyAdminOnboardingPreferenceRecord(profileId);
    }
    return {
      version: ONBOARDING_STORAGE_VERSION,
      profileId,
      surfaces: sanitizeSurfaceMap(parsed.surfaces),
      wizardPhases: sanitizeWizardPhaseMap(parsed.wizardPhases),
      bookingsPhases: sanitizeBookingsPhaseMap(parsed.bookingsPhases),
    };
  } catch {
    return createEmptyAdminOnboardingPreferenceRecord(profileId);
  }
}

export function writeAdminOnboardingPreference(
  record: AdminOnboardingPreferenceRecord,
  storage: StorageLike | null = getDefaultLocalStorage(),
): boolean {
  if (!record.profileId) return false;
  const key = getAdminOnboardingPreferenceKey(record.profileId);
  const sanitized: AdminOnboardingPreferenceRecord = {
    version: ONBOARDING_STORAGE_VERSION,
    profileId: record.profileId,
    surfaces: sanitizeSurfaceMap(record.surfaces),
    wizardPhases: sanitizeWizardPhaseMap(record.wizardPhases),
    bookingsPhases: sanitizeBookingsPhaseMap(record.bookingsPhases),
  };
  return safeSetRaw(key, JSON.stringify(sanitized), storage);
}

export function readAdminOnboardingSession(
  profileId: string,
  storage: StorageLike | null = getDefaultSessionStorage(),
): AdminOnboardingSessionRecord {
  if (!profileId) {
    return createEmptyAdminOnboardingSessionRecord("");
  }
  const key = getAdminOnboardingSessionKey(profileId);
  const raw = safeGetRaw(key, storage);
  if (!raw) {
    return createEmptyAdminOnboardingSessionRecord(profileId);
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainRecord(parsed)) {
      return createEmptyAdminOnboardingSessionRecord(profileId);
    }
    if (
      parsed.version !== ONBOARDING_STORAGE_VERSION ||
      parsed.profileId !== profileId
    ) {
      return createEmptyAdminOnboardingSessionRecord(profileId);
    }
    return {
      version: ONBOARDING_STORAGE_VERSION,
      profileId,
      skippedSurfaces: sanitizeBooleanMap(
        parsed.skippedSurfaces,
        VALID_ADMIN_SURFACES,
      ),
      skippedWizardPhases: sanitizeBooleanMap(
        parsed.skippedWizardPhases,
        VALID_WIZARD_PHASES,
      ),
      skippedBookingsPhases: sanitizeBooleanMap(
        parsed.skippedBookingsPhases,
        VALID_BOOKINGS_PHASES,
      ),
    };
  } catch {
    return createEmptyAdminOnboardingSessionRecord(profileId);
  }
}

export function writeAdminOnboardingSession(
  record: AdminOnboardingSessionRecord,
  storage: StorageLike | null = getDefaultSessionStorage(),
): boolean {
  if (!record.profileId) return false;
  const key = getAdminOnboardingSessionKey(record.profileId);
  const sanitized: AdminOnboardingSessionRecord = {
    version: ONBOARDING_STORAGE_VERSION,
    profileId: record.profileId,
    skippedSurfaces: sanitizeBooleanMap(
      record.skippedSurfaces,
      VALID_ADMIN_SURFACES,
    ),
    skippedWizardPhases: sanitizeBooleanMap(
      record.skippedWizardPhases,
      VALID_WIZARD_PHASES,
    ),
    skippedBookingsPhases: sanitizeBooleanMap(
      record.skippedBookingsPhases,
      VALID_BOOKINGS_PHASES,
    ),
  };
  return safeSetRaw(key, JSON.stringify(sanitized), storage);
}

/**
 * Updates surface status to `completed` only if prior status was `unseen`.
 * Never overwrites `dont_show_again`.
 */
export function markAdminSurfaceCompleted(
  profileId: string,
  surface: AdminOnboardingSurfaceId,
  storage: StorageLike | null = getDefaultLocalStorage(),
): AdminOnboardingPreferenceRecord {
  const current = readAdminOnboardingPreference(profileId, storage);
  const existing = current.surfaces[surface] ?? "unseen";
  if (existing === "dont_show_again") {
    return current;
  }
  const next: AdminOnboardingPreferenceRecord = {
    ...current,
    surfaces: {
      ...current.surfaces,
      [surface]: "completed",
    },
  };
  writeAdminOnboardingPreference(next, storage);
  return next;
}

export function markAdminSurfaceDontShowAgain(
  profileId: string,
  surface: AdminOnboardingSurfaceId,
  storage: StorageLike | null = getDefaultLocalStorage(),
): AdminOnboardingPreferenceRecord {
  const current = readAdminOnboardingPreference(profileId, storage);
  const next: AdminOnboardingPreferenceRecord = {
    ...current,
    surfaces: {
      ...current.surfaces,
      [surface]: "dont_show_again",
    },
  };
  writeAdminOnboardingPreference(next, storage);
  return next;
}

export function markAdminWizardPhaseCompleted(
  profileId: string,
  phaseId: WizardPhaseGuideId,
  markSurfaceCompleted = false,
  storage: StorageLike | null = getDefaultLocalStorage(),
): AdminOnboardingPreferenceRecord {
  const current = readAdminOnboardingPreference(profileId, storage);
  const existingSurface = current.surfaces.product_setup ?? "unseen";
  const nextSurfaceStatus: GuidePreferenceStatus =
    existingSurface === "dont_show_again"
      ? "dont_show_again"
      : markSurfaceCompleted
        ? "completed"
        : existingSurface;

  const next: AdminOnboardingPreferenceRecord = {
    ...current,
    surfaces: {
      ...current.surfaces,
      ...(nextSurfaceStatus !== "unseen" ? { product_setup: nextSurfaceStatus } : {}),
    },
    wizardPhases: {
      ...current.wizardPhases,
      [phaseId]: "completed",
    },
  };
  writeAdminOnboardingPreference(next, storage);
  return next;
}

export function markAdminBookingsPhaseCompleted(
  profileId: string,
  phaseId: BookingsSubGuideId,
  markSurfaceCompleted = false,
  storage: StorageLike | null = getDefaultLocalStorage(),
): AdminOnboardingPreferenceRecord {
  const current = readAdminOnboardingPreference(profileId, storage);
  const existingSurface = current.surfaces.bookings ?? "unseen";
  const nextSurfaceStatus: GuidePreferenceStatus =
    existingSurface === "dont_show_again"
      ? "dont_show_again"
      : markSurfaceCompleted
        ? "completed"
        : existingSurface;

  const next: AdminOnboardingPreferenceRecord = {
    ...current,
    surfaces: {
      ...current.surfaces,
      ...(nextSurfaceStatus !== "unseen" ? { bookings: nextSurfaceStatus } : {}),
    },
    bookingsPhases: {
      ...current.bookingsPhases,
      [phaseId]: "completed",
    },
  };
  writeAdminOnboardingPreference(next, storage);
  return next;
}

export function setAdminSurfaceSessionSkipped(
  profileId: string,
  surface: AdminOnboardingSurfaceId,
  skipped: boolean,
  storage: StorageLike | null = getDefaultSessionStorage(),
): AdminOnboardingSessionRecord {
  const current = readAdminOnboardingSession(profileId, storage);
  const next: AdminOnboardingSessionRecord = {
    ...current,
    skippedSurfaces: {
      ...current.skippedSurfaces,
      [surface]: skipped,
    },
  };
  writeAdminOnboardingSession(next, storage);
  return next;
}

export function setAdminWizardPhaseSessionSkipped(
  profileId: string,
  phaseId: WizardPhaseGuideId,
  skipped: boolean,
  storage: StorageLike | null = getDefaultSessionStorage(),
): AdminOnboardingSessionRecord {
  const current = readAdminOnboardingSession(profileId, storage);
  const next: AdminOnboardingSessionRecord = {
    ...current,
    skippedWizardPhases: {
      ...current.skippedWizardPhases,
      [phaseId]: skipped,
    },
  };
  writeAdminOnboardingSession(next, storage);
  return next;
}

export function setAdminBookingsPhaseSessionSkipped(
  profileId: string,
  phaseId: BookingsSubGuideId,
  skipped: boolean,
  storage: StorageLike | null = getDefaultSessionStorage(),
): AdminOnboardingSessionRecord {
  const current = readAdminOnboardingSession(profileId, storage);
  const next: AdminOnboardingSessionRecord = {
    ...current,
    skippedBookingsPhases: {
      ...current.skippedBookingsPhases,
      [phaseId]: skipped,
    },
  };
  writeAdminOnboardingSession(next, storage);
  return next;
}
