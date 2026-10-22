/**
 * Product Draft Input Validation Utilities
 *
 * Traceability: PRD-F1, PRD-F14, ERD-E3, QAD-TC82
 */

import type { CreateProductInput } from "./productMutations";

export const PRODUCT_TYPES = new Set([
  "Window",
  "Door",
  "Partition",
  "Cabinet",
  "Enclosure",
  "Railing",
  "Other",
]);

export function validateProductDraftInput(input: CreateProductInput): CreateProductInput {
  const productName = input.product_name.trim();
  if (!productName) throw new Error("Product name is required.");
  if (!PRODUCT_TYPES.has(input.product_type)) throw new Error("Product type is invalid.");
  if (!Number.isFinite(input.base_price) || input.base_price < 0) {
    throw new Error("Base price must be a finite, non-negative number.");
  }

  const isAddon = Boolean(input.is_addon);
  let addonType: "screen" | "grill" | null = null;
  if (isAddon) {
    if (input.addon_type !== "screen" && input.addon_type !== "grill") {
      throw new Error("Add-on accessory requires a valid add-on type ('screen' or 'grill').");
    }
    addonType = input.addon_type;
  } else if (input.addon_type) {
    throw new Error("Standard product cannot have an add-on type.");
  }

  return {
    product_name: productName,
    product_type: input.product_type,
    description: input.description.trim(),
    base_price: input.base_price,
    is_addon: isAddon,
    addon_type: addonType,
  };
}
