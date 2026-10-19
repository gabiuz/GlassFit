"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalibrationModeSelector,
  GuideLine,
  HeroSection,
  ImageErrorModal,
  ImageLoadingModal,
  ImageSuccessModal,
  PaperDetectionConfirmationModal,
  UploadImage,
} from "@/features/visualization";
import { analyzeImage, type SpaceImageSession } from "@/lib/imageApi";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";
import {
  type CalibrationMode,
  type FiducialPaperStandard,
  type Point2D,
  type SelectedVisualizationProduct,
} from "@/lib/visualization/types";

import { confirmPaperReference, skipPaperReference, type PaperReviewResult } from "@/lib/visualization/paperReference";

type UploadStatus = "idle" | "analyzing" | "ready" | "error";

export function ProductAwareUploadPage({
  product,
}: {
  product: SelectedVisualizationProduct;
}) {
  const router = useRouter();
  const requestIdRef = useRef(0);
  const { setPreparedSpaceImage, clearPendingProductConfiguration } = useVisualizationSession();
  const [pendingSession, setPendingSession] = useState<SpaceImageSession | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode>("auto_detect");
  const [paperStandard, setPaperStandard] = useState<FiducialPaperStandard>("short");

  const runAnalysis = async (file: File) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setPendingFile(file);
    setPendingSession(null);
    setStatus("analyzing");
    setErrorMessage(null);

    try {
      const session = await analyzeImage(file, {
        mode: calibrationMode,
        paperStandard: calibrationMode === "paper_fiducial" ? paperStandard : undefined,
      });
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

  const handlePaperConfirm = (
    corners: [Point2D, Point2D, Point2D, Point2D],
    result: PaperReviewResult,
    paperStd: FiducialPaperStandard,
  ) => {
    if (!pendingSession) return;
    const updatedSession = confirmPaperReference(pendingSession, corners, result, paperStd);

    setPreparedSpaceImage(product.productId, updatedSession);
    router.push(`/visualize/${product.productId}/workspace`);
  };

  const handlePaperSkip = (review?: PaperReviewResult) => {
    if (!pendingSession) return;
    const fallbackSession = skipPaperReference(pendingSession, review);

    setPreparedSpaceImage(product.productId, fallbackSession);
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

  const isPaperFiducialSession =
    calibrationMode !== "standard" ||
    pendingSession?.calibrationMeta?.mode === "paper_fiducial" ||
    Boolean(pendingSession?.paperCalibration?.detected_corners) ||
    Boolean(pendingSession?.calibrationMeta?.detectedCorners) ||
    pendingSession?.calibrationMeta?.status === "manual_pin_required";

  return (
    <main className="flex min-h-screen flex-col">
      <HeroSection />

      <section className="px-6 pt-8 md:px-12 md:pt-12 lg:px-24.25 lg:pt-17.75">
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
            onClick={clearPendingProductConfiguration}
            className="rounded-[10px] border border-[#0f1422] px-4 py-2 text-center text-sm text-[#0f1422] transition-colors hover:bg-neutral-100"
          >
            Change Product
          </Link>
        </div>
      </section>

      <div className="flex flex-col gap-10 px-6 py-8 md:px-12 md:py-12 lg:px-24.25 lg:py-17.75">
        <CalibrationModeSelector
          mode={calibrationMode}
          paperStandard={paperStandard}
          onModeChange={setCalibrationMode}
          onPaperStandardChange={setPaperStandard}
        />
        <UploadImage
          mode={calibrationMode}
          onImageSelected={(file) => void runAnalysis(file)}
        />
        <GuideLine mode={calibrationMode} />
      </div>

      <ImageLoadingModal
        isOpen={status === "analyzing"}
        onCancel={handleCancelModal}
        isLoading
      />

      {status === "ready" && isPaperFiducialSession && pendingSession && (
        <PaperDetectionConfirmationModal
          isOpen={status === "ready"}
          backgroundImageUrl={pendingSession.workspaceImage.url}
          canvasWidth={pendingSession.workspaceImage.width}
          canvasHeight={pendingSession.workspaceImage.height}
          initialCorners={
            pendingSession.calibrationMeta?.verified_corners ??
            (pendingSession.calibrationMeta?.detectedCorners
              ? pendingSession.calibrationMeta.detectedCorners.map(([x, y]) => ({ x, y }))
              : pendingSession.paperCalibration?.detected_corners
              ? pendingSession.paperCalibration.detected_corners.map(([x, y]) => ({ x, y }))
              : null)
          }
          candidates={pendingSession.paperCalibration?.candidates}
          selectedCandidateId={pendingSession.paperCalibration?.selected_candidate_id}
          paperStandardConfirmed={pendingSession.paperCalibration?.paper_standard_confirmed}
          suggestedPaperStandard={
            pendingSession.paperCalibration?.suggested_paper_standard ??
            pendingSession.calibrationMeta?.suggested_paper_standard ??
            null
          }
          aspectRatioMatchConfidence={
            pendingSession.paperCalibration?.aspect_ratio_match_confidence ??
            pendingSession.calibrationMeta?.aspect_ratio_match_confidence ??
            0
          }
          unwarpedAspectRatio={
            pendingSession.paperCalibration?.unwarped_aspect_ratio ??
            pendingSession.calibrationMeta?.unwarped_aspect_ratio ??
            null
          }
          paperStandard={
            pendingSession.calibrationMeta?.paperStandard ??
            pendingSession.paperCalibration?.paper_standard ??
            paperStandard
          }
          confidence={
            pendingSession.calibrationMeta?.confidence ??
            pendingSession.paperCalibration?.confidence ??
            0
          }
          status={pendingSession.calibrationMeta?.status ?? pendingSession.paperCalibration?.status}
          onConfirm={handlePaperConfirm}
          onSkip={handlePaperSkip}
          onCancel={handleCancelModal}
        />
      )}

      {status === "ready" && !isPaperFiducialSession && (
        <ImageSuccessModal
          isOpen={status === "ready"}
          onCancel={handleCancelModal}
          onPlaceProduct={handlePlaceProduct}
        />
      )}

      <ImageErrorModal
        isOpen={status === "error"}
        onCancel={handleCancelModal}
        onTryAgain={handleTryAgain}
        errorMessage={errorMessage ?? undefined}
      />
    </main>
  );
}
