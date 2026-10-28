# Implementation Specification: Admin Components Pre-Merge Validation and Save Integrity (fix-13)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document ID:** fix-13  
**Document Function:** Technical plan for correcting the Step 4 regressions found in the `fix/step4-product` pre-merge QA review  
**Version:** 1.0.0  
**Date:** October 28, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Ready for Implementation; no application changes in this planning pass  
**Primary Traceability:** `PRD-F5`, `PRD-F10`, `PRD-F14`, `PRD-F19`, `SDD-C4`, `SDD-C7`, `SDD-C9`, `DSD-UI10`, `ERD-E6`, `ERD-E17`, `QAD-TC19`, `QAD-TC79`, `QAD-TC89`, `QAD-TC94.7` through `QAD-TC94.17`  
**Upstream Specifications:** `docs/brd-glassfit.md`, `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/erd-glassfit.md`, `docs/qad-glassfit.md`, `docs/build-glassfit.md`, `docs/implementation/ms79.md`  
**Comparison Base:** `origin/dev` at `3e02094`; reviewed branch at `788ad59`  

---

## 1. Decision Summary

Hold the merge of `fix/step4-product` into `dev` until Step 4 uses the same product and component eligibility rules as publication, component and material changes have a reliable failure boundary, and the desktop sidebar fits the viewport. Complete the browser acceptance cases after restoring an isolated 18-part Jalousie test fixture. This plan also covers two smaller Step 4 issues identified during QA: the second upload upsert can discard accessory metadata, and the issue filter can hide unsaved parts.

No application code, migration, dependency, or test is changed by this document.

---

## 2. QA Evidence and Defect Analysis

| ID | Evidence in current branch | Impact and confidence |
|---|---|
| FIX13-01 | `StructuralComponentsSection.tsx` `handleContinue` rejects every empty `mappedFiles` list. `publishMutations.ts` permits a Fixed product with an active Whole Model or Catalog 3D Preview asset and no separate components. | Confirmed rule conflict. A valid Fixed whole-model product cannot leave Components. |
| FIX13-02 | `handleContinue` requires `rawMaterialId` for every non-slot part in a Parametric product. `publishMutations.ts` exempts fixed-price or `FIXED` dimension parts from raw material requirements. | Confirmed rule conflict. Valid fixed-price parts cannot advance. |
| FIX13-03 | `componentMutations.ts` writes `product_components` and then deletes, clears, and upserts `product_component_materials` through separate requests. A later error is returned after earlier writes can commit. | Confirmed non-atomic database sequence. The exact failure outcome needs fault-injection verification. |
| FIX13-04 | `adminSidePanel.tsx` changed the valid desktop calculated height to `lg:h-100vh`. The production CSS contains no rule for that class; the base `h-full` remains with a 106px top offset. | Confirmed styling regression. The bottom of the desktop sidebar can fall below the viewport. |
| FIX13-05 | After GLB upload, `processSingleUpload` upserts the component again with a smaller `componentData` object, omitting `accessory_category`. The mutation replaces `component_data` rather than merging stored keys. | Confirmed metadata overwrite path. The normal new-accessory upload initializes its price, so a zero-price result is conditional on a missing or legacy price value. |
| FIX13-06 | The "Show issues only" predicate includes error and missing-material parts but excludes an unsaved part that already has a material. | Confirmed filter omission relative to the MS79 readiness goal. |

The pre-merge QA run passed `npx tsc --noEmit`, `npm run build`, changed-file ESLint, and the CV health request. The focused suite passed 49 of 53 tests. Four accessory wizard failures and three repository-wide lint errors occur in files unchanged from `origin/dev`; compare them against the baseline and track them separately. The authenticated Jalousie page available during QA contained zero components, so QAD-TC94 part, material, and hover interactions were not completed. That fixture state is a verification gap, not proof that the branch removed parts.

---

## 3. Traceability and Acceptance Mapping

| Requirement | fix-13 responsibility |
|---|---|
| PRD-F5, SDD-C4 | Preserve valid whole-model and component-based 3D product workflows. |
| PRD-F10, SDD-C7 | Keep fixed-price component eligibility and persisted material pricing consistent with publication. |
| PRD-F14, PRD-F19, SDD-C9, DSD-UI10 | Make the admin Components step navigable, accurately labeled, and recoverable after save errors. |
| ERD-E6, ERD-E17 | Keep component rows, material bindings, default material, and asset references consistent. |
| QAD-TC19, QAD-TC79, QAD-TC89 | Preserve wizard progression, Fixed strategy behavior, and accessory product flows. |
| QAD-TC94.7 through QAD-TC94.17 | Verify save state, failure recovery, removal, readiness, responsive layout, and normal, Fixed, and accessory parity. |
| FIX13-V1 through FIX13-V8 | Plan-local acceptance cases below; these are not new QAD catalog IDs. |

---

## 4. Architectural Scope and Implementation Plan

### 4.1 Align Step 4 eligibility with publication

1. Extract or share a pure, typed eligibility rule so the Components step and `activateProduct` cannot independently redefine whether a product needs components or whether a component needs a raw material. Keep publication as the final server-side authority.
2. For Fixed products, allow an empty component list only when the product has a qualifying active Whole Model or Catalog 3D Preview asset. Keep a clear error when neither an asset nor components exist. Confirm how the Step 4 server input obtains current asset status; do not rely on an unverified client-only flag.
3. For Parametric products, require components and a material for each material-priced part. Exempt a part when its persisted pricing contract is Fixed, its dimension binding is `FIXED`, or its positive unit price makes it fixed under the publication rule. Preserve accessory slot validation and the accessory product path.
4. Use the same eligibility result for the readiness summary, issue filter, and Continue error. Show the actual missing prerequisite for each part instead of a combined material-and-preview message.

### 4.2 Make component and binding saves consistent

1. Define one database transaction boundary for a component row and its complete material-binding set. Validate the normalized bindings and default before mutation; commit all component, binding, and default changes together or roll all of them back. Do not treat sequential Supabase client requests as a transaction.
2. If a PostgreSQL function is needed, add it through a reversible file in `supabase/migrations/`. Preserve `manage_products` authorization, authenticated RLS behavior, template ownership checks, and existing accessory approval checks. Do not expose the service-role key to the client.
3. Make retries idempotent for a stable template and component key. Verify that a failed update leaves the prior default, candidate set, and component pricing unchanged; a failed insert leaves no partial component or bindings.
4. Account for the R2 upload boundary separately because object storage and PostgreSQL do not share a transaction. Stage and confirm the object in a defined order, commit database references only after the upload succeeds, and define cleanup or retry behavior for orphaned staged objects. Report partial asset failure accurately without claiming the component is fully saved.
5. Preserve failed local edits, surface the failed part and reason, and prevent Continue until the failed operation is reconciled. Keep pending removals recoverable before their successful save.

### 4.3 Preserve upload metadata

Build one complete typed component payload for the initial and post-upload persistence steps, changing only the model URL when it becomes available. Retain `accessory_category`, handing metadata, dimensions, material bindings, unit price, and pricing method on both writes. A missing legacy price must retain its previous persisted value or fail validation with a specific message; it must not silently become zero.

### 4.4 Restore sidebar and issue visibility

Restore a valid desktop height calculation based on the 106px top offset, using an established Tailwind arbitrary value or existing layout token. Verify scroll reachability at desktop, laptop, phone, and 200% zoom. Make "Show issues only" include every unsaved, failed, missing-required-material, or missing-model part using the same readiness rule as Continue. Keep ordinary saved parts out of the filtered view.

### 4.5 Planned file ownership

| File or area | Planned change |
|---|---|
| `src/features/admin/products/setup/StructuralComponentsSection.tsx` | Apply shared eligibility, accurate readiness and issue filtering, complete upload payload, and truthful save feedback. |
| `src/lib/admin/products/publishMutations.ts` and a shared domain helper | Reuse one product and component eligibility contract without weakening final publication checks. |
| `src/lib/admin/products/componentMutations.ts` | Replace partial component and binding writes with an atomic authorized mutation; preserve deletion and retry semantics. |
| `supabase/migrations/` | Add a reversible transaction function only if required by the chosen database boundary. |
| `src/components/ui/adminSidePanel.tsx` | Correct desktop height using current design patterns. |
| Focused unit and integration tests | Exercise eligibility, transaction rollback, idempotent retry, metadata parity, filter logic, and responsive behavior where automation is meaningful. |

Read the relevant installed Next.js 16 guide in `node_modules/next/dist/docs/` before changing any Next.js code. Use the repository's existing libraries, schemas, UI tokens, and server/client boundaries.

### 4.6 Out of scope

- New pricing formulas, new product roles, customer visualization changes, or FastAPI behavior changes
- A new UI library, arbitrary styling system, or third-party dependency
- Rewriting the source Jalousie GLB or changing live product data to make QA pass
- Implementing the separate 3D picking correction specified in `fix-ui6.md`

---

## 5. Verification and Test Catalog

| Case | Required result |
|---|---|
| FIX13-V1: Fixed whole model | A Fixed product with an active qualifying whole-model asset and zero components can advance; one with neither asset nor components receives a specific error. |
| FIX13-V2: Parametric fixed-price part | A Parametric product containing a valid fixed-price or `FIXED` part without a raw material can advance, while a material-priced part without a default is blocked. |
| FIX13-V3: Binding rollback | Inject failure at prune, default reset, and binding upsert. The database retains the previous component, default, and binding set after each failure. |
| FIX13-V4: Retry and removal | Retry after a failed save commits once without duplicate bindings. Failed removal remains visible as pending; successful removal stays removed after reload and step navigation. |
| FIX13-V5: Upload metadata | Save and reload new and legacy accessory parts. Category, price, handing, dimensions, bindings, and model URL match the intended payload after the post-upload write. |
| FIX13-V6: Issue filter | Unsaved material-assigned parts, failed parts, and missing required data appear under "Show issues only"; saved valid parts do not. Counts agree with readiness and Continue. |
| FIX13-V7: Sidebar layout | The desktop sidebar ends within the viewport and its last control is scroll-reachable at normal and 200% zoom; mobile drawer behavior remains intact. |
| FIX13-V8: Browser acceptance | On an isolated 18-part Jalousie fixture, execute applicable QAD-TC94 cases, including save failure and recovery, material assignment, keyboard use, and responsive widths. Run Fixed and accessory fixtures as separate cases. Record remaining `fix-ui6` picking results separately. |

Restore or seed the Jalousie fixture in an isolated QA environment using the existing versioned data path. Verify its 18 parts and required raw materials before starting browser cases. Do not alter a live draft merely to manufacture a passing fixture.

After implementation, run focused eligibility and component-material tests, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `GET http://localhost:8000/health`. Compare unchanged lint and accessory-wizard failures with `origin/dev`; report new failures as regressions and baseline failures separately. Database integration tests must run against an isolated migrated database so rollback behavior is observable.

---

## 6. Risks and Controls

| Risk | Control |
|---|---|
| Client-side eligibility diverges from publication again | Use one typed domain rule and test both Step 4 and publication entry points against the same cases. |
| A database error leaves part of a material change committed | Use a single PostgreSQL transaction and inject failures at each write stage. |
| R2 upload succeeds while database persistence fails | Define staged-object cleanup or idempotent retry and show an accurate failed state. |
| A migration changes authorization semantics | Verify admin permission and RLS with authorized and unauthorized sessions before rollout. |
| An empty Jalousie fixture is mistaken for completed browser QA | Require fixture verification and record screenshots and observed outcomes for each browser case. |

---

## 7. Readiness Decision

Implementation can start from this plan. Merge approval remains pending until FIX13-V1 through FIX13-V8 pass, the QAD-TC94 browser evidence is recorded, and any unchanged baseline failures are identified separately. This document alone does not close the QA findings.

---

## Self-Check

- [x] Uses the next numbered `fix-##.md` filename and the existing implementation-specification structure.
- [x] Links every planned code area and acceptance case to upstream PRD, SDD, DSD, ERD, and QAD requirements.
- [x] Separates confirmed source conflicts, conditional risks, baseline failures, and the browser fixture gap.
- [x] Preserves Next.js, Supabase RLS, architecture, dependency, and UI-style constraints.
- [x] Contains no application implementation or schema mutation.
