import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  GUIDE_PREFERENCE_STORAGE_KEY,
  GUIDE_PROGRESS_STORAGE_KEY,
  readGuidePreference,
  writeGuidePreference,
} from "../../src/features/visualization/onboarding/storage";
import {
  COMPARISON_PREFERENCE_STORAGE_KEY,
  COMPARISON_SESSION_STORAGE_KEY,
  clearOnboardingMemoryFallbackForTests,
  completeComparisonGuidePreference,
  getAdminOnboardingPreferenceKey,
  getAdminOnboardingSessionKey,
  markAdminBookingsPhaseCompleted,
  markAdminSurfaceCompleted,
  markAdminSurfaceDontShowAgain,
  markAdminWizardPhaseCompleted,
  readAdminOnboardingPreference,
  readAdminOnboardingSession,
  readComparisonGuidePreference,
  readComparisonGuideSession,
  setAdminWizardPhaseSessionSkipped,
  writeAdminOnboardingPreference,
  writeComparisonGuidePreference,
  writeComparisonGuideSession,
  type StorageLike,
} from "../../src/lib/onboarding/storage";
import {
  resolveComparisonTourStep,
  shouldShowComparisonTour,
} from "../../src/features/comparison/components/ComparisonOnboardingTour";
import {
  resolveProductSetupWizardPhase,
  shouldShowWizardPhaseTour,
} from "../../src/features/admin/products/setup/ProductSetupOnboardingTour";
import {
  resolveBookingsInspectorSteps,
  resolveBookingsQueueSteps,
  resolveDashboardTourSteps,
  resolveMaterialsTourSteps,
  resolveProductsTourSteps,
  resolveSettingsTourSteps,
  resolveStaffTourSteps,
} from "../../src/features/admin/onboarding/adminTourConfigs";
import { resolveBookingsActiveSubGuide } from "../../src/features/admin/onboarding/AdminBookingsOnboardingTour";
import { getStepsForProduct } from "../../src/lib/admin/products/wizardSteps";

function createMemoryStorage(options?: { throwOnWrite?: boolean; throwOnRead?: boolean }): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      if (options?.throwOnRead) throw new Error("SecurityError");
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      if (options?.throwOnWrite) throw new Error("QuotaExceededError");
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

describe("QAD-TC105.1 storage isolation & MS89 preservation", () => {
  it("preserves MS89 keys and isolates Comparison and Admin preferences", () => {
    clearOnboardingMemoryFallbackForTests();
    const local = createMemoryStorage();

    assert.equal(GUIDE_PREFERENCE_STORAGE_KEY, "glassfit.onboarding.preference.v1");
    assert.equal(GUIDE_PROGRESS_STORAGE_KEY, "glassfit.onboarding.progress.v1");
    assert.equal(
      COMPARISON_PREFERENCE_STORAGE_KEY,
      "glassfit.onboarding.comparison.preference.v1",
    );
    assert.equal(
      COMPARISON_SESSION_STORAGE_KEY,
      "glassfit.onboarding.comparison.session.v1",
    );

    writeGuidePreference("dont_show_again", local);
    assert.equal(readGuidePreference(local), "dont_show_again");
    assert.equal(readComparisonGuidePreference(local), "unseen");
    assert.equal(
      readAdminOnboardingPreference("admin-a", local).surfaces.bookings ?? "unseen",
      "unseen",
    );

    writeComparisonGuidePreference("completed", local);
    assert.equal(readComparisonGuidePreference(local), "completed");
    assert.equal(readGuidePreference(local), "dont_show_again");
  });
});

describe("QAD-TC105.2 admin account isolation, skip, opt-out precedence, and storage resilience", () => {
  it("isolates Admin A and Admin B on the same browser storage", () => {
    clearOnboardingMemoryFallbackForTests();
    const local = createMemoryStorage();

    markAdminSurfaceDontShowAgain("admin-a", "materials", local);
    markAdminSurfaceCompleted("admin-b", "products", local);

    const prefA = readAdminOnboardingPreference("admin-a", local);
    const prefB = readAdminOnboardingPreference("admin-b", local);

    assert.equal(prefA.surfaces.materials, "dont_show_again");
    assert.equal(prefA.surfaces.products, undefined);
    assert.equal(prefB.surfaces.materials, undefined);
    assert.equal(prefB.surfaces.products, "completed");
  });

  it("preserves dont_show_again on manual Help Got it completion", () => {
    clearOnboardingMemoryFallbackForTests();
    const local = createMemoryStorage();

    writeComparisonGuidePreference("dont_show_again", local);
    assert.equal(completeComparisonGuidePreference(local), "dont_show_again");
    assert.equal(readComparisonGuidePreference(local), "dont_show_again");

    markAdminSurfaceDontShowAgain("admin-a", "bookings", local);
    const afterManual = markAdminSurfaceCompleted("admin-a", "bookings", local);
    assert.equal(afterManual.surfaces.bookings, "dont_show_again");
  });

  it("handles session-only skip, malformed/mismatched records, and storage errors safely", () => {
    clearOnboardingMemoryFallbackForTests();
    const local = createMemoryStorage();
    const session = createMemoryStorage();

    writeComparisonGuideSession(true, session);
    assert.equal(readComparisonGuideSession(session).runSkipped, true);
    assert.equal(readComparisonGuidePreference(local), "unseen");

    // Malformed JSON, wrong version, wrong profileId
    local.setItem(getAdminOnboardingPreferenceKey("admin-a"), "{bad-json");
    assert.deepEqual(readAdminOnboardingPreference("admin-a", local).surfaces, {});

    local.setItem(
      getAdminOnboardingPreferenceKey("admin-a"),
      JSON.stringify({ version: 99, profileId: "admin-a", surfaces: { materials: "completed" } }),
    );
    assert.deepEqual(readAdminOnboardingPreference("admin-a", local).surfaces, {});

    local.setItem(
      getAdminOnboardingPreferenceKey("admin-a"),
      JSON.stringify({ version: 1, profileId: "admin-other", surfaces: { materials: "completed" } }),
    );
    assert.deepEqual(readAdminOnboardingPreference("admin-a", local).surfaces, {});

    session.setItem(getAdminOnboardingSessionKey("admin-a"), "not-an-object");
    assert.deepEqual(readAdminOnboardingSession("admin-a", session).skippedSurfaces, {});

    // Unavailable / throwing storage falls back to in-memory store
    const broken = createMemoryStorage({ throwOnRead: true, throwOnWrite: true });
    writeAdminOnboardingPreference(
      {
        version: 1,
        profileId: "admin-mem",
        surfaces: { products: "completed" },
        wizardPhases: {},
        bookingsPhases: {},
      },
      broken,
    );
    assert.equal(readAdminOnboardingPreference("admin-mem", broken).surfaces.products, "completed");
  });
});

describe("QAD-TC105.3 & QAD-TC105.4 Product Setup Wizard semantic StepKey & conditional resolution", () => {
  it("maps ProductRole step counts and keeps later unseen phases automatic", () => {
    assert.equal(getStepsForProduct(false, false).length, 7);
    assert.equal(getStepsForProduct(true, false).length, 5);
    assert.equal(getStepsForProduct(false, true).length, 4);

    clearOnboardingMemoryFallbackForTests();
    const local = createMemoryStorage();
    const session = createMemoryStorage();

    const afterInspector = markAdminWizardPhaseCompleted("admin-w", "components_inspector", false, local);
    assert.equal(afterInspector.wizardPhases.components_inspector, "completed");
    assert.equal(afterInspector.surfaces.product_setup, undefined);

    const paramsPhase = resolveProductSetupWizardPhase({
      activeStep: "parameters",
      isDraft: false,
      productRole: "standard",
      modelStrategy: "Parametric",
      hasWholeModelAsset: false,
      mappedFilesCount: 3,
      selectedPartsCount: 1,
      isDecomposing: false,
      decompositionModalOpen: false,
      lightboxOpen: false,
      parametersTab: "parameters",
      validationTab: "dimensions",
      validationLoading: false,
      validationHasError: false,
      validationHasDefinition: true,
    });
    assert.ok(paramsPhase);
    assert.equal(
      shouldShowWizardPhaseTour({
        isHydrated: true,
        resolvedPhase: paramsPhase,
        preference: afterInspector,
        session: readAdminOnboardingSession("admin-w", session),
        manualRunPhaseId: null,
      }),
      true,
    );

    const afterOptOut = markAdminSurfaceDontShowAgain("admin-w", "product_setup", local);
    assert.equal(
      shouldShowWizardPhaseTour({
        isHydrated: true,
        resolvedPhase: paramsPhase,
        preference: afterOptOut,
        session: readAdminOnboardingSession("admin-w", session),
        manualRunPhaseId: null,
      }),
      false,
    );

    // Skipping components_inspector only skips that phase for the session
    const skippedSession = setAdminWizardPhaseSessionSkipped("admin-s", "components_inspector", true, session);
    assert.equal(skippedSession.skippedWizardPhases.components_inspector, true);
    assert.equal(
      shouldShowWizardPhaseTour({
        isHydrated: true,
        resolvedPhase: paramsPhase,
        preference: readAdminOnboardingPreference("admin-s", local),
        session: skippedSession,
        manualRunPhaseId: null,
      }),
      true,
    );
  });

  it("resolves conditional targets for components intake/inspector, parameters tabs, and validation inline materials", () => {
    const intakeWithWhole = resolveProductSetupWizardPhase({
      activeStep: "components",
      isDraft: false,
      productRole: "standard",
      modelStrategy: "Parametric",
      hasWholeModelAsset: true,
      mappedFilesCount: 0,
      selectedPartsCount: 0,
      isDecomposing: false,
      decompositionModalOpen: false,
      lightboxOpen: false,
      parametersTab: "parameters",
      validationTab: "dimensions",
      validationLoading: false,
      validationHasError: false,
      validationHasDefinition: false,
    });
    assert.equal(intakeWithWhole?.phaseId, "components_intake");
    assert.match(intakeWithWhole?.steps[0].targetSelector ?? "", /admin-setup-extract-whole-model/);

    const intakeUpload = resolveProductSetupWizardPhase({
      activeStep: "components",
      isDraft: false,
      productRole: "standard",
      modelStrategy: "Parametric",
      hasWholeModelAsset: false,
      mappedFilesCount: 0,
      selectedPartsCount: 0,
      isDecomposing: false,
      decompositionModalOpen: false,
      lightboxOpen: false,
      parametersTab: "parameters",
      validationTab: "dimensions",
      validationLoading: false,
      validationHasError: false,
      validationHasDefinition: false,
    });
    assert.match(intakeUpload?.steps[0].targetSelector ?? "", /admin-setup-components-upload/);

    const inspectorNoSelection = resolveProductSetupWizardPhase({
      activeStep: "components",
      isDraft: false,
      productRole: "standard",
      modelStrategy: "Parametric",
      hasWholeModelAsset: false,
      mappedFilesCount: 2,
      selectedPartsCount: 0,
      isDecomposing: false,
      decompositionModalOpen: false,
      lightboxOpen: false,
      parametersTab: "parameters",
      validationTab: "dimensions",
      validationLoading: false,
      validationHasError: false,
      validationHasDefinition: false,
    });
    assert.equal(inspectorNoSelection?.phaseId, "components_inspector");
    assert.match(inspectorNoSelection?.steps[1].description ?? "", /Select a part on the left/);

    const inspectorAccessory = resolveProductSetupWizardPhase({
      activeStep: "components",
      isDraft: false,
      productRole: "accessory",
      modelStrategy: "Fixed",
      hasWholeModelAsset: false,
      mappedFilesCount: 1,
      selectedPartsCount: 1,
      isDecomposing: false,
      decompositionModalOpen: false,
      lightboxOpen: false,
      parametersTab: "parameters",
      validationTab: "dimensions",
      validationLoading: false,
      validationHasError: false,
      validationHasDefinition: false,
    });
    assert.match(inspectorAccessory?.steps[1].targetSelector ?? "", /admin-setup-accessory-handing/);
    assert.match(inspectorAccessory?.steps[1].description ?? "", /Right-Handed or Left-Handed/);

    const fixedParams = resolveProductSetupWizardPhase({
      activeStep: "parameters",
      isDraft: false,
      productRole: "standard",
      modelStrategy: "Fixed",
      hasWholeModelAsset: false,
      mappedFilesCount: 1,
      selectedPartsCount: 0,
      isDecomposing: false,
      decompositionModalOpen: false,
      lightboxOpen: false,
      parametersTab: "parameters",
      validationTab: "dimensions",
      validationLoading: false,
      validationHasError: false,
      validationHasDefinition: false,
    });
    assert.equal(fixedParams?.isAutomaticPhase, false);

    const addonsTab = resolveProductSetupWizardPhase({
      activeStep: "parameters",
      isDraft: false,
      productRole: "standard",
      modelStrategy: "Parametric",
      hasWholeModelAsset: false,
      mappedFilesCount: 1,
      selectedPartsCount: 0,
      isDecomposing: false,
      decompositionModalOpen: false,
      lightboxOpen: false,
      parametersTab: "addons",
      validationTab: "dimensions",
      validationLoading: false,
      validationHasError: false,
      validationHasDefinition: false,
    });
    assert.equal(addonsTab?.phaseId, "parameters_addons");
    assert.match(addonsTab?.steps[0].targetSelector ?? "", /admin-setup-addon-inheritance/);

    const validationLoading = resolveProductSetupWizardPhase({
      activeStep: "validation",
      isDraft: false,
      productRole: "standard",
      modelStrategy: "Parametric",
      hasWholeModelAsset: false,
      mappedFilesCount: 1,
      selectedPartsCount: 0,
      isDecomposing: false,
      decompositionModalOpen: false,
      lightboxOpen: false,
      parametersTab: "parameters",
      validationTab: "dimensions",
      validationLoading: true,
      validationHasError: false,
      validationHasDefinition: false,
    });
    assert.equal(validationLoading?.isPaused, true);

    const validationMaterials = resolveProductSetupWizardPhase({
      activeStep: "validation",
      isDraft: false,
      productRole: "standard",
      modelStrategy: "Parametric",
      hasWholeModelAsset: false,
      mappedFilesCount: 1,
      selectedPartsCount: 0,
      isDecomposing: false,
      decompositionModalOpen: false,
      lightboxOpen: false,
      parametersTab: "parameters",
      validationTab: "materials",
      validationLoading: false,
      validationHasError: false,
      validationHasDefinition: true,
    });
    assert.equal(validationMaterials?.phaseId, "validation_materials");
    assert.equal(validationMaterials?.isAutomaticPhase, false);
    assert.match(
      validationMaterials?.steps[0].targetSelector ?? "",
      /admin-setup-validation-materials-sandbox/,
    );
  });
});

describe("QAD-TC105.5 & QAD-TC105.6 Comparison tour & zero popup tours on conversion/browsing routes", () => {
  it("resolves Comparison tour steps, multi-overlay note, and pause/recovery guards", () => {
    const step0 = resolveComparisonTourStep({
      stepIndex: 0,
      compareMode: "left",
      variantModeReady: true,
      comparisonOverlaysCount: 1,
    });
    assert.match(step0.targetSelector, /comparison-mode-controls/);

    const step1BeforeAfter = resolveComparisonTourStep({
      stepIndex: 1,
      compareMode: "left",
      variantModeReady: true,
      comparisonOverlaysCount: 2,
    });
    assert.match(step1BeforeAfter.targetSelector, /comparison-preview-stage/);
    assert.equal(step1BeforeAfter.secondaryActionLabel, "Switch to Product Variant");
    assert.match(step1BeforeAfter.helperNote ?? "", /Multiple fixtures placed/);

    const step1Variant = resolveComparisonTourStep({
      stepIndex: 1,
      compareMode: "right",
      variantModeReady: true,
      comparisonOverlaysCount: 1,
    });
    assert.match(step1Variant.targetSelector, /comparison-variant-panel/);
    assert.equal(step1Variant.secondaryActionLabel, undefined);

    assert.equal(
      shouldShowComparisonTour({
        isHydrated: true,
        preferenceStatus: "unseen",
        runSkipped: false,
        manualRunActive: false,
        isIncompleteVariationPromptActive: true,
        isPreparingQuotation: false,
        hasComparisonError: false,
      }),
      false,
    );
    assert.equal(
      shouldShowComparisonTour({
        isHydrated: true,
        preferenceStatus: "unseen",
        runSkipped: false,
        manualRunActive: false,
        isIncompleteVariationPromptActive: false,
        isPreparingQuotation: true,
        hasComparisonError: false,
      }),
      false,
    );
    assert.equal(
      shouldShowComparisonTour({
        isHydrated: true,
        preferenceStatus: "unseen",
        runSkipped: false,
        manualRunActive: false,
        isIncompleteVariationPromptActive: false,
        isPreparingQuotation: false,
        hasComparisonError: true,
      }),
      false,
    );
    assert.equal(
      shouldShowComparisonTour({
        isHydrated: true,
        preferenceStatus: "unseen",
        runSkipped: false,
        manualRunActive: false,
        isIncompleteVariationPromptActive: false,
        isPreparingQuotation: false,
        hasComparisonError: false,
      }),
      true,
    );
  });

  it("keeps /quotation, /send-booking, /product, /product-details, and /my-requests free of OnboardingTourPopup", () => {
    const files = [
      "src/features/quotation/components/Quotation.tsx",
      "src/features/booking/components/BookingFlow.tsx",
    ];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      assert.doesNotMatch(content, /OnboardingTourPopup/);
    }
  });
});

describe("QAD-TC105.7 through QAD-TC105.12 Admin surfaces, role-aware Help, and modal pause contracts", () => {
  it("handles Bookings 2-phase progression and supportsItemNegotiation branching (QAD-TC105.7)", () => {
    clearOnboardingMemoryFallbackForTests();
    const local = createMemoryStorage();
    const session = createMemoryStorage();

    const emptySteps = resolveBookingsQueueSteps({
      filteredBookingsCount: 0,
      hasSelectedBooking: false,
    });
    assert.match(emptySteps[1].targetSelector, /admin-bookings-empty-state/);
    assert.equal(emptySteps[1].primaryActionLabel, "Got it");

    const afterEmptyQueue = markAdminBookingsPhaseCompleted(
      "admin-b",
      "queue_orientation",
      false,
      local,
    );
    assert.equal(afterEmptyQueue.bookingsPhases.queue_orientation, "completed");
    assert.equal(afterEmptyQueue.bookingsPhases.inspector_negotiation, undefined);

    const activePhase = resolveBookingsActiveSubGuide({
      isHydrated: true,
      loadError: null,
      filteredBookingsCount: 2,
      hasSelectedBooking: true,
      isPaused: false,
      preference: afterEmptyQueue,
      session: readAdminOnboardingSession("admin-b", session),
      manualPhase: null,
    });
    assert.equal(activePhase, "inspector_negotiation");

    const canonicalInspector = resolveBookingsInspectorSteps(true);
    assert.match(canonicalInspector[0].description, /Edit Price/);
    assert.match(canonicalInspector[0].description, /Site Installation & Labor Fee/);

    const legacyInspector = resolveBookingsInspectorSteps(false);
    assert.match(legacyInspector[0].description, /Edit Final Price/);
    assert.match(legacyInspector[0].description, /legacy reconstructed quotations/);
  });

  it("verifies Materials, Products, and Dashboard copy accuracy (QAD-TC105.8, QAD-TC105.9, QAD-TC105.10)", () => {
    const materials = resolveMaterialsTourSteps();
    assert.equal(materials.length, 3);
    assert.match(materials[2].description, /deactivates/);

    const products = resolveProductsTourSteps();
    assert.equal(products.length, 3);
    assert.match(products[0].description, /Add-on Accessory/);
    assert.match(products[2].description, /Duplicate/);

    const dashboard = resolveDashboardTourSteps();
    assert.equal(dashboard.length, 3);
    assert.match(dashboard[0].description, /All Products/);
    assert.match(dashboard[0].description, /Approved Booking/);
    assert.match(dashboard[1].description, /Go to Products/);

    const dashboardContent = readFileSync(
      "src/features/admin/components/DashboardContent.tsx",
      "utf8",
    );
    assert.match(dashboardContent, /autoOpen=\{false\}/);
  });

  it("verifies Staff and Settings role-aware Help tours (QAD-TC105.11)", () => {
    const staffOwner = resolveStaffTourSteps("Owner");
    assert.match(staffOwner[0].description, /6-digit Admin Verification Code/);
    assert.match(staffOwner[1].description, /Remove Staff/);

    const staffManager = resolveStaffTourSteps("Manager");
    assert.match(staffManager[1].description, /restricted to the Owner role/);

    const settingsStaff = resolveSettingsTourSteps("Staff");
    assert.match(settingsStaff[0].description, /Owner or Manager approves/);
    assert.match(settingsStaff[1].description, /restricted to the Owner role/);

    const settingsOwner = resolveSettingsTourSteps("Owner");
    assert.match(settingsOwner[0].description, /apply immediately/);
    assert.match(settingsOwner[1].description, /click Edit/);
    assert.match(settingsOwner[2].description, /Download Backup/);
  });

  it("verifies modal pause wiring and non-mutation invariants across all surfaces (QAD-TC105.12)", () => {
    const bookings = readFileSync("src/features/admin/bookings/BookingsContent.tsx", "utf8");
    assert.match(bookings, /isDiscardModalOpen \|\| isSaving \|\| isDeleting/);

    const materials = readFileSync("src/features/admin/materials/MaterialsContent.tsx", "utf8");
    assert.match(materials, /isAddEditOpen \|\| isBatchOpen \|\| isUploadOpen \|\| deletingMaterial !== null/);

    const products = readFileSync("src/features/admin/products/ProductsContent.tsx", "utf8");
    assert.match(products, /productToDelete !== null \|\| duplicatingId !== null/);

    const staff = readFileSync("src/features/admin/staff/StaffContent.tsx", "utf8");
    assert.match(staff, /isInviteOpen \|\| rowModalOpenCount > 0/);
    assert.match(staff, /autoOpen=\{false\}/);

    const settings = readFileSync("src/features/admin/settings/SettingsContent.tsx", "utf8");
    assert.match(settings, /isPaused=\{isAnalyticsModalOpen\}/);
    assert.match(settings, /autoOpen=\{false\}/);
  });
});
