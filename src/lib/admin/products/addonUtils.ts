/**
 * Add-on Reconciliation & Deletion Constraint Pure Calculation Helpers
 *
 * Traceability: PRD-F14, ERD-E3, SDD-C9, QAD-TC82
 */

import type { HostProductAddonConfig, AddonType } from "./types";

export type AddonReconciliationResult = {
  toUpsert: Array<{
    parent_product_id: string;
    addon_product_id: string;
    addon_type: AddonType;
    is_default_enabled: boolean;
    display_order: number;
  }>;
  toDeleteTypes: AddonType[];
};

/**
 * Pure calculation helper to determine which compatible add-on rows to upsert and delete.
 */
export function computeAddonReconciliation(
  parentProductId: string,
  existingTypes: Set<string>,
  config: HostProductAddonConfig
): AddonReconciliationResult {
  const toUpsert: AddonReconciliationResult["toUpsert"] = [];
  const toDeleteTypes: AddonType[] = [];

  if (config.hasScreen && config.screenAddonProductId) {
    toUpsert.push({
      parent_product_id: parentProductId,
      addon_product_id: config.screenAddonProductId,
      addon_type: "screen",
      is_default_enabled: false,
      display_order: 1,
    });
  } else if (existingTypes.has("screen")) {
    toDeleteTypes.push("screen");
  }

  if (config.hasGrill && config.grillAddonProductId) {
    toUpsert.push({
      parent_product_id: parentProductId,
      addon_product_id: config.grillAddonProductId,
      addon_type: "grill",
      is_default_enabled: false,
      display_order: 2,
    });
  } else if (existingTypes.has("grill")) {
    toDeleteTypes.push("grill");
  }

  return { toUpsert, toDeleteTypes };
}

/**
 * Checks whether an add-on product can be deleted or is protected by host dependencies.
 */
export function checkAddonDeletionConstraint(boundHostProductCount: number): void {
  if (boundHostProductCount > 0) {
    throw new Error("Cannot delete product: this add-on accessory is linked to one or more host products.");
  }
}
