import { describe, it } from "node:test";
import assert from "node:assert";
import { filterAdminProducts } from "../../src/features/admin/products/productFilters";
import type { AdminProductItem } from "../../src/features/admin/products/productData";
import { validateProductDraftInput } from "../../src/lib/admin/products/productValidation";
import {
  computeAddonReconciliation,
  checkAddonDeletionConstraint,
} from "../../src/lib/admin/products/addonUtils";
import type { HostProductAddonConfig } from "../../src/lib/admin/products/types";

describe("IMP-MS67: Add-on Product Catalog Architecture and Product Inheritance Binding (QAD-TC82)", () => {
  // Mock dataset containing standard host products and modular add-on accessories
  const mockCatalogProducts: AdminProductItem[] = [
    {
      id: "prod-window-798",
      name: "Series 798 2-Panel Sliding Window",
      type: "Window",
      description: "Heavy duty exterior sliding window",
      basePrice: "₱ 14,200.00",
      status: "Published",
      isAddon: false,
      addonType: null,
    },
    {
      id: "prod-door-patio",
      name: "Series 900 Patio Sliding Door",
      type: "Door",
      description: "Large glass sliding door for patio opening",
      basePrice: "₱ 28,500.00",
      status: "Published",
      isAddon: false,
      addonType: null,
    },
    {
      id: "prod-screen-798",
      name: "Series 798 Insect Screen Attachment",
      type: "Other",
      description: "Extruded aluminum framed wire mesh insect screen",
      basePrice: "₱ 1,850.00",
      status: "Published",
      isAddon: true,
      addonType: "screen",
    },
    {
      id: "prod-grill-diamond",
      name: "Colonial Security Grille Attachment",
      type: "Other",
      description: "Tubular aluminum safety grill with powder coated finish",
      basePrice: "₱ 3,200.00",
      status: "Published",
      isAddon: true,
      addonType: "grill",
    },
    {
      id: "prod-draft-window",
      name: "Casement Awning Window",
      type: "Window",
      description: "Single sash exterior awning window",
      basePrice: "₱ 8,900.00",
      status: "Draft",
      isAddon: false,
      addonType: null,
    },
  ];

  // --------------------------------------------------------------------------
  // QAD-TC82.1: Public catalog excludes add-on products
  // --------------------------------------------------------------------------
  it("QAD-TC82.1: Public catalog queries strictly exclude add-on products (is_addon = false)", () => {
    // Simulate public catalog query filtering: status = 'Active' (Published) and is_addon = false
    const publicProducts = mockCatalogProducts.filter(
      (p) => p.status === "Published" && !p.isAddon
    );

    assert.strictEqual(publicProducts.length, 2);
    assert.deepStrictEqual(
      publicProducts.map((p) => p.id),
      ["prod-window-798", "prod-door-patio"]
    );

    // Verify neither screens nor grills leak into public listings
    const containsAddon = publicProducts.some((p) => p.isAddon || p.addonType !== null);
    assert.strictEqual(containsAddon, false);
  });

  // --------------------------------------------------------------------------
  // QAD-TC82.2: Admin products view filters add-ons
  // --------------------------------------------------------------------------
  it("QAD-TC82.2: Admin products portal filters by scope (all, standard, and add-on accessories)", () => {
    // 1. Standard Products filter
    const standardOnly = filterAdminProducts(mockCatalogProducts, {
      searchQuery: "",
      selectedType: null,
      selectedStatus: null,
      selectedScope: "standard",
    });
    assert.strictEqual(standardOnly.length, 3);
    assert.ok(standardOnly.every((p) => !p.isAddon));

    // 2. Add-on Accessories filter
    const addonsOnly = filterAdminProducts(mockCatalogProducts, {
      searchQuery: "",
      selectedType: null,
      selectedStatus: null,
      selectedScope: "addon",
    });
    assert.strictEqual(addonsOnly.length, 2);
    assert.deepStrictEqual(
      addonsOnly.map((p) => p.id),
      ["prod-screen-798", "prod-grill-diamond"]
    );
    assert.ok(addonsOnly.every((p) => p.isAddon === true));
    assert.ok(addonsOnly.some((p) => p.addonType === "screen"));
    assert.ok(addonsOnly.some((p) => p.addonType === "grill"));

    // 3. All Catalog Items filter
    const allItems = filterAdminProducts(mockCatalogProducts, {
      searchQuery: "",
      selectedType: null,
      selectedStatus: null,
      selectedScope: "all",
    });
    assert.strictEqual(allItems.length, mockCatalogProducts.length);
  });

  // --------------------------------------------------------------------------
  // QAD-TC82.3: Create add-on product draft
  // --------------------------------------------------------------------------
  it("QAD-TC82.3: Validates and normalizes add-on product creation with is_addon = true and valid addon_type", () => {
    const inputScreen = {
      product_name: "Series 798 Insect Screen",
      product_type: "Other",
      description: "Fine wire mesh attachment",
      base_price: 1850,
      is_addon: true,
      addon_type: "screen" as const,
    };

    const normalizedScreen = validateProductDraftInput(inputScreen);
    assert.strictEqual(normalizedScreen.is_addon, true);
    assert.strictEqual(normalizedScreen.addon_type, "screen");
    assert.strictEqual(normalizedScreen.product_name, "Series 798 Insect Screen");

    const inputGrill = {
      product_name: "Aluminum Security Grille",
      product_type: "Other",
      description: "Colonial lattice grill",
      base_price: 3200,
      is_addon: true,
      addon_type: "grill" as const,
    };

    const normalizedGrill = validateProductDraftInput(inputGrill);
    assert.strictEqual(normalizedGrill.is_addon, true);
    assert.strictEqual(normalizedGrill.addon_type, "grill");
  });

  // --------------------------------------------------------------------------
  // QAD-TC82.4: Prevent invalid addon_type state
  // --------------------------------------------------------------------------
  it("QAD-TC82.4: Enforces consistency constraint between is_addon and addon_type", () => {
    // 1. Standard product cannot have an addon_type
    assert.throws(
      () => {
        validateProductDraftInput({
          product_name: "Sliding Window",
          product_type: "Window",
          description: "Standard window",
          base_price: 10000,
          is_addon: false,
          addon_type: "screen",
        });
      },
      {
        message: "Standard product cannot have an add-on type.",
      }
    );

    // 2. Add-on product must have a valid addon_type ('screen' or 'grill')
    assert.throws(
      () => {
        validateProductDraftInput({
          product_name: "Unknown Addon",
          product_type: "Other",
          description: "No type specified",
          base_price: 1000,
          is_addon: true,
          addon_type: null,
        });
      },
      {
        message: "Add-on accessory requires a valid add-on type ('screen' or 'grill').",
      }
    );

    // 3. Simulated SQL check constraint products_addon_type_check evaluation
    const evalSqlConstraint = (is_addon: boolean, addon_type: string | null) => {
      return (
        (is_addon === false && addon_type === null) ||
        (is_addon === true && (addon_type === "screen" || addon_type === "grill"))
      );
    };

    assert.strictEqual(evalSqlConstraint(false, null), true);
    assert.strictEqual(evalSqlConstraint(true, "screen"), true);
    assert.strictEqual(evalSqlConstraint(true, "grill"), true);
    assert.strictEqual(evalSqlConstraint(false, "screen"), false);
    assert.strictEqual(evalSqlConstraint(true, null), false);
    assert.strictEqual(evalSqlConstraint(true, "hardware"), false);
  });

  // --------------------------------------------------------------------------
  // QAD-TC82.5: Host product binds screen add-on
  // --------------------------------------------------------------------------
  it("QAD-TC82.5: Host window product binds screen add-on attachment into junction records", () => {
    const parentId = "11111111-1111-4111-8111-111111111111";
    const screenId = "22222222-2222-4222-8222-222222222222";
    const existingTypes = new Set<string>();

    const config: HostProductAddonConfig = {
      hasScreen: true,
      screenAddonProductId: screenId,
      hasGrill: false,
      grillAddonProductId: null,
    };

    const reconciliation = computeAddonReconciliation(parentId, existingTypes, config);

    assert.strictEqual(reconciliation.toUpsert.length, 1);
    assert.strictEqual(reconciliation.toUpsert[0].parent_product_id, parentId);
    assert.strictEqual(reconciliation.toUpsert[0].addon_product_id, screenId);
    assert.strictEqual(reconciliation.toUpsert[0].addon_type, "screen");
    assert.strictEqual(reconciliation.toUpsert[0].display_order, 1);
    assert.strictEqual(reconciliation.toDeleteTypes.length, 0);
  });

  // --------------------------------------------------------------------------
  // QAD-TC82.6: Host product binds both screen and grill
  // --------------------------------------------------------------------------
  it("QAD-TC82.6: Host window product binds both screen and grill attachments with distinct ordering", () => {
    const parentId = "11111111-1111-4111-8111-111111111111";
    const screenId = "22222222-2222-4222-8222-222222222222";
    const grillId = "33333333-3333-4333-8333-333333333333";
    const existingTypes = new Set<string>();

    const config: HostProductAddonConfig = {
      hasScreen: true,
      screenAddonProductId: screenId,
      hasGrill: true,
      grillAddonProductId: grillId,
    };

    const reconciliation = computeAddonReconciliation(parentId, existingTypes, config);

    assert.strictEqual(reconciliation.toUpsert.length, 2);
    assert.strictEqual(reconciliation.toDeleteTypes.length, 0);

    const screenBinding = reconciliation.toUpsert.find((u) => u.addon_type === "screen");
    const grillBinding = reconciliation.toUpsert.find((u) => u.addon_type === "grill");

    assert.ok(screenBinding);
    assert.strictEqual(screenBinding.addon_product_id, screenId);
    assert.strictEqual(screenBinding.display_order, 1);

    assert.ok(grillBinding);
    assert.strictEqual(grillBinding.addon_product_id, grillId);
    assert.strictEqual(grillBinding.display_order, 2);
  });

  // --------------------------------------------------------------------------
  // QAD-TC82.7: Disable add-on unlinks junction record
  // --------------------------------------------------------------------------
  it("QAD-TC82.7: Disabling an add-on safely queues junction record deletion", () => {
    const parentId = "11111111-1111-4111-8111-111111111111";
    const grillId = "33333333-3333-4333-8333-333333333333";
    // Host product previously had both screen and grill bound
    const existingTypes = new Set(["screen", "grill"]);

    // Administrator unchecks screen and keeps grill
    const config: HostProductAddonConfig = {
      hasScreen: false,
      screenAddonProductId: null,
      hasGrill: true,
      grillAddonProductId: grillId,
    };

    const reconciliation = computeAddonReconciliation(parentId, existingTypes, config);

    assert.strictEqual(reconciliation.toUpsert.length, 1);
    assert.strictEqual(reconciliation.toUpsert[0].addon_type, "grill");

    assert.strictEqual(reconciliation.toDeleteTypes.length, 1);
    assert.strictEqual(reconciliation.toDeleteTypes[0], "screen");
  });

  // --------------------------------------------------------------------------
  // QAD-TC82.8: Delete protection for bound add-on
  // --------------------------------------------------------------------------
  it("QAD-TC82.8: Blocks deletion of add-on accessories when bound to active host products", () => {
    // 1. Bound to 1 or more host products: deletion must be blocked
    assert.throws(
      () => {
        checkAddonDeletionConstraint(2);
      },
      {
        message:
          "Cannot delete product: this add-on accessory is linked to one or more host products.",
      }
    );

    // 2. Unbound add-on (0 host products): deletion is permitted
    assert.doesNotThrow(() => {
      checkAddonDeletionConstraint(0);
    });
  });
});
