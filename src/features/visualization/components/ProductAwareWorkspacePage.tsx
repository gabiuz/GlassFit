"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HeroSection, ProductModelWorkspace } from "@/features/visualization";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";
import type { ProductStructuralDefinition } from "@/lib/visualization/types";
import type { CatalogProduct } from "@/lib/products/types";
import { getMatchingProductConfigurationSeed } from "@/lib/visualization/configurationPropagation";

export function ProductAwareWorkspacePage({
  productId,
  structuralDefinition,
  catalogProducts,
}: {
  productId: string;
  structuralDefinition: ProductStructuralDefinition;
  catalogProducts: CatalogProduct[];
}) {
  const router = useRouter();
  const {
    assetSessionId,
    spaceImageSession,
    workspaceBackgroundDataUrl,
    productConfiguration,
    pendingProductConfiguration,
    placedOverlays,
    finalSnapshotDataUrl,
    setStructuralDefinition,
    setProductConfiguration,
    clearPendingProductConfiguration,
    setVariationSnapshots,
    setPlacedOverlays,
    setComparisonOverlays,
    setFinalSnapshotDataUrl,
    transitionWorkspaceProduct,
    resetVisualizationSession,
  } = useVisualizationSession();

  const hasValidSession = Boolean(spaceImageSession);
  const matchingProductConfiguration = getMatchingProductConfigurationSeed(
    pendingProductConfiguration,
    productId,
  );

  useEffect(() => {
    if (!hasValidSession) {
      router.replace(`/visualize/${productId}/upload`);
      return;
    }

    setStructuralDefinition(structuralDefinition);
  }, [
    hasValidSession,
    productId,
    router,
    setStructuralDefinition,
    structuralDefinition,
  ]);

  useEffect(() => {
    if (matchingProductConfiguration && productConfiguration) {
      clearPendingProductConfiguration();
    }
  }, [
    clearPendingProductConfiguration,
    matchingProductConfiguration,
    productConfiguration,
  ]);

  if (!hasValidSession || !spaceImageSession) {
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
      <HeroSection />

      <div className="px-6 py-8 md:px-12 md:py-12 lg:px-24.25 lg:py-17.75">
        <ProductModelWorkspace
          assetSessionId={assetSessionId}
          key={productId}
          uploadedImage={workspaceBackgroundDataUrl ?? spaceImageSession.workspaceImage.url}
          spaceImageSession={spaceImageSession}
          structuralDefinition={structuralDefinition}
          catalogProducts={catalogProducts}
          currentProductId={productId}
          selectedProductName={structuralDefinition.product.productName}
          initialSnapshotDataUrl={finalSnapshotDataUrl}
          initialConfiguration={productConfiguration}
          initialProductConfiguration={productConfiguration ? null : matchingProductConfiguration}
          placedOverlays={placedOverlays}
          onConfigurationChange={setProductConfiguration}
          onVariationSnapshotsChange={setVariationSnapshots}
          onSnapshotChange={setFinalSnapshotDataUrl}
          onPlacedOverlaysChange={setPlacedOverlays}
          onComparisonOverlaysChange={setComparisonOverlays}
          onProductSelect={(
            nextProductId,
            mode,
            newPlacedOverlay,
            configuration,
            targetOverlayId,
          ) => {
            transitionWorkspaceProduct({
              nextProductId,
              mode,
              newPlacedOverlay,
              targetOverlayId,
              nextConfiguration: configuration,
            });
            if (nextProductId !== productId) {
              router.push(`/visualize/${nextProductId}/workspace`);
            }
          }}
          onBack={() => {
            resetVisualizationSession();
            router.push(`/visualize/${productId}/upload`);
          }}
        />
      </div>
    </main>
  );
}
