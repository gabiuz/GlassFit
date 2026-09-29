import { notFound } from "next/navigation";
import { BackgroundNavbar } from "@/components/shared/BackgroundNavbar";
import { ProductDetails } from "@/features/product-details";
import { getProductById } from "@/lib/products/getProductById";
import type { ProductDetail } from "@/lib/products/getProductById";

export const dynamic = "force-dynamic";

interface ProductDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailsPage({ params }: ProductDetailsPageProps) {
  const { id } = await params;

  const product: ProductDetail | null = await getProductById(id);

  if (!product) {
    notFound();
  }

  // product is guaranteed non-null past the notFound() guard
  const safeProduct: ProductDetail = product;

  return (
    <div>
      <BackgroundNavbar />
      <ProductDetails product={safeProduct} />
    </div>
  );
}
