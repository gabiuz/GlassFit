"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getR2AssetUrl } from "@/lib/r2";
import type { AccessoryCategory, AccessoryMountingType } from "@/lib/admin/products/types";

/**
 * Active accessory item representation for the customer visualization workspace.
 * Traceability: PRD-F2, PRD-F6, PRD-F14, ERD-E3, IMP-MS74, IMP-MS76
 */
export interface ActiveAccessoryProduct {
  productId: string;
  productName: string;
  productType: string;
  description: string | null;
  basePrice: number;
  accessoryCategory: AccessoryCategory | "other";
  accessoryMountingType: AccessoryMountingType | null;
  imageUrl: string | null;
  previewGlbUrl: string | null;
  status: "Active" | "Inactive";
}

/**
 * Fetches all active accessory products from public.products.
 * Includes each accessory's primary active catalog image and 3D preview model asset.
 */
export async function getActiveAccessories(): Promise<ActiveAccessoryProduct[]> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("products")
      .select(`
        product_id,
        product_name,
        product_type,
        description,
        base_price,
        status,
        is_accessory,
        accessory_category,
        accessory_mounting_type,
        created_at,
        updated_at,
        product_assets (
          asset_id,
          asset_type,
          r2_object_key,
          display_order,
          is_primary,
          status
        )
      `)
      .eq("status", "Active")
      .eq("is_accessory", true)
      .order("product_name", { ascending: true });

    if (error) {
      throw new Error(`Could not load registered accessories: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    const accessories: ActiveAccessoryProduct[] = [];

    for (const row of data) {
      const assets = Array.isArray(row.product_assets) ? row.product_assets : [];
      const primaryImage = assets.find((a) => a.asset_type === "Catalog Image" && a.is_primary && a.status === "Active")
        || assets.find((a) => a.asset_type === "Catalog Image" && a.status === "Active");
      const previewGlb = assets.find((a) => (a.asset_type === "Catalog 3D Preview" || a.asset_type === "Whole Model" || a.asset_type === "Component Model") && a.status === "Active");
      if (!previewGlb?.r2_object_key) continue;

      accessories.push({
        productId: row.product_id,
        productName: row.product_name,
        productType: row.product_type,
        description: row.description,
        basePrice: Number(row.base_price) || 0,
        accessoryCategory: (row.accessory_category as AccessoryCategory) || "other",
        accessoryMountingType: (row.accessory_mounting_type as AccessoryMountingType) || null,
        imageUrl: primaryImage?.r2_object_key ? getR2AssetUrl(primaryImage.r2_object_key) : null,
        previewGlbUrl: previewGlb?.r2_object_key ? getR2AssetUrl(previewGlb.r2_object_key) : null,
        status: "Active",
      });
    }

    return accessories;
  } catch (err: unknown) {
    console.warn("[getActiveAccessories] Could not load catalog:", err);
    throw err;
  }
}
