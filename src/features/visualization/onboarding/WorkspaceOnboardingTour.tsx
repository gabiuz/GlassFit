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
  onAdvanceConfigStage: () => void;
  onOpenMobileControls?: () => void;
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
 * dropdown header (Placement to Object Aware Occlusion) and Apply Changes with Next
 * or header-click advancement, then finishes on Preview Ready.
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
  onAdvanceConfigStage,
  onOpenMobileControls,
  onPlaceManually,
  onAcceptFreePlacement,
  onEditCorners,
  onCompleteTour,
  onSkip,
  onDontShowAgain,
}: WorkspaceOnboardingTourProps) {
  const variant = isMobileEditor || isCompactViewport ? "mobile" : "desktop";
  const totalSteps = resolution.hasPlacedProductsOnly
    ? 1
    : 2 + configStages.length;
  const isPaused = resolution.pauseReason !== "none";

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

  let activeStep: {
    title: string;
    description: string;
    helperNote?: string;
    stepIndex: number;
    targetSelector?: string;
    preferredPlacement: "top" | "bottom" | "left" | "right" | "auto";
    primaryActionLabel?: string;
    onPrimaryAction?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    blocking: boolean;
  } | null = null;

  if (resolution.shouldShowPopupTour) {
    if (resolution.task === "add_product") {
      activeStep = {
        title: "Choose a Product",
        description: "Click Add Product here to pick a fixture for your room photo.",
        helperNote: "The next step appears automatically after your model loads.",
        stepIndex: 0,
        targetSelector: '[data-onboarding-target="workspace-add-product"]',
        preferredPlacement: "bottom",
        blocking: true,
      };
    } else if (resolution.task === "fit_opening") {
      activeStep = {
        title: "Fit to Opening",
        description: "Click Fit to align this product to the opening in your photo.",
        helperNote: isMobileEditor
          ? "Or choose Place manually to drag and resize directly on the canvas."
          : "Outline the four corners of your opening and confirm Fit to continue.",
        stepIndex: 1,
        targetSelector: isMobileEditor
          ? '[data-onboarding-target="workspace-fit-button-mobile"]'
          : '[data-onboarding-target="workspace-fit-button"]',
        preferredPlacement: "top",
        secondaryActionLabel: "Place manually",
        onSecondaryAction: onPlaceManually,
        blocking: true,
      };
    } else if (resolution.task === "free_placement") {
      activeStep = {
        title: "Position Your Product",
        description:
          isCanonicalCabinet && hasPerspectiveCorners
            ? CABINET_FREE_PLACEMENT_NOTICE
            : "Drag the product on the canvas into position, or use a corner handle to resize it.",
        helperNote: isMobileEditor
          ? "Drag right on the photo above, or tap Looks good if the placement is already right."
          : "Move or resize directly inside the highlighted canvas, or click Looks good if it is already positioned.",
        stepIndex: 1,
        targetSelector: '[data-onboarding-target="workspace-canvas-stage"]',
        preferredPlacement: "right",
        secondaryActionLabel: "Looks good",
        onSecondaryAction: onAcceptFreePlacement,
        blocking: true,
      };
    } else if (resolution.task === "preview_ready") {
      const safeIndex = Math.min(activeConfigStageIndex, Math.max(0, configStages.length - 1));
      const activeStage: ConfigStageId = resolution.hasPlacedProductsOnly
        ? "preview_ready"
        : configStages[safeIndex] ?? "preview_ready";
      const stepIndex = resolution.hasPlacedProductsOnly ? 0 : 2 + safeIndex;

      if (activeStage !== "preview_ready" && isMobileEditor && !isMobileControlsOpen) {
        activeStep = {
          title: "Open Configuration Controls",
          description:
            "Tap Controls to see the configuration dropdowns: Placement, Design & Customization, Add-ons, Hardware, and Object Aware Occlusion.",
          helperNote: "Tap Controls or click Next to open the configuration drawer.",
          stepIndex,
          targetSelector: '[data-onboarding-target="workspace-mobile-controls"]',
          preferredPlacement: "top",
          primaryActionLabel: "Next",
          onPrimaryAction: onOpenMobileControls ?? onAdvanceConfigStage,
          blocking: true,
        };
      } else if (activeStage === "placement") {
        activeStep = {
          title: "Placement Controls",
          description: hasPerspectiveCorners
            ? "Click Placement to see Front (Exterior) or Back (Interior) facing after fitting, plus Turn Left / Right and Tilt Up / Down angles."
            : "Click Placement to see Turn Left / Right (yaw) and Tilt Up / Down (pitch) viewing angles.",
          helperNote: "Click the highlighted dropdown or Next to continue.",
          stepIndex,
          targetSelector: '[data-onboarding-target="workspace-accordion-placement"]',
          preferredPlacement: "left",
          primaryActionLabel: "Next",
          onPrimaryAction: onAdvanceConfigStage,
          blocking: true,
        };
      } else if (activeStage === "design") {
        activeStep = {
          title: "Design & Customization",
          description:
            "Click Design and Customization Option to see Aluminum Finish, Glass Type, Glass Color, Glass Thickness, Window Sill, and per-part materials.",
          helperNote: "Click the highlighted dropdown or Next to continue.",
          stepIndex,
          targetSelector: '[data-onboarding-target="workspace-accordion-design"]',
          preferredPlacement: "left",
          primaryActionLabel: "Next",
          onPrimaryAction: onAdvanceConfigStage,
          blocking: true,
        };
      } else if (activeStage === "addons") {
        activeStep = {
          title: "Add-on Options",
          description:
            "Click Add-on Options to see grilles, insect screens, transom or sidelight options, and mounting placement.",
          helperNote: "Click the highlighted dropdown or Next to continue.",
          stepIndex,
          targetSelector: '[data-onboarding-target="workspace-accordion-addons"]',
          preferredPlacement: "left",
          primaryActionLabel: "Next",
          onPrimaryAction: onAdvanceConfigStage,
          blocking: true,
        };
      } else if (activeStage === "hardware") {
        activeStep = {
          title: "Hardware & Accessories",
          description:
            "Click Hardware & Accessories to see locks, handles, rollers, hinges, and hardware styles for this product.",
          helperNote: "Click the highlighted dropdown or Next to continue.",
          stepIndex,
          targetSelector: '[data-onboarding-target="workspace-accordion-hardware"]',
          preferredPlacement: "left",
          primaryActionLabel: "Next",
          onPrimaryAction: onAdvanceConfigStage,
          blocking: true,
        };
      } else if (activeStage === "occlusion") {
        activeStep = {
          title: "Object Aware Occlusion",
          description:
            "Click Object Aware Occlusion to put your product behind detected foreground objects or outline columns and beams with Manual Occlusion Mask.",
          helperNote: "Click the highlighted dropdown or Next to highlight Apply Changes.",
          stepIndex,
          targetSelector: '[data-onboarding-target="workspace-accordion-occlusion"]',
          preferredPlacement: "left",
          primaryActionLabel: "Next",
          onPrimaryAction: onAdvanceConfigStage,
          blocking: true,
        };
      } else if (activeStage === "apply_changes") {
        activeStep = {
          title: "Apply Changes",
          description:
            "Click Apply Changes to lock in and preview your configured product composite (you can click Edit anytime afterwards to keep tweaking).",
          helperNote: "Click Apply Changes or Next to proceed to Continue to Comparison.",
          stepIndex,
          targetSelector: '[data-onboarding-target="workspace-apply-changes"]',
          preferredPlacement: "left",
          primaryActionLabel: "Next",
          onPrimaryAction: onAdvanceConfigStage,
          blocking: true,
        };
      } else {
        const description = resolution.hasPlacedProductsOnly
          ? "Your placed product is ready. Select a layer to edit it, add another product, or click Continue to Comparison."
          : isMobileEditor
            ? "Your preview is ready. Tap Controls anytime to adjust settings, or tap Done to exit and Continue to Comparison."
            : "Your preview is ready. Refine any section above anytime, or click Continue to Comparison when ready.";

        activeStep = {
          title: "Preview Ready",
          description,
          helperNote:
            hasPerspectiveCorners && !isMobileEditor
              ? "Visual fit previews placement and does not confirm physical quotation dimensions."
              : undefined,
          stepIndex,
          targetSelector: isMobileEditor
            ? '[data-onboarding-target="workspace-mobile-done"]'
            : '[data-onboarding-target="workspace-continue-comparison"]',
          preferredPlacement: "top",
          primaryActionLabel: "Got it",
          onPrimaryAction: handleCompleteTour,
          secondaryActionLabel:
            hasPerspectiveCorners && supportsPerspectivePlane ? "Edit Corners" : undefined,
          onSecondaryAction:
            hasPerspectiveCorners && supportsPerspectivePlane ? handleEditCorners : undefined,
          blocking: false,
        };
      }
    }
  }

  return (
    <OnboardingTourPopup
      isOpen={Boolean(activeStep)}
      title={activeStep?.title ?? ""}
      description={activeStep?.description ?? ""}
      helperNote={activeStep?.helperNote}
      stepIndex={activeStep?.stepIndex ?? 0}
      totalSteps={totalSteps}
      targetSelector={activeStep?.targetSelector}
      preferredPlacement={activeStep?.preferredPlacement ?? "auto"}
      primaryActionLabel={activeStep?.primaryActionLabel}
      onPrimaryAction={activeStep?.onPrimaryAction}
      secondaryActionLabel={activeStep?.secondaryActionLabel}
      onSecondaryAction={activeStep?.onSecondaryAction}
      onSkip={handleSkip}
      onDontShowAgain={handleDontShowAgain}
      variant={variant}
      blocking={activeStep?.blocking ?? false}
      isPaused={isPaused}
      zIndexBase={120}
      restoreFocusSelector='[data-onboarding-target="workspace-help-trigger"]'
    />
  );
}
