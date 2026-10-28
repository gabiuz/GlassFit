"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/admin";
import { revalidatePath } from "next/cache";
import type { AddonType, CompatibleAddonBinding, HostProductAddonConfig, AvailableAddonProduct } from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Fetches active add-on products for populating setup wizard select inputs.
 */
export async function getAvailableAddonProducts(
  addonType?: AddonType
): Promise<AvailableAddonProduct[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("products")
    .select("product_id, product_name, product_type, addon_type, base_price, status, description")
    .eq("is_addon", true)
    .eq("status", "Active");

  if (addonType) {
    query = query.eq("addon_type", addonType);
  }

  const { data, error } = await query.order("product_name", { ascending: true });

  if (error) {
    console.error("Failed to fetch available add-on products:", error);
    throw new Error(`Failed to fetch available add-on products: ${error.message}`);
  }

  return (data || []).map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    productType: row.product_type,
    addonType: row.addon_type as AddonType | null,
    basePrice: Number(row.base_price) || 0,
    status: row.status,
    description: row.description,
  }));
}

/**
 * Fetches configured add-on bindings for a host parent product.
 */
export async function getCompatibleAddonsForProduct(
  parentProductId: string
): Promise<CompatibleAddonBinding[]> {
  const supabase = await createSupabaseServerClient();

  if (!UUID_PATTERN.test(parentProductId)) {
    return [];
  }

  // Fetch bindings directly and map products
  const { data: fallbackData, error: fallbackError } = await supabase
    .from("product_compatible_addons")
    .select("id, parent_product_id, addon_product_id, addon_type, is_default_enabled, display_order, allowed_sides, default_side, hatch_target_component_keys, hatch_alignment_config")
    .eq("parent_product_id", parentProductId)
    .order("display_order", { ascending: true });

  if (fallbackError) {
    console.error("Failed to fetch compatible add-ons:", fallbackError);
    throw new Error(`Failed to fetch compatible add-ons: ${fallbackError.message}`);
  }

  if (!fallbackData || fallbackData.length === 0) return [];

  const addonIds = fallbackData.map((d) => d.addon_product_id);
  const { data: productsData } = await supabase
    .from("products")
    .select("product_id, product_name, base_price, status")
    .in("product_id", addonIds);

  const productMap = new Map((productsData || []).map((p) => [p.product_id, p]));

  return fallbackData.map((row) => {
    const prod = productMap.get(row.addon_product_id);
    return {
      id: row.id,
      parentProductId: row.parent_product_id,
      addonProductId: row.addon_product_id,
      addonType: row.addon_type as AddonType,
      isDefaultEnabled: row.is_default_enabled,
      displayOrder: row.display_order,
      allowedSides: (row.allowed_sides as import("./types").AddonAllowedSides) || "both",
      defaultSide: (row.default_side as import("./types").AddonMountingSide) || "back",
      hatchTargetComponentKeys: (row.hatch_target_component_keys as string[]) || null,
      hatchAlignmentConfig: (row.hatch_alignment_config as Record<string, unknown>) || null,
      addonProduct: prod
        ? {
            productId: prod.product_id,
            productName: prod.product_name,
            basePrice: Number(prod.base_price) || 0,
            status: prod.status,
          }
        : undefined,
    };
  });
}

import {
  computeAddonReconciliation,
} from "./addonUtils";

/**
 * Persists compatible add-on attachments for a host product.
 * Removes disabled add-ons and creates or updates enabled add-on bindings.
 */
export async function saveProductAddonInheritance(
  parentProductId: string,
  config: HostProductAddonConfig
): Promise<void> {
  await requirePermission("manage_products");
  const supabase = await createSupabaseServerClient();

  if (!UUID_PATTERN.test(parentProductId)) {
    throw new Error("A valid persisted parent product ID is required.");
  }

  // 1. Fetch existing bindings
  const { data: existing, error: fetchErr } = await supabase
    .from("product_compatible_addons")
    .select("id, addon_product_id, addon_type")
    .eq("parent_product_id", parentProductId);

  if (fetchErr) {
    throw new Error(`Failed to load existing add-ons: ${fetchErr.message}`);
  }

  const existingTypes = new Set((existing || []).map((row) => row.addon_type));
  const { toUpsert, toDeleteTypes } = computeAddonReconciliation(parentProductId, existingTypes, config);
  const desiredAddonProductIds = new Set(toUpsert.map((item) => item.addon_product_id));

  // 2. Execute upserts
  for (const item of toUpsert) {
    const { error: upsertErr } = await supabase.from("product_compatible_addons").upsert(
      item,
      { onConflict: "parent_product_id,addon_product_id" }
    );
    if (upsertErr) {
      throw new Error(`Failed to bind ${item.addon_type} add-on: ${upsertErr.message}`);
    }
  }

  // 3. Execute deletes: remove unselected items and disabled types
  for (const addonType of toDeleteTypes) {
    const { error: delErr } = await supabase
      .from("product_compatible_addons")
      .delete()
      .eq("parent_product_id", parentProductId)
      .eq("addon_type", addonType);
    if (delErr) {
      throw new Error(`Failed to unbind ${addonType} add-on: ${delErr.message}`);
    }
  }

  const unselectedExisting = (existing || []).filter(
    (row) => !toDeleteTypes.includes(row.addon_type as AddonType) && !desiredAddonProductIds.has(row.addon_product_id)
  );

  for (const row of unselectedExisting) {
    const { error: delItemErr } = await supabase
      .from("product_compatible_addons")
      .delete()
      .eq("parent_product_id", parentProductId)
      .eq("addon_product_id", row.addon_product_id);
    if (delItemErr) {
      throw new Error(`Failed to unbind add-on ${row.addon_product_id}: ${delItemErr.message}`);
    }
  }

  revalidatePath(`/admin/products/${parentProductId}/setup`);
  revalidatePath("/admin/products");
}
