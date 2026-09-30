import { requirePermission } from "@/lib/auth/admin";
import { getProductDraft } from "@/lib/admin/products/productMutations";
import { resolveWizardStep } from "@/lib/admin/products/wizardSteps";
import { notFound } from "next/navigation";
import { ProductSetupWizard } from "@/features/admin/products/setup/ProductSetupWizard";

export const metadata = {
  title: "Setup Product | Admin | GlassFit",
};

export default async function ProductSetupRoute({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePermission("manage_products");
  
  const { productId } = await params;
  const resolvedSearchParams = await searchParams;
  const initialStep = resolveWizardStep(productId, resolvedSearchParams.step);

  let initialData = null;
  
  if (productId !== "draft") {
    initialData = await getProductDraft(productId);
    if (!initialData) notFound();
  }

  return (
    <ProductSetupWizard
      key={productId}
      productId={productId}
      initialData={initialData}
      initialStep={initialStep}
    />
  );
}
