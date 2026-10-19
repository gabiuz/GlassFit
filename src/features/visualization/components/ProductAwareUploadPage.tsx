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
  PAPER_STANDARD_METRICS,
  type CalibrationMode,
  type FiducialPaperStandard,
  type Point2D,
  type SelectedVisualizationProduct,
} from "@/lib/visualization/types";

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

  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode>("standard");
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
    result: { scaleCmPerPx: number; confidence: number },
    paperStd: FiducialPaperStandard,
  ) => {
    if (!pendingSession) return;
    const refHeightCm = (PAPER_STANDARD_METRICS[paperStd]?.heightMm ?? 297) / 10;
    const bboxHeightPx = Math.round(
      Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y),
    );

    const updatedSession: SpaceImageSession = {
      ...pendingSession,
      scaleEstimation: {
        best_scale_cm_per_px: result.scaleCmPerPx,
        confidence: result.confidence,
        method: `paper_fiducial_${paperStd}`,
        anchors: [
          {
            label: `paper_${paperStd}`,
            bbox_height_px: bboxHeightPx,
            reference_height_cm: refHeightCm,
            scale_cm_per_px: result.scaleCmPerPx,
            confidence: result.confidence,
            depth_correction: 1.0,
          },
        ],
        exif_focal_length_mm: pendingSession.scaleEstimation?.exif_focal_length_mm ?? null,
        exif_focal_length_35mm: pendingSession.scaleEstimation?.exif_focal_length_35mm ?? null,
        exif_device_model: pendingSession.scaleEstimation?.exif_device_model ?? null,
      },
      scale_estimation: {
        best_scale_cm_per_px: result.scaleCmPerPx,
        confidence: result.confidence,
        method: `paper_fiducial_${paperStd}`,
        anchors: [
          {
            label: `paper_${paperStd}`,
            bbox_height_px: bboxHeightPx,
            reference_height_cm: refHeightCm,
            scale_cm_per_px: result.scaleCmPerPx,
            confidence: result.confidence,
            depth_correction: 1.0,
          },
        ],
        exif_focal_length_mm: pendingSession.scaleEstimation?.exif_focal_length_mm ?? null,
        exif_focal_length_35mm: pendingSession.scaleEstimation?.exif_focal_length_35mm ?? null,
        exif_device_model: pendingSession.scaleEstimation?.exif_device_model ?? null,
      },
      calibrationMeta: {
        mode: "paper_fiducial",
        paperStandard: paperStd,
        status: "verified_calibrated",
        confidence: result.confidence,
        homographyMatrix: pendingSession.calibrationMeta?.homographyMatrix ?? null,
        detectedCorners: corners.map((p) => [p.x, p.y]),
        user_verified: true,
        verified_corners: corners,
        verified_scale_cm_per_px: result.scaleCmPerPx,
      },
      paperCalibration: {
        status: "verified_calibrated",
        paper_standard: paperStd,
        detected_corners: corners.map((p) => [p.x, p.y]),
        scale_cm_per_px: result.scaleCmPerPx,
        confidence: result.confidence,
        homography_matrix: pendingSession.calibrationMeta?.homographyMatrix ?? null,
        user_verified: true,
        verified_corners: corners,
        verified_scale_cm_per_px: result.scaleCmPerPx,
      },
    };

    setPreparedSpaceImage(product.productId, updatedSession);
    router.push(`/visualize/${product.productId}/workspace`);
  };

  const handlePaperSkip = () => {
    if (!pendingSession) return;
    const fallbackSession: SpaceImageSession = {
      ...pendingSession,
      calibrationMeta: {
        mode: "standard",
        paperStandard: null,
        status: "heuristic_fallback",
        confidence: 0.75,
        homographyMatrix: null,
        detectedCorners: null,
        user_verified: false,
      },
    };
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
    calibrationMode === "paper_fiducial" ||
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
          paperStandard={
            pendingSession.calibrationMeta?.paperStandard ??
            pendingSession.paperCalibration?.paper_standard ??
            paperStandard
          }
          confidence={
            pendingSession.calibrationMeta?.confidence ??
            pendingSession.paperCalibration?.confidence ??
            0.95
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
