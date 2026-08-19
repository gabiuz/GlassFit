import { ProductsPage } from "@/features/admin";

export const metadata = {
  title: "Admin Products | GlassFit",
  description: "Manage products catalog and pricing",
};

export default function AdminProductsRoute() {
  return <ProductsPage />;
}
