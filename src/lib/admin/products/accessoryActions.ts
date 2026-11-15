"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/admin";
import { getEligibleAccessories, type EligibleAccessory } from "./accessoryEligibility";
import type { AccessoryCategory } from "./types";

export type CatalogAccessoryItem = EligibleAccessory;

/** IMP-MS77, QAD-TC92.2-.3: authorized accessory picker with distinct errors. */
export async function fetchActiveCatalogAccessories(
  category?: AccessoryCategory,
): Promise<CatalogAccessoryItem[]> {
  await requirePermission("manage_products");
  const supabase = await createSupabaseServerClient();
  return getEligibleAccessories(supabase, category);
}

/** Validate an administrator's explicit approval list against the current catalog. */
export async function validateAccessoryApprovalIds(
  category: AccessoryCategory | null | undefined,
  ids: string[] | null | undefined,
  partName: string,
  requireOptions = false,
): Promise<string[]> {
  await requirePermission("manage_products");
  if (!category || !(["handle", "lock", "hinge", "roller", "other"] as string[]).includes(category)) {
    throw new Error(`Part "${partName}" needs a valid accessory category.`);
  }
  if (!Array.isArray(ids)) {
    if (requireOptions) throw new Error(`Part "${partName}" needs at least one approved accessory.`);
    return [];
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Part "${partName}" has duplicate approved accessories.`);
  }
  if (ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    throw new Error(`Part "${partName}" has an invalid accessory ID.`);
  }
  if (requireOptions && ids.length === 0) {
    throw new Error(`Part "${partName}" needs at least one approved accessory.`);
  }
  if (ids.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const eligible = await getEligibleAccessories(supabase, category, ids);
  const eligibleIds = new Set(eligible.map((item) => item.id));
  const unavailable = ids.find((id) => !eligibleIds.has(id));
  if (unavailable) {
    throw new Error(`Part "${partName}" has an unavailable or incompatible approved accessory (${unavailable}). Select an active ${category} accessory with a 3D model.`);
  }
  return ids;
}
