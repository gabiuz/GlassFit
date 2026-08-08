import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getR2AssetUrl } from "@/lib/r2";

export type ProductDetail = {
  product_id: string;
  product_name: string;
  product_type: string;
  description: string | null;
  base_price: number;
  catalog_image_url: string | null;
  preview_glb_url: string | null;
};

/**
 * Fetches a single active product by its UUID.
 * Returns null when the product is not found or inactive.
 */
export async function getProductById(id: string): Promise<ProductDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("products")
    .select(`
      product_id,
      product_name,
      product_type,
      description,
      base_price,
      product_assets (
        asset_type,
        r2_object_key,
        is_primary,
        status
      )
    `)
    .eq("product_id", id)
    .eq("status", "Active")
    .single();

  if (error || !data) {
    return null;
  }

  const assets = Array.isArray(data.product_assets) ? data.product_assets : [];

  type Asset = { asset_type: string; r2_object_key: string; is_primary: boolean; status: string };

  // Primary catalog image
  const catalogAsset = assets.find(
    (a: Asset) =>
      a.asset_type === "Catalog Image" && a.is_primary === true && a.status === "Active"
  ) ?? null;

  // Primary 3D preview GLB
  const glbAsset = assets.find(
    (a: Asset) =>
      a.asset_type === "Catalog 3D Preview" && a.is_primary === true && a.status === "Active"
  ) ?? null;

  const rawPrice = data.base_price;
  const price =
    typeof rawPrice === "number"
      ? rawPrice
      : typeof rawPrice === "string"
        ? parseFloat(rawPrice)
        : 0;

  return {
    product_id: data.product_id,
    product_name: data.product_name,
    product_type: data.product_type,
    description: typeof data.description === "string" ? data.description : null,
    base_price: price,
    catalog_image_url: getR2AssetUrl(catalogAsset ? catalogAsset.r2_object_key : null),
    preview_glb_url: getR2AssetUrl(glbAsset ? glbAsset.r2_object_key : null),
  };
}
