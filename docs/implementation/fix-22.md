# Implementation Specification: Harden Client and Admin Onboarding Tours, Mobile Layout, and Modal Coordination (fix-22)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document ID:** fix-22
**Document Function:** Technical fix plan for resolving post-implementation client and admin onboarding regressions across IMP-MS89 and IMP-MS90
**Version:** 1.0.0
**Date:** November 17, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Ready for Implementation; plan only
**Primary Traceability:** `BRD-M3`, `BRD-M4`, `BRD-M5`, `PRD-F3`, `PRD-F6`, `PRD-F14`, `PRD-F15`, `PRD-F16`, `PRD-F19`, `SDD-C2`, `SDD-C5`, `SDD-C6`, `SDD-C7`, `SDD-C9`, `DSD-UI3`, `DSD-UI4`, `DSD-UI9`, `DSD-UI10`, `DSD-UI11`, `DSD-UI14`, `DSD-UI16`, `QAD-TC104`, `QAD-TC105`; regression guards for `PRD-F5`, `PRD-F9`, `PRD-F10`, `SDD-C4`, `SDD-C8`, `ERD-E3`, `ERD-E4`, `ERD-E6`, `ERD-E10`, `ERD-E11`, `ERD-E13`, `ERD-E17`
**Upstream Specifications:** `docs/brd-glassfit.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/erd-glassfit.md`, `docs/qad-glassfit.md`, `docs/build-glassfit.md`, `docs/implementation/ms89.md`, `docs/implementation/ms90.md`

---

## 1. Required Outcome and Scope

Following the implementation of `IMP-MS89` (Context-Aware Visualization Onboarding and First Placement Guidance) and `IMP-MS90` (Context-Aware Client Comparison Tour and Role-Aware Admin Workbench Guidance), live browser QA (`1280x720` desktop and `390x844` mobile) and source audits identified concrete runtime crashes, scroll-lock leaks, mobile card clipping and overlap, modal-pause callback hazards, step-counter mismatches, focus-restoration regressions, and product-role guidance leaks.

This plan resolves every confirmed defect across client visualization onboarding (`IMP-MS89`), client comparison onboarding (`IMP-MS90`), shared `OnboardingTourPopup` behavior, and the seven administrative workbench surfaces (`/admin`, `/admin/products`, `/admin/products/[productId]/setup`, `/admin/bookings`, `/admin/materials`, `/admin/staff`, `/admin/settings`) without altering domain business logic, database schemas, quotation calculations, or 3D rendering pipelines.

`FIX22-V1` through `FIX22-V12` are plan-local acceptance cases mapped back to `QAD-TC104` and `QAD-TC105`. This document creates a specification plan only. It does not modify application code, unit tests, database records, migrations, or dependencies.

---

## 2. Confirmed Findings and Evidence Boundary

| ID | Surface / Component | Confirmed Evidence (Live Browser & Source Audit) | Consequence |
|---|---|---|---|
| F1 | `PaperDetectionConfirmationModal.tsx:188,317-324` | Prop destructuring `candidates = []` allocates a fresh array reference on every render. Render-phase state synchronization (`if (candidates !== prevCandidates) setPrevCandidates(candidates)`) executes on every render when `paperCalibration?.candidates` is `undefined`. | Confirmed live in Chromium: opening `PaperDetectionConfirmationModal` without an explicit `candidates` array triggers an infinite re-render loop and crashes the page into the Next.js error boundary (`This page couldn't load`). |
| F2 | `OnboardingTourPopup.tsx:300-364`, `useDocumentScrollLock.ts:21-66` | React executes child `useEffect`s (`OnboardingTourPopup` setting `html.style.overflow = "hidden"; html.style.overscrollBehavior = "none"`) before parent `useEffect`s (`PaperDetectionConfirmationModal` calling `useDocumentScrollLock(isOpen)` and capturing `savedHtml`). | Confirmed live in Chromium: when `PaperDetectionConfirmationModal` closes, `useDocumentScrollLock` restores `savedHtml` (`{ overflow: "hidden", overscrollBehavior: "none" }`), leaving `<html>` permanently scroll-locked after all dialogs close. |
| F3 | `VisualizationOnboardingProvider.tsx:340-343`, `store.ts:740-762` | `completeWorkspaceTour` unconditionally calls `writeGuidePreference("completed")` and sets `preferenceStatus: "completed"`. | Confirmed live in Chromium: if a user clicks `Don't show again` in the workspace tour, later launches a manual replay via `Help`, and clicks `Got it` at the end, their persistent `"dont_show_again"` opt-out is overwritten to `"completed"`. |
| F4 | `AdminBookingsOnboardingTour.tsx:184-191,212-238`, `BookingsContent.tsx:172-178` | (a) `BookingsContent` falls back `selectedBooking` to `bookings[0]` even when active search/status filters match 0 rows (`filteredBookings.length === 0`), so `hasSelectedBooking` remains `true` while `filteredBookingsCount === 0`. (b) `AdminBookingsOnboardingTour` returns `null` when `!activePhase` while passing `isOpen={true}` when mounted. | Confirmed live in Chromium: (a) filtering `/admin/bookings` to 0 results and clicking `Got it` on Step 2 jumps into Phase 2 while `displayTotalSteps = 2`, displaying `"Step 4 of 2: Preview PDF, Save Status, or Discard"`; (b) closing the tour unmounts `OnboardingTourPopup` before `isOpen` transitions `true -> false`, preventing focus restoration to `Help`. |
| F5 | `ProductSetupOnboardingTour.tsx:245-265,321-347`, `AddonInheritanceSection.tsx:246-259`, `ValidationWorkspaceSection.tsx:1839,2018-2062` | (a) On `productRole === "addon"`, opening the `Compatible Add-ons` sub-tab triggers `parameters_addons` even though `AddonInheritanceSection` renders `"Add-on Accessory Notice"` stating add-ons cannot attach other add-ons. (b) On `productRole === "accessory"`, entering `validation` triggers `validation_sandbox` pointing to `admin-setup-validation-sliders` (empty for accessories) and instructing the admin to drag Width/Height sliders, toggle sills, and open the `Materials` tab. | Confirmed live in Chromium on catalog items (`Mesh Screen Add-on` and `09 Awning Window Cam Handle Left`): administrators receive contradictory or non-existent control instructions for `addon` and `accessory` roles. |
| F6 | `productMutations.ts:420-467`, `ProductSetupWizard.tsx:106-111`, `StructuralComponentsSection.tsx:1409` | `getProductDraft` selects `r2_object_key` on `product_assets` without populating `file_url` via `getR2AssetUrl(a.r2_object_key)`, while `ProductSetupWizard` filters `wholeModelAsset` on `Boolean(a.file_url)`. | Confirmed live in Chromium on standard product `ff58c79a-a03c-4e5a-bc75-ea136d9bc16f` (`00BFD_Complete_BiFold_Door.glb`): `wholeModelAsset` is always `null`, so `[data-onboarding-target="admin-setup-extract-whole-model"]` and its `components_intake` guidance branch never render. |
| F7 | `OnboardingTourPopup.tsx:150-165,618-621`, `AdminHelpButton.tsx:17` | On `< 768px` (`variant === "mobile"`): (a) `max-h-[45dvh]` clips the `Skip` and `Don't show again` footer buttons off-card on longer steps without a visible scroll affordance; (b) `computeAnchoredLayout` sets `placeAbove = targetCenterY >= viewportHeight * 0.48` and clamps `top` to `8px`, placing the mobile card over the page header and top half of tall spotlighted targets (`admin-materials-table`, `admin-setup-3d-viewport`); (c) `AdminHelpButton` (`fixed bottom-5 right-5`) overlaps the sticky `Continue to Parameters & Rules` CTA in `StructuralComponentsSection`. | Confirmed live in Chromium at `390x844`: mobile tour actions are clipped out of view, tall spotlighted targets are obscured at the top of the screen, and the floating `Help` button collides with sticky wizard footer buttons. |
| F8 | `SettingsContent.tsx:238-253,949-975`, `adminTourConfigs.ts:193-201` | `data-onboarding-target="admin-settings-profile-card"` wraps only `AdminProfileCard` in the left column, leaving `SecurityCard` in the right column dimmed under the backdrop despite Step 1 covering `"Profile, Password & Email Approval Rules"`. In addition, `AdminProfileCard` compares `role === "Staff"` case-sensitively. | Confirmed live in Chromium on `/admin/settings`: the password card described in Step 1 is darkened and covered by the popover. |
| F9 | `StaffContent.tsx:121-125,148`, `StaffActionsMenu.tsx:42-44` | `StaffContent` passes an inline `onModalOpenChange` arrow function per row, and `StaffActionsMenu` includes `onModalOpenChange` in its `useEffect([isRemoveOpen, resendResult, onModalOpenChange])` dependency array. | Verified in source: when `rowModalOpenCount` updates, every row re-runs its effect. With 1 staff row, opening `RemoveStaffDialog` or `resendResult` causes an infinite `+1` render loop; with 3+ rows, closed rows subtract `-1` and reset `rowModalOpenCount` to `0` (`isPaused={false}`) while the modal remains open. |
| F10 | `ProductSetupWizard.tsx:88-94,280,287`, `ValidationWorkspaceSection.tsx:245-252`, `ReviewAndPublishSection.tsx:206-236` | Revisiting `validation` leaves `ProductSetupWizard.validationState` stale (`{ isLoading: false, hasDefinition: true }`) for 1 render frame before `ValidationWorkspaceSection`'s effect resets `isLoading: true`. On `review`, `admin-setup-review-publish` excludes the `Activate Product` button and lacks a loading/error pause guard. | Verified in source: revisiting `validation` flashes the tour open for 1 frame and triggers focus restoration onto `AdminHelpButton` during loading; `review` spotlights only the validation checklist box. |
| F11 | `OnboardingTourPopup.tsx:313-325,522-546,626-632`, `WorkspaceOnboardingTour.tsx:38,45-162`, `PaperDetectionConfirmationModal.tsx:1548-1566` | (a) `handleWheel` blocks wheel/trackpad scrolling inside `spotlightEl` (unlike `handleTouchMove`); (b) when `blocking && !targetRect`, renders a `pointer-events-auto fixed inset-0` curtain; (c) does not move focus into the popup on open or trap `Tab` when `aria-modal="true"`; (d) pausing a tour (`isPaused = true` -> `isOpen = false`) runs focus restoration onto `Help` behind the newly opened domain modal; (e) `WorkspaceOnboardingTour` returns `null` when closed and omits `restoreFocusSelector` (as does `PaperDetectionConfirmationModal`). | Verified in source: keyboard users can `Tab` into background elements behind the backdrop, opening a modal from a spotlighted button pulls focus to `Help` behind the modal, wheel scrolling fails inside spotlighted drawers, and closing MS89 tours does not restore focus to the `Help` trigger. |
| F12 | `PaperDetectionConfirmationModal.tsx:86-134,1523-1535`, `ComparisonOnboardingTour.tsx:53`, `BasicInfoSection.tsx:146`, `DashboardContent.tsx:118-138` | Minor UI and copy drift against `ms89.md` and `ms90.md`: (a) Paper tour steps 1, 3, and 4 omit a `Next` button (`tourPrimaryLabel` is `undefined`); (b) Comparison Step 2 omits `"The initial panels may show the same default finish."`; (c) `BasicInfoSection` labels the role card `"Add-on Attachment"` vs `"Add-on Accessory"`; (d) `DashboardContent` welcome cue buttons use `min-h-10` instead of `min-h-11`. | Verified in live browser and source: minor usability and specification alignment gaps. |

---

## 3. Planned Implementation Contract

### 3.1 Client Visualization and Comparison Fixes (`IMP-MS89` & `IMP-MS90`)

1. **Stable `candidates` fallback in `PaperDetectionConfirmationModal.tsx` (Fixes F1):**
   - Replace the inline default parameter `candidates = []` with a module-level constant `const EMPTY_CANDIDATES: PaperCandidate[] = []` (or compare candidate list identity safely without allocating a new array reference during destructuring) so `candidates !== prevCandidates` never triggers an infinite render loop when `paperCalibration?.candidates` is `undefined`.
2. **Coordinate scroll locking with `useDocumentScrollLock` (Fixes F2):**
   - Remove the independent `htmlEl.style.overflow` and `htmlEl.style.overscrollBehavior` mutation/restoration from `OnboardingTourPopup.tsx` in favor of either the shared reference-counted `useDocumentScrollLock(Boolean(isOpen && blocking))` hook or event-level wheel/touch/key scroll prevention paired with reference-counted `<html>` style restoration. Mounting and unmounting `OnboardingTourPopup` inside `PaperDetectionConfirmationModal` or `ProductModelWorkspace` in any order must leave `<html>` and `<body>` unlocked once all locks release.
3. **Preserve `"dont_show_again"` on manual `Help` completion in MS89 (Fixes F3):**
   - Update `completeWorkspaceTour` in `VisualizationOnboardingProvider.tsx` and `completeWorkspaceTourState` in `src/features/visualization/onboarding/store.ts` (and `writeGuidePreference` / `completeGuidePreference` in `src/features/visualization/onboarding/storage.ts`) so clicking `Got it` at the end of a manual `Help` run preserves an existing `"dont_show_again"` status instead of overwriting it to `"completed"`, matching `completeComparisonGuidePreference` in `src/lib/onboarding/storage.ts`.
4. **Restore focus on MS89 tour dismissal and expose `Next` in Paper tour (Fixes F11e, F12a, F12b):**
   - Keep `OnboardingTourPopup` mounted with `isOpen={Boolean(activeStep)}` in `WorkspaceOnboardingTour.tsx` (instead of returning `null` early) and pass `restoreFocusSelector='[data-onboarding-target="workspace-help-trigger"]'` (adding `data-onboarding-target="workspace-help-trigger"` to the workspace `Help` button in `ProductModelWorkspace.tsx` and `data-onboarding-target="paper-tour-help-trigger"` in `PaperDetectionConfirmationModal.tsx`).
   - Provide a `Next` primary action button on steps 1, 3, and 4 of the Paper Calibration Review tour in `PaperDetectionConfirmationModal.tsx` (allowing the user to advance either by selecting the paper option or by clicking `Next`), and reconcile `docs/implementation/ms89.md` to reflect the 5-step paper review sequence (`Select Paper Format`, `Check 4-Corner Boundaries`, `Select Sheet Orientation`, `Confirm Wall Plane`, `Apply or Preview`).
   - Append `"The initial panels may show the same default finish."` to Step 2 in `ComparisonOnboardingTour.tsx`.

### 3.2 Shared `OnboardingTourPopup` and Mobile Ergonomics (`DSD-UI15`, `QAD-TC104.12`, `QAD-TC105.13`, `QAD-TC105.14`)

1. **Mobile compact bottom-sheet layout and sticky footer actions (Fixes F7a, F7b):**
   - In `OnboardingTourPopup.tsx`, structure the card as a flex column (`flex flex-col`) where the header and description scroll inside a bounded body region while the action footer (`Next` / `Got it`, `Skip`, `Don't show again`) remains pinned and always visible at the bottom of the card without requiring the user to scroll to discover `Skip` or `Don't show again`.
   - For `variant === "mobile"`, when a spotlighted target is tall (spanning more than 55% of `viewportHeight` or covering the vertical center, such as `admin-materials-table`, `admin-products-table`, or `admin-setup-3d-viewport`), anchor the compact card as a true bottom sheet (`bottom: 8px` with safe-area padding) rather than clamping `top` to `8px` over the page header and upper target content.
2. **Avoid `AdminHelpButton` collision with sticky wizard/workspace footers on mobile (Fixes F7c):**
   - Adjust `AdminHelpButton.tsx` (or accept a compact/header placement or higher bottom offset when a sticky bottom action bar is present, such as in `ProductSetupWizard.tsx`) so the `Help` trigger never covers `"Continue to Parameters & Rules"` or other primary sticky footer CTAs on `< 768px` viewports.
3. **Wheel scrolling inside spotlight, non-trapping fallback, focus entry, and modal-pause focus guard (Fixes F11a, F11b, F11c, F11d):**
   - In `handleWheel` (`OnboardingTourPopup.tsx`), allow wheel events when `isInsideNode(spotlightEl, event.target)` is true (matching `handleTouchMove`), provided the spotlighted container or one of its ancestors inside `spotlightEl` is scrollable.
   - When `blocking && !targetRect`, set the fallback backdrop to `pointer-events-none` (or keep only the card interactive) so a missing target never creates a full-screen pointer-blocking curtain (`ms90.md` Section 5.4.4).
   - When `OnboardingTourPopup` transitions to `isOpen === true`, move initial focus to the popup card or its primary action button (`cardRef.current?.focus({ preventScroll: true })`) unless focus is already inside the spotlighted target, and handle `Tab` / `Shift+Tab` cycling within the popup when no spotlight target is present (`!targetRect`).
   - Distinguish user-initiated tour dismissal/completion from a temporary pause (`isPaused === true`): pass `isPaused` (or suppress focus restoration when closing due to `isPaused`) so opening a domain modal (`MaterialModal`, `DeleteProductModal`, `DiscardBookingModal`, `InviteStaffDialog`, `BusinessIntelligenceModal`) from a spotlighted button keeps focus inside the newly opened modal instead of pulling focus back to `AdminHelpButton`.

### 3.3 Admin Workbench Surfaces (`IMP-MS90`)

1. **`StaffContent` and `StaffActionsMenu` modal tracking stability (Fixes F9):**
   - Wrap the `onModalOpenChange` handler in `StaffContent.tsx` with `useCallback` AND track each row's previous modal-open boolean in a `useRef` inside `StaffActionsMenu.tsx` so `onModalOpenChange` is invoked only when `isModalOpen = isRemoveOpen || resendResult !== null` actually transitions (`false -> true` or `true -> false`), never on mount or unrelated re-renders.
2. **`AdminBookingsOnboardingTour` empty-filter guard and focus restoration (Fixes F4a, F4b):**
   - In `BookingsContent.tsx` and `AdminBookingsOnboardingTour.tsx`, treat `hasVisibleSelectedBooking = filteredBookings.length > 0 && Boolean(selectedBooking)` as the condition for Phase 2 (`inspector_negotiation`) eligibility and step counting. When `filteredBookings.length === 0`, completing Step 2 of `queue_orientation` finishes the 2-step orientation tour cleanly without advancing to Phase 2 or displaying `"Step 4 of 2"`, leaving `inspector_negotiation` `"unseen"` until a booking is actually visible in the filtered list.
   - Keep `OnboardingTourPopup` mounted in `AdminBookingsOnboardingTour.tsx` with `isOpen={Boolean(activePhase && steps.length > 0)}` (and suppress focus restoration only when `isPaused` is true) so dismissing the Bookings tour via `Got it`, `Skip`, or `Escape` restores focus to `[data-onboarding-target="admin-header-help"]`.
3. **`ProductSetupWizard` whole-model asset URL resolution, role-aware phase filtering, and step-transition state reset (Fixes F5, F6, F10, F12c):**
   - In `getProductDraft` (`src/lib/admin/products/productMutations.ts`), populate `file_url: a.r2_object_key ? getR2AssetUrl(a.r2_object_key) : null` on each returned `product_assets` item (matching `CatalogAssetsSection.tsx`), and allow `ProductSetupWizard.tsx` to check `Boolean(a.file_url || a.r2_object_key)` so `wholeModelAsset` resolves reliably and mounts `[data-onboarding-target="admin-setup-extract-whole-model"]` when a whole `.glb` exists.
   - In `ProductSetupOnboardingTour.tsx`:
     - When `productRole === "addon"` and `activeStep === "parameters"` with `parametersTab === "addons"`, do not launch an automatic tour instructing the admin to bind screens/grilles; if `Help` is clicked on that tab for an add-on, show accurate copy explaining that add-on items attach to standard host fixtures and cannot attach nested add-ons.
     - When `productRole === "accessory"` and `activeStep === "validation"`, target the mounted hardware accessory handing & preview controls (adding `data-onboarding-target="admin-setup-validation-accessory-dock"` to the `Hardware Accessory Handing Dock` in `ValidationWorkspaceSection.tsx` with fallback to `admin-setup-validation-sliders` for non-accessories) and adapt Step 1 & Step 2 copy to describe testing `Left Side` / `Right Side` mirrored handing and verifying the accessory unit cost and readiness gate (without referencing nonexistent Width/Height sliders, removable sills, or the `Materials` tab).
   - When switching `activeStep` in `ProductSetupWizard.tsx`, synchronously reset `validationState` to `{ activeTab: "dimensions", isLoading: true, hasError: false, hasDefinition: false }` when entering `"validation"` and reset `parametersTab` to `"parameters"` when entering `"parameters"` so stale state from an earlier visit never causes a 1-frame tour flash.
   - In `ReviewAndPublishSection.tsx`, move `data-onboarding-target="admin-setup-review-publish"` to wrap both the `Automatic Validation` readiness card and the `Activate Product` action footer, and pass `reviewLoading || reviewHasError` to pause the `review` tour while draft data is still loading.
   - Align the role card title in `BasicInfoSection.tsx` (`"Add-on Accessory (Screen / Grille)"` or matching tour copy) so card labels and tour copy use identical terminology.
4. **`SettingsContent` spotlight target and role-check normalization (Fixes F8, F12d):**
   - In `SettingsContent.tsx`, wrap the top profile and security row (or include both `AdminProfileCard` and `SecurityCard` inside `data-onboarding-target="admin-settings-profile-card"`) so Step 1 (`"Profile, Password & Email Approval Rules"`) spotlights both cards together rather than dimming `SecurityCard`.
   - Normalize role comparisons in `AdminProfileCard` (`role.toLowerCase() === "staff"`, `role.toLowerCase() === "owner" || role.toLowerCase() === "manager"`) for consistency with the rest of `SettingsContent.tsx` and `adminTourConfigs.ts`.
   - Update the welcome cue buttons in `DashboardContent.tsx` from `min-h-10` to `min-h-11` (`44px`).

Before writing Next.js code, read the relevant installed guide in `node_modules/next/dist/docs/`. Reuse existing repository components and Tailwind tokens. No new third-party dependency, database migration, or FastAPI change is required.

---

## 4. Agent Delegation Before Implementation

This document is a read-only planning specification created after live browser and source QA. No implementation subagent has modified repository code.

| Agent | Later responsibility | Ownership |
|---|---|---|
| `frontend-developer` (Client & Shared Popup) | Implement Section 3.1 and Section 3.2 fixes across `OnboardingTourPopup.tsx`, `PaperDetectionConfirmationModal.tsx`, `VisualizationOnboardingProvider.tsx`, `WorkspaceOnboardingTour.tsx`, `ComparisonOnboardingTour.tsx`, and `AdminHelpButton.tsx`. | Shared popup primitive and client visualization/comparison onboarding files. |
| `frontend-developer` (Admin Surfaces) | Implement Section 3.3 fixes across `StaffContent.tsx`, `StaffActionsMenu.tsx`, `BookingsContent.tsx`, `AdminBookingsOnboardingTour.tsx`, `productMutations.ts`, `ProductSetupWizard.tsx`, `ProductSetupOnboardingTour.tsx`, `ValidationWorkspaceSection.tsx`, `ReviewAndPublishSection.tsx`, `BasicInfoSection.tsx`, `SettingsContent.tsx`, and `DashboardContent.tsx`. | Admin workbench onboarding components and host surface targets. |
| `qa-expert` | Add regression tests to `tests/unit/ms89Onboarding.test.ts` and `tests/unit/ms90Onboarding.test.ts` and re-run live desktop (`1280x720`) and mobile (`390x844`) Chromium verification across client and authenticated admin flows. | Automated unit/contract tests and live browser verification evidence. |
| `code-reviewer` | Verify zero regressions across `npm run test:ms89`, `npm run test:ms90`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`, and confirm adherence to `AGENTS.md` bans. | Read-only final review. |

---

## 5. Verification and Acceptance

| Case | Required result |
|---|---|
| FIX22-V1: Paper modal candidate stability | Opening `PaperDetectionConfirmationModal` with `candidates={undefined}` renders Step 1 of the Paper Calibration Review tour cleanly with zero infinite re-render crashes or console errors (`QAD-TC104.2`). |
| FIX22-V2: Document scroll-lock release | Opening `PaperDetectionConfirmationModal` while its blocking tour is active and then closing the modal via `Continue Approximate Preview`, `Cancel`, or confirmation leaves `document.documentElement.style.overflow` and `document.body.style.overflow` unlocked so the page scrolls normally (`QAD-TC104.2`, `QAD-TC104.12`). |
| FIX22-V3: MS89 `dont_show_again` precedence | Clicking `Don't show again` on the visualization workspace tour, opening a manual run via `Help`, and clicking `Got it` on the final step preserves `status: "dont_show_again"` in `localStorage["glassfit.onboarding.preference.v1"]` (`QAD-TC104.11`). |
| FIX22-V4: Bookings empty-filter & focus restoration | On `/admin/bookings`, filtering to 0 matching bookings and clicking `Got it` on Step 2 ends `queue_orientation` cleanly (`Step 2 of 2`) without jumping to `"Step 4 of 2"`, while keeping `inspector_negotiation` `"unseen"` until a booking is visible. Closing the Bookings tour via `Got it`, `Skip`, or `Escape` restores focus to `AdminHelpButton` (`QAD-TC105.7`, `QAD-TC105.14`). |
| FIX22-V5: Staff row modal pause stability | On `/admin/staff` with 1, 2, or 3+ staff rows, opening and closing `RemoveStaffDialog` or the `Resend Invite` code modal increments `rowModalOpenCount` to `1` (`isPaused === true`) and returns it to `0` on close without infinite re-renders or premature unpausing (`QAD-TC105.11`, `QAD-TC105.12`). |
| FIX22-V6: Product Setup whole-model extraction target | For a product draft with an active `Whole Model` or `Catalog 3D Preview` asset in `product_assets`, `getProductDraft` populates `file_url` and Step 4 (`components` with `mappedFiles.length === 0`) renders `[data-onboarding-target="admin-setup-extract-whole-model"]` and displays the whole-model extraction guidance (`QAD-TC105.4`). |
| FIX22-V7: Product Setup `addon` & `accessory` role accuracy | On an `addon` product, switching to `Compatible Add-ons` does not auto-launch host-only add-on binding instructions. On an `accessory` product, entering `validation` spotlights the accessory handing & preview controls with accessory-specific copy rather than empty dimension sliders (`QAD-TC105.3`, `QAD-TC105.4`). |
| FIX22-V8: Setup Wizard revisit & Review spotlight | Revisiting `validation` or `parameters` does not flash a 1-frame tour popup while `ValidationWorkspaceSection` loads. On `review`, `admin-setup-review-publish` encompasses both the readiness checklist and `Activate Product` button (`QAD-TC105.4`, `QAD-TC105.12`). |
| FIX22-V9: Mobile `< 768px` sheet footer & non-overlapping placement | On `390x844` mobile viewports across `/admin/materials`, `/admin/products`, `/admin/products/[productId]/setup`, and client workspace/comparison tours, `Skip` and `Don't show again` remain visible in a pinned footer inside the compact card, tall targets anchor the sheet at the bottom rather than covering the top header/viewport, and `AdminHelpButton` does not cover sticky wizard footer CTAs (`QAD-TC104.12`, `QAD-TC105.13`). |
| FIX22-V10: Settings Step 1 spotlight & role check | Clicking `Help` on `/admin/settings` spotlights both `AdminProfileCard` and `SecurityCard` on Step 1, and `AdminProfileCard` role checks are case-insensitive (`QAD-TC105.11`). |
| FIX22-V11: Shared popup focus, wheel scroll, and modal-pause guard | `OnboardingTourPopup` permits wheel scrolling inside scrollable spotlighted elements, keeps missing-target fallback non-trapping, moves initial focus safely on open, restores focus to `Help` on user close across MS89 and MS90, and does not steal focus to `Help` when pausing for an opened domain modal (`QAD-TC104.13`, `QAD-TC105.12`, `QAD-TC105.14`). |
| FIX22-V12: Quality gates | `npm run test:ms89`, `npm run test:ms90`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `GET http://localhost:8000/health` all pass with updated unit and live browser evidence recorded. |

Focused test commands for the implementation pass:

```sh
npm run test:ms89 && npm run test:ms90
```

---

## 6. Execution Order and Completion Gate

1. Implement the shared `OnboardingTourPopup`, scroll-lock coordination, and `AdminHelpButton` mobile placement fixes (Section 3.2).
2. Implement the client visualization and comparison fixes in `PaperDetectionConfirmationModal.tsx`, `VisualizationOnboardingProvider.tsx`, `WorkspaceOnboardingTour.tsx`, and `ComparisonOnboardingTour.tsx` (Section 3.1).
3. Implement the admin workbench fixes across `StaffContent.tsx`, `StaffActionsMenu.tsx`, `BookingsContent.tsx`, `AdminBookingsOnboardingTour.tsx`, `productMutations.ts`, `ProductSetupWizard.tsx`, `ProductSetupOnboardingTour.tsx`, `ValidationWorkspaceSection.tsx`, `ReviewAndPublishSection.tsx`, `BasicInfoSection.tsx`, `SettingsContent.tsx`, and `DashboardContent.tsx` (Section 3.3).
4. Add behavioral unit tests for each regression case in `tests/unit/ms89Onboarding.test.ts` and `tests/unit/ms90Onboarding.test.ts`.
5. Run `npm run test:ms89`, `npm run test:ms90`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and live desktop/mobile browser checks to verify `FIX22-V1` through `FIX22-V12`.

The fix is complete when all 12 acceptance cases pass in automated tests and live desktop and mobile browser verification without regressions.

## Self-Check

- [x] Uses the next numbered `fix-##.md` convention (`fix-22`) and upstream specification IDs (`IMP-MS89`, `IMP-MS90`, `QAD-TC104`, `QAD-TC105`).
- [x] Covers every confirmed live browser and code-verified defect from client and admin QA.
- [x] Separates shared popup ergonomics, client visualization/comparison fixes, and admin workbench fixes.
- [x] Defines concrete agent ownership and measurable acceptance criteria (`FIX22-V1` through `FIX22-V12`).
- [x] Contains zero em-dashes (`BAN-PUNCT-01`) and zero box diagrams (`BAN-DIAG-03`).
- [x] Creates documentation only; no application code or test files were modified.
