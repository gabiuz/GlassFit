import type { GuideResolution, GuideResolverInput } from "./types";

/**
 * Pure next-action resolver for context-aware visualization onboarding
 * (IMP-MS89 Sections 3 and 4).
 */
export function resolveNextGuideAction(input: GuideResolverInput): GuideResolution {
  const isPaperMode = input.calibrationMode === "paper_fiducial";
  const isAutomaticEligible =
    input.preferenceStatus === "unseen" &&
    !input.runSkipped &&
    !input.comparisonSuspended;
  const isGuideActive = input.manualRunActive || isAutomaticEligible;

  const canTriggerFit = Boolean(
    input.activeProduct &&
      input.activeProduct.isReady &&
      input.activeProduct.capabilities?.canFitOpening &&
      !input.isModelLoading &&
      !input.hasError,
  );
  const showLegacyCabinetNotice = Boolean(
    input.activeProduct?.capabilities?.isCanonicalCabinet &&
      input.activeProduct.hasFittedCorners,
  );
  const hasPlacedProductsOnly = Boolean(
    !input.activeProduct && input.placedProductCount > 0,
  );

  const baseFacts = {
    isGuideActive,
    isAutomaticEligible,
    canTriggerFit,
    isPaperMode,
    hasPlacedProductsOnly,
    showLegacyCabinetNotice,
  };

  // 1. Wait for session hydration before showing any guide surface.
  if (!input.isSessionHydrated) {
    return {
      ...baseFacts,
      task: "paused",
      shouldShowPopupTour: false,
      shouldShowPaperTour: false,
      pauseReason: "hydrating",
    };
  }

  // 2. Before an image is accepted, paper preparation stays driven by mode without a popup tour.
  if (!input.hasValidImage || !input.imageId) {
    return {
      ...baseFacts,
      task: isPaperMode ? "paper_preparation" : "paused",
      shouldShowPopupTour: false,
      shouldShowPaperTour: false,
      pauseReason: isPaperMode ? "none" : "no_image",
    };
  }

  // 3. Pause for upload/analysis, errors, or comparison preparation.
  if (input.isUploadingOrAnalyzing) {
    return {
      ...baseFacts,
      task: "paused",
      shouldShowPopupTour: false,
      shouldShowPaperTour: false,
      pauseReason: "uploading",
    };
  }

  if (input.hasError) {
    return {
      ...baseFacts,
      task: "paused",
      shouldShowPopupTour: false,
      shouldShowPaperTour: false,
      pauseReason: "error",
    };
  }

  if (input.isComparisonPreparing) {
    return {
      ...baseFacts,
      task: "paused",
      shouldShowPopupTour: false,
      shouldShowPaperTour: false,
      pauseReason: "comparison_preparing",
    };
  }

  // 4. Resolve pending paper review inside PaperDetectionConfirmationModal when in paper mode.
  if (input.activeBlockingModal === "paper_review") {
    if (isPaperMode) {
      const shouldShowPaperTour = isGuideActive && !input.paperTourCompletedForRun;
      return {
        ...baseFacts,
        task: shouldShowPaperTour
          ? "reference_review"
          : isGuideActive
            ? "paused"
            : "dismissed",
        shouldShowPopupTour: false,
        shouldShowPaperTour,
        pauseReason: shouldShowPaperTour ? "none" : "modal_open",
      };
    }

    return {
      ...baseFacts,
      task: "paused",
      shouldShowPopupTour: false,
      shouldShowPaperTour: false,
      pauseReason: "modal_open",
    };
  }

  // Pause workspace tour whenever any other modal owns the screen.
  if (input.activeBlockingModal !== "none") {
    return {
      ...baseFacts,
      task: "paused",
      shouldShowPopupTour: false,
      shouldShowPaperTour: false,
      pauseReason: "modal_open",
    };
  }

  // 5. Respect dismissed or completed guidance unless user requested Help.
  if (!isGuideActive) {
    return {
      ...baseFacts,
      task: "dismissed",
      shouldShowPopupTour: false,
      shouldShowPaperTour: false,
      pauseReason: "none",
    };
  }

  // 6. Empty canvas vs placed-only canvas.
  if (!input.activeProduct) {
    if (input.placedProductCount === 0) {
      return {
        ...baseFacts,
        task: "add_product",
        shouldShowPopupTour: true,
        shouldShowPaperTour: false,
        pauseReason: "none",
      };
    }

    return {
      ...baseFacts,
      task: "preview_ready",
      shouldShowPopupTour: true,
      shouldShowPaperTour: false,
      pauseReason: "none",
    };
  }

  // 7. Wait until active product definition and 3D model are ready.
  if (
    input.isModelLoading ||
    !input.activeProduct.isReady ||
    !input.activeProduct.capabilities ||
    !input.activeProduct.capabilities.isDefinitionReady
  ) {
    return {
      ...baseFacts,
      task: "paused",
      shouldShowPopupTour: false,
      shouldShowPaperTour: false,
      pauseReason: "model_loading",
    };
  }

  // 8. Active product placement & Fit capability check.
  if (input.activeProduct.hasFittedCorners) {
    if (
      input.instanceProgress?.manualPlacementRequested &&
      !input.instanceProgress.placementAccepted
    ) {
      return {
        ...baseFacts,
        task: "free_placement",
        shouldShowPopupTour: true,
        shouldShowPaperTour: false,
        pauseReason: "none",
      };
    }

    return {
      ...baseFacts,
      task: "preview_ready",
      shouldShowPopupTour: true,
      shouldShowPaperTour: false,
      pauseReason: "none",
    };
  }

  if (input.instanceProgress?.placementAccepted) {
    return {
      ...baseFacts,
      task: "preview_ready",
      shouldShowPopupTour: true,
      shouldShowPaperTour: false,
      pauseReason: "none",
    };
  }

  if (
    input.activeProduct.capabilities.canFitOpening &&
    !input.instanceProgress?.manualPlacementRequested
  ) {
    return {
      ...baseFacts,
      task: "fit_opening",
      shouldShowPopupTour: true,
      shouldShowPaperTour: false,
      pauseReason: "none",
    };
  }

  return {
    ...baseFacts,
    task: "free_placement",
    shouldShowPopupTour: true,
    shouldShowPaperTour: false,
    pauseReason: "none",
  };
}
