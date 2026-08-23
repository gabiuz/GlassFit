import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductsContent } from "./ProductsContent";
import type { AdminProductItem, AdminProductStatus } from "./productData";

export async function ProductsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: products } = await supabase
    .from("products")
    .select("product_id, product_name, product_type, description, base_price, status")
    .order("created_at", { ascending: false });

  const formattedProducts: AdminProductItem[] = (products || []).map((p) => ({
    id: p.product_id,
    name: p.product_name,
    type: p.product_type,
    description: p.description || "",
    basePrice: `₱ ${new Intl.NumberFormat("en-PH", {
      style: "decimal",
      minimumFractionDigits: 2,
    }).format(p.base_price)}`,
    status: (p.status === "Active" ? "Published" : "Draft") as AdminProductStatus,
  }));

  return <ProductsContent initialProducts={formattedProducts} />;
}
