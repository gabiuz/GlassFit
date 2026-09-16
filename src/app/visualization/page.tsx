import { DirectVisualizationPage } from "@/features/visualization";
import { getActiveProducts } from "@/lib/products/getActiveProducts";
import { mapDatabaseProductToCatalog } from "@/lib/products/productRendererAdapter";
import type { CatalogProduct } from "@/lib/products/types";

export const dynamic = "force-dynamic";

export default async function VisualizationPage() {
  let catalogProducts: CatalogProduct[] = [];

  try {
    const products = await getActiveProducts();
    catalogProducts = products.map(mapDatabaseProductToCatalog);
  } catch (error) {
    console.error("[VisualizationPage] Unable to load active products:", error);
  }

  return <DirectVisualizationPage catalogProducts={catalogProducts} />;
}
