"use client";

import { useState, useSyncExternalStore } from "react";
import { OnboardingTourPopup } from "@/components/shared/onboarding/OnboardingTourPopup";
import {
  markAdminSurfaceDontShowAgain,
  markAdminWizardPhaseCompleted,
  readAdminOnboardingPreference,
  readAdminOnboardingSession,
  setAdminWizardPhaseSessionSkipped,
} from "@/lib/onboarding/storage";
import type {
  AdminOnboardingPreferenceRecord,
  AdminOnboardingSessionRecord,
  OnboardingTourStep,
  WizardPhaseGuideId,
} from "@/lib/onboarding/types";
import { useTourViewportVariant } from "@/lib/onboarding/useTourViewportVariant";
import type { StepKey } from "@/lib/admin/products/wizardSteps";

const subscribeNoop = () => () => {};

export type ProductRole = "standard" | "addon" | "accessory";

export interface ProductSetupPhaseInput {
  activeStep: StepKey;
  isDraft: boolean;
  productRole: ProductRole;
  modelStrategy: string | null;
  hasWholeModelAsset: boolean;
  mappedFilesCount: number;
  selectedPartsCount: number;
  isDecomposing: boolean;
  decompositionModalOpen: boolean;
  lightboxOpen: boolean;
  parametersTab: "parameters" | "rules" | "addons";
  validationTab: "dimensions" | "materials";
  validationLoading: boolean;
  validationHasError: boolean;
  validationHasDefinition: boolean;
}

export interface ResolvedWizardPhaseGuide {
  phaseId: WizardPhaseGuideId;
  isAutomaticPhase: boolean;
  isPaused: boolean;
  steps: OnboardingTourStep[];
  marksSurfaceCompletedOnFinish: boolean;
}

export function resolveProductSetupWizardPhase(
  input: ProductSetupPhaseInput,
): ResolvedWizardPhaseGuide | null {
  const {
    activeStep,
    isDraft,
    productRole,
    modelStrategy,
    hasWholeModelAsset,
    mappedFilesCount,
    selectedPartsCount,
    isDecomposing,
    decompositionModalOpen,
    lightboxOpen,
    parametersTab,
    validationTab,
    validationLoading,
    validationHasError,
    validationHasDefinition,
  } = input;

  if (activeStep === "basic") {
    return {
      phaseId: "basic",
      isAutomaticPhase: isDraft,
      isPaused: false,
      marksSurfaceCompletedOnFinish: false,
      steps: [
        {
          id: "setup-basic-role",
          targetSelector: '[data-onboarding-target="admin-setup-basic-role"]',
          title: "Select Product Role & Basic Details",
          description:
            "Choose Standard Fixture (7-step setup for windows, doors, cabinets, and enclosures), Add-on Accessory (5-step setup for insect screens and security grilles), or Hardware Accessory (4-step setup for handles, locks, hinges, and rollers). Newly saved products remain in Draft (Inactive) status until published in the final Review step.",
          preferredPlacement: "bottom",
          primaryActionLabel: "Got it",
        },
      ],
    };
  }

  if (activeStep === "strategy") {
    return {
      phaseId: "strategy",
      isAutomaticPhase: false,
      isPaused: false,
      marksSurfaceCompletedOnFinish: false,
      steps: [
        {
          id: "setup-strategy",
          targetSelector: '[data-onboarding-target="admin-setup-strategy-cards"]',
          title: "Choose Fixed vs. Parametric Construction",
          description:
            "Select Parametric when dimensions dynamically resize or repeat structural components (using profiles such as Frame + Panels, Sliding Leaf System, or Cabinet System), or Fixed when the product uses a static 3D model without part-level scaling rules.",
          preferredPlacement: "bottom",
          primaryActionLabel: "Got it",
        },
      ],
    };
  }

  if (activeStep === "assets") {
    return {
      phaseId: "assets",
      isAutomaticPhase: false,
      isPaused: lightboxOpen,
      marksSurfaceCompletedOnFinish: false,
      steps: [
        {
          id: "setup-assets",
          targetSelector: '[data-onboarding-target="admin-setup-catalog-assets"]',
          title: "Upload Storefront Images & Whole 3D Preview",
          description:
            "Upload 2D catalog images (JPG, PNG, or WebP up to 5 MB; mark one as Primary) and an optional assembled 3D preview model (.glb up to 25 MB). Any whole .glb uploaded here can be unpacked into individual structural parts in the next step.",
          preferredPlacement: "bottom",
          primaryActionLabel: "Got it",
        },
      ],
    };
  }

  if (activeStep === "components") {
    if (mappedFilesCount === 0) {
      return {
        phaseId: "components_intake",
        isAutomaticPhase: true,
        isPaused: isDecomposing || decompositionModalOpen,
        marksSurfaceCompletedOnFinish: false,
        steps: [
          {
            id: "setup-components-intake",
            targetSelector: hasWholeModelAsset
              ? '[data-onboarding-target="admin-setup-extract-whole-model"]'
              : '[data-onboarding-target="admin-setup-components-upload"]',
            title: "Ingest 3D Component Meshes",
            description: hasWholeModelAsset
              ? "A whole 3D model was uploaded in Catalog Assets. Click Extract Components from Whole Model to unpack its named sub-meshes automatically, or use the dropzone below to upload individual .glb part files."
              : "Choose Upload Individual Parts to drop separate .glb profile/glass meshes, or Decompose Whole Model to unpack an assembled .glb with named nodes into individual parts.",
            preferredPlacement: "bottom",
            primaryActionLabel: "Got it",
          },
        ],
      };
    }

    const isAccessory = productRole === "accessory";
    const inspectorDescription = isAccessory
      ? "For hardware accessories, choose the Accessory Category (Handle, Lock, Roller, Hinge, or Other) and specify whether the uploaded model is Right-Handed or Left-Handed so GlassFit can generate the mirrored bilateral counterpart automatically."
      : selectedPartsCount === 0
        ? "Select a part on the left to open its settings here. Once selected, you can bind catalog raw materials, set its scaling driver (WIDTH, HEIGHT, AREA, FIXED, or GRILLE_LINEAR), mark removable bottom sills, or configure swappable hardware accessory slots."
        : "Bind one or more Raw Materials from the catalog, verify the Dimension Binding (WIDTH, HEIGHT, AREA, FIXED, or GRILLE_LINEAR) and Span Ratio, and optionally mark bottom sills as Removable or designate a Swappable Accessory Slot.";

    return {
      phaseId: "components_inspector",
      isAutomaticPhase: true,
      isPaused: isDecomposing || decompositionModalOpen,
      marksSurfaceCompletedOnFinish: false,
      steps: [
        {
          id: "setup-components-viewport",
          targetSelector: '[data-onboarding-target="admin-setup-3d-viewport"]',
          title: "Select Parts in the 3D Viewport or List",
          description:
            "Click any mesh in the 3D viewport (or use the part list below; hold Shift for multi-select) to inspect it. Toggle between Assembled (Built) and Exploded (Separated) views to reach internal profiles.",
          preferredPlacement: "right",
          primaryActionLabel: "Next",
        },
        {
          id: "setup-components-inspector",
          targetSelector: isAccessory
            ? '[data-onboarding-target="admin-setup-accessory-handing"]'
            : '[data-onboarding-target="admin-setup-part-inspector"]',
          title: isAccessory
            ? "Configure Accessory Category & Handing"
            : "Bind Materials & Scaling Rules",
          description: inspectorDescription,
          preferredPlacement: "left",
          primaryActionLabel: "Next",
        },
        {
          id: "setup-components-save",
          targetSelector: '[data-onboarding-target="admin-setup-components-save"]',
          title: "Review Component Status & Save",
          description:
            "Check the BOM Estimation Status banner and component table to ensure all required parts are linked and saved before continuing.",
          preferredPlacement: "top",
          primaryActionLabel: "Got it",
        },
      ],
    };
  }

  if (activeStep === "parameters") {
    if (modelStrategy !== "Parametric") {
      return {
        phaseId: "parameters_dimensions",
        isAutomaticPhase: false,
        isPaused: false,
        marksSurfaceCompletedOnFinish: false,
        steps: [
          {
            id: "setup-parameters-fixed-guard",
            targetSelector:
              '[data-onboarding-target="admin-setup-parameters-fixed-guard"]',
            title: "Fixed Model Selected",
            description:
              "This product uses a Fixed 3D model without parametric scaling rules. Click Continue to 3D Validation to verify sizing and BOM output.",
            preferredPlacement: "bottom",
            primaryActionLabel: "Got it",
          },
        ],
      };
    }

    if (parametersTab === "rules") {
      return {
        phaseId: "parameters_rules",
        isAutomaticPhase: true,
        isPaused: false,
        marksSurfaceCompletedOnFinish: false,
        steps: [
          {
            id: "setup-parameters-rules",
            targetSelector: '[data-onboarding-target="admin-setup-rules-editor"]',
            title: "Configure Structural Logic Rules",
            description:
              "Enable Smart Dynamic Bay Replication for multi-bay fixtures or add WHEN ... THEN and FOR EVERY ... ADD structural rules that adjust component quantities as dimensions increase.",
            preferredPlacement: "bottom",
            primaryActionLabel: "Got it",
          },
        ],
      };
    }

    if (parametersTab === "addons") {
      return {
        phaseId: "parameters_addons",
        isAutomaticPhase: true,
        isPaused: false,
        marksSurfaceCompletedOnFinish: false,
        steps: [
          {
            id: "setup-parameters-addons",
            targetSelector:
              '[data-onboarding-target="admin-setup-addon-inheritance"]',
            title: "Bind Compatible Add-ons & Operator Alignment",
            description:
              "Bind compatible Insect Screen and Security Grille catalog add-ons, choose allowed mounting sides (Exterior (Front), Interior (Back), or Both), and select operator alignment targets.",
            helperNote:
              "Operator access hatches and handle clearance cutouts activate exclusively when an add-on is mounted on the Interior (Back) face; they are automatically suppressed for Exterior mounting.",
            preferredPlacement: "bottom",
            primaryActionLabel: "Got it",
          },
        ],
      };
    }

    return {
      phaseId: "parameters_dimensions",
      isAutomaticPhase: true,
      isPaused: false,
      marksSurfaceCompletedOnFinish: false,
      steps: [
        {
          id: "setup-parameters-list",
          targetSelector: '[data-onboarding-target="admin-setup-parameters-list"]',
          title: "Define Parametric Dimensions",
          description:
            "Define minimum and default millimeter dimensions (such as Width and Height). Width and Height remain open-ended (No Max) so large openings can be evaluated by structural rules.",
          preferredPlacement: "bottom",
          primaryActionLabel: "Next",
        },
        {
          id: "setup-parameters-tabs",
          targetSelector: '[data-onboarding-target="admin-setup-parameters-tabs"]',
          title: "Switch to Logic Rules or Compatible Add-ons",
          description:
            "Switch to Logic Rules to configure threshold or step-loop mullion/panel rules and Smart Dynamic Bay Replication, or open Compatible Add-ons to bind insect screens, security grilles, and interior operator alignment targets.",
          preferredPlacement: "bottom",
          primaryActionLabel: "Got it",
        },
      ],
    };
  }

  if (activeStep === "validation") {
    const isPaused =
      validationLoading || validationHasError || !validationHasDefinition;

    if (validationTab === "materials") {
      return {
        phaseId: "validation_materials",
        isAutomaticPhase: false,
        isPaused,
        marksSurfaceCompletedOnFinish: false,
        steps: [
          {
            id: "setup-validation-materials",
            targetSelector:
              '[data-onboarding-target="admin-setup-validation-materials-sandbox"]',
            title: "Test Inline Material Overrides",
            description:
              "Preview how different framing finishes and per-component raw material overrides affect both the 3D model appearance and the Material Sensitivity price delta below.",
            preferredPlacement: "left",
            primaryActionLabel: "Got it",
          },
        ],
      };
    }

    return {
      phaseId: "validation_sandbox",
      isAutomaticPhase: true,
      isPaused,
      marksSurfaceCompletedOnFinish: true,
      steps: [
        {
          id: "setup-validation-sliders",
          targetSelector:
            '[data-onboarding-target="admin-setup-validation-sliders"]',
          title: "Test-Drive Live 3D Scaling & Attachments",
          description:
            "Drag the Width and Height sliders, toggle removable sills, or test bound add-ons and hardware handings to verify that the 3D assembly scales cleanly across its size envelope.",
          preferredPlacement: "left",
          primaryActionLabel: "Next",
        },
        {
          id: "setup-validation-bom",
          targetSelector: '[data-onboarding-target="admin-setup-validation-bom"]',
          title: "Verify Real-Time BOM & Pre-Activation Gate",
          description:
            "Inspect live aluminum extrusion meters, glazing area, hardware/consumables, fabrication labor, and final quotation totals. You can also switch to the Materials tab to test alternative finish overrides inline. Once the Ready for Activation check passes, click Confirm & Proceed to Review.",
          preferredPlacement: "left",
          primaryActionLabel: "Got it",
        },
      ],
    };
  }

  if (activeStep === "review") {
    return {
      phaseId: "review",
      isAutomaticPhase: false,
      isPaused: false,
      marksSurfaceCompletedOnFinish: false,
      steps: [
        {
          id: "setup-review-publish",
          targetSelector: '[data-onboarding-target="admin-setup-review-publish"]',
          title: "Final Readiness Check & Storefront Activation",
          description:
            "Review the configuration summary and verify that no unassigned-material or missing-parameter blockers remain. Clicking Activate Product changes the product status from Draft (Inactive) to Active in the storefront catalog.",
          preferredPlacement: "top",
          primaryActionLabel: "Got it",
        },
      ],
    };
  }

  return null;
}

export function shouldShowWizardPhaseTour(options: {
  isHydrated: boolean;
  resolvedPhase: ResolvedWizardPhaseGuide | null;
  preference: AdminOnboardingPreferenceRecord;
  session: AdminOnboardingSessionRecord;
  manualRunPhaseId: WizardPhaseGuideId | null;
}): boolean {
  const { isHydrated, resolvedPhase, preference, session, manualRunPhaseId } =
    options;
  if (!isHydrated || !resolvedPhase || resolvedPhase.isPaused) {
    return false;
  }

  if (manualRunPhaseId === resolvedPhase.phaseId) {
    return true;
  }

  if (!resolvedPhase.isAutomaticPhase) {
    return false;
  }

  const surfaceStatus = preference.surfaces.product_setup ?? "unseen";
  if (surfaceStatus === "dont_show_again") {
    return false;
  }

  const phaseStatus = preference.wizardPhases[resolvedPhase.phaseId] ?? "unseen";
  if (phaseStatus === "completed") {
    return false;
  }

  if (session.skippedWizardPhases[resolvedPhase.phaseId]) {
    return false;
  }

  return true;
}

export interface ProductSetupOnboardingTourProps extends ProductSetupPhaseInput {
  profileId: string;
  manualTriggerCount: number;
}

export function ProductSetupOnboardingTour({
  profileId,
  manualTriggerCount,
  ...phaseInput
}: ProductSetupOnboardingTourProps) {
  const isHydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const viewportVariant = useTourViewportVariant();

  const [preference, setPreference] = useState<AdminOnboardingPreferenceRecord>(() =>
    readAdminOnboardingPreference(profileId),
  );
  const [session, setSession] = useState<AdminOnboardingSessionRecord>(() =>
    readAdminOnboardingSession(profileId),
  );
  const [manualRunPhaseId, setManualRunPhaseId] =
    useState<WizardPhaseGuideId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [prevProfileId, setPrevProfileId] = useState(profileId);
  const [prevActivePhaseId, setPrevActivePhaseId] =
    useState<WizardPhaseGuideId | null>(null);
  const [prevTriggerCount, setPrevTriggerCount] = useState(manualTriggerCount);

  const resolvedPhase = resolveProductSetupWizardPhase(phaseInput);
  const activePhaseId = resolvedPhase?.phaseId ?? null;

  if (prevProfileId !== profileId) {
    setPrevProfileId(profileId);
    setPreference(readAdminOnboardingPreference(profileId));
    setSession(readAdminOnboardingSession(profileId));
  }

  if (prevActivePhaseId !== activePhaseId) {
    setPrevActivePhaseId(activePhaseId);
    setStepIndex(0);
    setManualRunPhaseId(null);
  }

  if (manualTriggerCount !== prevTriggerCount) {
    setPrevTriggerCount(manualTriggerCount);
    if (manualTriggerCount > 0 && activePhaseId) {
      setStepIndex(0);
      const nextSession = setAdminWizardPhaseSessionSkipped(
        profileId,
        activePhaseId,
        false,
      );
      setSession(nextSession);
      setManualRunPhaseId(activePhaseId);
    }
  }

  const isOpen = shouldShowWizardPhaseTour({
    isHydrated,
    resolvedPhase,
    preference,
    session,
    manualRunPhaseId,
  });

  const handleSkip = () => {
    if (!activePhaseId) return;
    setManualRunPhaseId(null);
    const nextSession = setAdminWizardPhaseSessionSkipped(
      profileId,
      activePhaseId,
      true,
    );
    setSession(nextSession);
  };

  const handleDontShowAgain = () => {
    setManualRunPhaseId(null);
    const nextPref = markAdminSurfaceDontShowAgain(profileId, "product_setup");
    setPreference(nextPref);
  };

  const handlePrimaryAction = () => {
    if (!resolvedPhase) return;
    if (stepIndex < resolvedPhase.steps.length - 1) {
      setStepIndex((prev) => Math.min(resolvedPhase.steps.length - 1, prev + 1));
      return;
    }
    const nextPref = markAdminWizardPhaseCompleted(
      profileId,
      resolvedPhase.phaseId,
      resolvedPhase.marksSurfaceCompletedOnFinish,
    );
    setPreference(nextPref);
    setManualRunPhaseId(null);
  };

  if (!resolvedPhase) return null;

  const clampedStepIndex = Math.min(
    Math.max(0, stepIndex),
    resolvedPhase.steps.length - 1,
  );
  const step = resolvedPhase.steps[clampedStepIndex];

  return (
    <OnboardingTourPopup
      isOpen={isOpen}
      title={step.title}
      description={step.description}
      helperNote={step.helperNote}
      stepIndex={clampedStepIndex}
      totalSteps={resolvedPhase.steps.length}
      targetSelector={step.targetSelector}
      preferredPlacement={step.preferredPlacement}
      primaryActionLabel={step.primaryActionLabel}
      onPrimaryAction={handlePrimaryAction}
      onSkip={handleSkip}
      onDontShowAgain={handleDontShowAgain}
      variant={viewportVariant}
      blocking={true}
      restoreFocusSelector='[data-onboarding-target="admin-header-help"]'
    />
  );
}
