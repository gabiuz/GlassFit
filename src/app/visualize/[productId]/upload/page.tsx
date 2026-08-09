import Link from "next/link";
import { ProductAwareUploadPage } from "@/features/visualization";
import { getSelectedVisualizationProduct } from "@/lib/visualization/structuralData";

export const dynamic = "force-dynamic";

type ProductUploadPageProps = {
  params: Promise<{ productId: string }>;
};

export default async function ProductUploadPage({
  params,
}: ProductUploadPageProps) {
  const { productId } = await params;
  const product = await getSelectedVisualizationProduct(productId);

  if (!product) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="flex max-w-xl flex-col items-center gap-5 rounded-[20px] border border-[#c3c3c3]/50 bg-white p-8 text-center shadow-[0px_0px_5px_0px_rgba(0,0,0,0.18)]">
          <h1 className="text-3xl font-medium text-black">Product unavailable</h1>
          <p className="text-base text-black/75">
            This product is inactive or no longer exists, so it cannot be used for visualization.
          </p>
          <Link
            href="/product"
            className="rounded-[10px] bg-[#0f1422] px-5 py-2.5 text-white transition-colors hover:bg-black"
          >
            Back to Catalog
          </Link>
        </div>
      </main>
    );
  }

  return <ProductAwareUploadPage product={product} />;
}
