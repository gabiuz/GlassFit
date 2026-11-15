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

  let initialData = null;
  
  if (productId !== "draft") {
    initialData = await getProductDraft(productId);
    if (!initialData) notFound();
  }

  const isAddon = Boolean(initialData?.is_addon) || resolvedSearchParams.role === "addon";
  const isAccessory = Boolean(initialData?.is_accessory) || resolvedSearchParams.role === "accessory";
  const initialStep = resolveWizardStep(productId, resolvedSearchParams.step, isAddon, isAccessory);

  return (
    <ProductSetupWizard
      key={productId}
      productId={productId}
      initialData={initialData}
      initialStep={initialStep}
    />
  );
}
