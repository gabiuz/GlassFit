"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";
import { calculateStandardSeries798, calculateBOMFromStructuralDefinition } from "@/lib/pricing/pricingEngine";
import { generateQuotationPdfHtml } from "@/lib/pricing/quotationPdfGenerator";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { generateSignedBookingLink, recordBookingRequest } from "@/lib/booking/bookingActions";
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
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [sharingMethod, setSharingMethod] = useState<"Messenger" | "Viber">("Messenger");
  const [errorMessage, setErrorMessage] = useState("");

  // Authenticated user state
  const [customerName, setCustomerName] = useState("Juan Dela Cruz");
  const [customerPhone, setCustomerPhone] = useState("+63 (917) 000-0000");
  const [customerEmail, setCustomerEmail] = useState("client@glassfit.ph");

  // Dynamic booking identifiers
  const [quotationNumber, setQuotationNumber] = useState("Q-2026-0482");
  const [referenceCode, setReferenceCode] = useState("CF-2026-001");
  const [generatedLink, setGeneratedLink] = useState("glassfit.ph/q/cf-2026-001");
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);

  const { productConfiguration, structuralDefinition, finalSnapshotDataUrl } =
    useVisualizationSession();

  // Load authenticated profile on mount
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, contact_number, email")
            .eq("profile_id", user.id)
            .single();

          if (profile) {
            if (profile.full_name) setCustomerName(profile.full_name);
            if (profile.contact_number) setCustomerPhone(profile.contact_number);
            if (profile.email) setCustomerEmail(profile.email);
          } else if (user.user_metadata?.full_name) {
            setCustomerName(user.user_metadata.full_name);
          }
        }
      } catch (err) {
        console.error("Failed to load user profile in booking flow:", err);
      }
    }

    loadUserProfile();
  }, []);

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

  const now = new Date();
  const dateFormatted = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  const expiresDate = new Date();
  expiresDate.setDate(expiresDate.getDate() + 7);
  const expiresFormatted = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(expiresDate);

  const validUntilFormatted = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(expiresDate);

  const handlePreviewPdf = () => {
    const html = generateQuotationPdfHtml({
      quotationNumber,
      referenceCode,
      customerName,
      customerPhone,
      customerEmail,
      createdAtFormatted: dateFormatted,
      validUntilFormatted,
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
      customerName,
      customerPhone,
      customerEmail,
      createdAtFormatted: dateFormatted,
      validUntilFormatted,
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

  const handleGenerateLink = async () => {
    setIsGeneratingLink(true);
    setErrorMessage("");

    try {
      const result = await generateSignedBookingLink({
        widthMm,
        heightMm,
        panelCount,
        hasSill,
        finishType,
        glassType,
        structuralWaiver,
        productName: structuralDefinition?.product.productName || "Series 798 Sliding Window",
        productType: structuralDefinition?.product.productType || "Sliding Window",
        finalSnapshotDataUrl,
      });

      setQuotationNumber(result.quotationNumber);
      setReferenceCode(result.referenceCode);
      setGeneratedLink(result.displayLink);
      setActiveLinkId(result.linkId);
      setIsLinkGenerated(true);
    } catch (err: unknown) {
      console.error("Failed to generate signed reference link:", err);
      // If unauthenticated or token expired, give friendly fallback and keep standard flow
      const fallbackRef = `CF-2026-${Math.floor(100 + Math.random() * 900)}`;
      setReferenceCode(fallbackRef);
      setGeneratedLink(`glassfit.ph/q/${fallbackRef.toLowerCase()}`);
      setIsLinkGenerated(true);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleSend = async (method: "Messenger" | "Viber") => {
    setSharingMethod(method);

    if (activeLinkId) {
      try {
        await recordBookingRequest({
          linkId: activeLinkId,
          platform: method,
        });
      } catch (err) {
        console.error("Failed to log booking request:", err);
      }
    }

    // Advance to Step 4 verification checklist
    setTimeout(() => {
      setStep(4);
    }, 600);
  };

  const handleConfirmSent = () => {
    setStep(5);
  };

  const handleBackToHome = () => {
    router.push("/");
  };

  return (
    <div className="w-full max-w-331 mx-auto px-6 py-12 md:py-16 flex flex-col gap-[52px] items-stretch">
      {/* 4-Step Stepper Header (hidden on final success page) */}
      {step < 5 && <Stepper currentStep={step} />}

      {errorMessage && (
        <div className="bg-red-50 border border-red-300 text-red-700 text-sm rounded-[14px] p-4 text-center">
          {errorMessage}
        </div>
      )}

      {/* Dynamic Step Content */}
      <div className="w-full flex-1">
        {step === 1 && (
          <Step1ViewPdf
            onPreview={handlePreviewPdf}
            onSave={handleSavePdf}
            structuralWaiver={structuralWaiver}
            hasSill={hasSill}
            totalEstimatePhp={bomCalc.finalQuotation}
            quotationNumber={quotationNumber}
            dateFormatted={dateFormatted}
            fileName="Livingroom.jpeg"
          />
        )}
        {step === 2 && (
          <Step2GenerateLink
            isLinkGenerated={isLinkGenerated}
            isGenerating={isGeneratingLink}
            onGenerateLink={handleGenerateLink}
            generatedLink={generatedLink}
            totalEstimatePhp={bomCalc.finalQuotation}
            hasStructuralWaiver={structuralWaiver}
            customerName={customerName}
            referenceCode={referenceCode}
            productName={structuralDefinition?.product.productName || "Series 798 Sliding Window"}
            fileName="Livingroom.jpeg"
            dateFormatted={dateFormatted}
            expiresFormatted={expiresFormatted}
          />
        )}
        {step === 3 && (
          <Step3SendReference
            generatedLink={generatedLink}
            onSend={handleSend}
            totalEstimatePhp={bomCalc.finalQuotation}
            hasStructuralWaiver={structuralWaiver}
            productName={structuralDefinition?.product.productName || "Series 798 Sliding Window"}
            quotationNumber={quotationNumber}
            customerName={customerName}
          />
        )}
        {step === 4 && (
          <Step4ConfirmSent
            sharingMethod={sharingMethod}
            onConfirm={handleConfirmSent}
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
              referenceCode={referenceCode}
              dateFormatted={dateFormatted}
            />
          </>
        )}
      </div>

      {/* Bottom Step Navigation Bar (Steps 1, 2, 3) */}
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
