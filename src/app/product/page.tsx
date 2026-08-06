import { HeroSection, SearchSection, ProductSection } from "@/features/product";
import { getActiveProducts } from "@/lib/products/getActiveProducts";
import { mapDatabaseProductToCatalog } from "@/lib/products/productRendererAdapter";
import type { CatalogProduct } from "@/lib/products/types";

// Always fetch fresh product data so admin changes are visible immediately.
export const dynamic = "force-dynamic";

export default async function ProductPage() {
  let products: CatalogProduct[] = [];
  let fetchError: string | null = null;

  try {
    const dbProducts = await getActiveProducts();
    products = dbProducts.map(mapDatabaseProductToCatalog);
  } catch (err) {
    fetchError =
      err instanceof Error
        ? err.message
        : "Products could not be loaded. Please refresh the page and try again.";
  }

  return (
    <main className="flex flex-col">
      <HeroSection />
      <div className="flex flex-col gap-6 xl:gap-14 px-6 py-8 md:px-12 lg:px-24.25 lg:py-17.75">
        <SearchSection />
        <ProductSection initialProducts={products} fetchError={fetchError} />
      </div>
    </main>
  );
}
