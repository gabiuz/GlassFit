"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HeroSection, ProductModelWorkspace } from "@/features/visualization";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";
import type { ProductStructuralDefinition } from "@/lib/visualization/types";
import type { CatalogProduct } from "@/lib/products/types";
import { getMatchingProductConfigurationSeed } from "@/lib/visualization/configurationPropagation";
import { seedWorkspaceDefinition, clearWorkspaceDefinitions } from "@/lib/visualization/workspaceDefinitionCache";

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
    selectedProductId,
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

  const [active, setActive] = useState(() => ({ productId, definition: structuralDefinition }));
  const initializedRouteRef = useRef<string | null>(null);
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

    if (structuralDefinition.product.productId !== productId) return;
    if (assetSessionId) seedWorkspaceDefinition(assetSessionId, structuralDefinition);
    const routeKey = `${assetSessionId}:${productId}`;
    if (initializedRouteRef.current === routeKey) return;
    initializedRouteRef.current = routeKey;
    setActive({ productId, definition: structuralDefinition });
    if (selectedProductId !== productId) {
      setProductConfiguration(null);
    }
    setStructuralDefinition(structuralDefinition);
  }, [
    assetSessionId,
    hasValidSession,
    productId,
    router,
    setStructuralDefinition,
    setProductConfiguration,
    selectedProductId,
    structuralDefinition,
  ]);

  useEffect(() => () => clearWorkspaceDefinitions(), []);

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
          uploadedImage={workspaceBackgroundDataUrl ?? spaceImageSession.workspaceImage.url}
          spaceImageSession={spaceImageSession}
          structuralDefinition={active.definition}
          catalogProducts={catalogProducts}
          currentProductId={active.productId}
          selectedProductName={active.definition.product.productName}
          initialSnapshotDataUrl={finalSnapshotDataUrl}
          initialConfiguration={selectedProductId === productId ? productConfiguration : null}
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
            nextDefinition,
          ) => {
            transitionWorkspaceProduct({
              nextProductId,
              mode,
              newPlacedOverlay,
              targetOverlayId,
              nextConfiguration: configuration,
              nextDefinition,
            });
            if (nextDefinition) {
              setActive({ productId: nextProductId, definition: nextDefinition });
              window.history.replaceState(null, "", `/visualize/${encodeURIComponent(nextProductId)}/workspace`);
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
