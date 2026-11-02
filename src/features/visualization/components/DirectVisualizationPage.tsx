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
import { analyzeImage, SpacePhotoError, type SpaceImageSession, type UploadProgressStage } from "@/lib/imageApi";
import type { CatalogProduct } from "@/lib/products/types";
import {
  type CalibrationMode,
  type FiducialPaperStandard,
  type Point2D,
} from "@/lib/visualization/types";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";

import { confirmPaperReference, skipPaperReference, type PaperReviewResult } from "@/lib/visualization/paperReference";

type UploadStatus = "idle" | "analyzing" | "ready" | "error";

export function DirectVisualizationPage({
  catalogProducts,
}: {
  catalogProducts: CatalogProduct[];
}) {
  const router = useRouter();
  const requestIdRef = useRef(0);
  const analysisControllerRef = useRef<AbortController | null>(null);
  const { setPreparedSpaceImage, updateSessionCalibration } = useVisualizationSession();
  const [activeSession, setActiveSession] = useState<SpaceImageSession | null>(null);
  const [pendingSession, setPendingSession] = useState<SpaceImageSession | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [photoErrorCode, setPhotoErrorCode] = useState<SpacePhotoError["code"] | null>(null);
  const [browseRequestKey, setBrowseRequestKey] = useState(0);
  const [uploadStage, setUploadStage] = useState<UploadProgressStage | null>(null);
  const [retryAttempt, setRetryAttempt] = useState<number>(0);

  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode>("auto_detect");
  const [paperStandard, setPaperStandard] = useState<FiducialPaperStandard>("short");

  const runAnalysis = async (file: File) => {
    analysisControllerRef.current?.abort();
    const controller = new AbortController();
    analysisControllerRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setPendingFile(file);
    setPendingSession(null);
    setStatus("analyzing");
    setUploadStage("uploading");
    setRetryAttempt(0);
    setErrorMessage(null);
    setPhotoErrorCode(null);

    try {
      const session = await analyzeImage(file, {
        mode: calibrationMode,
        paperStandard: calibrationMode === "paper_fiducial" ? paperStandard : undefined,
        onProgress: (stage, attempt) => {
          if (requestIdRef.current !== requestId) return;
          setUploadStage(stage);
          if (attempt !== undefined) {
            setRetryAttempt(attempt);
          }
        },
      }, controller.signal);
      if (requestIdRef.current !== requestId) {
        if (session.localBlobUrl) URL.revokeObjectURL(session.localBlobUrl);
        return;
      }

      setPendingSession(session);
      setStatus("ready");
    } catch (error) {
      if (requestIdRef.current !== requestId) return;

      setPendingSession(null);
      setStatus("error");
      setPhotoErrorCode(error instanceof SpacePhotoError ? error.code : null);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to analyze the image.",
      );
    } finally {
      if (requestIdRef.current === requestId) {
        setUploadStage(null);
        analysisControllerRef.current = null;
      }
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
    result: PaperReviewResult,
    paperStd: FiducialPaperStandard,
  ) => {
    if (!pendingSession) return;
    const updatedSession = confirmPaperReference(pendingSession, corners, result, paperStd);

    setActiveSession(updatedSession);
    setPendingSession(null);
    setPendingFile(null);
    setStatus("idle");
  };

  const handlePaperSkip = (review?: PaperReviewResult) => {
    if (!pendingSession) return;
    const fallbackSession = skipPaperReference(pendingSession, review);

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
    analysisControllerRef.current?.abort();
    analysisControllerRef.current = null;
    requestIdRef.current += 1;
    setPendingSession(null);
    setPendingFile(null);
    setStatus("idle");
    setErrorMessage(null);
    setPhotoErrorCode(null);
  };

  const handleTryAgain = () => {
    if (photoErrorCode === "SPACE_PHOTO_REJECTED" || photoErrorCode === "SPACE_PHOTO_TOO_CLOSE") {
      handleCancelModal();
      setBrowseRequestKey((value) => value + 1);
      return;
    }
    if (pendingFile) {
      void runAnalysis(pendingFile);
      return;
    }

    setStatus("idle");
    setErrorMessage(null);
  };

  const handleResetImage = () => {
    analysisControllerRef.current?.abort();
    analysisControllerRef.current = null;
    requestIdRef.current += 1;
    setActiveSession(null);
    setPendingSession(null);
    setPendingFile(null);
    setStatus("idle");
    setErrorMessage(null);
  };

  const isPaperFiducialSession =
    pendingSession?.calibrationMeta?.mode === "paper_fiducial";

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
              key={browseRequestKey}
              mode={calibrationMode}
              uploadStage={uploadStage}
              retryAttempt={retryAttempt}
          onRetry={photoErrorCode === "SPACE_PHOTO_REJECTED" || photoErrorCode === "SPACE_PHOTO_TOO_CLOSE" ? undefined : (file) => void runAnalysis(file)}
          browseRequestKey={browseRequestKey}
          onImageRemoved={handleCancelModal}
          onSelectionStart={handleCancelModal}
              errorMessage={errorMessage}
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
        stage={uploadStage}
        attempt={retryAttempt}
      />

      {status === "ready" && isPaperFiducialSession && pendingSession && (
        <PaperDetectionConfirmationModal
          isOpen={status === "ready"}
          sessionId={pendingSession.sessionId}
          localBlobUrl={pendingSession.localBlobUrl}
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
          description="Continue to the workspace, then choose a product from the active catalog."
          actionLabel="Continue" 
        />
      )}

      <ImageErrorModal
        isOpen={status === "error"}
        onCancel={handleCancelModal}
        onTryAgain={handleTryAgain}
        errorMessage={errorMessage ?? undefined}
        actionLabel={photoErrorCode === "SPACE_PHOTO_REJECTED" || photoErrorCode === "SPACE_PHOTO_TOO_CLOSE" ? "Choose Another Photo" : undefined}
        guidance={photoErrorCode === "SPACE_PHOTO_REJECTED"
          ? "This is not a room or opening photo. Choose a photo of the space where the product will be installed."
          : photoErrorCode === "SPACE_PHOTO_TOO_CLOSE"
            ? "Move back to include the wall or opening and some surrounding room in your next photo."
          : photoErrorCode === "SPACE_PHOTO_UNVERIFIABLE"
            ? "We could not verify this photo right now. Please retry or choose another photo."
            : undefined}
      />
    </main>
  );
}
