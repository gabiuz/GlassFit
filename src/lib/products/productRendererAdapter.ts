import { getR2AssetUrl } from "@/lib/r2";
import type { DatabaseProduct, SupportedRendererKey, CatalogProduct } from "./types";

/**
 * Maps a database product_type to the currently supported local renderer key.
 *
 * This is intentionally temporary.  It will be replaced by product_templates.model_strategy
 * once templates and assets are connected in a later implementation step.
 *
 * @returns The renderer key if the type is currently supported, or null otherwise.
 */
export function resolveRendererKey(
  productType: DatabaseProduct["product_type"]
): SupportedRendererKey | null {
  switch (productType) {
    case "Window":
      return "window";
    case "Cabinet":
      return "cabinet";
    default:
      return null;
  }
}

/**
 * Maps a raw Supabase DatabaseProduct to the UI-facing CatalogProduct shape.
 */
export function mapDatabaseProductToCatalog(
  dbProduct: DatabaseProduct
): CatalogProduct {
  return {
    id: dbProduct.product_id,
    name: dbProduct.product_name,
    type: dbProduct.product_type,
    description: dbProduct.description,
    basePrice: dbProduct.base_price,
    rendererKey: resolveRendererKey(dbProduct.product_type),
    imageUrl: getR2AssetUrl(dbProduct.catalog_image_r2_key),
  };
}
