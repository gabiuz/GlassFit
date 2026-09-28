import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getR2AssetUrl } from "@/lib/r2";

export type ProductDetail = {
  product_id: string;
  product_name: string;
  product_type: string;
  description: string | null;
  base_price: number;
  catalog_image_url: string | null;
  catalog_image_urls?: string[];
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
        asset_id,
        asset_type,
        r2_object_key,
        display_order,
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

  type Asset = {
    asset_id?: string;
    asset_type: string;
    r2_object_key: string;
    display_order?: number;
    is_primary: boolean;
    status: string;
  };

  // Filter and sort all active catalog images
  const catalogImages = (assets as Asset[])
    .filter((a) => a.asset_type === "Catalog Image" && a.status === "Active")
    .sort((a, b) => (a.display_order ?? 1) - (b.display_order ?? 1));

  // Primary catalog image
  const primaryAsset = catalogImages.find((a) => a.is_primary === true) ?? catalogImages[0] ?? null;

  const catalogImageUrls = catalogImages
    .map((a) => getR2AssetUrl(a.r2_object_key))
    .filter((url): url is string => url !== null);

  // Primary 3D preview GLB
  const glbAsset = (assets as Asset[]).find(
    (a) =>
      (a.asset_type === "Catalog 3D Preview" || a.asset_type === "Whole Model") &&
      a.is_primary === true &&
      a.status === "Active"
  ) ?? (assets as Asset[]).find(
    (a) =>
      (a.asset_type === "Catalog 3D Preview" || a.asset_type === "Whole Model") &&
      a.status === "Active"
  ) ?? null;

  const rawPrice = data.base_price;
  const price =
    typeof rawPrice === "number"
      ? rawPrice
      : typeof rawPrice === "string"
        ? parseFloat(rawPrice)
        : 0;

  const primaryUrl = getR2AssetUrl(primaryAsset ? primaryAsset.r2_object_key : null);
  const finalImageUrls = catalogImageUrls.length > 0 ? catalogImageUrls : (primaryUrl ? [primaryUrl] : []);

  return {
    product_id: data.product_id,
    product_name: data.product_name,
    product_type: data.product_type,
    description: typeof data.description === "string" ? data.description : null,
    base_price: price,
    catalog_image_url: primaryUrl ?? (finalImageUrls[0] || null),
    catalog_image_urls: finalImageUrls,
    preview_glb_url: getR2AssetUrl(glbAsset ? glbAsset.r2_object_key : null),
  };
}
