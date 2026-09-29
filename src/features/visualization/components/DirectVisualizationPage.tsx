"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GuideLine } from "./GuideLine";
import { HeroSection } from "./HeroSection";
import { ImageErrorModal } from "./ImageErrorModal";
import { ImageLoadingModal } from "./ImageLoadingModal";
import { ImageSuccessModal } from "./ImageSuccessModal";
import { ProductModelWorkspace } from "./ProductModelWorkspace";
import { UploadImage } from "./UploadImage";
import { analyzeImage, type SpaceImageSession } from "@/lib/imageApi";
import type { CatalogProduct } from "@/lib/products/types";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";

type UploadStatus = "idle" | "analyzing" | "ready" | "error";

export function DirectVisualizationPage({
  catalogProducts,
}: {
  catalogProducts: CatalogProduct[];
}) {
  const router = useRouter();
  const requestIdRef = useRef(0);
  const { setPreparedSpaceImage } = useVisualizationSession();
  const [activeSession, setActiveSession] = useState<SpaceImageSession | null>(null);
  const [pendingSession, setPendingSession] = useState<SpaceImageSession | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runAnalysis = async (file: File) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setPendingFile(file);
    setPendingSession(null);
    setStatus("analyzing");
    setErrorMessage(null);

    try {
      const session = await analyzeImage(file);
      if (requestIdRef.current !== requestId) return;

      setPendingSession(session);
      setStatus("ready");
    } catch (error) {
      if (requestIdRef.current !== requestId) return;

      setPendingSession(null);
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to analyze the image.",
      );
    }
  };

  const handlePlaceProduct = () => {
    if (!pendingSession) return;

    setActiveSession(pendingSession);
    setPendingSession(null);
    setPendingFile(null);
    setStatus("idle");
  };

  const handleSelectProduct = (productId: string) => {
    if (!activeSession) return;

    setPreparedSpaceImage(productId, activeSession);
    router.push(`/visualize/${productId}/workspace`);
  };

  const handleCancelModal = () => {
    requestIdRef.current += 1;
    setPendingSession(null);
    setStatus("idle");
    setErrorMessage(null);
  };

  const handleTryAgain = () => {
    if (pendingFile) {
      void runAnalysis(pendingFile);
      return;
    }

    setStatus("idle");
    setErrorMessage(null);
  };

  const handleResetImage = () => {
    requestIdRef.current += 1;
    setActiveSession(null);
    setPendingSession(null);
    setPendingFile(null);
    setStatus("idle");
    setErrorMessage(null);
  };

  return (
    <main className="flex min-h-screen flex-col">
      <HeroSection />
      <div className="flex flex-col gap-14 px-6 py-8 md:px-12 md:py-12 lg:px-24.25 lg:py-17.75">
        {activeSession ? (
          <ProductModelWorkspace
            uploadedImage={activeSession.workspaceImage.url}
            spaceImageSession={activeSession}
            catalogProducts={catalogProducts}
            onProductSelect={(productId) => handleSelectProduct(productId)}
            onBack={handleResetImage}
          />
        ) : (
          <>
            <UploadImage onImageSelected={(file) => void runAnalysis(file)} />
            <GuideLine />
          </>
        )}
      </div>

      <ImageLoadingModal
        isOpen={status === "analyzing"}
        onCancel={handleCancelModal}
        isLoading
      />

      <ImageSuccessModal
        isOpen={status === "ready"}
        onCancel={handleCancelModal}
        onPlaceProduct={handlePlaceProduct}
        description="Continue to the workspace, then choose a product from the active catalog."
        actionLabel="Continue" 
      />

      <ImageErrorModal
        isOpen={status === "error"}
        onCancel={handleCancelModal}
        onTryAgain={handleTryAgain}
        errorMessage={errorMessage ?? undefined}
      />
    </main>
  );
}
