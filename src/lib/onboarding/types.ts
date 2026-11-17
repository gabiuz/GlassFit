/**
 * Shared onboarding types for Comparison and Admin surfaces (IMP-MS90).
 * Independent of feature-specific domain state.
 */

export type GuidePreferenceStatus = "unseen" | "completed" | "dont_show_again";

export type PhaseCompletionStatus = "unseen" | "completed";

export interface ComparisonGuidePreferenceRecord {
  version: 1;
  status: GuidePreferenceStatus;
}

export interface ComparisonGuideSessionRecord {
  version: 1;
  runSkipped: boolean;
}

export type AdminOnboardingSurfaceId =
  | "dashboard"
  | "bookings"
  | "products"
  | "product_setup"
  | "materials"
  | "staff"
  | "settings";

export type WizardPhaseGuideId =
  | "basic"
  | "strategy"
  | "assets"
  | "components_intake"
  | "components_inspector"
  | "parameters_dimensions"
  | "parameters_rules"
  | "parameters_addons"
  | "validation_sandbox"
  | "validation_materials"
  | "review";

export type BookingsSubGuideId =
  | "queue_orientation"
  | "inspector_negotiation";

export interface AdminOnboardingPreferenceRecord {
  version: 1;
  profileId: string;
  /** Surface-level status: controls automatic entry tours and surface-wide dont_show_again opt-out. */
  surfaces: Partial<Record<AdminOnboardingSurfaceId, GuidePreferenceStatus>>;
  /** Granular completion for Product Setup Wizard phases so completing one phase does not silence later phases. */
  wizardPhases: Partial<Record<WizardPhaseGuideId, PhaseCompletionStatus>>;
  /** Granular completion for Bookings orientation vs. selected-quotation inspector guidance. */
  bookingsPhases: Partial<Record<BookingsSubGuideId, PhaseCompletionStatus>>;
}

export interface AdminOnboardingSessionRecord {
  version: 1;
  profileId: string;
  skippedSurfaces: Partial<Record<AdminOnboardingSurfaceId, boolean>>;
  skippedWizardPhases: Partial<Record<WizardPhaseGuideId, boolean>>;
  skippedBookingsPhases: Partial<Record<BookingsSubGuideId, boolean>>;
}

export interface OnboardingTourStep {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
  helperNote?: string;
  preferredPlacement?: "top" | "bottom" | "left" | "right" | "auto";
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
}
