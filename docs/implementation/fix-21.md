# Implementation Specification: Update GlassFit Contact Number and Viber Consultation Destination (fix-21)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)
**Document ID:** fix-21
**Document Function:** Technical fix plan for updating the business contact number and directing Viber consultation handoff to the same number
**Version:** 1.0.0
**Date:** November 15, 2026
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)
**Status:** Ready for Implementation; plan only
**Primary Traceability:** `BRD-M1`, `PRD-F13`, `SDD-C8`, `DSD-UI8`, `QAD-TC13`, `QAD-TC29`; regression guards for `PRD-F12`, `PRD-F14`, `ERD-E15`, `ERD-E16`, `ERD-E18`
**Upstream Specifications:** `docs/brd-glassfit.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/erd-glassfit.md`, `docs/qad-glassfit.md`, `docs/build-glassfit.md`, `docs/implementation/fix-ui11.md`

---

## 1. Required Outcome and Scope

Use the user-supplied **09053258970** as GlassFit's business contact number and the destination for Viber consultation handoff. Preserve each existing UI number format, label, icon, typography, spacing, layout, and responsive behavior. Public contact text currently uses a hyphenated local number; replace only its digits so it reads **0905-325-8970**.

| Representation | Required value | Use |
|---|---|---|
| Local digits | `09053258970` | User-supplied business number |
| Existing public UI format | `0905-325-8970` | Header strips, footer, privacy policy, and terms |
| Existing admin international display format | `+63 905 325 8970` | Business Contact Phone defaults and placeholder |
| International destination | `+639053258970` | Viber destination before URI encoding |

Keep customer and staff phone numbers, authentication validation, Messenger destination, quotation content, and signed-reference semantics unchanged. This document creates a plan only. It does not modify application code, tests, database records, migrations, or dependencies. `FIX21-V1` through `FIX21-V7` are plan-local acceptance cases, not new QAD identifiers.

---

## 2. Confirmed Findings and Evidence Boundary

| Evidence | Consequence |
|---|---|
| Public business contact text is duplicated as `0918-601-4737` across the files listed below. | Updating only the footer would leave other customer-facing contact details inconsistent. |
| `formatBookingShareMessage()` in `src/lib/pricing/quotationPdfGenerator.ts` generates `viber://forward?text=...`. It contains no business destination number. | The Viber portion requires a destination-aware handoff change, not a replacement of an existing phone literal. |
| `src/features/booking/components/Step3SendReference.tsx` assigns `viberUrl` to `window.location.href`, then calls `onSend("Viber")`. It already provides full-message copy and clipboard-error feedback. | Reuse the existing handoff and copy controls. An attempted launch must not be represented as proof that a message was sent. |
| `SDD-C8` describes `viber://chat?number=...`; PRD-F13 expects a business-directed handoff with the signed reference available. `fix-ui11` implemented a compact forward message with a 200-character guard. | Verify the targeted-chat contract before changing the URI. Do not assume a forward/share URI can select a recipient or a chat URI supports the same text-prefill parameters. |
| `SettingsContent.tsx` and `settingsActions.ts` use `+63 917 123 4567` as a business-contact fallback. `system_preferences.contact_phone` is read separately from the database, and migration 011 seeded that placeholder. | Updating source defaults alone does not update a stored admin preference. Keep the existing international display format and include persisted settings in rollout verification. |
| Existing unit tests assert the forward URI, embedded message, and length guard. | Update those expectations to the verified destination contract while protecting the complete consultation reference and message fallback. |

This investigation inspected repository source only. The current stored business preference, Viber registration of the supplied number, and physical-device launch behavior have not been verified. The user has supplied the intended destination; device verification must establish whether the handoff reaches it.

---

## 3. Planned Implementation Contract

### 3.1 Public contact surfaces

Replace `0918-601-4737` with `0905-325-8970` in these existing business-contact locations:

| File | Location |
|---|---|
| `src/components/shared/BackgroundNavbar.tsx` | Phone label |
| `src/components/ui/Footer.tsx` | Contact Number text |
| `src/features/home/components/HeroSection.tsx` | Phone label |
| `src/features/product/components/HeroSection.tsx` | Phone label |
| `src/features/visualization/components/HeroSection.tsx` | Phone label |
| `src/features/privacy/components/HeroSection.tsx` | Phone label |
| `src/features/terms/components/HeroSection.tsx` | Phone label |
| `src/features/profile/components/ProfileHero.tsx` | Phone label |
| `src/features/my-requests/components/MyRequestsPage.tsx` | Phone label |
| `src/features/privacy/components/privacyData.ts` | Both Contact Number entries |
| `src/features/terms/components/termsData.ts` | Contact Number entry |

Keep this a focused content update. Do not redesign the contact strips, add new contact actions, or refactor the page layouts. Search active application source again during implementation for additional business-number references introduced after this plan.

### 3.2 Admin business contact consistency

1. Update the business defaults in `src/features/admin/settings/SettingsContent.tsx` and `src/features/admin/settings/settingsActions.ts`, including the Contact Phone placeholder, to `+63 905 325 8970`.
2. During rollout, inspect the saved `GLOBAL_PREFERENCES` business contact and update it through the existing authorized Owner settings workflow. Preserve all other settings. Do not claim that source fallback edits changed a persisted value.
3. For fresh database installations, add a narrowly scoped reversible migration that changes the `contact_phone` column default and replaces the known seeded placeholder for the business singleton. Preserve unrelated customized values and document rollback without overwriting subsequent Owner edits. Follow repository schema-snapshot conventions if `schema.sql` needs synchronization; do not rewrite historical migration 011 or perform unversioned SQL mutations.
4. Do not connect public contact rendering to a new database fetch or alter settings permissions as part of this fix. Do not replace generic customer-phone examples or customer/staff records merely because they resemble the old business number.

### 3.3 Viber consultation handoff

1. Use `+639053258970` as the destination identity. Normalize the Philippine local number by replacing the leading `0` with `+63`, without retaining an extra zero. Encode the destination according to the verified Viber URI contract.
2. Check current official Viber guidance and test the `SDD-C8` targeted-chat scheme on supported devices before finalizing the link builder. The intended result is a conversation addressed to this number. A generic recipient picker does not satisfy the destination requirement.
3. Update `formatBookingShareMessage()` and its consumer in `Step3SendReference.tsx` together. Preserve Messenger behavior and the complete full-message text, including the quotation number, amount, customer details, applicable waiver/add-on text, and intact signed reference.
4. Preserve prefilling where the targeted-chat contract supports it. If direct chat cannot also prefill text, reuse the existing Copy Message control and feedback area to explain copying and pasting into the targeted conversation. Do not invent URI parameters or silently revert to a generic share destination. Reconcile this platform limitation with the PRD-F13/SDD-C8 acceptance wording during implementation.
5. Keep the existing controls, layout, and visual styling. Limit any feedback wording changes to what is necessary to make the handoff usable. Clipboard denial or an unavailable Viber app must leave the full message and signed link accessible. Keep a user-gesture-safe launch; do not introduce an asynchronous clipboard dependency that prevents the external app from opening.
6. Reassess the forward-specific 200-character guard when switching to a targeted chat. It must not block opening the business conversation merely because a reference is long when the message is supplied through the existing copy path. Never truncate the signed URL.
7. Preserve booking recording, platform selection, and the existing explicit sent-confirmation step. Repeated taps must not create duplicate booking requests. Reconcile the affected `fix-ui11` handoff description after implementation rather than treating its generic forward behavior as the new acceptance target.

Before writing Next.js code, read the relevant installed guide in `node_modules/next/dist/docs/`. Reuse existing components and services. No new dependency or CV change is required.

---

## 4. Agent Delegation Before Implementation

This is a focused plan-only change. No implementation agents were started. A single implementation owner can complete the contact replacements and handoff update; specialist review is only needed if device behavior or persisted-setting rollout requires it.

| Responsibility | Ownership |
|---|---|
| Implementation | Listed contact surfaces, business defaults, narrow migration, and Viber builder/consumer |
| Verification | Existing booking unit suites, contact-format comparison, saved-settings checks, and physical-device handoff evidence |
| Final review | Scope, destination normalization, complete signed-reference availability, and unchanged customer data and Messenger behavior |

---

## 5. Verification and Acceptance

| Case | Required result |
|---|---|
| FIX21-V1: Public contact coverage | Every listed business-contact surface displays `0905-325-8970`, including both privacy-policy entries. No active business-contact UI retains `0918-601-4737`. |
| FIX21-V2: UI format preservation | Compare desktop and mobile views before and after. Hyphen grouping, labels, icons, typography, spacing, layout, and visibility rules remain unchanged. Admin defaults and placeholder retain their international grouping as `+63 905 325 8970`. |
| FIX21-V3: Stored settings | The existing Owner workflow saves and reloads the new business contact without changing unrelated preferences. Fresh-install defaults and the known seeded placeholder use the new number. Migration rollback is verified on disposable data and does not overwrite later Owner edits. |
| FIX21-V4: Correct Viber destination | On Android and iOS with Viber installed, Send via Viber reaches the conversation for `+639053258970`. Record the tested app/browser versions and actual destination. A recipient picker or a syntactically valid URI alone is insufficient evidence. |
| FIX21-V5: Message availability and fallback | The complete signed reference and consultation message remain available through supported prefill or the existing copy/paste path. Test long references, clipboard denial, Viber unavailable, and return to browser. No false copied/sent success is shown. |
| FIX21-V6: Regression guards | Messenger retains its destination and message. Booking platform and explicit sent confirmation remain correct; repeated taps do not duplicate records. Customer/staff numbers and authentication validation remain unchanged. Verify `QAD-TC13` and `QAD-TC29` alongside the plan-local Viber cases. |
| FIX21-V7: Quality gates | Update and run the relevant booking tests, then run `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Record pre-existing failures separately. Do not mark external-app behavior verified from unit tests alone. |

Focused booking command for the implementation pass:

```sh
npx tsx --test tests/unit/milestone7.test.ts tests/unit/milestone8.test.ts tests/unit/signedBookingLink.test.ts
```

Run `tests/unit/systemPreferencesSchedule.test.ts` if settings defaults or persistence expectations change. Extend focused link-builder tests to check the normalized destination and preserve message/reference behavior, rather than adding source-text tests for every static phone label. The FastAPI service is outside this fix; if it is running during broader verification, record the standard `GET http://localhost:8000/health` result separately.

---

## 6. Execution Order and Completion Gate

1. Recheck the source inventory, capture existing contact formats, and verify the Viber targeted-chat contract.
2. Replace public contact text and admin defaults, and prepare the narrow fresh-install migration and persisted-setting rollout.
3. Implement the destination-aware Viber handoff and preserve the full-message fallback; update affected booking tests and handoff documentation.
4. Run the focused and repository quality gates, verify settings, compare UI formats, and complete the device matrix.
5. Record implementation and acceptance evidence separately before updating this plan's status.

The fix is complete when GlassFit's business contact consistently uses the supplied number with existing UI formats preserved, and Viber consultation handoff reaches that number with the complete signed reference available.

## Self-Check

- [x] Uses the next numbered `fix-##.md` convention and existing specification IDs.
- [x] Preserves the user's number and each existing UI display format.
- [x] Lists every confirmed public business-contact source location.
- [x] Distinguishes the existing generic Viber forward action from a destination-aware business handoff.
- [x] Covers stored admin preferences without editing customer data or historical migrations.
- [x] Defines measurable acceptance and separates source evidence from device verification.
- [x] Creates documentation only; no implementation or runtime verification was performed.
