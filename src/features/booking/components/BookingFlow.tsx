"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";
import { calculateStandardSeries798, calculateBOMFromStructuralDefinition } from "@/lib/pricing/pricingEngine";
import { generateQuotationPdfHtml } from "@/lib/pricing/quotationPdfGenerator";
import { Stepper } from "./Stepper";
import { Step1ViewPdf } from "./Step1ViewPdf";
import { Step2GenerateLink } from "./Step2GenerateLink";
import { Step3SendReference } from "./Step3SendReference";
import { Step4Success } from "./Step4Success";
import { Step4ConfirmSent } from "./Step4ConfirmSent";

export function BookingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLinkGenerated, setIsLinkGenerated] = useState(false);
  const [sharingMethod, setSharingMethod] = useState("");

  const { productConfiguration, structuralDefinition, finalSnapshotDataUrl } =
    useVisualizationSession();

  const widthMm = Math.round((productConfiguration?.widthCm ?? 120) * 10);
  const heightMm = Math.round((productConfiguration?.heightCm ?? 120) * 10);
  const hasSill = productConfiguration?.includeSill ?? true;
  const structuralWaiver = productConfiguration?.structuralWaiver ?? false;
  const panelCount = productConfiguration?.panelCount ?? (widthMm >= 2400 ? 3 : 2);
  const finishType = productConfiguration?.aluminumFinish === "white" ? "PowderCoatedWhite" : "Analok";
  const glassType = (productConfiguration?.thicknessMm ?? 6) >= 6 && productConfiguration?.glassAppearance === "clear"
    ? "6mm_clear"
    : "6mm_bronze";

  const bomCalc = structuralDefinition
    ? calculateBOMFromStructuralDefinition(structuralDefinition, {
        widthMm,
        heightMm,
        panelCount,
        hasSill,
        finishType,
        glassType,
        structuralWaiver,
      })
    : calculateStandardSeries798({
        widthMm,
        heightMm,
        panelCount,
        hasSill,
        finishType,
        glassType,
        structuralWaiver,
      });

  const quotationNumber = "Q-2026-0482";
  const referenceCode = "CF-2026-001";
  const generatedLink = `glassfit.ph/q/${referenceCode.toLowerCase()}`;

  const handlePreviewPdf = () => {
    const html = generateQuotationPdfHtml({
      quotationNumber,
      referenceCode,
      customerName: "Juan Dela Cruz",
      createdAtFormatted: "May 21, 2026 · 3:42 PM",
      validUntilFormatted: "June 4, 2026",
      hasSill,
      structuralWaiver,
      bomResult: bomCalc,
      snapshotImageUrl: finalSnapshotDataUrl,
    });
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const handleSavePdf = () => {
    const html = generateQuotationPdfHtml({
      quotationNumber,
      referenceCode,
      customerName: "Juan Dela Cruz",
      createdAtFormatted: "May 21, 2026 · 3:42 PM",
      validUntilFormatted: "June 4, 2026",
      hasSill,
      structuralWaiver,
      bomResult: bomCalc,
      snapshotImageUrl: finalSnapshotDataUrl,
    });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GlassFit_Quotation_${quotationNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleNext = () => {
    if (step < 4) {
      setStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (step === 1) {
      router.push("/quotation");
    } else {
      setStep((prev) => prev - 1);
    }
  };

  const handleGenerateLink = () => {
    setIsLinkGenerated(true);
  };

  const handleSend = (method: "Messenger" | "Viber") => {
    setSharingMethod(method);
    // Simulate short delay while loading opens external app, then proceed to confirm page (Step 4)
    setTimeout(() => {
      setStep(4);
    }, 800);
  };

  const handleBackToHome = () => {
    router.push("/");
  };

  return (
    <div className="w-full max-w-331 mx-auto px-6 py-12 md:py-16 flex flex-col gap-[52px] items-stretch">
      {/* 4-Step Stepper Header (hidden on final success page) */}
      {step < 5 && <Stepper currentStep={step} />}

      {/* Dynamic Step Content */}
      <div className="w-full flex-1">
        {step === 1 && (
          <Step1ViewPdf
            onPreview={handlePreviewPdf}
            onSave={handleSavePdf}
            structuralWaiver={structuralWaiver}
            hasSill={hasSill}
            totalEstimatePhp={bomCalc.finalQuotation}
          />
        )}
        {step === 2 && (
          <Step2GenerateLink
            isLinkGenerated={isLinkGenerated}
            onGenerateLink={handleGenerateLink}
            generatedLink={generatedLink}
            totalEstimatePhp={bomCalc.finalQuotation}
            hasStructuralWaiver={structuralWaiver}
          />
        )}
        {step === 3 && (
          <Step3SendReference
            generatedLink={generatedLink}
            onSend={handleSend}
            totalEstimatePhp={bomCalc.finalQuotation}
            hasStructuralWaiver={structuralWaiver}
            productName={structuralDefinition?.product.productName || "Series 798 Sliding Window"}
          />
        )}
        {step === 4 && (
          <Step4ConfirmSent
            sharingMethod={sharingMethod}
            onConfirm={() => setStep(5)}
            onBack={() => setStep(3)}
          />
        )}
        {step === 5 && (
          <>
            <Step4ConfirmSent
              sharingMethod={sharingMethod}
              onConfirm={() => {}}
              onBack={() => {}}
            />
            <Step4Success
              sharingMethod={sharingMethod}
              onBackToHome={handleBackToHome}
              totalEstimatePhp={bomCalc.finalQuotation}
            />
          </>
        )}
      </div>

      {/* Conditionally Render Bottom Step Navigation Bar (Steps 1, 2, 3) */}
      {step < 4 && (
        <div className="bg-[#f5f5f5] w-full flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-[20px] shadow-sm select-none mt-4 transition-all duration-300">
          {/* Back / Back to Estimate Button */}
          <button
            onClick={handlePrev}
            className="w-full sm:w-auto bg-[#0f1422] hover:bg-black transition-colors text-white font-normal text-base sm:text-[20px] tracking-[-0.38px] leading-[1.4] px-5 py-3.5 rounded-[25px] flex items-center justify-center gap-3.5 cursor-pointer shadow-sm"
          >
            <ChevronLeft className="w-5 h-5 text-white stroke-[2.5px]" />
            <span>{step === 1 ? "Back to Estimate" : "Back"}</span>
          </button>

          {/* Continue Button (Steps 1 & 2 only) */}
          {step < 3 && (
            <button
              onClick={handleNext}
              disabled={step === 2 && !isLinkGenerated}
              className={`w-full sm:w-auto font-normal text-base sm:text-[20px] tracking-[-0.38px] leading-[1.4] px-5 py-3.5 rounded-[25px] flex items-center justify-center gap-3.5 transition-all shadow-sm ${
                step === 2 && !isLinkGenerated
                  ? "bg-[#c3c3c3] text-white opacity-70 pointer-events-none"
                  : "bg-grad-light text-white cursor-pointer hover:opacity-95 active:translate-y-px"
              }`}
            >
              <span>Continue</span>
              <div className="relative w-5 h-5">
                <Image
                  src="/right_arrow.svg"
                  alt="Continue"
                  fill
                  className="object-contain"
                />
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
