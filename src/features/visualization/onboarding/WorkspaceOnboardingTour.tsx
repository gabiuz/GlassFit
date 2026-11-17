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

/** Guides first placement through product selection, positioning, and preview acceptance (IMP-MS89, DSD-UI4). */
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
  if (!resolution.shouldShowPopupTour) return null;

  const variant = isMobileEditor || isCompactViewport ? "mobile" : "desktop";
  const totalSteps = resolution.hasPlacedProductsOnly ? 1 : 3;

  if (resolution.task === "add_product") {
    return (
      <OnboardingTourPopup
        isOpen
        title="Choose a Product"
        description="Click Add Product here to pick a fixture for your room photo."
        helperNote="The next step appears automatically after your model loads."
        stepIndex={0}
        totalSteps={totalSteps}
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
        totalSteps={totalSteps}
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
        totalSteps={totalSteps}
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

  if (resolution.task !== "preview_ready") return null;

  const description = resolution.hasPlacedProductsOnly
    ? "Your placed product is ready. Select a layer to edit it, add another product, or click Continue to Comparison."
    : isMobileEditor
      ? "Your preview is ready. Tap Controls to adjust settings, or tap Done to exit the editor and continue to comparison."
      : "Your preview is ready. You can refine finishes, add another product, or continue to comparison.";

  return (
    <OnboardingTourPopup
      isOpen
      title="Preview Ready"
      description={description}
      helperNote={
        hasPerspectiveCorners
          ? "Visual fit previews placement and does not confirm physical quotation dimensions."
          : undefined
      }
      stepIndex={resolution.hasPlacedProductsOnly ? 0 : 2}
      totalSteps={totalSteps}
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
