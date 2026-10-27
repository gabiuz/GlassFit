/**
 * Product Draft Input Validation Utilities
 *
 * Traceability: PRD-F1, PRD-F14, ERD-E3, QAD-TC82
 */

import type { CreateProductInput } from "./productMutations";
import type { AccessoryCategory, AccessoryMountingType } from "./types";

export const PRODUCT_TYPES = new Set([
  "Window",
  "Door",
  "Partition",
  "Cabinet",
  "Enclosure",
  "Railing",
  "Other",
]);

export const ACCESSORY_CATEGORIES = new Set<AccessoryCategory>([
  "handle",
  "lock",
  "hinge",
  "roller",
  "other",
]);

export const ACCESSORY_MOUNTING_TYPES = new Set<AccessoryMountingType>([
  "surface_mount",
  "mortise",
  "recessed",
  "clamp",
]);

export function validateProductDraftInput(input: CreateProductInput): CreateProductInput {
  const productName = input.product_name.trim();
  if (!productName) throw new Error("Product name is required.");
  if (!PRODUCT_TYPES.has(input.product_type)) throw new Error("Product type is invalid.");
  if (!Number.isFinite(input.base_price) || input.base_price < 0) {
    throw new Error("Base price must be a finite, non-negative number.");
  }

  const isAddon = Boolean(input.is_addon);
  const isAccessory = Boolean(input.is_accessory);

  if (isAddon && isAccessory) {
    throw new Error("A product cannot be both an add-on and an accessory.");
  }

  let addonType: "screen" | "grill" | null = null;
  if (isAddon) {
    if (input.addon_type !== "screen" && input.addon_type !== "grill") {
      throw new Error("Add-on accessory requires a valid add-on type ('screen' or 'grill').");
    }
    addonType = input.addon_type;
  } else if (input.addon_type) {
    throw new Error("Standard product cannot have an add-on type.");
  }

  let accessoryCategory: AccessoryCategory | null = null;
  let accessoryMountingType: AccessoryMountingType | null = null;
  if (isAccessory) {
    if (!input.accessory_category || !ACCESSORY_CATEGORIES.has(input.accessory_category)) {
      throw new Error("Accessory requires a valid category ('handle', 'lock', 'hinge', 'roller', or 'other').");
    }
    if (input.accessory_mounting_type && !ACCESSORY_MOUNTING_TYPES.has(input.accessory_mounting_type)) {
      throw new Error("Accessory mounting type is invalid.");
    }
    accessoryCategory = input.accessory_category;
    accessoryMountingType = input.accessory_mounting_type ?? "surface_mount";
  } else {
    if (input.accessory_category) {
      throw new Error("Non-accessory product cannot have an accessory category.");
    }
    if (input.accessory_mounting_type) {
      throw new Error("Non-accessory product cannot have an accessory mounting type.");
    }
  }

  return {
    product_name: productName,
    product_type: input.product_type,
    description: input.description.trim(),
    base_price: input.base_price,
    is_addon: isAddon,
    addon_type: addonType,
    is_accessory: isAccessory,
    accessory_category: accessoryCategory,
    accessory_mounting_type: accessoryMountingType,
  };
}
