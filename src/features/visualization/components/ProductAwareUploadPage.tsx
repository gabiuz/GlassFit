"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GuideLine,
  ImageErrorModal,
  ImageLoadingModal,
  ImageSuccessModal,
  UploadImage,
} from "@/features/visualization";
import { analyzeImage, type SpaceImageSession } from "@/lib/imageApi";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";
import type { SelectedVisualizationProduct } from "@/lib/visualization/types";

type UploadStatus = "idle" | "analyzing" | "ready" | "error";

export function ProductAwareUploadPage({
  product,
}: {
  product: SelectedVisualizationProduct;
}) {
  const router = useRouter();
  const requestIdRef = useRef(0);
  const { setPreparedSpaceImage } = useVisualizationSession();
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to analyze the image.");
    }
  };

  const handlePlaceProduct = () => {
    if (!pendingSession) return;

    setPreparedSpaceImage(product.productId, pendingSession);
    router.push(`/visualize/${product.productId}/workspace`);
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

  return (
    <main className="flex min-h-screen flex-col">
      <section className="px-6 pt-28 md:px-12 lg:px-24.25">
        <div className="mx-auto flex w-full max-w-367 flex-col gap-5 rounded-[20px] border border-[#c3c3c3]/50 bg-white px-5 py-5 shadow-[0px_0px_5px_0px_rgba(0,0,0,0.18)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-[10px] bg-neutral-100">
              {product.catalogImageUrl ? (
                <Image
                  src={product.catalogImageUrl}
                  alt={product.productName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                  No image
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[#c3c3c3]">You are visualizing</p>
              <h1 className="truncate text-2xl font-medium text-black">
                {product.productName}
              </h1>
              <p className="text-sm text-green">{product.productType}</p>
            </div>
          </div>
          <Link
            href="/product"
            className="rounded-[10px] border border-[#0f1422] px-4 py-2 text-center text-sm text-[#0f1422] transition-colors hover:bg-neutral-100"
          >
            Change Product
          </Link>
        </div>
      </section>

      <div className="flex flex-col gap-14 px-6 py-8 md:px-12 md:py-12 lg:px-24.25 lg:py-17.75">
        <UploadImage onImageSelected={(file) => void runAnalysis(file)} />
        <GuideLine />
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
