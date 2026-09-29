import { requirePermission } from "@/lib/auth/admin";
import { getProductDraft } from "@/lib/admin/products/productMutations";
import { ProductSetupWizard } from "@/features/admin/products/setup/ProductSetupWizard";

export const metadata = {
  title: "Setup Product | Admin | GlassFit",
};

export default async function ProductSetupRoute({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await requirePermission("manage_products");
  
  const { productId } = await params;

  let initialData = null;
  
  if (productId !== "draft") {
    initialData = await getProductDraft(productId);
  }

  return <ProductSetupWizard productId={productId} initialData={initialData} />;
}
