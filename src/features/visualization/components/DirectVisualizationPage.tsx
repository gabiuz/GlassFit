"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalibrationModeSelector } from "./CalibrationModeSelector";
import { GuideLine } from "./GuideLine";
import { HeroSection } from "./HeroSection";
import { ImageErrorModal } from "./ImageErrorModal";
import { ImageLoadingModal } from "./ImageLoadingModal";
import { ImageSuccessModal } from "./ImageSuccessModal";
import { PaperDetectionConfirmationModal } from "./PaperDetectionConfirmationModal";
import { ProductModelWorkspace } from "./ProductModelWorkspace";
import { UploadImage } from "./UploadImage";
import { analyzeImage, type SpaceImageSession } from "@/lib/imageApi";
import type { CatalogProduct } from "@/lib/products/types";
import {
  PAPER_STANDARD_METRICS,
  type CalibrationMode,
  type FiducialPaperStandard,
  type Point2D,
} from "@/lib/visualization/types";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";

type UploadStatus = "idle" | "analyzing" | "ready" | "error";

export function DirectVisualizationPage({
  catalogProducts,
}: {
  catalogProducts: CatalogProduct[];
}) {
  const router = useRouter();
  const requestIdRef = useRef(0);
  const { setPreparedSpaceImage, updateSessionCalibration } = useVisualizationSession();
  const [activeSession, setActiveSession] = useState<SpaceImageSession | null>(null);
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

    setActiveSession(updatedSession);
    setPendingSession(null);
    setPendingFile(null);
    setStatus("idle");
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
    setActiveSession(fallbackSession);
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

  const isPaperFiducialSession =
    calibrationMode === "paper_fiducial" ||
    pendingSession?.calibrationMeta?.mode === "paper_fiducial" ||
    Boolean(pendingSession?.paperCalibration?.detected_corners) ||
    Boolean(pendingSession?.calibrationMeta?.detectedCorners) ||
    pendingSession?.calibrationMeta?.status === "manual_pin_required";

  return (
    <main className="flex min-h-screen flex-col">
      <HeroSection />
      <div className="flex flex-col gap-10 px-6 py-8 md:px-12 md:py-12 lg:px-24.25 lg:py-17.75">
        {activeSession ? (
          <ProductModelWorkspace
            uploadedImage={activeSession.workspaceImage.url}
            spaceImageSession={activeSession}
            catalogProducts={catalogProducts}
            onCalibrationChange={updateSessionCalibration}
            onProductSelect={(productId) => handleSelectProduct(productId)}
            onBack={handleResetImage}
          />
        ) : (
          <>
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
          </>
        )}
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
          description="Continue to the workspace, then choose a product from the active catalog."
          actionLabel="Continue" 
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
