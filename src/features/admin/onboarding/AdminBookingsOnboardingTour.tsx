"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { OnboardingTourPopup } from "@/components/shared/onboarding/OnboardingTourPopup";
import {
  markAdminBookingsPhaseCompleted,
  markAdminSurfaceDontShowAgain,
  readAdminOnboardingPreference,
  readAdminOnboardingSession,
  setAdminBookingsPhaseSessionSkipped,
} from "@/lib/onboarding/storage";
import type {
  AdminOnboardingPreferenceRecord,
  AdminOnboardingSessionRecord,
  BookingsSubGuideId,
} from "@/lib/onboarding/types";
import { useTourViewportVariant } from "@/lib/onboarding/useTourViewportVariant";
import {
  resolveBookingsInspectorSteps,
  resolveBookingsQueueSteps,
} from "./adminTourConfigs";

const subscribeNoop = () => () => {};

export interface BookingsTourStateInput {
  isHydrated: boolean;
  loadError: string | null;
  filteredBookingsCount: number;
  hasSelectedBooking: boolean;
  isPaused: boolean;
  preference: AdminOnboardingPreferenceRecord;
  session: AdminOnboardingSessionRecord;
  manualPhase: BookingsSubGuideId | null;
}

export function resolveBookingsActiveSubGuide(
  input: BookingsTourStateInput,
): BookingsSubGuideId | null {
  if (!input.isHydrated || input.loadError !== null || input.isPaused) {
    return null;
  }

  if (input.manualPhase) {
    if (input.manualPhase === "inspector_negotiation" && !input.hasSelectedBooking) {
      return "queue_orientation";
    }
    return input.manualPhase;
  }

  if (input.preference.surfaces.bookings === "dont_show_again") {
    return null;
  }

  const queueDone = input.preference.bookingsPhases.queue_orientation === "completed";
  const queueSkipped = Boolean(input.session.skippedBookingsPhases.queue_orientation);

  if (!queueDone && !queueSkipped) {
    return "queue_orientation";
  }

  const inspectorDone =
    input.preference.bookingsPhases.inspector_negotiation === "completed";
  const inspectorSkipped = Boolean(
    input.session.skippedBookingsPhases.inspector_negotiation,
  );

  if (input.hasSelectedBooking && !inspectorDone && !inspectorSkipped) {
    return "inspector_negotiation";
  }

  return null;
}

export interface AdminBookingsOnboardingTourProps {
  profileId: string;
  loadError: string | null;
  filteredBookingsCount: number;
  hasSelectedBooking: boolean;
  supportsItemNegotiation: boolean;
  isPaused: boolean;
  manualTriggerCount: number;
}

export function AdminBookingsOnboardingTour({
  profileId,
  loadError,
  filteredBookingsCount,
  hasSelectedBooking,
  supportsItemNegotiation,
  isPaused,
  manualTriggerCount,
}: AdminBookingsOnboardingTourProps) {
  const isHydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const viewportVariant = useTourViewportVariant();

  const [preference, setPreference] = useState<AdminOnboardingPreferenceRecord>(() =>
    readAdminOnboardingPreference(profileId),
  );
  const [session, setSession] = useState<AdminOnboardingSessionRecord>(() =>
    readAdminOnboardingSession(profileId),
  );
  const [manualPhase, setManualPhase] = useState<BookingsSubGuideId | null>(null);
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
      let nextSession = setAdminBookingsPhaseSessionSkipped(
        profileId,
        "queue_orientation",
        false,
      );
      nextSession = setAdminBookingsPhaseSessionSkipped(
        profileId,
        "inspector_negotiation",
        false,
      );
      setSession(nextSession);
      setManualPhase("queue_orientation");
    }
  }

  const activePhase = resolveBookingsActiveSubGuide({
    isHydrated,
    loadError,
    filteredBookingsCount,
    hasSelectedBooking,
    isPaused,
    preference,
    session,
    manualPhase,
  });

  const steps =
    activePhase === "inspector_negotiation"
      ? resolveBookingsInspectorSteps(supportsItemNegotiation)
      : resolveBookingsQueueSteps({
          filteredBookingsCount,
          hasSelectedBooking,
        });

  const handleSkip = useCallback(() => {
    if (!activePhase) return;
    setManualPhase(null);
    const nextSession = setAdminBookingsPhaseSessionSkipped(
      profileId,
      activePhase,
      true,
    );
    setSession(nextSession);
  }, [activePhase, profileId]);

  const handleDontShowAgain = useCallback(() => {
    setManualPhase(null);
    const nextPref = markAdminSurfaceDontShowAgain(profileId, "bookings");
    setPreference(nextPref);
  }, [profileId]);

  const handlePrimaryAction = useCallback(() => {
    if (!activePhase) return;

    if (stepIndex < steps.length - 1) {
      setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
      return;
    }

    if (activePhase === "queue_orientation") {
      const nextPref = markAdminBookingsPhaseCompleted(
        profileId,
        "queue_orientation",
        false,
      );
      setPreference(nextPref);

      if (filteredBookingsCount > 0 && hasSelectedBooking) {
        setStepIndex(0);
        if (manualPhase === "queue_orientation") {
          setManualPhase("inspector_negotiation");
        }
      } else {
        setManualPhase(null);
      }
      return;
    }

    const nextPref = markAdminBookingsPhaseCompleted(
      profileId,
      "inspector_negotiation",
      true,
    );
    setPreference(nextPref);
    setManualPhase(null);
  }, [
    activePhase,
    filteredBookingsCount,
    hasSelectedBooking,
    manualPhase,
    profileId,
    stepIndex,
    steps.length,
  ]);

  if (!activePhase || steps.length === 0) return null;

  const clampedIndex = Math.min(Math.max(0, stepIndex), steps.length - 1);
  const step = steps[clampedIndex];
  const displayStepIndex =
    activePhase === "inspector_negotiation" ? clampedIndex + 2 : clampedIndex;
  const displayTotalSteps =
    filteredBookingsCount > 0 && hasSelectedBooking ? 4 : 2;

  return (
    <OnboardingTourPopup
      isOpen={true}
      title={step.title}
      description={step.description}
      stepIndex={displayStepIndex}
      totalSteps={displayTotalSteps}
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
