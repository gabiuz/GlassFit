# Implementation Specification: Admin Product Setup Wizard Step Progression & Draft Route State Synchronization (fix-11)

**Project:** GlassFit (Web-Based Client-Space Visualization System for Customized Glass & Aluminum)  
**Document Function:** Technical specification for fixing Step 1 to Step 2 route reset defect in Admin Product Setup Wizard  
**Version:** 1.0.0  
**Date:** September 30, 2026  
**Owner:** Reynard John B. Rabanal (Lead Product / Systems Architect) & GlassFit Capstone Team (PUP CCIS)  
**Status:** Ready for Implementation  
**Upstream Specifications:** `docs/prd-glassfit.md`, `docs/sdd-glassfit.md`, `docs/dsd-glassfit.md`, `docs/erd-glassfit.md`, `docs/qad-glassfit.md`, `docs/milestone.md` (MS-10)  

---

## 1. Decision Summary

When an administrator creates a new product via the Admin Product Setup Wizard (`/admin/products/draft/setup`), completing Step 1 (Basic Info) and clicking "Save & Continue" must advance the wizard to Step 2 (Visualization Strategy) and remain securely positioned on Step 2.

The implementation must adopt the following architecture:

1. **URL-Synchronized Wizard Step State:** The active step must be reflected in the route via Next.js App Router search parameters (`?step=<key>`). This makes the wizard step robust against client navigation, server component revalidation, and browser refreshes.
2. **Server Route Async SearchParams Resolution:** In compliance with Next.js 16 specifications, the server route component `ProductSetupRoute` in [page.tsx](file:///d:/Developer/GlassFit/src/app/admin/(protected)/products/[productId]/setup/page.tsx) must await `searchParams`, resolve the requested step through a production `resolveWizardStep` helper, and supply `initialStep` to `ProductSetupWizard`. Repeated `step` parameters must be rejected to the safe `"basic"` default.
3. **Route Component Keying by Product ID:** The server component must mount `<ProductSetupWizard key={productId} ... />` so that when `productId` transitions from the unpersisted pseudo-ID `"draft"` to a real database UUID, React cleanly handles component lifecycle re-initialization with the newly fetched Supabase record.
4. **Coordinated Optimistic Transition & Route Replacement:** In [ProductSetupWizard.tsx](file:///d:/Developer/GlassFit/src/features/admin/products/setup/ProductSetupWizard.tsx), `handleProductCreated` must execute `router.replace(`/admin/products/${newId}/setup?step=strategy`)` concurrently with `setActiveStep("strategy")`. The newly mounted instance on the replaced route will initialize directly to `"strategy"` from its `initialStep` prop, preventing any regression back to `"basic"`.
5. **Draft Boundary Enforcement:** If an unpersisted draft route (`productId === "draft"`) receives a request for a later step (for example, `?step=strategy` or `?step=components`), the server route must defensively force `initialStep` to `"basic"` because no database record exists yet.
6. **Persistence for Step 1 Updates:** When editing an existing product, clicking "Save & Continue" in Step 1 must call a dedicated `updateProductDraft` server action in [productMutations.ts](file:///d:/Developer/GlassFit/src/lib/admin/products/productMutations.ts) before progressing to Step 2, ensuring modifications to name, type, price, and description are saved to PostgreSQL.
7. **Resolved Product Identifier Safety:** In [ProductSetupWizard.tsx](file:///d:/Developer/GlassFit/src/features/admin/products/setup/ProductSetupWizard.tsx), Steps 6 and 7 (`ValidationWorkspaceSection` and `ReviewAndPublishSection`) must consume `currentProductId = draftId || productId` rather than the static `productId` prop, preventing the literal string `"draft"` from being passed to validation or publishing mutations.
8. **Strict Type Safety (BAN-TYPE-05):** Remove all instances of `any` across [BasicInfoSection.tsx](file:///d:/Developer/GlassFit/src/features/admin/products/setup/BasicInfoSection.tsx) and [ProductSetupWizard.tsx](file:///d:/Developer/GlassFit/src/features/admin/products/setup/ProductSetupWizard.tsx), replacing them with explicit TypeScript interfaces and `unknown` error catch blocks.
9. **Focused Acceptance Criterion:** After a successful Step 1 create operation, the browser URL must become `/admin/products/<newId>/setup?step=strategy`, the newly mounted wizard must render Step 2, and the wizard must not return to Step 1 unless the administrator explicitly selects Step 1.

---

## 2. Problem Context & Empirical Defect Analysis

### 2.1 Observed Behavior

When an administrator adds a new product by navigating to `/admin/products/new` (which redirects to `/admin/products/draft/setup`):
1. The administrator inputs product name, product type, base price, and description in Step 1 (Basic Info).
2. The administrator clicks "Save & Continue".
3. The UI momentarily switches to Step 2 (Visualization Strategy).
4. After a fraction of a second, the view reverts back to Step 1 (Basic Info).

The administrator is trapped in Step 1 despite the product draft having been successfully inserted into the Supabase database.

### 2.2 Detailed Execution Trace & Failure Sequence

Here is the exact runtime trace of the current implementation:

1. **Initial Mount:**
   - Route: `/admin/products/draft/setup`
   - Server Component: `ProductSetupRoute` in [page.tsx](file:///d:/Developer/GlassFit/src/app/admin/(protected)/products/[productId]/setup/page.tsx) receives `params: { productId: "draft" }`.
   - `initialData` evaluates to `null`.
   - Renders `<ProductSetupWizard productId="draft" initialData={null} />`.
   - Client Component: `ProductSetupWizard` initializes state:
     ```typescript
     const [activeStep, setActiveStep] = useState<StepKey>("basic");
     const [draftId, setDraftId] = useState<string>("");
     ```

2. **Form Submission:**
   - In [BasicInfoSection.tsx](file:///d:/Developer/GlassFit/src/features/admin/products/setup/BasicInfoSection.tsx), `handleSubmit` calls `createProductDraft(data)`.
   - A row is inserted into the `products` table in Supabase.
   - The server action returns the generated UUID `newProductId` (e.g. `9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`).
   - `BasicInfoSection` invokes `onSave(newProductId, data)`.

3. **Wizard Callback Execution:**
   - `onSave` triggers `handleProductCreated` in [ProductSetupWizard.tsx](file:///d:/Developer/GlassFit/src/features/admin/products/setup/ProductSetupWizard.tsx):
     ```typescript
     const handleProductCreated = (newId: string, data: Record<string, unknown>) => {
         setDraftId(newId);
         setProductData({ ...productData, ...data, product_id: newId });
         router.replace(`/admin/products/${newId}/setup`);
         setActiveStep("strategy");
     };
     ```
   - `setActiveStep("strategy")` updates React state immediately.
   - React renders Step 2 (Visualization Strategy) on screen. The administrator sees Step 2.

4. **The Destructive Reset (Race Condition & Route Unmount):**
   - In parallel, `router.replace('/admin/products/${newId}/setup')` initiates a Next.js App Router client navigation.
   - The URL changes from `/admin/products/draft/setup` to `/admin/products/${newId}/setup`.
   - Next.js evaluates the route on the server: `ProductSetupRoute({ params: { productId: newId } })`.
   - The server component calls `getProductDraft(newId)` and renders `<ProductSetupWizard productId={newId} initialData={freshData} />`.
   - Because the dynamic route segment changed from `draft` to `newId`, Next.js mounts a fresh instance of `ProductSetupWizard`.
   - In the new instance, `useState<StepKey>("basic")` initializes `activeStep` to `"basic"`.
   - The URL contained no query parameter (it was `/admin/products/${newId}/setup`, not `?step=strategy`), and `ProductSetupWizard` had no knowledge of what step the previous instance was on.
   - **Result:** The wizard is reset to Step 1. The administrator experiences this as "goes to step 2 then goes back to step 1".

### 2.3 Root Cause Summary

| Root Cause ID | Location | Defect Description | System Impact |
|---|---|---|---|
| RC-1 | `ProductSetupWizard.tsx` (line 112) | `router.replace` navigates to `/admin/products/${newId}/setup` without specifying `?step=strategy` | Navigation loses step intent |
| RC-2 | `ProductSetupWizard.tsx` (line 81) | `useState<StepKey>("basic")` is hardcoded with no prop or URL parameter integration | Newly mounted component always defaults to Step 1 |
| RC-3 | `page.tsx` (lines 9-25) | Server route component does not accept or resolve Next.js 16 async `searchParams` | Step query parameter cannot be validated or passed as `initialStep` |
| RC-4 | `page.tsx` (line 24) | `<ProductSetupWizard>` lacks `key={productId}` | React component tree reconciliation across route param changes lacks clean identity boundary |
| RC-5 | `BasicInfoSection.tsx` (lines 44-54) & `productMutations.ts` | Missing `updateProductDraft` mutation when `isEditing` is true | Editing basic info on an existing product does not persist changes to Supabase |
| RC-6 | `ProductSetupWizard.tsx` (lines 232, 237) | Steps 6 and 7 pass `productId={productId}` instead of `draftId \|\| productId` | If component were not remounted, `"draft"` string would be passed to validation and publish mutations |

---

## 3. Traceability & Specification Mapping

| Traceability Code | Specification Reference | fix-11 Responsibility |
|---|---|---|
| PRD-F14 | Role-Based Admin Portal & Part Inspector | Governs protected catalog authoring under `/admin` |
| SDD-C9 | Role-Based Admin Portal & Part Inspector | Owns the protected product setup route and admin mutation orchestration |
| DSD-UI10 | AdminPartInspectorAndSimulator | Supplies the established multi-step admin workbench styling and interaction patterns |
| ERD-E3 | `products` entity | Stores draft product core attributes (`product_name`, `product_type`, `base_price`, `description`, `status`) |
| ERD-E4 | `product_templates` entity | Associates visualization strategies and templates with the persisted product |
| QAD-TC19 | Admin Setup Wizard Step Switching & Component Persistence | Provides the parent wizard-state regression category; fix-11 adds focused Step 1 to Step 2 coverage without claiming that the locked QAD execution steps already cover this defect |
| BAN-PUNCT-01 | Zero em-dashes in documentation | Standard hyphens, colons, and parentheses used exclusively |
| BAN-SPEC-02 | Spec-linked commits and tasks | Direct traceability to PRD-F14, SDD-C9, DSD-UI10, ERD-E3, ERD-E4, and QAD-TC19 |
| BAN-AUTH-04 | Secure authorization enforcement | Revalidates `requirePermission("manage_products")` in server actions and routes |
| BAN-TYPE-05 | Zero `any` in TypeScript | Strict types for `StepKey`, `ProductSetupData`, `UpdateProductInput`, and mutation handlers |
| BAN-UI-09 | Strict UI consistency | Reuses established Tailwind tokens, stepper pills, and button designs |

---

## 4. Architectural Scope & Boundaries

### 4.1 In Scope

| Target File | Modification Rationale |
|---|---|
| `src/lib/admin/products/wizardSteps.ts` | 1. Define the canonical `StepKey` and whitelist.<br>2. Export pure `resolveWizardStep` and `buildProductSetupUrl` helpers so production code and unit tests exercise one implementation. |
| `src/app/admin/(protected)/products/[productId]/setup/page.tsx` | 1. Accept and resolve Next.js 16 async `searchParams` with the documented `string \| string[] \| undefined` value shape.<br>2. Resolve `step` through the shared production helper.<br>3. Enforce the draft guard through that helper.<br>4. Return `notFound()` when a persisted product ID does not resolve to a product.<br>5. Pass `initialStep` and `key={productId}` to `ProductSetupWizard`. |
| `src/features/admin/products/setup/ProductSetupWizard.tsx` | 1. Accept a required, server-validated `initialStep: StepKey` prop.<br>2. Initialize `activeStep` with `initialStep`.<br>3. Synchronize `activeStep` with incoming `initialStep` changes via `useEffect`.<br>4. In `handleProductCreated`, route to `/admin/products/${newId}/setup?step=strategy`.<br>5. In `handleStepChange`, update URL search parameter via `router.replace`.<br>6. In `handleStrategySaved`, advance URL to `?step=assets`.<br>7. Fix `productId` references in Steps 6 and 7 to use `draftId \|\| productId`.<br>8. Replace all `any` usages with typed interfaces. |
| `src/features/admin/products/setup/BasicInfoSection.tsx` | 1. Accept the target `productId` explicitly.<br>2. Add update path calling `updateProductDraft` when `isEditing` is true.<br>3. Reject an empty or `"draft"` target before invoking the mutation.<br>4. Remove `any` types on `initialData`, `onSave`, and error catches. |
| `src/lib/admin/products/productMutations.ts` | 1. Add `updateProductDraft(productId, input: UpdateProductInput)` server action with permission check, deterministic input validation, affected-row verification, and cache revalidation. |
| `tests/unit/adminProductWizardSteps.test.ts` | 1. Import and test the production step resolver and URL builder.<br>2. Verify missing, valid, invalid, repeated, and draft-route step inputs.<br>3. Verify Step 1 to Step 2 URL serialization. |
| `package.json` | Add the focused fix-11 test to an explicit script and to the default test command so CI does not omit it. |

### 4.2 Out of Scope

| System Component | Rationale |
|---|---|
| `src/features/admin/products/setup/StructuralComponentsSection.tsx` | Internal component uploading, 3D preview, and part inspection logic is working properly. |
| `src/features/admin/products/setup/ParametersAndRulesSection.tsx` | Parameter and rule logic is intact. |
| `src/features/admin/products/setup/ValidationWorkspaceSection.tsx` | Three.js rendering and BOM calculation are intact. |
| `src/features/admin/products/setup/ReviewAndPublishSection.tsx` | Activation mutation and summary rendering are intact. |
| `supabase/migrations/` | The `products` table schema already supports all required draft columns. No DDL changes needed. |
| `fastapi-service/` | Computer vision pipeline is unrelated to product setup administration. |

### 4.3 Navigation History Decision

Wizard step changes use `router.replace` intentionally. The URL is the refresh-safe source of truth, but individual wizard steps do not create browser history entries. Browser Back returns to the page visited before the setup wizard rather than traversing every step. Supporting per-step Back and Forward navigation is outside this defect fix and must not be claimed by its acceptance criteria.

---

## 5. Detailed Technical Implementation

### 5.1 Add `updateProductDraft` Server Action in `productMutations.ts`

When an administrator edits Step 1 of an already created product, changes must be persisted to the database.

**Location:** [src/lib/admin/products/productMutations.ts](file:///d:/Developer/GlassFit/src/lib/admin/products/productMutations.ts)

```typescript
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_TYPES = new Set([
    "Window",
    "Door",
    "Partition",
    "Cabinet",
    "Enclosure",
    "Railing",
    "Other",
]);

function validateProductDraftInput(input: CreateProductInput): CreateProductInput {
    const productName = input.product_name.trim();
    if (!productName) throw new Error("Product name is required.");
    if (!PRODUCT_TYPES.has(input.product_type)) throw new Error("Product type is invalid.");
    if (!Number.isFinite(input.base_price) || input.base_price < 0) {
        throw new Error("Base price must be a finite, non-negative number.");
    }

    return {
        product_name: productName,
        product_type: input.product_type,
        description: input.description.trim(),
        base_price: input.base_price,
    };
}

export type UpdateProductInput = CreateProductInput;

export async function updateProductDraft(productId: string, input: UpdateProductInput) {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    if (!UUID_PATTERN.test(productId)) {
        throw new Error("A valid persisted product ID is required.");
    }

    const normalizedInput = validateProductDraftInput(input);

    const { data, error } = await supabase
        .from("products")
        .update({
            product_name: normalizedInput.product_name,
            product_type: normalizedInput.product_type,
            description: normalizedInput.description,
            base_price: normalizedInput.base_price,
            updated_by: adminCtx.profileId,
        })
        .eq("product_id", productId)
        .select("product_id")
        .single();

    if (error) {
        console.error("Failed to update product:", error);
        throw new Error(error.message);
    }

    if (!data) {
        throw new Error("Product draft was not found or could not be updated.");
    }

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${productId}/setup`);
    return data.product_id;
}
```

`UUID_PATTERN` and `validateProductDraftInput` must be private helpers in `productMutations.ts`. Validation must trim and require a non-empty product name, accept only the ERD-E3 product type values, require a finite non-negative base price, and normalize the description to a string. The same validator should be used by `createProductDraft` so create and edit enforce one contract without adding a dependency.

### 5.2 Canonical Wizard Step Utilities

**Location:** `src/lib/admin/products/wizardSteps.ts`

```typescript
export const WIZARD_STEPS = [
  "basic",
  "strategy",
  "assets",
  "components",
  "parameters",
  "validation",
  "review",
] as const;

export type StepKey = (typeof WIZARD_STEPS)[number];

export function isStepKey(value: string): value is StepKey {
  return (WIZARD_STEPS as readonly string[]).includes(value);
}

export function resolveWizardStep(
  productId: string,
  rawStep: string | string[] | undefined,
): StepKey {
  if (productId === "draft") return "basic";
  return typeof rawStep === "string" && isStepKey(rawStep) ? rawStep : "basic";
}

export function buildProductSetupUrl(productId: string, step: StepKey): string {
  const query = new URLSearchParams({ step });
  return `/admin/products/${encodeURIComponent(productId)}/setup?${query.toString()}`;
}
```

### 5.3 Server Route Async SearchParams & Keying in `page.tsx`

Update the Next.js 16 server route to resolve `searchParams`, enforce step validation, guard against uncreated draft step skipping, and key `<ProductSetupWizard>`.

**Location:** [src/app/admin/(protected)/products/[productId]/setup/page.tsx](file:///d:/Developer/GlassFit/src/app/admin/(protected)/products/[productId]/setup/page.tsx)

```typescript
import { requirePermission } from "@/lib/auth/admin";
import { getProductDraft } from "@/lib/admin/products/productMutations";
import { notFound } from "next/navigation";
import { ProductSetupWizard } from "@/features/admin/products/setup/ProductSetupWizard";
import { resolveWizardStep } from "@/lib/admin/products/wizardSteps";

export const metadata = {
  title: "Setup Product | Admin | GlassFit",
};

export default async function ProductSetupRoute({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePermission("manage_products");
  
  const { productId } = await params;
  const resolvedSearchParams = await searchParams;
  const initialStep = resolveWizardStep(productId, resolvedSearchParams.step);

  let initialData = null;
  
  if (productId !== "draft") {
    initialData = await getProductDraft(productId);
    if (!initialData) notFound();
  }

  return (
    <ProductSetupWizard
      key={productId}
      productId={productId}
      initialData={initialData}
      initialStep={initialStep}
    />
  );
}
```

### 5.4 Wizard Controller State Synchronization in `ProductSetupWizard.tsx`

Update [ProductSetupWizard.tsx](file:///d:/Developer/GlassFit/src/features/admin/products/setup/ProductSetupWizard.tsx) to:
1. Import `StepKey` and `buildProductSetupUrl` from the shared production utility.
2. Accept required `initialStep: StepKey` in `ProductSetupWizardProps`.
3. Initialize `activeStep` with `initialStep`.
4. Add `useEffect` to synchronize `activeStep` if a route replacement supplies a new `initialStep`.
5. In `handleProductCreated`, call `router.replace(`/admin/products/${newId}/setup?step=strategy`)` and `setActiveStep("strategy")`.
6. In `handleStepChange`, update the URL via `router.replace(`/admin/products/${currentId}/setup?step=${targetStep}`, { scroll: false })`.
7. In `handleStrategySaved`, update the URL to `?step=assets`.
8. Ensure `ValidationWorkspaceSection` and `ReviewAndPublishSection` receive `productId={currentProductId}` where `const currentProductId = draftId || productId`.

**Key Code Snippet:**

```typescript
import { buildProductSetupUrl, type StepKey } from "@/lib/admin/products/wizardSteps";

export type ProductSetupWizardProps = {
    productId: string;
    initialData: ProductSetupData | null;
    initialStep: StepKey;
};

export function ProductSetupWizard({ productId, initialData, initialStep }: ProductSetupWizardProps) {
    const router = useRouter();
    const [draftId, setDraftId] = useState<string>(productId === "draft" ? "" : productId);
    const [activeStep, setActiveStep] = useState<StepKey>(initialStep);
    const [productData, setProductData] = useState<ProductSetupData>(initialData ?? {});

    const isDraft = !draftId;
    const currentProductId = draftId || productId;

    // Synchronize the client state with the validated server route state.
    useEffect(() => {
        setActiveStep(initialStep);
    }, [initialStep]);

    const refreshDraft = useCallback(async (idToFetch?: string) => {
        const id = idToFetch || draftId;
        if (!id || id === "draft") return;
        try {
            const fresh = await getProductDraft(id);
            if (fresh) {
                setProductData(fresh as unknown as ProductSetupData);
            }
        } catch (err: unknown) {
            console.error("Failed to revalidate product draft:", err);
        }
    }, [draftId]);

    const handleStepChange = async (targetStep: StepKey) => {
        setActiveStep(targetStep);
        if (currentProductId && currentProductId !== "draft") {
            router.replace(buildProductSetupUrl(currentProductId, targetStep), { scroll: false });
            refreshDraft(currentProductId);
        }
    };

    const handleProductCreated = (newId: string, data: Record<string, unknown>) => {
        setDraftId(newId);
        setProductData((prev) => ({ ...prev, ...data, product_id: newId }));
        setActiveStep("strategy");
        router.replace(buildProductSetupUrl(newId, "strategy"));
    };

    const handleBasicInfoSaved = (savedId: string, data: Record<string, unknown>) => {
        setProductData((prev) => ({ ...prev, ...data, product_id: savedId }));
        handleStepChange("strategy");
    };

    const handleStrategySaved = (data: Record<string, unknown>) => {
        const existingTemplate = Array.isArray(productData?.product_templates) 
            ? productData.product_templates[0] 
            : productData?.product_templates || {};
        const mergedTemplate: ProductTemplateSummary = {
            ...existingTemplate,
            ...data,
        };
        setProductData((prev) => ({
            ...prev,
            product_templates: Array.isArray(prev?.product_templates) ? [mergedTemplate] : mergedTemplate,
        }));
        setActiveStep("assets");
        if (currentProductId && currentProductId !== "draft") {
            router.replace(buildProductSetupUrl(currentProductId, "assets"), { scroll: false });
            refreshDraft(currentProductId);
        }
    };
    ...
```

**Step Render Updates:**

```typescript
{/* Step 1: Basic Info */}
{activeStep === "basic" && (
    <BasicInfoSection 
        productId={currentProductId}
        initialData={productData} 
        onSave={isDraft ? handleProductCreated : handleBasicInfoSaved} 
        isEditing={!isDraft} 
    />
)}

{/* Step 6: Validation */}
{activeStep === "validation" && (
    <ValidationWorkspaceSection
        productId={currentProductId}
        onSave={() => handleStepChange("review")}
    />
)}

{/* Step 7: Review & Publish */}
{activeStep === "review" && (
    <ReviewAndPublishSection productId={currentProductId} />
)}
```

### 5.5 Type-Safe Edit Mutation in `BasicInfoSection.tsx`

Update [BasicInfoSection.tsx](file:///d:/Developer/GlassFit/src/features/admin/products/setup/BasicInfoSection.tsx) to:
1. Import `updateProductDraft` and `createProductDraft`.
2. Eliminate `any` types: replace with `ProductSetupData` and `unknown`.
3. Accept `productId` explicitly from the wizard instead of deriving mutation identity from display data.
4. If `isEditing` is true, reject a missing or draft identifier, call `updateProductDraft(productId, data)`, and invoke `onSave` only after the mutation confirms an updated row.

**Key Code Snippet:**

```typescript
import { useState } from "react";
import { createProductDraft, updateProductDraft } from "@/lib/admin/products/productMutations";
import type { ProductSetupData } from "./ProductSetupWizard";

export type BasicInfoSectionProps = {
    productId: string;
    initialData: ProductSetupData;
    onSave: (productId: string, data: Record<string, unknown>) => void;
    isEditing?: boolean;
};

export function BasicInfoSection({
    productId,
    initialData,
    onSave,
    isEditing,
}: BasicInfoSectionProps) {
    // Existing form state remains unchanged.
    ...

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
        const data = {
            product_name: name,
            product_type: type,
            description,
            base_price: parseFloat(basePrice) || 0,
        };

        if (isEditing) {
            if (!productId || productId === "draft") {
                throw new Error("A persisted product ID is required before editing basic information.");
            }
            const updatedProductId = await updateProductDraft(productId, data);
            onSave(updatedProductId, data);
        } else {
            const newProductId = await createProductDraft(data);
            onSave(newProductId, data);
        }
    } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred while saving.");
    } finally {
        setIsSaving(false);
    }
};
```

---

## 6. Verification & Test Catalog

### 6.1 Unit Test Suite (`tests/unit/adminProductWizardSteps.test.ts`)

A dedicated unit test file will import the production utilities. It must not duplicate the resolver or whitelist inside the test:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildProductSetupUrl,
  resolveWizardStep,
  WIZARD_STEPS,
} from "../../src/lib/admin/products/wizardSteps";

const PRODUCT_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

describe("QAD-TC19: Admin Product Setup Wizard Step Progression & Parameter Resolution", () => {
  it("resolves basic step when no query parameter is provided", () => {
    assert.strictEqual(resolveWizardStep(PRODUCT_ID, undefined), "basic");
  });

  it("resolves valid step parameter for persisted product", () => {
    for (const step of WIZARD_STEPS) {
      assert.strictEqual(resolveWizardStep(PRODUCT_ID, step), step);
    }
  });

  it("falls back to basic when an invalid step parameter is supplied", () => {
    assert.strictEqual(resolveWizardStep(PRODUCT_ID, "invalid_step"), "basic");
    assert.strictEqual(resolveWizardStep(PRODUCT_ID, "12345"), "basic");
  });

  it("falls back to basic when repeated step parameters are supplied", () => {
    assert.strictEqual(resolveWizardStep(PRODUCT_ID, ["strategy", "review"]), "basic");
  });

  it("enforces draft boundary: unpersisted draft cannot bypass basic step", () => {
    assert.strictEqual(resolveWizardStep("draft", "strategy"), "basic");
    assert.strictEqual(resolveWizardStep("draft", "assets"), "basic");
    assert.strictEqual(resolveWizardStep("draft", "components"), "basic");
    assert.strictEqual(resolveWizardStep("draft", "review"), "basic");
  });

  it("serializes the successful Step 1 to Step 2 destination", () => {
    assert.strictEqual(
      buildProductSetupUrl(PRODUCT_ID, "strategy"),
      `/admin/products/${PRODUCT_ID}/setup?step=strategy`,
    );
  });
});
```

The test proves the shared route contract. The manual protocol below remains mandatory because the repository does not currently include a React component test dependency capable of asserting the full client transition. No new test library may be introduced for this fix.

`package.json` must add `"test:fix11": "npx tsx --test tests/unit/adminProductWizardSteps.test.ts"` and append the same test file to the existing `test` script. This keeps the focused command available while ensuring the default CI test run includes the regression.

### 6.2 Manual Verification Protocol (QAD-TC19 Trace)

| Step # | Action | Expected Result | Pass Criteria |
|---|---|---|---|
| 1 | Navigate to `/admin/products` as an authorized Admin | Products catalog table renders with "+ Add Product" button | Table visible, no authorization errors |
| 2 | Click "+ Add Product" | Route redirects to `/admin/products/draft/setup` with Step 1 active | Header shows "Add Product", Steps 2-7 pills disabled |
| 3 | Enter valid information (e.g., Name: "Casement Window V1", Type: "Window", Base Price: "3500.00", Description: "Standard single casement") | Input values populate without form errors | Form valid |
| 4 | Click "Save & Continue" | Button shows "Saving...", product is inserted into database, URL transitions to `/admin/products/<newId>/setup?step=strategy` | **Wizard remains at Step 2 (Visualization Strategy). It does NOT jump back to Step 1.** |
| 5 | Verify Stepper header | Stepper displays "Edit Product Setup: Casement Window V1", Step 1 and Step 2 pills are active/clickable | Header accurately reflects saved draft |
| 6 | Refresh the browser page at `/admin/products/<newId>/setup?step=strategy` | Page reloads directly on Step 2 (Visualization Strategy) | Active step persists across browser reload |
| 7 | Click Step 1 pill in Stepper header | Wizard returns to Step 1 showing pre-filled data ("Casement Window V1") | URL updates to `?step=basic`, data preserved |
| 8 | Edit Product Name to "Casement Window V1 (Updated)" and click "Save & Continue" | Database updates, wizard smoothly returns to Step 2 | Database row updated, wizard advances to Step 2 |
| 9 | Select Strategy "Fixed", click "Save & Continue" | Strategy saved, wizard advances to Step 3 (Assets) with URL `?step=assets` | Seamless progression to Step 3 |
| 10 | Open `/admin/products/draft/setup?step=strategy` directly | Server rejects the attempted draft step skip | Step 1 renders and Steps 2-7 remain disabled |
| 11 | Open a persisted setup URL with `?step=strategy&step=review` | Repeated step input is treated as invalid | Step 1 renders deterministically |
| 12 | Open `/admin/products/<unknownUuid>/setup?step=strategy` | Missing persisted product is rejected | Next.js not-found boundary renders instead of an empty editable wizard |

### 6.3 Automated Build & Lint Verification Commands

```bash
# 1. Execute the focused test through the committed package script
npm run test:fix11

# 2. Run static lint
npm run lint

# 3. Static typecheck
npx tsc --noEmit

# 4. Production build validation
npm run build
```

---

## 7. Self-Check & Quality Constraints

- [x] **BAN-PUNCT-01:** Zero em-dashes across the entire specification document (hyphens, colons, and parentheses used exclusively).
- [x] **BAN-SPEC-02:** Strict upstream specification linking to PRD-F14, SDD-C9, DSD-UI10, ERD-E3, ERD-E4, and QAD-TC19.
- [x] **BAN-AUTH-04:** Verified authorization gate `requirePermission("manage_products")` maintained across routes and mutations.
- [x] **BAN-TYPE-05:** Zero `any` in TypeScript snippets; strict interfaces and type signatures defined for all props and mutations.
- [x] **BAN-UI-09:** Preserved existing GlassFit Tailwind design tokens, stepper pills, and button components.
- [x] **Next.js 16 App Router Compliance:** Handled async `searchParams` Promise resolution cleanly on server page component.
