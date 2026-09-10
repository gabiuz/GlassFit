import { MaterialsPage } from "@/features/admin";
import { requirePermission } from "@/lib/auth/admin";

export const metadata = {
  title: "Raw Materials Catalog | GlassFit Admin",
  description: "Manage wholesale profile rates, glass sheets, hardware, and waste allowances",
};

export default async function AdminMaterialsRoute() {
  await requirePermission("manage_products");
  return <MaterialsPage />;
}
