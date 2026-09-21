"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { useVisualizationSession } from "@/lib/visualization/visualizationSession";
import {
  calculateStandardSeries798,
  calculateBOMFromStructuralDefinition,
  calculateOverlayPricing,
  aggregateMultiProductBOM,
} from "@/lib/pricing/pricingEngine";
import type { ItemizedProductQuotation } from "@/lib/pricing/types";
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
  const [shareableUrl, setShareableUrl] = useState("");
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const {
    productConfiguration,
    structuralDefinition,
    finalSnapshotDataUrl,
    placedOverlays,
    comparisonOverlays,
  } = useVisualizationSession();

  // Load authenticated profile on mount
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setIsAuthenticated(true);
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
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Failed to load user profile in booking flow:", err);
        setIsAuthenticated(false);
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

  const {
    quotationItems,
    consolidatedSummary,
    effectiveTotal,
    productNameSummary,
    hasAnyStructuralWaiver,
    hasAnySill,
  } = useMemo(() => {
    const overlays =
      placedOverlays && placedOverlays.length > 0
        ? placedOverlays
        : comparisonOverlays && comparisonOverlays.length > 0
          ? comparisonOverlays
          : [];

    const quotations: ItemizedProductQuotation[] = [];

    if (overlays.length > 0) {
      overlays.forEach((overlay) => {
        const pricing = calculateOverlayPricing(overlay);
        const config = overlay.configuration;
        const wMm = Math.round((Number(config.widthCm) || 120) * 10);
        const hMm = Math.round((Number(config.heightCm) || 120) * 10);
        const quantity = Math.max(1, config.quantity ?? 1);
        const sill = config.includeSill ?? true;
        const waiver = config.structuralWaiver ?? false;
        const finish = config.aluminumFinish === "white" ? "PowderCoatedWhite" : "Analok";
        const glass = (config.thicknessMm ?? 6) >= 6 && config.glassAppearance === "clear"
          ? "6mm_clear"
          : "6mm_bronze";
        const panels = config.panelCount ?? (wMm >= 2400 ? 3 : 2);
        const dimension = `${wMm / 10}cm × ${hMm / 10}cm`;

        quotations.push({
          itemId: overlay.overlayId,
          productId: overlay.productId,
          productName: overlay.productName,
          productType: "Window & Door",
          variantName: panels > 2 ? `${panels}-Panel Configuration` : "2-Panel Standard",
          specSummary: `${finish} | ${dimension}`,
          dimensionsFormatted: dimension,
          widthMm: wMm,
          heightMm: hMm,
          panelCount: panels,
          hasSill: sill,
          structuralWaiver: waiver,
          finishType: finish,
          glassType: glass,
          quantity,
          unitPrice: pricing.unitPrice,
          totalPrice: pricing.totalPrice,
          imageUrl: overlay.flattenedImageDataUrl || finalSnapshotDataUrl || "",
          bomResult: pricing.bomResult,
        });
      });
    } else if (structuralDefinition) {
      const quantity = Math.max(1, productConfiguration?.quantity ?? 1);
      const dimension = `${widthMm / 10}cm × ${heightMm / 10}cm`;
      quotations.push({
        itemId: "primary-item",
        productId: structuralDefinition.product.productId,
        productName: structuralDefinition.product.productName,
        productType: structuralDefinition.product.productType || "Window & Door",
        variantName: panelCount > 2 ? `${panelCount}-Panel Configuration` : "2-Panel Standard",
        specSummary: `${finishType} | ${dimension}`,
        dimensionsFormatted: dimension,
        widthMm,
        heightMm,
        panelCount,
        hasSill,
        structuralWaiver,
        finishType,
        glassType,
        quantity,
        unitPrice: bomCalc.finalQuotation,
        totalPrice: bomCalc.finalQuotation * quantity,
        imageUrl: finalSnapshotDataUrl || structuralDefinition.product.catalogImageUrl || "",
        bomResult: bomCalc,
      });
    }

    const summary = aggregateMultiProductBOM(quotations);
    const isMulti = quotations.length > 1;
    const effTotal = isMulti ? summary.finalGrandTotal : (quotations[0]?.totalPrice ?? bomCalc.finalQuotation);
    const nameSummary = isMulti
      ? `${quotations.length} Architectural Fixtures (${summary.totalQuantity} Units)`
      : quotations[0]?.productName || (structuralDefinition?.product.productName ?? "Custom Architectural Fenestration");
    const anyWaiver = quotations.some((q) => q.structuralWaiver);
    const anySill = quotations.some((q) => q.hasSill);

    return {
      quotationItems: quotations,
      consolidatedSummary: summary,
      effectiveTotal: effTotal,
      productNameSummary: nameSummary,
      hasAnyStructuralWaiver: anyWaiver,
      hasAnySill: anySill,
    };
  }, [placedOverlays, comparisonOverlays, structuralDefinition, productConfiguration, bomCalc, hasSill, structuralWaiver, widthMm, heightMm]);

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
      hasSill: hasAnySill,
      structuralWaiver: hasAnyStructuralWaiver,
      bomResult: bomCalc,
      snapshotImageUrl: finalSnapshotDataUrl,
      items: quotationItems,
      consolidatedSummary,
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
      hasSill: hasAnySill,
      structuralWaiver: hasAnyStructuralWaiver,
      bomResult: bomCalc,
      snapshotImageUrl: finalSnapshotDataUrl,
      items: quotationItems,
      consolidatedSummary,
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
        structuralWaiver: hasAnyStructuralWaiver,
        productName: productNameSummary,
        productType:
          quotationItems.length > 1
            ? "Multi-Product Installation"
            : structuralDefinition?.product.productType || "Sliding Window",
        finalSnapshotDataUrl,
        items: quotationItems.length > 0 ? quotationItems : undefined,
        totalEstimatedAmount: effectiveTotal,
      });

      setQuotationNumber(result.quotationNumber);
      setReferenceCode(result.referenceCode);
      setGeneratedLink(result.displayBadge || result.displayLink);
      setShareableUrl(result.shareableUrl);
      setActiveLinkId(result.linkId);
      setIsLinkGenerated(true);
    } catch (err: unknown) {
      console.error("Failed to generate signed reference link:", err);
      const msg = err instanceof Error ? err.message : "Failed to generate consultation reference link.";
      setErrorMessage(msg);
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
        <div className="bg-red-50 border border-red-300 text-red-700 text-sm rounded-[14px] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col gap-1 text-left">
            <span className="font-semibold text-red-900">Action Required</span>
            <span>{errorMessage}</span>
          </div>
          {errorMessage.toLowerCase().includes("authentication") || errorMessage.toLowerCase().includes("account") || errorMessage.toLowerCase().includes("log in") ? (
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => router.push("/login?redirect=/send-booking")}
                className="bg-[#0f1422] text-white text-xs px-4 py-2 rounded-full hover:bg-black transition-colors"
              >
                Log In
              </button>
              <button
                onClick={() => router.push("/register?redirect=/send-booking")}
                className="bg-white border border-[#0f1422] text-[#0f1422] text-xs px-4 py-2 rounded-full hover:bg-neutral-50 transition-colors"
              >
                Register
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Dynamic Step Content */}
      <div className="w-full flex-1">
        {step === 1 && (
          <Step1ViewPdf
            onPreview={handlePreviewPdf}
            onSave={handleSavePdf}
            structuralWaiver={hasAnyStructuralWaiver}
            hasSill={hasAnySill}
            totalEstimatePhp={effectiveTotal}
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
            shareableUrl={shareableUrl}
            totalEstimatePhp={effectiveTotal}
            hasStructuralWaiver={hasAnyStructuralWaiver}
            customerName={customerName}
            referenceCode={referenceCode}
            productName={productNameSummary}
            fileName="Livingroom.jpeg"
            dateFormatted={dateFormatted}
            expiresFormatted={expiresFormatted}
          />
        )}
        {step === 3 && (
          <Step3SendReference
            generatedLink={generatedLink}
            shareableUrl={shareableUrl}
            onSend={handleSend}
            totalEstimatePhp={effectiveTotal}
            hasStructuralWaiver={hasAnyStructuralWaiver}
            productName={productNameSummary}
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
              totalEstimatePhp={effectiveTotal}
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
