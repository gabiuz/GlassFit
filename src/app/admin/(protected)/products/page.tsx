import { ProductsPage } from "@/features/admin";
import { requirePermission } from "@/lib/auth/admin";

export const metadata = {
  title: "Admin Products | GlassFit",
  description: "Manage products catalog and pricing",
};

export default async function AdminProductsRoute() {
  await requirePermission("manage_products");
  return <ProductsPage />;
}
