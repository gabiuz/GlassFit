import type { CalibrationMode } from "@/lib/visualization/types";
import type { WorkspaceProductCapabilities } from "@/lib/visualization/workspaceCapabilities";

/**
 * Context-aware visualization onboarding types (PRD-F3, PRD-F6, SDD-C2, SDD-C5, IMP-MS89).
 */

export type GuidePreferenceStatus = "unseen" | "completed" | "dont_show_again";

export type GuideTaskStep =
  | "paper_preparation"
  | "reference_review"
  | "add_product"
  | "fit_opening"
  | "free_placement"
  | "preview_ready"
  | "paused"
  | "dismissed";

export type GuidePauseReason =
  | "hydrating"
  | "no_image"
  | "uploading"
  | "model_loading"
  | "error"
  | "modal_open"
  | "comparison_preparing"
  | "none";

export type ActiveBlockingModal =
  | "none"
  | "add_product"
  | "perspective_picker"
  | "measurement"
  | "guardrail"
  | "occlusion"
  | "finishes_sheet"
  | "image_success"
  | "paper_review";

export type PaperTourStepIndex = 0 | 1 | 2 | 3 | 4;

export interface GuideInstanceProgress {
  guideInstanceId: string;
  productId: string;
  activeOverlayId: string | null;
  placedOverlayIds: string[];
  comparisonOverlayIds: string[];
  fitCompleted: boolean;
  manualPlacementRequested: boolean;
  placementAccepted: boolean;
  updatedAt: number;
}

export interface GuideActionAttempt {
  attemptId: string;
  action: "add_product" | "fit_opening" | "paper_review" | "comparison";
  imageId: string;
  guideGeneration: number;
  guideInstanceId: string | null;
}

export interface GuidePreferenceRecord {
  version: 1;
  status: GuidePreferenceStatus;
}

export interface GuideSessionProgressRecord {
  version: 1;
  imageId: string | null;
  guideGeneration: number;
  runSkipped: boolean;
  comparisonSuspended: boolean;
  paperTourCompletedForRun: boolean;
  activeGuideInstanceId: string | null;
  instances: Record<string, GuideInstanceProgress>;
  overlayAliasToInstance: Record<string, string>;
}

export interface GuideActiveProductFacts {
  productId: string;
  guideInstanceId: string | null;
  isReady: boolean;
  capabilities: WorkspaceProductCapabilities | null;
  hasFittedCorners: boolean;
}

export interface GuideResolverInput {
  isSessionHydrated: boolean;
  hasValidImage: boolean;
  imageId: string | null;
  calibrationMode: CalibrationMode | null;
  isUploadingOrAnalyzing: boolean;
  isModelLoading: boolean;
  hasError: boolean;
  activeBlockingModal: ActiveBlockingModal;
  isComparisonPreparing: boolean;
  activeProduct: GuideActiveProductFacts | null;
  placedProductCount: number;
  preferenceStatus: GuidePreferenceStatus;
  runSkipped: boolean;
  comparisonSuspended: boolean;
  manualRunActive: boolean;
  paperTourCompletedForRun: boolean;
  instanceProgress: GuideInstanceProgress | null;
}

export interface GuideResolution {
  task: GuideTaskStep;
  shouldShowPopupTour: boolean;
  shouldShowPaperTour: boolean;
  pauseReason: GuidePauseReason;
  isGuideActive: boolean;
  isAutomaticEligible: boolean;
  canTriggerFit: boolean;
  isPaperMode: boolean;
  hasPlacedProductsOnly: boolean;
  showLegacyCabinetNotice: boolean;
}
