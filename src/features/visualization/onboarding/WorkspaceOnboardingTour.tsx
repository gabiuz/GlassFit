"use client";

import React from "react";
import { CABINET_FREE_PLACEMENT_NOTICE } from "@/lib/visualization/workspaceCapabilities";
import { OnboardingTourPopup } from "./OnboardingTourPopup";
import type { GuideResolution } from "./types";

export interface WorkspaceOnboardingTourProps {
  resolution: GuideResolution;
  isMobileEditor: boolean;
  isCompactViewport: boolean;
  hasPerspectiveCorners: boolean;
  isCanonicalCabinet: boolean;
  supportsPerspectivePlane: boolean;
  onPlaceManually: () => void;
  onAcceptFreePlacement: () => void;
  onEditCorners: () => void;
  onCompleteTour: () => void;
  onSkip: () => void;
  onDontShowAgain: () => void;
}

/**
 * Action-driven workspace onboarding tour (DSD-UI4, IMP-MS89).
 * Each step anchors beside its real UI control with a directional arrow and advances
 * automatically when the user interacts with that control.
 */
export function WorkspaceOnboardingTour({
  resolution,
  isMobileEditor,
  isCompactViewport,
  hasPerspectiveCorners,
  isCanonicalCabinet,
  supportsPerspectivePlane,
  onPlaceManually,
  onAcceptFreePlacement,
  onEditCorners,
  onCompleteTour,
  onSkip,
  onDontShowAgain,
}: WorkspaceOnboardingTourProps) {
  if (!resolution.shouldShowPopupTour) {
    return null;
  }

  const variant = isMobileEditor || isCompactViewport ? "mobile" : "desktop";

  if (resolution.task === "add_product") {
    return (
      <OnboardingTourPopup
        isOpen
        title="Choose a Product"
        description="Click Add Product here to pick a fixture for your room photo."
        helperNote="The next step appears automatically after your model loads."
        stepIndex={0}
        totalSteps={3}
        targetSelector='[data-onboarding-target="workspace-add-product"]'
        preferredPlacement="bottom"
        onSkip={onSkip}
        onDontShowAgain={onDontShowAgain}
        variant={variant}
        blocking
        zIndexBase={70}
      />
    );
  }

  if (resolution.task === "fit_opening") {
    return (
      <OnboardingTourPopup
        isOpen
        title="Fit to Opening"
        description="Click Fit to align this product to the opening in your photo."
        helperNote={
          isMobileEditor
            ? "Or choose Place manually to drag and resize directly on the canvas."
            : "Outline the four corners of your opening and confirm Fit to continue."
        }
        stepIndex={1}
        totalSteps={3}
        targetSelector={
          isMobileEditor
            ? '[data-onboarding-target="workspace-fit-button-mobile"]'
            : '[data-onboarding-target="workspace-fit-button"]'
        }
        preferredPlacement="top"
        secondaryActionLabel="Place manually"
        onSecondaryAction={onPlaceManually}
        onSkip={onSkip}
        onDontShowAgain={onDontShowAgain}
        variant={variant}
        blocking
        zIndexBase={70}
      />
    );
  }

  if (resolution.task === "free_placement") {
    return (
      <OnboardingTourPopup
        isOpen
        title="Position Your Product"
        description={
          isCanonicalCabinet && hasPerspectiveCorners
            ? CABINET_FREE_PLACEMENT_NOTICE
            : "Drag the product on the canvas into position, or use a corner handle to resize it."
        }
        helperNote={
          isMobileEditor
            ? "Drag right on the photo above, or tap Looks good if the placement is already right."
            : "Move or resize directly inside the highlighted canvas, or click Looks good if it is already positioned."
        }
        stepIndex={1}
        totalSteps={3}
        targetSelector='[data-onboarding-target="workspace-canvas-stage"]'
        preferredPlacement="right"
        secondaryActionLabel="Looks good"
        onSecondaryAction={onAcceptFreePlacement}
        onSkip={onSkip}
        onDontShowAgain={onDontShowAgain}
        variant={variant}
        blocking
        zIndexBase={70}
      />
    );
  }

  if (resolution.task === "preview_ready") {
    const description = resolution.hasPlacedProductsOnly
      ? "Your placed product is ready. Select a layer to edit it, add another product, or click Continue to Comparison."
      : isMobileEditor
        ? "Your preview is ready. Tap Controls for Placement/Facing, or tap Done to exit and Continue to Comparison."
        : hasPerspectiveCorners
          ? "Your preview is ready. Refine finishes or Front/Back facing in Placement, or click Continue to Comparison."
          : "Your preview is ready. Refine finishes anytime, or click Continue to Comparison when ready.";

    const helperNote = hasPerspectiveCorners && !isMobileEditor
      ? "Visual fit previews placement and does not confirm physical quotation dimensions."
      : undefined;

    return (
      <OnboardingTourPopup
        isOpen
        title="Preview Ready"
        description={description}
        helperNote={helperNote}
        stepIndex={2}
        totalSteps={3}
        targetSelector={
          isMobileEditor
            ? '[data-onboarding-target="workspace-mobile-done"]'
            : '[data-onboarding-target="workspace-continue-comparison"]'
        }
        preferredPlacement="top"
        primaryActionLabel="Got it"
        onPrimaryAction={onCompleteTour}
        secondaryActionLabel={
          hasPerspectiveCorners && supportsPerspectivePlane ? "Edit Corners" : undefined
        }
        onSecondaryAction={
          hasPerspectiveCorners && supportsPerspectivePlane ? onEditCorners : undefined
        }
        onSkip={onSkip}
        onDontShowAgain={onDontShowAgain}
        variant={variant}
        blocking={false}
        zIndexBase={70}
      />
    );
  }

  return null;
}
