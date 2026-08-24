"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProductModelWorkspace } from "@/features/visualization";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";
import type { ProductStructuralDefinition } from "@/lib/visualization/types";

export function ProductAwareWorkspacePage({
  productId,
  structuralDefinition,
}: {
  productId: string;
  structuralDefinition: ProductStructuralDefinition;
}) {
  const router = useRouter();
  const {
    selectedProductId,
    spaceImageSession,
    finalSnapshotDataUrl,
    setStructuralDefinition,
    setProductConfiguration,
    setVariationSnapshots,
    setFinalSnapshotDataUrl,
    resetVisualizationSession,
  } = useVisualizationSession();

  const hasMatchingSession =
    selectedProductId === productId && Boolean(spaceImageSession);

  useEffect(() => {
    if (!hasMatchingSession) {
      router.replace(`/visualize/${productId}/upload`);
      return;
    }

    setStructuralDefinition(structuralDefinition);
  }, [
    hasMatchingSession,
    productId,
    router,
    setStructuralDefinition,
    structuralDefinition,
  ]);

  if (!hasMatchingSession || !spaceImageSession) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="rounded-[20px] bg-neutral-100 px-6 py-5 text-black">
          Returning to upload...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex flex-col gap-14 px-6 py-28 md:px-12 lg:px-24.25">
        <ProductModelWorkspace
          uploadedImage={spaceImageSession.workspaceImage.url}
          spaceImageSession={spaceImageSession}
          structuralDefinition={structuralDefinition}
          selectedProductName={structuralDefinition.product.productName}
          initialSnapshotDataUrl={finalSnapshotDataUrl}
          onConfigurationChange={setProductConfiguration}
          onVariationSnapshotsChange={setVariationSnapshots}
          onSnapshotChange={setFinalSnapshotDataUrl}
          onBack={() => {
            resetVisualizationSession();
            router.push(`/visualize/${productId}/upload`);
          }}
        />
      </div>
    </main>
  );
}
