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
 * Built-in fallback accessories to guarantee real-time customer testing and demo availability
 * when the master catalog accessories table is in setup or authoring phase.
 */
export const DEFAULT_FALLBACK_ACCESSORIES: ActiveAccessoryProduct[] = [
  {
    productId: "default-lever-handle",
    productName: "Ergonomic Architectural Lever Handle",
    productType: "Other",
    description: "Solid zinc alloy ergonomic door handle with sleek horizontal lever.",
    basePrice: 850.0,
    accessoryCategory: "handle",
    accessoryMountingType: "surface_mount",
    imageUrl: null,
    previewGlbUrl: null,
    status: "Active",
  },
  {
    productId: "privacy-round-knob",
    productName: "Privacy Round Doorknob",
    productType: "Other",
    description: "Classic round spherical doorknob with turn-button interior privacy lock.",
    basePrice: 350.0,
    accessoryCategory: "handle",
    accessoryMountingType: "mortise",
    imageUrl: null,
    previewGlbUrl: null,
    status: "Active",
  },
  {
    productId: "keyless-smart-lock",
    productName: "Keyless Smart Digital Lock",
    productType: "Other",
    description: "Biometric fingerprint, digital passcode, and RFID card electronic door lock.",
    basePrice: 4500.0,
    accessoryCategory: "lock",
    accessoryMountingType: "mortise",
    imageUrl: null,
    previewGlbUrl: null,
    status: "Active",
  },
  {
    productId: "heavy-duty-roller",
    productName: "Heavy Duty Dual Ball-Bearing Roller",
    productType: "Other",
    description: "Stainless steel dual ball-bearing roller assembly for smooth door and window sliding.",
    basePrice: 420.0,
    accessoryCategory: "roller",
    accessoryMountingType: "recessed",
    imageUrl: null,
    previewGlbUrl: null,
    status: "Active",
  },
];

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
      console.warn("[getActiveAccessories] Query error, falling back to defaults:", error.message);
      return DEFAULT_FALLBACK_ACCESSORIES;
    }

    if (!data || data.length === 0) {
      return DEFAULT_FALLBACK_ACCESSORIES;
    }

    const accessories: ActiveAccessoryProduct[] = [];

    for (const row of data) {
      const assets = Array.isArray(row.product_assets) ? row.product_assets : [];
      const primaryImage = assets.find((a) => a.asset_type === "Catalog Image" && a.is_primary && a.status === "Active")
        || assets.find((a) => a.asset_type === "Catalog Image" && a.status === "Active");
      const previewGlb = assets.find((a) => (a.asset_type === "Catalog 3D Preview" || a.asset_type === "Whole Model" || a.asset_type === "Component Model") && a.status === "Active");

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

    // Merge fallback accessories if DB has none for a given category
    const categoriesInDb = new Set(accessories.map((a) => a.accessoryCategory));
    for (const fallback of DEFAULT_FALLBACK_ACCESSORIES) {
      if (!categoriesInDb.has(fallback.accessoryCategory)) {
        accessories.push(fallback);
      }
    }

    return accessories;
  } catch (err: unknown) {
    console.warn("[getActiveAccessories] Unhandled error, returning defaults:", err);
    return DEFAULT_FALLBACK_ACCESSORIES;
  }
}
