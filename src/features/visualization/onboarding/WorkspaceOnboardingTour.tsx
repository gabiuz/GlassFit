"use client";

import React from "react";
import { CABINET_FREE_PLACEMENT_NOTICE } from "@/lib/visualization/workspaceCapabilities";
import { OnboardingTourPopup } from "./OnboardingTourPopup";
import type { GuideResolution } from "./types";

export type ConfigStageId =
  | "placement"
  | "design"
  | "addons"
  | "hardware"
  | "occlusion"
  | "apply_changes"
  | "preview_ready";

export function getWorkspaceConfigStages(options: {
  hasCompatibleAddons: boolean;
  hasHardwareAccessories: boolean;
}): ConfigStageId[] {
  const stages: ConfigStageId[] = ["placement", "design"];
  if (options.hasCompatibleAddons) {
    stages.push("addons");
  }
  if (options.hasHardwareAccessories) {
    stages.push("hardware");
  }
  stages.push("occlusion", "apply_changes", "preview_ready");
  return stages;
}

export interface WorkspaceOnboardingTourProps {
  resolution: GuideResolution;
  configStages: ConfigStageId[];
  activeConfigStageIndex: number;
  isMobileEditor: boolean;
  isCompactViewport: boolean;
  isMobileControlsOpen: boolean;
  hasPerspectiveCorners: boolean;
  isCanonicalCabinet: boolean;
  supportsPerspectivePlane: boolean;
  onResetConfigStage: () => void;
  onPlaceManually: () => void;
  onAcceptFreePlacement: () => void;
  onEditCorners: () => void;
  onCompleteTour: () => void;
  onSkip: () => void;
  onDontShowAgain: () => void;
}

/**
 * Action-driven workspace onboarding tour (DSD-UI4, IMP-MS89).
 * Walks from product selection and placement through each available configuration
 * dropdown header (Placement to Object Aware Occlusion) when clicked, then Preview Ready.
 */
export function WorkspaceOnboardingTour({
  resolution,
  configStages,
  activeConfigStageIndex,
  isMobileEditor,
  isCompactViewport,
  isMobileControlsOpen,
  hasPerspectiveCorners,
  isCanonicalCabinet,
  supportsPerspectivePlane,
  onResetConfigStage,
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
  const totalSteps = resolution.hasPlacedProductsOnly
    ? 1
    : 2 + configStages.length;

  const handleSkip = () => {
    onResetConfigStage();
    onSkip();
  };

  const handleDontShowAgain = () => {
    onResetConfigStage();
    onDontShowAgain();
  };

  const handleCompleteTour = () => {
    onResetConfigStage();
    onCompleteTour();
  };

  const handleEditCorners = () => {
    onResetConfigStage();
    onEditCorners();
  };

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
        onSkip={handleSkip}
        onDontShowAgain={handleDontShowAgain}
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
        onSkip={handleSkip}
        onDontShowAgain={handleDontShowAgain}
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
        onSkip={handleSkip}
        onDontShowAgain={handleDontShowAgain}
        variant={variant}
        blocking
        zIndexBase={70}
      />
    );
  }

  if (resolution.task === "preview_ready") {
    const safeIndex = Math.min(activeConfigStageIndex, configStages.length - 1);
    const activeStage: ConfigStageId = resolution.hasPlacedProductsOnly
      ? "preview_ready"
      : configStages[safeIndex] ?? "preview_ready";
    const stepIndex = resolution.hasPlacedProductsOnly
      ? 0
      : 2 + safeIndex;

    if (
      activeStage !== "preview_ready" &&
      isMobileEditor &&
      !isMobileControlsOpen
    ) {
      return (
        <OnboardingTourPopup
          isOpen
          title="Open Configuration Controls"
          description="Tap Controls to see the configuration dropdowns: Placement, Design & Customization, Add-ons, Hardware, and Object Aware Occlusion."
          helperNote="Clicking Controls opens the menu and moves straight to the first dropdown."
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          targetSelector='[data-onboarding-target="workspace-mobile-controls"]'
          preferredPlacement="top"
          onSkip={handleSkip}
          onDontShowAgain={handleDontShowAgain}
          variant={variant}
          blocking
          zIndexBase={70}
        />
      );
    }

    if (activeStage === "placement") {
      return (
        <OnboardingTourPopup
          isOpen
          title="Placement Controls"
          description={
            hasPerspectiveCorners
              ? "Click Placement to see Front (Exterior) or Back (Interior) facing after fitting, plus Turn Left / Right and Tilt Up / Down angles."
              : "Click Placement to see Turn Left / Right (yaw) and Tilt Up / Down (pitch) viewing angles."
          }
          helperNote="Clicking this dropdown moves straight to the next section cleanly. You can open it once the tour finishes."
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          targetSelector='[data-onboarding-target="workspace-accordion-placement"]'
          preferredPlacement="left"
          onSkip={handleSkip}
          onDontShowAgain={handleDontShowAgain}
          variant={variant}
          blocking
          zIndexBase={70}
        />
      );
    }

    if (activeStage === "design") {
      return (
        <OnboardingTourPopup
          isOpen
          title="Design & Customization"
          description="Click Design and Customization Option to see Aluminum Finish, Glass Type, Glass Color, Glass Thickness, Window Sill, and per-part materials."
          helperNote="Clicking this dropdown moves straight to the next section cleanly. You can open it once the tour finishes."
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          targetSelector='[data-onboarding-target="workspace-accordion-design"]'
          preferredPlacement="left"
          onSkip={handleSkip}
          onDontShowAgain={handleDontShowAgain}
          variant={variant}
          blocking
          zIndexBase={70}
        />
      );
    }

    if (activeStage === "addons") {
      return (
        <OnboardingTourPopup
          isOpen
          title="Add-on Options"
          description="Click Add-on Options to see grilles, insect screens, transom or sidelight options, and mounting placement."
          helperNote="Clicking this dropdown moves straight to the next section cleanly. You can open it once the tour finishes."
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          targetSelector='[data-onboarding-target="workspace-accordion-addons"]'
          preferredPlacement="left"
          onSkip={handleSkip}
          onDontShowAgain={handleDontShowAgain}
          variant={variant}
          blocking
          zIndexBase={70}
        />
      );
    }

    if (activeStage === "hardware") {
      return (
        <OnboardingTourPopup
          isOpen
          title="Hardware & Accessories"
          description="Click Hardware & Accessories to see locks, handles, rollers, hinges, and hardware styles for this product."
          helperNote="Clicking this dropdown moves straight to Object Aware Occlusion cleanly."
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          targetSelector='[data-onboarding-target="workspace-accordion-hardware"]'
          preferredPlacement="left"
          onSkip={handleSkip}
          onDontShowAgain={handleDontShowAgain}
          variant={variant}
          blocking
          zIndexBase={70}
        />
      );
    }

    if (activeStage === "occlusion") {
      return (
        <OnboardingTourPopup
          isOpen
          title="Object Aware Occlusion"
          description="Click Object Aware Occlusion to put your product behind detected foreground objects or outline columns and beams with Manual Occlusion Mask."
          helperNote="Clicking this dropdown highlights Apply Changes next."
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          targetSelector='[data-onboarding-target="workspace-accordion-occlusion"]'
          preferredPlacement="left"
          onSkip={handleSkip}
          onDontShowAgain={handleDontShowAgain}
          variant={variant}
          blocking
          zIndexBase={70}
        />
      );
    }

    if (activeStage === "apply_changes") {
      return (
        <OnboardingTourPopup
          isOpen
          title="Apply Changes"
          description="Click Apply Changes to lock in and preview your configured product composite (you can click Edit anytime afterwards to keep tweaking)."
          helperNote="Clicking Apply Changes generates the preview and moves to Continue to Comparison."
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          targetSelector='[data-onboarding-target="workspace-apply-changes"]'
          preferredPlacement="left"
          onSkip={handleSkip}
          onDontShowAgain={handleDontShowAgain}
          variant={variant}
          blocking
          zIndexBase={70}
        />
      );
    }

    const description = resolution.hasPlacedProductsOnly
      ? "Your placed product is ready. Select a layer to edit it, add another product, or click Continue to Comparison."
      : isMobileEditor
        ? "Your preview is ready. Tap Controls anytime to adjust settings, or tap Done to exit and Continue to Comparison."
        : "Your preview is ready. Refine any section above anytime, or click Continue to Comparison when ready.";

    const helperNote = hasPerspectiveCorners && !isMobileEditor
      ? "Visual fit previews placement and does not confirm physical quotation dimensions."
      : undefined;

    return (
      <OnboardingTourPopup
        isOpen
        title="Preview Ready"
        description={description}
        helperNote={helperNote}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        targetSelector={
          isMobileEditor
            ? '[data-onboarding-target="workspace-mobile-done"]'
            : '[data-onboarding-target="workspace-continue-comparison"]'
        }
        preferredPlacement="top"
        primaryActionLabel="Got it"
        onPrimaryAction={handleCompleteTour}
        secondaryActionLabel={
          hasPerspectiveCorners && supportsPerspectivePlane ? "Edit Corners" : undefined
        }
        onSecondaryAction={
          hasPerspectiveCorners && supportsPerspectivePlane ? handleEditCorners : undefined
        }
        onSkip={handleSkip}
        onDontShowAgain={handleDontShowAgain}
        variant={variant}
        blocking={false}
        zIndexBase={70}
      />
    );
  }

  return null;
}
