/**
 * Add-on Reconciliation & Deletion Constraint Pure Calculation Helpers
 *
 * Traceability: PRD-F14, ERD-E3, SDD-C9, QAD-TC82
 */

import type { HostProductAddonConfig, AddonType, AddonAllowedSides, AddonMountingSide } from "./types";

export type AddonReconciliationResult = {
  toUpsert: Array<{
    parent_product_id: string;
    addon_product_id: string;
    addon_type: AddonType;
    is_default_enabled: boolean;
    display_order: number;
    allowed_sides: AddonAllowedSides;
    default_side: AddonMountingSide;
    hatch_target_component_keys: string[] | null;
    hatch_alignment_config?: Record<string, unknown> | null;
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

  const screenIds = config.screenAddonProductIds && config.screenAddonProductIds.length > 0
    ? config.screenAddonProductIds
    : config.screenAddonProductId
      ? [config.screenAddonProductId]
      : [];

  if (config.hasScreen && screenIds.length > 0) {
    screenIds.forEach((screenId, idx) => {
      toUpsert.push({
        parent_product_id: parentProductId,
        addon_product_id: screenId,
        addon_type: "screen",
        is_default_enabled: idx === 0,
        display_order: idx + 1,
        allowed_sides: config.screenAllowedSides ?? "both",
        default_side: config.screenDefaultSide ?? "back",
        hatch_target_component_keys: (config.screenHatchTargetComponentKeys && config.screenHatchTargetComponentKeys.length > 0)
          ? config.screenHatchTargetComponentKeys
          : null,
        hatch_alignment_config: config.screenHatchAlignmentConfig ?? null,
      });
    });
  } else if (existingTypes.has("screen")) {
    toDeleteTypes.push("screen");
  }

  const grillIds = config.grillAddonProductIds && config.grillAddonProductIds.length > 0
    ? config.grillAddonProductIds
    : config.grillAddonProductId
      ? [config.grillAddonProductId]
      : [];

  const grillBaseOrder = screenIds.length > 0 ? screenIds.length + 1 : 2;

  if (config.hasGrill && grillIds.length > 0) {
    grillIds.forEach((grillId, idx) => {
      toUpsert.push({
        parent_product_id: parentProductId,
        addon_product_id: grillId,
        addon_type: "grill",
        is_default_enabled: idx === 0,
        display_order: grillBaseOrder + idx,
        allowed_sides: config.grillAllowedSides ?? "both",
        default_side: config.grillDefaultSide ?? "back",
        hatch_target_component_keys: (config.grillHatchTargetComponentKeys && config.grillHatchTargetComponentKeys.length > 0)
          ? config.grillHatchTargetComponentKeys
          : null,
        hatch_alignment_config: config.grillHatchAlignmentConfig ?? null,
      });
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
