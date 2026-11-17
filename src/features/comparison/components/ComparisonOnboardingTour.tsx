"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { OnboardingTourPopup } from "@/components/shared/onboarding/OnboardingTourPopup";
import {
  completeComparisonGuidePreference,
  readComparisonGuidePreference,
  readComparisonGuideSession,
  writeComparisonGuidePreference,
  writeComparisonGuideSession,
} from "@/lib/onboarding/storage";
import type { GuidePreferenceStatus, OnboardingTourStep } from "@/lib/onboarding/types";
import { useTourViewportVariant } from "@/lib/onboarding/useTourViewportVariant";

const subscribeNoop = () => () => {};

export interface ComparisonTourStepInput {
  stepIndex: number;
  compareMode: "left" | "right";
  variantModeReady: boolean;
  comparisonOverlaysCount: number;
}

export function resolveComparisonTourStep(
  input: ComparisonTourStepInput,
): OnboardingTourStep {
  const { stepIndex, compareMode, variantModeReady, comparisonOverlaysCount } = input;

  if (stepIndex <= 0) {
    return {
      id: "comparison-modes",
      targetSelector: '[data-onboarding-target="comparison-mode-controls"]',
      title: "Choose View & Compare Modes",
      description:
        "Use View as to switch between Side-by-Side cards and an interactive Slider curtain. Use Compare mode to switch between Before and After (original room photo vs. installed result) and Product Variant (comparing two aluminum finishes).",
      preferredPlacement: "bottom",
      primaryActionLabel: "Next",
    };
  }

  if (stepIndex === 1) {
    const isVariantMode = compareMode === "right";
    const targetSelector =
      isVariantMode && variantModeReady
        ? '[data-onboarding-target="comparison-variant-panel"]'
        : '[data-onboarding-target="comparison-preview-stage"]';

    return {
      id: "comparison-finishes",
      targetSelector,
      title: "Compare Aluminum Finishes",
      description:
        "In Product Variant mode, select different finishes in Panel A (left) and Panel B (right), or use Swap to flip sides. A finish selected in one panel is disabled in the other so you always compare two distinct options.",
      helperNote:
        comparisonOverlaysCount > 1
          ? "Multiple fixtures placed: click a product directly in the preview or use the 'Choose a product to compare' buttons above to change which fixture is being edited."
          : undefined,
      preferredPlacement: isVariantMode ? "top" : "bottom",
      primaryActionLabel: "Next",
      secondaryActionLabel: !isVariantMode ? "Switch to Product Variant" : undefined,
    };
  }

  return {
    id: "comparison-proceed",
    targetSelector: '[data-onboarding-target="comparison-proceed-quotation"]',
    title: "Continue to Price Estimate",
    description:
      "When you are satisfied with your finish selection, click Proceed to Estimate Price to generate your composite snapshot and review the itemized quotation, or click Edit Placement to return to the 3D workspace.",
    preferredPlacement: "top",
    primaryActionLabel: "Got it",
  };
}

export interface ComparisonTourVisibilityInput {
  isHydrated: boolean;
  preferenceStatus: GuidePreferenceStatus;
  runSkipped: boolean;
  manualRunActive: boolean;
  isIncompleteVariationPromptActive: boolean;
  isPreparingQuotation: boolean;
  hasComparisonError: boolean;
}

export function shouldShowComparisonTour(
  input: ComparisonTourVisibilityInput,
): boolean {
  if (!input.isHydrated) return false;
  if (input.isIncompleteVariationPromptActive) return false;
  if (input.isPreparingQuotation) return false;
  if (input.hasComparisonError) return false;

  if (input.manualRunActive) return true;
  if (input.runSkipped) return false;
  return input.preferenceStatus === "unseen";
}

export interface ComparisonOnboardingTourProps {
  compareMode: "left" | "right";
  variantModeReady: boolean;
  comparisonOverlaysCount: number;
  variationSnapshotsCount: number;
  isPreparingQuotation: boolean;
  comparisonError: string | null;
  onSwitchToProductVariant: () => void;
  manualTriggerCount: number;
}

export function ComparisonOnboardingTour({
  compareMode,
  variantModeReady,
  comparisonOverlaysCount,
  variationSnapshotsCount,
  isPreparingQuotation,
  comparisonError,
  onSwitchToProductVariant,
  manualTriggerCount,
}: ComparisonOnboardingTourProps) {
  const isHydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const viewportVariant = useTourViewportVariant();

  const [preferenceStatus, setPreferenceStatus] = useState<GuidePreferenceStatus>(() =>
    readComparisonGuidePreference(),
  );
  const [runSkipped, setRunSkipped] = useState<boolean>(() =>
    readComparisonGuideSession().runSkipped,
  );
  const [manualRunActive, setManualRunActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [prevTriggerCount, setPrevTriggerCount] = useState(manualTriggerCount);

  if (manualTriggerCount !== prevTriggerCount) {
    setPrevTriggerCount(manualTriggerCount);
    if (manualTriggerCount > 0) {
      setStepIndex(0);
      setRunSkipped(false);
      writeComparisonGuideSession(false);
      setManualRunActive(true);
    }
  }

  const isIncompleteVariationPromptActive =
    compareMode === "right" &&
    comparisonOverlaysCount > 0 &&
    !variantModeReady &&
    variationSnapshotsCount === 0;

  const isOpen = shouldShowComparisonTour({
    isHydrated,
    preferenceStatus,
    runSkipped,
    manualRunActive,
    isIncompleteVariationPromptActive,
    isPreparingQuotation,
    hasComparisonError: comparisonError !== null,
  });

  const handleSkip = useCallback(() => {
    setManualRunActive(false);
    setRunSkipped(true);
    writeComparisonGuideSession(true);
  }, []);

  const handleDontShowAgain = useCallback(() => {
    setManualRunActive(false);
    setPreferenceStatus("dont_show_again");
    writeComparisonGuidePreference("dont_show_again");
  }, []);

  const handlePrimaryAction = useCallback(() => {
    if (stepIndex < 2) {
      setStepIndex((prev) => Math.min(2, prev + 1));
      return;
    }
    const nextStatus = completeComparisonGuidePreference();
    setPreferenceStatus(nextStatus);
    setManualRunActive(false);
  }, [stepIndex]);

  const step = resolveComparisonTourStep({
    stepIndex,
    compareMode,
    variantModeReady,
    comparisonOverlaysCount,
  });

  return (
    <OnboardingTourPopup
      isOpen={isOpen}
      title={step.title}
      description={step.description}
      helperNote={step.helperNote}
      stepIndex={stepIndex}
      totalSteps={3}
      targetSelector={step.targetSelector}
      preferredPlacement={step.preferredPlacement}
      primaryActionLabel={step.primaryActionLabel}
      onPrimaryAction={handlePrimaryAction}
      secondaryActionLabel={step.secondaryActionLabel}
      onSecondaryAction={
        step.secondaryActionLabel ? onSwitchToProductVariant : undefined
      }
      onSkip={handleSkip}
      onDontShowAgain={handleDontShowAgain}
      variant={viewportVariant}
      blocking={true}
      restoreFocusSelector='[data-onboarding-target="comparison-header-help"]'
    />
  );
}
