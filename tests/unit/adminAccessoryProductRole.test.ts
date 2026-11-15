/**
 * Acceptance Tests: Admin Accessory Product Role, 5-Step Authoring Workflow,
 * and Master Accessory Catalog (IMP-MS74)
 *
 * Upstream Specifications: docs/implementation/ms74.md, docs/qad-glassfit.md
 * Traceability Codes: PRD-F1, PRD-F14, PRD-F19, SDD-C1, SDD-C9, DSD-UI10, DSD-UI14,
 *   ERD-E3, ERD-E6, QAD-TC89.1 through QAD-TC89.10
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ACCESSORY_PRODUCT_STEPS,
  getStepsForRole,
  getStepsForProduct,
  getNextStepKey,
  resolveWizardStep,
} from "../../src/lib/admin/products/wizardSteps.js";

import {
  validateProductDraftInput,
  ACCESSORY_CATEGORIES,
  ACCESSORY_MOUNTING_TYPES,
} from "../../src/lib/admin/products/productValidation.js";

import {
  filterAdminProducts,
} from "../../src/features/admin/products/productFilters.js";

import type { AdminProductItem } from "../../src/features/admin/products/productData.js";

describe("IMP-MS74: Admin Accessory Product Role and 5-Step Authoring Workflow", () => {
  const PRODUCT_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

  // QAD-TC89.1: Add Accessory button initializes draft with accessory role
  it("QAD-TC89.1: Add Accessory button initializes draft with accessory role", () => {
    // When role=accessory is passed to wizard step resolver
    const step = resolveWizardStep("draft", undefined, false, true);
    assert.strictEqual(step, "basic", "Draft product must always initialize on basic step");

    // Accessory step progression maps correctly
    const accessorySteps = getStepsForRole("accessory");
    assert.strictEqual(accessorySteps.length, 5);
    assert.strictEqual(accessorySteps[0].key, "basic");
    assert.strictEqual(accessorySteps[0].label, "Basic Info");
  });

  // QAD-TC89.2: Role choice card toggles accessory fields
  it("QAD-TC89.2: Role choice card toggles accessory fields", () => {
    // Valid accessory payload with category and mounting type
    const validated = validateProductDraftInput({
      product_name: "Matte Black Lever Handle",
      product_type: "Other",
      description: "Heavy duty zinc alloy lever handle",
      base_price: 1850,
      is_accessory: true,
      accessory_category: "handle",
      accessory_mounting_type: "surface_mount",
    });

    assert.strictEqual(validated.is_accessory, true);
    assert.strictEqual(validated.is_addon, false);
    assert.strictEqual(validated.accessory_category, "handle");
    assert.strictEqual(validated.accessory_mounting_type, "surface_mount");

    // All categories in domain are allowed
    for (const cat of ACCESSORY_CATEGORIES) {
      const result = validateProductDraftInput({
        product_name: `Test ${cat}`,
        product_type: "Other",
        description: "",
        base_price: 500,
        is_accessory: true,
        accessory_category: cat,
      });
      assert.strictEqual(result.accessory_category, cat);
    }

    // All mounting types in domain are allowed
    for (const mount of ACCESSORY_MOUNTING_TYPES) {
      const result = validateProductDraftInput({
        product_name: `Test ${mount}`,
        product_type: "Other",
        description: "",
        base_price: 500,
        is_accessory: true,
        accessory_category: "lock",
        accessory_mounting_type: mount,
      });
      assert.strictEqual(result.accessory_mounting_type, mount);
    }
  });

  // QAD-TC89.3: Mutual exclusion between Add-on and Accessory
  it("QAD-TC89.3: Mutual exclusion between Add-on and Accessory", () => {
    // Attempting to set both is_addon: true and is_accessory: true must fail
    assert.throws(
      () => {
        validateProductDraftInput({
          product_name: "Conflicted Product",
          product_type: "Other",
          description: "",
          base_price: 1000,
          is_addon: true,
          addon_type: "screen",
          is_accessory: true,
          accessory_category: "handle",
        });
      },
      /A product cannot be both an add-on and an accessory/
    );

    // Standard product cannot have accessory category
    assert.throws(
      () => {
        validateProductDraftInput({
          product_name: "Standard Window With Handle Category",
          product_type: "Window",
          description: "",
          base_price: 5000,
          is_addon: false,
          is_accessory: false,
          accessory_category: "handle",
        });
      },
      /Non-accessory product cannot have an accessory category/
    );

    // Invalid accessory category must fail
    assert.throws(
      () => {
        validateProductDraftInput({
          product_name: "Invalid Accessory",
          product_type: "Other",
          description: "",
          base_price: 500,
          is_accessory: true,
          // @ts-expect-error Testing invalid category input
          accessory_category: "curtain",
        });
      },
      /Accessory requires a valid category/
    );
  });

  // QAD-TC89.4: Accessory wizard enforces 5-step workflow
  it("QAD-TC89.4: Accessory wizard enforces 5-step workflow", () => {
    const steps = getStepsForProduct(false, true);
    assert.strictEqual(steps.length, 5, "Accessory wizard must have exactly 5 steps");

    const expectedSequence = [
      { key: "basic", label: "Basic Info", number: 1 },
      { key: "strategy", label: "Visualization", number: 2 },
      { key: "components", label: "Components", number: 3 },
      { key: "validation", label: "Validation", number: 4 },
      { key: "review", label: "Review & Publish", number: 5 },
    ];

    assert.deepStrictEqual(steps, expectedSequence);
    assert.deepStrictEqual(ACCESSORY_PRODUCT_STEPS, expectedSequence);
    assert.deepStrictEqual(getStepsForRole("accessory"), expectedSequence);
  });

  // QAD-TC89.5: Assets and Parameters steps are omitted
  it("QAD-TC89.5: Assets and Parameters steps are omitted", () => {
    const stepKeys = ACCESSORY_PRODUCT_STEPS.map((s) => s.key);
    assert.ok(!stepKeys.includes("assets"), "Assets step must be omitted for accessories");
    assert.ok(!stepKeys.includes("parameters"), "Parameters step must be omitted for accessories");

    // Routing redirects/clamps skipped steps
    assert.strictEqual(
      resolveWizardStep(PRODUCT_ID, "assets", false, true),
      "components",
      "Navigating to assets redirects to components"
    );
    assert.strictEqual(
      resolveWizardStep(PRODUCT_ID, "parameters", false, true),
      "validation",
      "Navigating to parameters redirects to validation"
    );
  });

  // QAD-TC89.6: Step 1 save advances directly to Visualization (Step 2)
  it("QAD-TC89.6: Step 1 save advances directly to Visualization (Step 2)", () => {
    const nextStep = getNextStepKey("basic", false, true);
    assert.strictEqual(nextStep, "strategy", "Step 1 basic must advance to strategy (Step 2)");
  });

  // QAD-TC89.7: Step 2 Visualization advances to Components (Step 3)
  it("QAD-TC89.7: Step 2 Visualization advances to Components (Step 3)", () => {
    const nextStep = getNextStepKey("strategy", false, true);
    assert.strictEqual(nextStep, "components", "Step 2 strategy must advance to components (Step 3)");
  });

  // QAD-TC89.8: Step 3 Components advances to Validation (Step 4)
  it("QAD-TC89.8: Step 3 Components advances to Validation (Step 4)", () => {
    const nextStep = getNextStepKey("components", false, true);
    assert.strictEqual(nextStep, "validation", "Step 3 components must advance directly to validation (Step 4)");
  });

  // QAD-TC89.9: Step 4 Validation advances to Review & Publish (Step 5)
  it("QAD-TC89.9: Step 4 Validation advances to Review & Publish (Step 5)", () => {
    const nextStep = getNextStepKey("validation", false, true);
    assert.strictEqual(nextStep, "review", "Step 4 validation must advance to review (Step 5)");

    // Review is the terminal step
    assert.strictEqual(getNextStepKey("review", false, true), "review", "Step 5 review is terminal");
  });

  // QAD-TC89.10: Catalog scope filter isolates accessories
  it("QAD-TC89.10: Catalog scope filter isolates accessories", () => {
    const testProducts: AdminProductItem[] = [
      {
        id: "prod-1",
        name: "Standard Sliding Window",
        type: "Window",
        description: "2-panel window",
        basePrice: "₱ 12,000.00",
        status: "Published",
        isAddon: false,
        isAccessory: false,
      },
      {
        id: "prod-2",
        name: "Series 798 Insect Screen",
        type: "Other",
        description: "Nylon mesh insect screen",
        basePrice: "₱ 1,800.00",
        status: "Published",
        isAddon: true,
        addonType: "screen",
        isAccessory: false,
      },
      {
        id: "prod-3",
        name: "Stainless Lever Handle",
        type: "Other",
        description: "Grade 304 lever handle",
        basePrice: "₱ 1,450.00",
        status: "Published",
        isAddon: false,
        isAccessory: true,
        accessoryCategory: "handle",
        accessoryMountingType: "surface_mount",
      },
      {
        id: "prod-4",
        name: "Smart Digital Door Lock",
        type: "Other",
        description: "Biometric and pin smart lock",
        basePrice: "₱ 8,900.00",
        status: "Draft",
        isAddon: false,
        isAccessory: true,
        accessoryCategory: "lock",
        accessoryMountingType: "mortise",
      },
    ];

    // Filter by accessory scope
    const accessoryOnly = filterAdminProducts(testProducts, {
      searchQuery: "",
      selectedType: null,
      selectedStatus: null,
      selectedScope: "accessory",
    });
    assert.strictEqual(accessoryOnly.length, 2);
    assert.deepStrictEqual(
      accessoryOnly.map((p) => p.id),
      ["prod-3", "prod-4"]
    );
    assert.ok(accessoryOnly.every((p) => p.isAccessory === true));

    // Filter by standard scope
    const standardOnly = filterAdminProducts(testProducts, {
      searchQuery: "",
      selectedType: null,
      selectedStatus: null,
      selectedScope: "standard",
    });
    assert.strictEqual(standardOnly.length, 1);
    assert.strictEqual(standardOnly[0].id, "prod-1");

    // Filter by addon scope
    const addonOnly = filterAdminProducts(testProducts, {
      searchQuery: "",
      selectedType: null,
      selectedStatus: null,
      selectedScope: "addon",
    });
    assert.strictEqual(addonOnly.length, 1);
    assert.strictEqual(addonOnly[0].id, "prod-2");

    // Filter by all scope
    const allProducts = filterAdminProducts(testProducts, {
      searchQuery: "",
      selectedType: null,
      selectedStatus: null,
      selectedScope: "all",
    });
    assert.strictEqual(allProducts.length, 4);
  });
});
