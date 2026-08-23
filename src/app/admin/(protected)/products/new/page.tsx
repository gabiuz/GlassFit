import { requirePermission } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "New Product | Admin | GlassFit",
};

export default async function NewProductRoute() {
  await requirePermission("manage_products");
  
  // This route is just an entry point that renders an empty setup wizard.
  // We can redirect to the setup page with a "new" ID, or we can handle it all in the setup page.
  // Actually, wait, if we redirect to `/admin/products/new/setup`, the ID is "new".
  // Let's redirect to `/admin/products/draft/setup` and handle "draft" gracefully, or just use this route to host the setup wizard.
  redirect("/admin/products/draft/setup");
}
