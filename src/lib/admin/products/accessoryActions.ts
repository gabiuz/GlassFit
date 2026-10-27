"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/admin";
import type { AccessoryCategory } from "./types";

export interface CatalogAccessoryItem {
  id: string;
  name: string;
  category: AccessoryCategory;
  price: number;
  description: string;
  glbUrl?: string | null;
}

/**
 * Fetches active accessories from the catalog, optionally filtered by category.
 * Traceability: PRD-F14, SDD-C9, IMP-MS75, QAD-TC90.7, QAD-TC90.8
 */
export async function fetchActiveCatalogAccessories(
  category?: AccessoryCategory,
): Promise<CatalogAccessoryItem[]> {
  await requirePermission("manage_products");
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("products")
    .select("product_id, product_name, description, base_price, accessory_category, preview_image_url")
    .eq("is_accessory", true)
    .eq("status", "Active");

  if (category) {
    query = query.eq("accessory_category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch catalog accessories:", error.message);
    return [];
  }

  if (!data) return [];

  return data.map((item) => ({
    id: item.product_id,
    name: item.product_name,
    category: (item.accessory_category as AccessoryCategory) || "other",
    price: Number(item.base_price) || 0,
    description: item.description || "",
    glbUrl: item.preview_image_url,
  }));
}
