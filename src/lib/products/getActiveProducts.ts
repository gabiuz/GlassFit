import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DatabaseProduct } from "./types";

/**
 * Fetches all active products from public.products ordered by type then name.
 *
 * Includes each product's primary active Catalog Image from public.product_assets.
 *
 * Designed for use in Next.js Server Components.
 * Does NOT require authentication — public RLS allows anonymous reads of active
 * catalog products and assets.
 *
 * @throws An Error with a user-safe message if the query fails.
 */
export async function getActiveProducts(): Promise<DatabaseProduct[]> {
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
      created_at,
      updated_at,
      product_assets (
        asset_id,
        asset_type,
        r2_object_key,
        is_primary,
        status
      )
    `)
    .eq("status", "Active")
    .eq("product_assets.asset_type", "Catalog Image")
    .eq("product_assets.is_primary", true)
    .eq("product_assets.status", "Active")
    .order("product_type", { ascending: true })
    .order("product_name", { ascending: true });

  if (error) {
    console.error("[getActiveProducts] Supabase error:", error);

    throw new Error(
      "Products could not be loaded. Please refresh the page and try again."
    );
  }

  const validated: DatabaseProduct[] = [];

  const allowedTypes: DatabaseProduct["product_type"][] = [
    "Window",
    "Door",
    "Partition",
    "Cabinet",
    "Enclosure",
    "Railing",
    "Other",
  ];

  for (const row of data ?? []) {
    const id: unknown = row.product_id;
    const name: unknown = row.product_name;
    const type: unknown = row.product_type;
    const price: unknown = row.base_price;
    const status: unknown = row.status;

    if (typeof id !== "string" || id.trim() === "") {
      console.warn(
        "[getActiveProducts] Skipping row with invalid product_id:",
        row
      );
      continue;
    }

    if (typeof name !== "string" || name.trim() === "") {
      console.warn(
        "[getActiveProducts] Skipping row with invalid product_name:",
        row
      );
      continue;
    }

    if (
      !allowedTypes.includes(type as DatabaseProduct["product_type"])
    ) {
      console.warn(
        "[getActiveProducts] Skipping row with unsupported product_type:",
        row
      );
      continue;
    }

    if (
      typeof price !== "number" ||
      !isFinite(price) ||
      price < 0
    ) {
      console.warn(
        "[getActiveProducts] Skipping row with invalid base_price:",
        row
      );
      continue;
    }

    if (status !== "Active") {
      continue;
    }

    const catalogImageAsset = row.product_assets?.[0];

    const catalogImageR2Key =
      catalogImageAsset &&
        typeof catalogImageAsset.r2_object_key === "string" &&
        catalogImageAsset.r2_object_key.trim() !== ""
        ? catalogImageAsset.r2_object_key
        : null;

    validated.push({
      product_id: id,
      product_name: name,
      product_type:
        type as DatabaseProduct["product_type"],
      description:
        typeof row.description === "string"
          ? row.description
          : null,
      base_price: price,
      status: "Active",
      created_at:
        typeof row.created_at === "string"
          ? row.created_at
          : "",
      updated_at:
        typeof row.updated_at === "string"
          ? row.updated_at
          : "",

      catalog_image_r2_key: catalogImageR2Key,
    });
  }

  return validated;
}