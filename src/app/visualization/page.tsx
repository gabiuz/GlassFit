"use client";

import { useRef, useState } from "react";
import {
  HeroSection,
  UploadImage,
  GuideLine,
  ProductModelWorkspace,
  ImageLoadingModal,
  ImageErrorModal,
  ImageSuccessModal,
} from "@/features/visualization";
import { analyzeImage, type SpaceImageSession } from "@/lib/imageApi";

type UploadStatus = "idle" | "analyzing" | "ready" | "error";

export default function VisualizationPage() {
  const requestIdRef = useRef(0);
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to analyze the image.");
    }
  };

  const handleImageSelected = (file: File) => {
    void runAnalysis(file);
  };

  const handlePlaceProduct = () => {
    if (!pendingSession) return;

    setActiveSession(pendingSession);
    setPendingSession(null);
    setPendingFile(null);
    setStatus("idle");
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
    <main className="flex flex-col min-h-screen">
      <HeroSection />
      <div className="flex flex-col gap-14 px-6 py-8 md:px-12 md:py-12 lg:px-24.25 lg:py-17.75">
        {activeSession ? (
          <ProductModelWorkspace
            uploadedImage={activeSession.workspaceImage.url}
            spaceImageSession={activeSession}
            onBack={handleResetImage}
          />
        ) : (
          <>
            <UploadImage onImageSelected={handleImageSelected} />
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
