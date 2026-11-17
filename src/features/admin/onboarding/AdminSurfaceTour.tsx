"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { OnboardingTourPopup } from "@/components/shared/onboarding/OnboardingTourPopup";
import {
  markAdminSurfaceCompleted,
  markAdminSurfaceDontShowAgain,
  readAdminOnboardingPreference,
  readAdminOnboardingSession,
  setAdminSurfaceSessionSkipped,
} from "@/lib/onboarding/storage";
import type {
  AdminOnboardingPreferenceRecord,
  AdminOnboardingSessionRecord,
  AdminOnboardingSurfaceId,
  OnboardingTourStep,
} from "@/lib/onboarding/types";
import { useTourViewportVariant } from "@/lib/onboarding/useTourViewportVariant";

const subscribeNoop = () => () => {};

export interface AdminSurfaceTourProps {
  profileId: string;
  surfaceId: AdminOnboardingSurfaceId;
  steps: OnboardingTourStep[];
  /** When true, opens automatically if surface status is "unseen" and not skipped in session. */
  autoOpen: boolean;
  isPaused?: boolean;
  manualTriggerCount: number;
  restoreFocusSelector?: string;
}

export function AdminSurfaceTour({
  profileId,
  surfaceId,
  steps,
  autoOpen,
  isPaused = false,
  manualTriggerCount,
  restoreFocusSelector = '[data-onboarding-target="admin-header-help"]',
}: AdminSurfaceTourProps) {
  const isHydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const viewportVariant = useTourViewportVariant();

  const [preference, setPreference] = useState<AdminOnboardingPreferenceRecord>(() =>
    readAdminOnboardingPreference(profileId),
  );
  const [session, setSession] = useState<AdminOnboardingSessionRecord>(() =>
    readAdminOnboardingSession(profileId),
  );
  const [manualRunActive, setManualRunActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [prevProfileId, setPrevProfileId] = useState(profileId);
  const [prevTriggerCount, setPrevTriggerCount] = useState(manualTriggerCount);

  if (prevProfileId !== profileId) {
    setPrevProfileId(profileId);
    setPreference(readAdminOnboardingPreference(profileId));
    setSession(readAdminOnboardingSession(profileId));
  }

  if (manualTriggerCount !== prevTriggerCount) {
    setPrevTriggerCount(manualTriggerCount);
    if (manualTriggerCount > 0) {
      setStepIndex(0);
      const nextSession = setAdminSurfaceSessionSkipped(
        profileId,
        surfaceId,
        false,
      );
      setSession(nextSession);
      setManualRunActive(true);
    }
  }

  const surfaceStatus = preference.surfaces[surfaceId] ?? "unseen";
  const isSkipped = Boolean(session.skippedSurfaces[surfaceId]);

  const isOpen =
    isHydrated &&
    !isPaused &&
    steps.length > 0 &&
    (manualRunActive || (autoOpen && surfaceStatus === "unseen" && !isSkipped));

  const handleSkip = useCallback(() => {
    setManualRunActive(false);
    const nextSession = setAdminSurfaceSessionSkipped(
      profileId,
      surfaceId,
      true,
    );
    setSession(nextSession);
  }, [profileId, surfaceId]);

  const handleDontShowAgain = useCallback(() => {
    setManualRunActive(false);
    const nextPref = markAdminSurfaceDontShowAgain(profileId, surfaceId);
    setPreference(nextPref);
  }, [profileId, surfaceId]);

  const handlePrimaryAction = useCallback(() => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
      return;
    }
    const nextPref = markAdminSurfaceCompleted(profileId, surfaceId);
    setPreference(nextPref);
    setManualRunActive(false);
  }, [profileId, stepIndex, steps.length, surfaceId]);

  if (steps.length === 0) return null;

  const clampedIndex = Math.min(Math.max(0, stepIndex), steps.length - 1);
  const step = steps[clampedIndex];

  return (
    <OnboardingTourPopup
      isOpen={isOpen}
      title={step.title}
      description={step.description}
      helperNote={step.helperNote}
      stepIndex={clampedIndex}
      totalSteps={steps.length}
      targetSelector={step.targetSelector}
      preferredPlacement={step.preferredPlacement}
      primaryActionLabel={step.primaryActionLabel}
      onPrimaryAction={handlePrimaryAction}
      onSkip={handleSkip}
      onDontShowAgain={handleDontShowAgain}
      variant={viewportVariant}
      blocking={true}
      isPaused={isPaused}
      restoreFocusSelector={restoreFocusSelector}
    />
  );
}
