"use client";

import { useState, useEffect } from "react";
import {
  HeroSection,
  UploadImage,
  GuideLine,
  ProductModelWorkspace,
  ImageLoadingModal,
  ImageErrorModal,
  ImageSuccessModal,
} from "@/features/visualization";

export default function VisualizationPage() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleImageUploaded = (imageUrl: string) => {
    setPendingImage(imageUrl);
    setIsLoading(true);
    setIsSuccess(false);
    setHasError(false);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading && pendingImage && !isSuccess && !hasError) {
      // Simulate image analysis phase -> transition to Success modal state
      timer = setTimeout(() => {
        setIsLoading(false);
        setIsSuccess(true);
      }, 1600);
    }
    return () => clearTimeout(timer);
  }, [isLoading, pendingImage, isSuccess, hasError]);

  const handlePlaceProduct = () => {
    if (pendingImage) {
      setUploadedImage(pendingImage);
    } else {
      setUploadedImage("/images/windows.png");
    }
    setIsSuccess(false);
    setIsLoading(false);
    setPendingImage(null);
  };

  const handleCancelModal = () => {
    setIsLoading(false);
    setIsSuccess(false);
    setHasError(false);
    setPendingImage(null);
  };

  const handleTryAgain = () => {
    setHasError(false);
    setIsLoading(true);
  };

  const handleResetImage = () => {
    setUploadedImage(null);
    setPendingImage(null);
    setIsLoading(false);
    setIsSuccess(false);
    setHasError(false);
  };

  return (
    <main className="flex flex-col min-h-screen">
      <HeroSection />
      <div className="flex flex-col gap-14 px-6 py-8 md:px-12 md:py-12 lg:px-24.25 lg:py-17.75">
        {uploadedImage ? (
          <ProductModelWorkspace
            uploadedImage={uploadedImage}
            onBack={handleResetImage}
          />
        ) : (
          <>
            <UploadImage onImageUploaded={handleImageUploaded} />
            <GuideLine />
          </>
        )}
      </div>

      {/* 1. Loading Modal */}
      <ImageLoadingModal
        isOpen={isLoading}
        onCancel={handleCancelModal}
        isLoading={isLoading}
      />

      {/* 2. Success Modal */}
      <ImageSuccessModal
        isOpen={isSuccess}
        onCancel={handleCancelModal}
        onPlaceProduct={handlePlaceProduct}
      />

      {/* 3. Error Modal */}
      <ImageErrorModal
        isOpen={hasError}
        onCancel={handleCancelModal}
        onTryAgain={handleTryAgain}
      />
    </main>
  );
}




