import Link from "next/link";
import { ProductAwareWorkspacePage } from "@/features/visualization";
import { getProductStructuralDefinition } from "@/lib/visualization/structuralData";

export const dynamic = "force-dynamic";

type ProductWorkspacePageProps = {
  params: Promise<{ productId: string }>;
};

export default async function ProductWorkspacePage({
  params,
}: ProductWorkspacePageProps) {
  const { productId } = await params;
  const structuralDefinitionResult = await loadStructuralDefinition(productId);

  if (structuralDefinitionResult.ok) {
    return (
      <ProductAwareWorkspacePage
        productId={productId}
        structuralDefinition={structuralDefinitionResult.definition}
      />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 pt-24">
      <div className="flex max-w-xl flex-col items-center gap-5 rounded-[20px] border border-[#c3c3c3]/50 bg-white p-8 text-center shadow-[0px_0px_5px_0px_rgba(0,0,0,0.18)]">
        <h1 className="text-3xl font-medium text-black">Visualization unavailable</h1>
        <p className="text-base text-black/75">{structuralDefinitionResult.message}</p>
        <Link
          href={`/visualize/${productId}/upload`}
          className="rounded-[10px] bg-[#0f1422] px-5 py-2.5 text-white transition-colors hover:bg-black"
        >
          Back to Upload
        </Link>
      </div>
    </main>
  );
}

async function loadStructuralDefinition(productId: string) {
  try {
    const definition = await getProductStructuralDefinition(productId);
    return { ok: true as const, definition };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof Error
          ? error.message
          : "This product cannot be prepared for visualization.",
    };
  }
}
