/**
 * IMP-MS89 Work Packages 2 through 5 & QAD-TC104.1 through QAD-TC104.14:
 * Next-action resolver, preference/progress storage, route handoff,
 * overlay UUID alias continuity, stale acknowledgement guards, and UI contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PaperDetectionConfirmationModal } from "../../src/features/visualization/components/PaperDetectionConfirmationModal";
import {
  acquireDocumentLock,
  acquireHtmlLock,
  releaseDocumentLock,
  releaseHtmlLock,
} from "../../src/features/visualization/hooks/useDocumentScrollLock";
import {
  computeAnchoredLayout,
  hasScrollableContainerWithin,
} from "../../src/features/visualization/onboarding/OnboardingTourPopup";
import { getWorkspaceConfigStages } from "../../src/features/visualization/onboarding/WorkspaceOnboardingTour";
import { resolveNextGuideAction } from "../../src/features/visualization/onboarding/resolver";
import {
  clearGuideProgress,
  completeGuidePreference,
  createEmptyGuideProgressRecord,
  GUIDE_PREFERENCE_STORAGE_KEY,
  GUIDE_PROGRESS_STORAGE_KEY,
  parseGuidePreferenceRecord,
  parseGuideProgressRecord,
  readGuidePreference,
  readGuideProgress,
  resetInMemoryPreferenceFallbackForTests,
  writeGuidePreference,
  writeGuideProgress,
  type StorageLike,
} from "../../src/features/visualization/onboarding/storage";
import {
  acceptFreePlacementState,
  acknowledgeActionAttempt,
  activateOverlayForEditing,
  adoptOrEnsureActiveProductInstance,
  beginActionAttempt,
  cancelActionAttempt,
  completeWorkspaceTourState,
  createInitialGuideRuntimeState,
  duplicateActiveProductInstance,
  markPaperTourCompletedForRunState,
  optOutDontShowAgainState,
  registerOverlayAlias,
  removeActiveProductState,
  removePlacedOverlayReference,
  replaceProductInstance,
  requestManualPlacementState,
  reserveFirstProductHandoff,
  resetGuideForNewImage,
  restartGuideManuallyState,
  skipCurrentRunState,
  syncImageIdentity,
} from "../../src/features/visualization/onboarding/store";
import { resolveWorkspaceProductCapabilities } from "../../src/lib/visualization/workspaceCapabilities";
import { createPreparedSpaceImageState, initialState, serializeVisualizationSession } from "../../src/lib/visualization/visualizationSession";
import { skipPaperReference } from "../../src/lib/visualization/paperReference";
import type { SpaceImageSession } from "../../src/lib/imageApi";
import type { ProductStructuralDefinition } from "../../src/lib/visualization/types";
import type { GuideResolverInput } from "../../src/features/visualization/onboarding/types";

function makeDefinition(productType: "Window" | "Cabinet", productId = "prod-1"): ProductStructuralDefinition {
  return {
    product: {
      productId,
      productName: productType === "Cabinet" ? "Door Cabinet" : "Sliding Window",
      productType,
    },
    template: {
      templateId: "tpl-1",
      templateName: "Tpl",
      modelStrategy: "Parametric",
      measurementUnit: "mm",
      baseConfiguration: {},
    },
    parameters: [],
    components: [],
    rules: [],
  };
}

function makeSpaceSession(sessionId: string, mode: "auto_detect" | "paper_fiducial"): SpaceImageSession {
  return {
    sessionId,
    originalFileName: "room.jpg",
    workspaceImage: { url: "https://example.com/room.jpg", width: 1200, height: 900 },
    brightness: { mean_pixel_intensity: 128, category: "normal" },
    lighting: {
      mean_rgb: [128, 128, 128],
      ambient_rgb: [128, 128, 128],
      ambient_hex: "#808080",
      contrast: 1,
      saturation: 1,
      warmth: 0,
      tint: 0,
      temperature: "neutral",
      sharpness: 1,
      noise: 0,
      light_direction: { x: 0, y: 1 },
      suggested: {
        brightness: 1,
        contrast: 1,
        saturation: 1,
        color_mix: 0,
        blur_px: 0,
        grain: 0,
        shadow_opacity: 0.3,
      },
    },
    objects: [],
    segmentation: { mode: "none", model: null },
    warnings: [],
    calibrationMeta: {
      mode,
      paperStandard: mode === "paper_fiducial" ? "a4" : null,
      status: mode === "paper_fiducial" ? "manual_pin_required" : "heuristic_fallback",
      confidence: 0,
      homographyMatrix: null,
      detectedCorners: null,
      user_verified: false,
    },
  };
}

function makeMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: (key) => { map.delete(key); },
  };
}

function makeThrowingStorage(): StorageLike {
  return {
    getItem: () => { throw new Error("Storage denied"); },
    setItem: () => { throw new Error("Storage denied"); },
    removeItem: () => { throw new Error("Storage denied"); },
  };
}

function baseResolverInput(overrides: Partial<GuideResolverInput> = {}): GuideResolverInput {
  return {
    isSessionHydrated: true,
    hasValidImage: true,
    imageId: "img-1",
    calibrationMode: "auto_detect",
    isUploadingOrAnalyzing: false,
    isModelLoading: false,
    hasError: false,
    activeBlockingModal: "none",
    isComparisonPreparing: false,
    activeProduct: null,
    placedProductCount: 0,
    preferenceStatus: "unseen",
    runSkipped: false,
    comparisonSuspended: false,
    manualRunActive: false,
    paperTourCompletedForRun: false,
    instanceProgress: null,
    ...overrides,
  };
}

describe("QAD-TC104.1 / QAD-TC104.3 eight entry, mode, and capability paths", () => {
  const fitCapabilities = resolveWorkspaceProductCapabilities({
    structuralDefinition: makeDefinition("Window", "win-1"),
  });
  const cabinetCapabilities = resolveWorkspaceProductCapabilities({
    structuralDefinition: makeDefinition("Cabinet", "cab-1"),
  });

  it("resolves all eight entry/mode/capability sequences cleanly", () => {
    const matrix: Array<{
      name: string;
      mode: "auto_detect" | "paper_fiducial";
      entry: "photo_first" | "product_first";
      fit: boolean;
      expectedWorkspaceStep: "fit_opening" | "free_placement";
    }> = [
      { name: "Photo-first + Auto + Fit", mode: "auto_detect", entry: "photo_first", fit: true, expectedWorkspaceStep: "fit_opening" },
      { name: "Photo-first + Auto + Free", mode: "auto_detect", entry: "photo_first", fit: false, expectedWorkspaceStep: "free_placement" },
      { name: "Photo-first + Paper + Fit", mode: "paper_fiducial", entry: "photo_first", fit: true, expectedWorkspaceStep: "fit_opening" },
      { name: "Photo-first + Paper + Free", mode: "paper_fiducial", entry: "photo_first", fit: false, expectedWorkspaceStep: "free_placement" },
      { name: "Product-first + Auto + Fit", mode: "auto_detect", entry: "product_first", fit: true, expectedWorkspaceStep: "fit_opening" },
      { name: "Product-first + Auto + Free", mode: "auto_detect", entry: "product_first", fit: false, expectedWorkspaceStep: "free_placement" },
      { name: "Product-first + Paper + Fit", mode: "paper_fiducial", entry: "product_first", fit: true, expectedWorkspaceStep: "fit_opening" },
      { name: "Product-first + Paper + Free", mode: "paper_fiducial", entry: "product_first", fit: false, expectedWorkspaceStep: "free_placement" },
    ];

    for (const row of matrix) {
      // Pre-upload
      const preUpload = resolveNextGuideAction(
        baseResolverInput({
          hasValidImage: false,
          imageId: null,
          calibrationMode: row.mode,
        }),
      );
      assert.equal(preUpload.shouldShowPopupTour, false, `${row.name}: no pre-upload popup`);
      assert.equal(
        preUpload.task,
        row.mode === "paper_fiducial" ? "paper_preparation" : "paused",
      );

      // Post-upload paper review vs automatic mode
      const reviewModal = resolveNextGuideAction(
        baseResolverInput({
          calibrationMode: row.mode,
          activeBlockingModal: row.mode === "paper_fiducial" ? "paper_review" : "image_success",
        }),
      );
      assert.equal(reviewModal.shouldShowPaperTour, row.mode === "paper_fiducial");
      assert.equal(reviewModal.shouldShowPopupTour, false);

      // Photo-first empty workspace -> Add Product
      if (row.entry === "photo_first") {
        const emptyRes = resolveNextGuideAction(
          baseResolverInput({
            calibrationMode: row.mode,
            paperTourCompletedForRun: row.mode === "paper_fiducial",
          }),
        );
        assert.equal(emptyRes.task, "add_product", row.name);
        assert.equal(emptyRes.shouldShowPopupTour, true);
      }

      // Product ready -> Fit or Free Place
      const placementRes = resolveNextGuideAction(
        baseResolverInput({
          calibrationMode: row.mode,
          paperTourCompletedForRun: row.mode === "paper_fiducial",
          activeProduct: {
            productId: row.fit ? "win-1" : "cab-1",
            guideInstanceId: "inst-1",
            isReady: true,
            capabilities: row.fit ? fitCapabilities : cabinetCapabilities,
            hasFittedCorners: false,
          },
        }),
      );
      assert.equal(placementRes.task, row.expectedWorkspaceStep, row.name);
      assert.equal(placementRes.shouldShowPopupTour, true);
    }
  });

  it("never shows paper review in automatic mode and keeps paper skip approximate", () => {
    const autoPaperAttempt = resolveNextGuideAction(
      baseResolverInput({
        calibrationMode: "auto_detect",
        activeBlockingModal: "paper_review",
      }),
    );
    assert.equal(autoPaperAttempt.shouldShowPaperTour, false);

    const skipped = skipPaperReference(makeSpaceSession("img-paper", "paper_fiducial"));
    assert.equal(skipped.calibrationMeta?.mode, "paper_fiducial");
    assert.equal(skipped.calibrationMeta?.user_verified, false);
    assert.equal(skipped.calibrationMeta?.status, "heuristic_fallback");
  });
});

describe("QAD-TC104.5 / QAD-TC104.6 / QAD-TC104.7 / QAD-TC104.8 transitions & pauses", () => {
  const fitCapabilities = resolveWorkspaceProductCapabilities({
    structuralDefinition: makeDefinition("Window", "win-1"),
  });

  it("pauses for hydration, upload, model build, error, modal ownership, and comparison prep", () => {
    const pauseCases: Array<[string, Partial<GuideResolverInput>, string]> = [
      ["hydrating", { isSessionHydrated: false }, "hydrating"],
      ["uploading", { isUploadingOrAnalyzing: true }, "uploading"],
      ["error", { hasError: true }, "error"],
      ["comparison", { isComparisonPreparing: true }, "comparison_preparing"],
      ["add modal", { activeBlockingModal: "add_product" }, "modal_open"],
      ["fit modal", { activeBlockingModal: "perspective_picker" }, "modal_open"],
      ["measurement modal", { activeBlockingModal: "measurement" }, "modal_open"],
      ["guardrail modal", { activeBlockingModal: "guardrail" }, "modal_open"],
      [
        "model loading",
        {
          isModelLoading: true,
          activeProduct: {
            productId: "win-1",
            guideInstanceId: "inst-1",
            isReady: false,
            capabilities: fitCapabilities,
            hasFittedCorners: false,
          },
        },
        "model_loading",
      ],
    ];

    for (const [label, overrides, expectedReason] of pauseCases) {
      const res = resolveNextGuideAction(baseResolverInput(overrides));
      assert.equal(res.task, "paused", label);
      assert.equal(res.pauseReason, expectedReason, label);
      assert.equal(res.shouldShowPopupTour, false, label);
    }
  });

  it("guards async acknowledgements against cancellation, image reset, generation change, and product switch", () => {
    let state = createInitialGuideRuntimeState({
      storedPreference: "unseen",
      storedProgress: null,
      sessionImageId: "img-1",
    });
    state = adoptOrEnsureActiveProductInstance(state, {
      imageId: "img-1",
      productId: "win-1",
      activeOverlayId: "active-win-1",
    });
    const inst1 = state.progress.activeGuideInstanceId!;

    // Cancel attempt -> stale acknowledgement rejected
    const { state: sWithAttempt, attempt: cancelledAttempt } = beginActionAttempt(state, "fit_opening", inst1);
    const sAfterCancel = cancelActionAttempt(sWithAttempt, cancelledAttempt!.attemptId);
    assert.equal(acknowledgeActionAttempt(sAfterCancel, cancelledAttempt).accepted, false);

    // Image reset (even reusing same imageId) bumps guideGeneration -> stale rejected
    const { state: sWithAttempt2, attempt: oldGenAttempt } = beginActionAttempt(sAfterCancel, "fit_opening", inst1);
    const sReset = resetGuideForNewImage(sWithAttempt2, "img-1");
    assert.equal(sReset.progress.guideGeneration, 2);
    assert.equal(acknowledgeActionAttempt(sReset, oldGenAttempt).accepted, false);

    // Replace product -> old instance retired -> stale rejected
    const s2 = adoptOrEnsureActiveProductInstance(sReset, {
      imageId: "img-1",
      productId: "win-1",
      activeOverlayId: "active-win-1",
    });
    const instA = s2.progress.activeGuideInstanceId!;
    const { state: sPendingFit, attempt: fitAttempt } = beginActionAttempt(s2, "fit_opening", instA);
    const replaced = replaceProductInstance(sPendingFit, instA, "win-2", "active-win-2");
    assert.equal(acknowledgeActionAttempt(replaced.state, fitAttempt).accepted, false);

    // Valid acknowledgement succeeds and advances fitCompleted
    const validFit = beginActionAttempt(replaced.state, "fit_opening", replaced.guideInstanceId);
    const acked = acknowledgeActionAttempt(validFit.state, validFit.attempt);
    assert.equal(acked.accepted, true);
    assert.equal(acked.state.progress.instances[replaced.guideInstanceId]?.fitCompleted, true);
  });

  it("supports Place manually without altering geometry and Next -> Got it completion", () => {
    let state = createInitialGuideRuntimeState({
      storedPreference: "unseen",
      storedProgress: null,
      sessionImageId: "img-1",
    });
    state = adoptOrEnsureActiveProductInstance(state, {
      imageId: "img-1",
      productId: "win-1",
      activeOverlayId: "active-win-1",
    });
    const instId = state.progress.activeGuideInstanceId!;

    state = requestManualPlacementState(state, instId);
    const freeStep = resolveNextGuideAction(
      baseResolverInput({
        activeProduct: {
          productId: "win-1",
          guideInstanceId: instId,
          isReady: true,
          capabilities: fitCapabilities,
          hasFittedCorners: false,
        },
        instanceProgress: state.progress.instances[instId],
      }),
    );
    assert.equal(freeStep.task, "free_placement");

    state = acceptFreePlacementState(state, instId);
    const previewStep = resolveNextGuideAction(
      baseResolverInput({
        activeProduct: {
          productId: "win-1",
          guideInstanceId: instId,
          isReady: true,
          capabilities: fitCapabilities,
          hasFittedCorners: false,
        },
        instanceProgress: state.progress.instances[instId],
      }),
    );
    assert.equal(previewStep.task, "preview_ready");

    state = completeWorkspaceTourState(state);
    assert.equal(state.preferenceStatus, "completed");
    const afterComplete = resolveNextGuideAction(
      baseResolverInput({
        preferenceStatus: state.preferenceStatus,
        activeProduct: {
          productId: "win-1",
          guideInstanceId: instId,
          isReady: true,
          capabilities: fitCapabilities,
          hasFittedCorners: false,
        },
        instanceProgress: state.progress.instances[instId],
      }),
    );
    assert.equal(afterComplete.task, "dismissed");
    assert.equal(afterComplete.shouldShowPopupTour, false);
  });

  it("preserves restored fitted placement on guide entry and manual Help restart", () => {
    let state = createInitialGuideRuntimeState({
      storedPreference: "completed",
      storedProgress: null,
      sessionImageId: "img-1",
    });
    state = adoptOrEnsureActiveProductInstance(state, {
      imageId: "img-1",
      productId: "win-1",
      activeOverlayId: "active-win-1",
    });
    const instId = state.progress.activeGuideInstanceId!;

    // Completed user gets no automatic popup
    assert.equal(
      resolveNextGuideAction(
        baseResolverInput({
          preferenceStatus: state.preferenceStatus,
          activeProduct: {
            productId: "win-1",
            guideInstanceId: instId,
            isReady: true,
            capabilities: fitCapabilities,
            hasFittedCorners: true,
          },
          instanceProgress: state.progress.instances[instId],
        }),
      ).shouldShowPopupTour,
      false,
    );

    // Manual Help starts at preview_ready for fitted product without clearing preferenceStatus
    state = restartGuideManuallyState(state);
    assert.equal(state.preferenceStatus, "completed");
    const restarted = resolveNextGuideAction(
      baseResolverInput({
        preferenceStatus: state.preferenceStatus,
        manualRunActive: state.manualRunActive,
        activeProduct: {
          productId: "win-1",
          guideInstanceId: instId,
          isReady: true,
          capabilities: fitCapabilities,
          hasFittedCorners: true,
        },
        instanceProgress: state.progress.instances[instId],
      }),
    );
    assert.equal(restarted.task, "preview_ready");
    assert.equal(restarted.shouldShowPopupTour, true);
  });
});

describe("QAD-TC104.9 / QAD-TC104.10 route handoff, assetSessionId stability, and overlay UUID aliases", () => {
  it("preserves image and guide instance continuity across direct-to-product assetSessionId change", () => {
    const directSession = makeSpaceSession("stable-img-uuid", "paper_fiducial");
    let state = createInitialGuideRuntimeState({
      storedPreference: "unseen",
      storedProgress: null,
      sessionImageId: null,
    });
    state = syncImageIdentity(state, directSession.sessionId);
    state = markPaperTourCompletedForRunState(state);

    const reserved = reserveFirstProductHandoff(state, directSession.sessionId, "win-1");
    state = reserved.state;

    // Simulate setPreparedSpaceImage creating a brand-new assetSessionId while keeping sessionId
    const nextVizState = createPreparedSpaceImageState(initialState, "win-1", directSession);
    assert.ok(nextVizState.assetSessionId);
    assert.equal(nextVizState.spaceImageSession?.sessionId, directSession.sessionId);

    const adopted = adoptOrEnsureActiveProductInstance(state, {
      imageId: nextVizState.spaceImageSession!.sessionId,
      productId: "win-1",
      activeOverlayId: "active-win-1",
    });

    assert.equal(adopted.progress.activeGuideInstanceId, reserved.guideInstanceId);
    assert.equal(adopted.progress.guideGeneration, state.progress.guideGeneration);
    assert.equal(adopted.progress.paperTourCompletedForRun, true);
  });

  it("retains mapped identity across UUID captures/edits while separating duplicates and removals", () => {
    let state = createInitialGuideRuntimeState({
      storedPreference: "unseen",
      storedProgress: null,
      sessionImageId: "img-1",
    });
    state = adoptOrEnsureActiveProductInstance(state, {
      imageId: "img-1",
      productId: "win-1",
      activeOverlayId: "active-win-1",
    });
    const inst1 = state.progress.activeGuideInstanceId!;

    // Active -> placed UUID alias
    state = registerOverlayAlias(state, inst1, "placed-uuid-1", "placed");
    // Same-product duplicate creates independent identity
    const dup = duplicateActiveProductInstance(state, "win-1", "active-win-1-dup");
    state = dup.state;
    assert.notEqual(dup.guideInstanceId, inst1);

    // Capture duplicate to comparison UUID
    state = registerOverlayAlias(state, dup.guideInstanceId, "comp-uuid-2", "comparison");

    // Edit original placed overlay restores inst1
    const editRes = activateOverlayForEditing(state, "placed-uuid-1", "win-1");
    assert.equal(editRes.guideInstanceId, inst1);

    // Removing placed overlay cleans alias
    state = removePlacedOverlayReference(editRes.state, "placed-uuid-1");
    assert.equal(state.progress.overlayAliasToInstance["placed-uuid-1"], undefined);

    // Removing last active product restores add_product without clearing imageId or paperTourCompletedForRun
    state = markPaperTourCompletedForRunState(state);
    state = removeActiveProductState(state, inst1);
    assert.equal(state.progress.activeGuideInstanceId, null);
    assert.equal(state.progress.imageId, "img-1");
    assert.equal(state.progress.paperTourCompletedForRun, true);

    const emptyAfterRemove = resolveNextGuideAction(baseResolverInput({
      imageId: state.progress.imageId,
      placedProductCount: 0,
      paperTourCompletedForRun: state.progress.paperTourCompletedForRun,
    }));
    assert.equal(emptyAfterRemove.task, "add_product");

    // Placed-only state does not misreport an empty canvas
    const placedOnly = resolveNextGuideAction(baseResolverInput({
      imageId: state.progress.imageId,
      placedProductCount: 1,
    }));
    assert.equal(placedOnly.hasPlacedProductsOnly, true);
    assert.equal(placedOnly.task, "preview_ready");
  });
});

describe("QAD-TC104.11 / QAD-TC104.14 storage safety, preferences, and snapshot isolation", () => {
  it("handles valid versioned storage, corrupt/old records, and denied storage safely", () => {
    resetInMemoryPreferenceFallbackForTests();
    const local = makeMemoryStorage();
    const session = makeMemoryStorage();

    assert.equal(readGuidePreference(local), "unseen");
    writeGuidePreference("dont_show_again", local);
    assert.equal(readGuidePreference(local), "dont_show_again");

    // Malformed / wrong-version records ignored safely
    local.setItem(GUIDE_PREFERENCE_STORAGE_KEY, JSON.stringify({ version: 99, status: "completed" }));
    assert.equal(parseGuidePreferenceRecord(local.getItem(GUIDE_PREFERENCE_STORAGE_KEY)), null);
    assert.equal(readGuidePreference(local), "unseen");

    session.setItem(GUIDE_PROGRESS_STORAGE_KEY, "{not-valid-json");
    assert.equal(readGuideProgress(session), null);
    assert.equal(session.getItem(GUIDE_PROGRESS_STORAGE_KEY), null);

    session.setItem(
      GUIDE_PROGRESS_STORAGE_KEY,
      JSON.stringify({ version: 2, imageId: "img-1" }),
    );
    assert.equal(parseGuideProgressRecord(session.getItem(GUIDE_PROGRESS_STORAGE_KEY)), null);

    // Valid progress write/read roundtrip contains no photo/geometry/PII
    const progress = createEmptyGuideProgressRecord("img-42", 2);
    progress.comparisonSuspended = true;
    writeGuideProgress(progress, session);
    const restoredProgress = readGuideProgress(session);
    assert.equal(restoredProgress?.imageId, "img-42");
    assert.equal(restoredProgress?.comparisonSuspended, true);
    clearGuideProgress(session);
    assert.equal(readGuideProgress(session), null);

    // Mismatched imageId on reload discards stored progress rather than fabricating a workspace
    const mismatchedRuntime = createInitialGuideRuntimeState({
      storedPreference: "unseen",
      storedProgress: progress,
      sessionImageId: null,
    });
    assert.equal(mismatchedRuntime.progress.imageId, null);
    assert.equal(mismatchedRuntime.progress.comparisonSuspended, false);

    // Denied storage falls back to in-memory preference
    resetInMemoryPreferenceFallbackForTests();
    const denied = makeThrowingStorage();
    assert.equal(writeGuidePreference("completed", denied), false);
    assert.equal(readGuidePreference(denied), "completed");
    assert.equal(writeGuideProgress(progress, denied), false);
    assert.equal(readGuideProgress(denied), null);
  });

  it("handles Skip vs Don't show again vs manual restart semantics", () => {
    let state = createInitialGuideRuntimeState({
      storedPreference: "unseen",
      storedProgress: null,
      sessionImageId: "img-1",
    });

    state = skipCurrentRunState(state);
    assert.equal(state.preferenceStatus, "unseen");
    assert.equal(state.progress.runSkipped, true);
    assert.equal(
      resolveNextGuideAction(
        baseResolverInput({
          preferenceStatus: state.preferenceStatus,
          runSkipped: state.progress.runSkipped,
        }),
      ).task,
      "dismissed",
    );

    // Manual Help clears runSkipped for the manual run without setting completed
    state = restartGuideManuallyState(state);
    assert.equal(state.manualRunActive, true);
    assert.equal(state.preferenceStatus, "unseen");

    // Skipping the manual run restores suppression
    state = skipCurrentRunState(state);
    assert.equal(state.manualRunActive, false);

    // Opt-out persists dont_show_again
    state = optOutDontShowAgainState(state);
    assert.equal(state.preferenceStatus, "dont_show_again");
  });

  it("keeps onboarding state out of visualization session serialization", () => {
    const vizJson = JSON.stringify(serializeVisualizationSession(initialState));
    assert.doesNotMatch(vizJson, /guideGeneration/);
    assert.doesNotMatch(vizJson, /dont_show_again/);
    assert.doesNotMatch(vizJson, /guideInstanceId/);
  });
});

describe("QAD-TC104.2 / QAD-TC104.12 / QAD-TC104.13 UI, backdrop, Escape, and accessibility contracts", () => {
  it("keeps pre-upload pages free of pre-upload popup tours", () => {
    const selector = readFileSync("src/features/visualization/components/CalibrationModeSelector.tsx", "utf8");
    const guideLine = readFileSync("src/features/visualization/components/GuideLine.tsx", "utf8");
    const upload = readFileSync("src/features/visualization/components/UploadImage.tsx", "utf8");

    assert.ok(selector.includes("Approximate Preview Available"));
    assert.doesNotMatch(selector, /OnboardingTourPopup/);
    assert.doesNotMatch(guideLine, /OnboardingTourPopup/);
    assert.doesNotMatch(upload, /OnboardingTourPopup/);
  });

  it("renders anchored spotlight paper tour inside PaperDetectionConfirmationModal with Escape isolation", () => {
    const modal = readFileSync("src/features/visualization/components/PaperDetectionConfirmationModal.tsx", "utf8");
    assert.match(modal, /OnboardingTourPopup/);
    assert.match(modal, /Select Paper Format/);
    assert.match(modal, /Check 4-Corner Boundaries/);
    assert.match(modal, /Map 4 corners manually/);
    assert.match(modal, /Tap Corner \$\{nextManualCorner \+ 1\} of 4/);
    assert.match(modal, /Select Sheet Orientation/);
    assert.match(modal, /Confirm Wall Plane/);
    assert.match(modal, /Apply or Preview/);
    assert.match(modal, /advancePaperTourTo/);
    const pointerUpMatch = modal.match(/const handleSvgPointerUp[\s\S]*?const handleResetCorners/);
    assert.ok(pointerUpMatch, "expected handleSvgPointerUp handler");
    assert.doesNotMatch(pointerUpMatch[0], /advancePaperTourTo/);
    assert.match(modal, /isPaperTourOpenRef\.current/);
  });

  it("keeps first-placement guidance concise and preserves workspace controls", () => {
    const popup = readFileSync("src/features/visualization/onboarding/OnboardingTourPopup.tsx", "utf8");
    const scrollLock = readFileSync("src/features/visualization/hooks/useDocumentScrollLock.ts", "utf8");
    const workspaceTour = readFileSync("src/features/visualization/onboarding/WorkspaceOnboardingTour.tsx", "utf8");
    const workspace = readFileSync("src/features/visualization/components/ProductModelWorkspace.tsx", "utf8");
    const layout = readFileSync("src/components/shared/LayoutWrapper.tsx", "utf8");

    assert.match(layout, /VisualizationOnboardingProvider/);
    assert.match(popup, /bg-black\/60/);
    assert.match(popup, /max-h-\[45dvh\]/);
    assert.match(popup, /min-h-11/);
    assert.match(popup, /env\(safe-area-inset-bottom\)/);
    assert.match(popup, /aria-live="polite"/);
    assert.doesNotMatch(popup, /animate-in|animate-pulse/);
    assert.match(popup, /zIndexBase = 120/);
    assert.match(popup, /stopImmediatePropagation/);
    assert.match(popup, /computeAnchoredLayout/);
    assert.match(popup, /hasFixedAncestor/);
    assert.match(popup, /createPortal/);
    assert.match(popup, /useHtmlScrollLock/);
    assert.match(scrollLock, /html\.style\.overflow = "hidden"/);
    assert.match(popup, /ensureTargetInViewport/);
    assert.match(popup, /handleWheel/);
    assert.doesNotMatch(popup, /transition-all/);
    assert.match(workspaceTour, /workspace-add-product/);
    assert.match(workspaceTour, /workspace-fit-button/);
    assert.match(workspaceTour, /workspace-canvas-stage/);
    assert.match(workspaceTour, /workspace-accordion-placement/);
    assert.match(workspaceTour, /workspace-accordion-design/);
    assert.match(workspaceTour, /workspace-accordion-addons/);
    assert.match(workspaceTour, /workspace-accordion-hardware/);
    assert.match(workspaceTour, /workspace-accordion-occlusion/);
    assert.match(workspaceTour, /workspace-apply-changes/);
    assert.match(workspaceTour, /workspace-mobile-controls/);
    assert.match(workspaceTour, /workspace-continue-comparison/);
    assert.match(workspaceTour, /primaryActionLabel:\s*"Next"/);
    assert.doesNotMatch(workspaceTour, /Adaptive/);
    assert.match(workspace, /getWorkspaceConfigStages/);
    assert.match(workspace, /accordionToStage/);
    assert.match(workspace, /advanceConfigStage/);
    assert.match(workspace, /workspace-accordion-placement/);
    assert.match(workspace, /workspace-accordion-design/);
    assert.match(workspace, /workspace-accordion-addons/);
    assert.match(workspace, /workspace-accordion-hardware/);
    assert.match(workspace, /workspace-accordion-occlusion/);
    assert.match(workspace, /workspace-apply-changes/);
    assert.match(workspace, /workspace-mobile-controls/);
    assert.deepEqual(
      getWorkspaceConfigStages({ hasCompatibleAddons: false, hasHardwareAccessories: false }),
      ["placement", "design", "occlusion", "apply_changes", "preview_ready"],
    );
    assert.deepEqual(
      getWorkspaceConfigStages({ hasCompatibleAddons: true, hasHardwareAccessories: true }),
      ["placement", "design", "addons", "hardware", "occlusion", "apply_changes", "preview_ready"],
    );
    assert.match(workspaceTour, /blocking:\s*false/);
    assert.match(workspaceTour, /blocking=\{activeStep\?\.blocking \?\? false\}/);
    assert.match(workspace, /!isWorkspaceTourVisibleRef\.current/);
    assert.match(workspace, /markFreePlacementInteracted/);
  });
});

describe("FIX22-V1 / FIX22-V2 / FIX22-V3 / FIX22-V9 / FIX22-V11 client onboarding regressions", () => {
  it("renders PaperDetectionConfirmationModal cleanly when candidates is undefined and exposes Next on steps 0, 2, 3 (FIX22-V1)", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PaperDetectionConfirmationModal, {
        isOpen: true,
        backgroundImageUrl: "room.webp",
        canvasWidth: 1024,
        canvasHeight: 768,
        initialCorners: [
          { x: 100, y: 100 },
          { x: 310, y: 100 },
          { x: 310, y: 397 },
          { x: 100, y: 397 },
        ],
        candidates: undefined,
        selectedCandidateId: null,
        status: "manual_pin_required",
        onConfirm: () => {},
        onSkip: () => {},
        onCancel: () => {},
      }),
    );
    assert.match(markup, /data-onboarding-target="paper-tour-help-trigger"/);
    assert.match(markup, /Review paper reference/);
    assert.match(markup, /Select the paper format you used/);

    const modalSource = readFileSync(
      "src/features/visualization/components/PaperDetectionConfirmationModal.tsx",
      "utf8",
    );
    assert.match(modalSource, /const EMPTY_CANDIDATES:\s*PaperCandidate\[\]\s*=\s*\[\]/);
    assert.match(modalSource, /candidates\s*=\s*EMPTY_CANDIDATES/);
    assert.match(
      modalSource,
      /paperTourStep === 0 \|\| paperTourStep === 2 \|\| paperTourStep === 3[\s\S]*?"Next"/,
    );
    assert.match(
      modalSource,
      /<OnboardingTourPopup[\s\S]*?isOpen=\{isPaperTourOpen\}[\s\S]*?restoreFocusSelector='\[data-onboarding-target="paper-tour-help-trigger"\]'/,
    );
  });

  it("coordinates html and body scroll locks across nested child/parent mount and unmount orders (FIX22-V2)", () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;

    const htmlStyle: Record<string, string> = { overflow: "", overscrollBehavior: "" };
    const bodyStyle: Record<string, string> = {
      overflow: "",
      overscrollBehavior: "",
      position: "",
      top: "",
      left: "",
      right: "",
      width: "",
      paddingRight: "",
    };
    const scrollCalls: Array<{ x: number; y: number }> = [];

    try {
      (globalThis as { document: unknown }).document = {
        documentElement: { style: htmlStyle, clientWidth: 1280 },
        body: { style: bodyStyle },
      };
      (globalThis as { window: unknown }).window = {
        scrollX: 0,
        scrollY: 120,
        innerWidth: 1280,
        scrollTo: (x: number, y: number) => {
          scrollCalls.push({ x, y });
        },
      };

      // Child effect (OnboardingTourPopup) acquires html lock before parent (PaperDetectionConfirmationModal) acquires document lock.
      acquireHtmlLock();
      assert.equal(htmlStyle.overflow, "hidden");
      assert.equal(htmlStyle.overscrollBehavior, "none");

      acquireDocumentLock();
      assert.equal(htmlStyle.overflow, "hidden");
      assert.equal(bodyStyle.overflow, "hidden");
      assert.equal(bodyStyle.position, "fixed");

      // Closing child first then parent leaves both html and body unlocked.
      releaseHtmlLock();
      assert.equal(htmlStyle.overflow, "hidden");
      releaseDocumentLock();
      assert.equal(htmlStyle.overflow, "");
      assert.equal(htmlStyle.overscrollBehavior, "");
      assert.equal(bodyStyle.overflow, "");
      assert.equal(bodyStyle.position, "");

      // Closing parent before child also leaves html unlocked only once both release.
      acquireHtmlLock();
      acquireDocumentLock();
      releaseDocumentLock();
      assert.equal(htmlStyle.overflow, "hidden");
      assert.equal(bodyStyle.overflow, "");
      releaseHtmlLock();
      assert.equal(htmlStyle.overflow, "");
      assert.equal(htmlStyle.overscrollBehavior, "");
      assert.ok(scrollCalls.length >= 2);
    } finally {
      (globalThis as { document: unknown }).document = originalDocument;
      (globalThis as { window: unknown }).window = originalWindow;
    }

    const popupSource = readFileSync("src/features/visualization/onboarding/OnboardingTourPopup.tsx", "utf8");
    const modalSource = readFileSync("src/features/visualization/components/PaperDetectionConfirmationModal.tsx", "utf8");
    assert.match(popupSource, /useHtmlScrollLock\(Boolean\(isOpen && blocking\)\)/);
    assert.match(modalSource, /useDocumentScrollLock\(isOpen\)/);
  });

  it("preserves dont_show_again across manual Help replay completion in storage, store, and provider (FIX22-V3)", () => {
    resetInMemoryPreferenceFallbackForTests();
    const local = makeMemoryStorage();

    writeGuidePreference("dont_show_again", local);
    assert.equal(completeGuidePreference(local), "dont_show_again");
    assert.equal(readGuidePreference(local), "dont_show_again");

    const freshLocal = makeMemoryStorage();
    assert.equal(completeGuidePreference(freshLocal), "completed");
    assert.equal(readGuidePreference(freshLocal), "completed");

    let optedOutState = createInitialGuideRuntimeState({
      storedPreference: "dont_show_again",
      storedProgress: null,
      sessionImageId: "img-v3",
    });
    optedOutState = restartGuideManuallyState(optedOutState);
    assert.equal(optedOutState.manualRunActive, true);
    optedOutState = completeWorkspaceTourState(optedOutState);
    assert.equal(optedOutState.preferenceStatus, "dont_show_again");
    assert.equal(optedOutState.manualRunActive, false);

    const providerSource = readFileSync(
      "src/features/visualization/onboarding/VisualizationOnboardingProvider.tsx",
      "utf8",
    );
    assert.match(providerSource, /const completeWorkspaceTour = useCallback\(\(\) => \{\s*completeGuidePreference\(\);/);
  });

  it("pins mobile footer actions and bottom-anchors tall targets without overlapping headers (FIX22-V9)", () => {
    const tallTargetLayout = computeAnchoredLayout({
      targetRect: { top: 80, left: 16, right: 374, bottom: 720, width: 358, height: 640 },
      popoverWidth: 374,
      popoverHeight: 240,
      viewportWidth: 390,
      viewportHeight: 844,
      variant: "mobile",
      preferredPlacement: "auto",
    });
    assert.equal(tallTargetLayout.side, "fallback");
    assert.equal(tallTargetLayout.top, 844 - 240 - 8);

    const centeredTargetLayout = computeAnchoredLayout({
      targetRect: { top: 300, left: 20, right: 370, bottom: 520, width: 350, height: 220 },
      popoverWidth: 374,
      popoverHeight: 220,
      viewportWidth: 390,
      viewportHeight: 844,
      variant: "mobile",
      preferredPlacement: "auto",
    });
    assert.equal(centeredTargetLayout.side, "fallback");
    assert.equal(centeredTargetLayout.top, 844 - 220 - 8);

    const compactBottomTarget = computeAnchoredLayout({
      targetRect: { top: 700, left: 20, right: 370, bottom: 760, width: 350, height: 60 },
      popoverWidth: 374,
      popoverHeight: 200,
      viewportWidth: 390,
      viewportHeight: 844,
      variant: "mobile",
      preferredPlacement: "auto",
    });
    assert.equal(compactBottomTarget.side, "top");

    const popupSource = readFileSync("src/features/visualization/onboarding/OnboardingTourPopup.tsx", "utf8");
    assert.match(popupSource, /max-h-\[45dvh\] flex flex-col overflow-hidden/);
    assert.match(popupSource, /min-h-0 flex-1 overflow-y-auto overscroll-contain/);
    assert.match(popupSource, /<div className="shrink-0">/);
  });

  it("hardens wheel scroll inside spotlight, non-trapping fallback, Tab trap, focus entry, and isPaused focus guard (FIX22-V11)", () => {
    const originalElement = globalThis.Element;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalWindow = globalThis.window;

    class MockElement {
      parentElement: MockElement | null = null;
      private children: MockElement[] = [];
      appendChild(child: MockElement) {
        child.parentElement = this;
        this.children.push(child);
      }
      contains(node: unknown): boolean {
        if (node === this) return true;
        return this.children.some((c) => c.contains(node));
      }
    }
    class MockHTMLElement extends MockElement {
      scrollHeight = 100;
      clientHeight = 100;
      scrollWidth = 100;
      clientWidth = 100;
      overflowY = "visible";
      overflowX = "visible";
    }

    try {
      (globalThis as { Element: unknown }).Element = MockElement;
      (globalThis as { HTMLElement: unknown }).HTMLElement = MockHTMLElement;
      (globalThis as { window: unknown }).window = {
        getComputedStyle: (el: MockHTMLElement) => ({
          overflowY: el.overflowY,
          overflowX: el.overflowX,
        }),
      };

      const boundary = new MockHTMLElement();
      const scrollDrawer = new MockHTMLElement();
      scrollDrawer.overflowY = "auto";
      scrollDrawer.scrollHeight = 500;
      scrollDrawer.clientHeight = 200;
      const innerChild = new MockHTMLElement();
      boundary.appendChild(scrollDrawer);
      scrollDrawer.appendChild(innerChild);

      const nonScrollEl = new MockHTMLElement();
      boundary.appendChild(nonScrollEl);

      const outsideEl = new MockHTMLElement();

      assert.equal(
        hasScrollableContainerWithin(
          innerChild as unknown as EventTarget,
          boundary as unknown as HTMLElement,
        ),
        true,
      );
      assert.equal(
        hasScrollableContainerWithin(
          nonScrollEl as unknown as EventTarget,
          boundary as unknown as HTMLElement,
        ),
        false,
      );
      assert.equal(
        hasScrollableContainerWithin(
          outsideEl as unknown as EventTarget,
          boundary as unknown as HTMLElement,
        ),
        false,
      );
    } finally {
      (globalThis as { Element: unknown }).Element = originalElement;
      (globalThis as { HTMLElement: unknown }).HTMLElement = originalHTMLElement;
      (globalThis as { window: unknown }).window = originalWindow;
    }

    const popupSource = readFileSync("src/features/visualization/onboarding/OnboardingTourPopup.tsx", "utf8");
    assert.match(popupSource, /isInsideNode\(spotlightEl, event\.target\) &&\s*hasScrollableContainerWithin\(event\.target, spotlightEl\)/);
    assert.match(popupSource, /\{blocking && !targetRect && \(\s*<div[\s\S]*?className="pointer-events-none fixed inset-0 bg-black\/60/);
    assert.match(popupSource, /event\.key === "Tab" && blocking && !targetRect && cardRef\.current/);
    assert.match(popupSource, /if \(!alreadyFocusedInside\)\s*\{\s*cardRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
    assert.match(popupSource, /if \(!isPaused\)\s*\{\s*const restoreTarget = restoreFocusSelector/);

    const workspaceTourSource = readFileSync("src/features/visualization/onboarding/WorkspaceOnboardingTour.tsx", "utf8");
    const workspaceSource = readFileSync("src/features/visualization/components/ProductModelWorkspace.tsx", "utf8");
    assert.match(workspaceTourSource, /isOpen=\{Boolean\(activeStep\)\}/);
    assert.match(workspaceTourSource, /isPaused=\{isPaused\}/);
    assert.match(workspaceTourSource, /restoreFocusSelector='\[data-onboarding-target="workspace-help-trigger"\]'/);
    assert.match(workspaceSource, /data-onboarding-target="workspace-help-trigger"/);
  });
});
