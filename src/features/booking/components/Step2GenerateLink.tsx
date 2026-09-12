"use client";

import React, { useState } from "react";
import Image from "next/image";

interface Step2GenerateLinkProps {
  isLinkGenerated: boolean;
  isGenerating?: boolean;
  onGenerateLink: () => void;
  generatedLink: string;
  totalEstimatePhp?: number;
  hasStructuralWaiver?: boolean;
  customerName?: string;
  referenceCode?: string;
  productName?: string;
  fileName?: string;
  dateFormatted?: string;
  expiresFormatted?: string;
}

export function Step2GenerateLink({
  isLinkGenerated,
  isGenerating = false,
  onGenerateLink,
  generatedLink,
  totalEstimatePhp = 50000,
  hasStructuralWaiver = false,
  customerName = "Juan Dela Cruz",
  referenceCode = "CF-2026-001",
  productName = "Series 798 Sliding Window",
  fileName = "Livingroom.jpeg",
  dateFormatted = "May 21, 2026 · 3:42 PM",
  expiresFormatted = "June 3, 2026",
}: Step2GenerateLinkProps) {
  const [copied, setCopied] = useState(false);

  const formattedPrice = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(totalEstimatePhp).replace("PHP", "Php");

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-[52px] items-center justify-center w-full">
      {/* Title block */}
      <div className="flex flex-col gap-5 items-start justify-center w-full select-none">
        <p className="font-normal text-[#c3c3c3] text-[20px] tracking-[-0.38px] leading-[1.4] uppercase">
          STEP 2 OF 4
        </p>
        <h2 className="font-medium text-[#0f1422] text-3xl sm:text-4xl lg:text-[48px] tracking-[-0.912px] leading-[1.2]">
          Generate Your Reference Link
        </h2>
        <p className="font-normal text-[#0f1422] text-lg sm:text-xl lg:text-[24px] tracking-[-0.456px] leading-[1.2]">
          Create a secure, shareable link for your saved GlassFit reference.
        </p>
      </div>

      {/* Main card box */}
      <div className="bg-[#f5f5f5] flex flex-col gap-[37px] p-6 md:p-[50px] relative rounded-[20px] w-full">
        {/* Reference Summary Card */}
        <div className="bg-white w-full p-6 md:p-8 rounded-[20px] shadow-sm select-none">
          <h3 className="font-medium text-[#07b6d3] text-lg sm:text-[24px] tracking-[-0.456px] leading-[1.2] mb-6">
            Reference Summary
          </h3>
          <div className="grid grid-cols-[auto_1fr] md:grid-cols-[auto_auto_auto_auto_auto_auto] gap-x-4 md:gap-x-[67px] gap-y-2.5 md:gap-y-[10px] text-sm font-normal items-baseline">
            {/* Row 1 / Items 1-6 */}
            <span className="text-[#c3c3c3] whitespace-nowrap">Configuration No:</span>
            <span className="text-[#0f1422] whitespace-nowrap">{referenceCode}</span>

            <span className="text-[#c3c3c3] whitespace-nowrap">Selected Product</span>
            <span className="text-[#0f1422] md:whitespace-nowrap">
              {productName} {hasStructuralWaiver ? "(Waiver Active)" : ""}
            </span>

            <span className="text-[#c3c3c3] whitespace-nowrap">Visual Output</span>
            <span className="text-[#0f1422] whitespace-nowrap">{fileName}</span>

            {/* Row 2 / Items 7-12 */}
            <span className="text-[#c3c3c3] whitespace-nowrap">Estimated Price</span>
            <span className="text-[#0f1422] whitespace-nowrap">{formattedPrice}</span>

            <span className="text-[#c3c3c3] whitespace-nowrap">Date Created</span>
            <span className="text-[#0f1422] md:whitespace-nowrap">{dateFormatted}</span>

            <span className="text-[#c3c3c3] whitespace-nowrap">Customer</span>
            <span className="text-[#0f1422] whitespace-nowrap">{customerName}</span>
          </div>
        </div>

        {/* Dynamic Card State */}
        {!isLinkGenerated ? (
          /* Empty State */
          <div className="bg-white w-full py-16 px-8 rounded-[20px] shadow-sm flex flex-col items-center justify-center gap-6 select-none text-center">
            <div className="bg-[#0f1422] text-white flex items-center justify-center w-14 h-14 rounded-full">
              <div className="relative w-[26px] h-[26px]">
                <Image
                  src="/send-booking/link.svg"
                  alt="Link Icon"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="font-medium text-[#0f1422] text-2xl tracking-[-0.456px]">
                No reference link generated yet
              </h4>
              <p className="text-black/60 text-base">
                Click below to create a secure, shareable link for this configuration.
              </p>
            </div>
            <button
              onClick={onGenerateLink}
              disabled={isGenerating}
              className={`border border-[#0f1422] bg-white transition-colors px-6 py-3.5 rounded-[25px] flex items-center gap-3.5 text-[#0f1422] font-normal text-[20px] tracking-[-0.38px] leading-[1.4] shadow-sm ${
                isGenerating ? "opacity-60 cursor-not-allowed" : "hover:bg-neutral-50 active:bg-neutral-100 cursor-pointer"
              }`}
            >
              {isGenerating ? (
                <div className="w-5 h-5 border-2 border-[#0f1422] border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="relative w-[20px] h-[20px]">
                  <Image
                    src="/send-booking/link.svg"
                    alt="Link Icon"
                    fill
                    className="object-contain brightness-0"
                  />
                </div>
              )}
              <span>{isGenerating ? "Generating Secure Link..." : "Generate Link"}</span>
            </button>
          </div>
        ) : (
          /* Generated Link State */
          <div className="flex flex-col gap-9 w-full">
            {/* Success Banner */}
            <div className="bg-[#dcfce7] border border-[#bbf7d0] text-[#15803d] p-5 rounded-[20px] flex items-center gap-4 shadow-sm w-full select-none">
              <div className="bg-[#05b64b] flex items-center justify-center p-[20px] rounded-full shrink-0">
                <Image
                  src="/send-booking/check.svg"
                  alt="Success"
                  width={26}
                  height={26}
                  className="object-contain"
                />
              </div>
              <div>
                <p className="font-medium text-lg leading-[1.4]">Reference link generated successfully</p>
                <p className="text-base text-[#166534] mt-0.5">Your secure link is ready to share</p>
              </div>
            </div>

            {/* Generated Link Card */}
            <div className="bg-white w-full p-8 rounded-[20px] shadow-sm flex flex-col gap-6">
              <div className="flex flex-col gap-2 select-none">
                <h4 className="font-medium text-[#0f1422] text-[20px] tracking-[-0.38px]">
                  Your Reference Link
                </h4>
              </div>

              {/* Link Box */}
              <div className="flex items-center border border-[#c3c3c3] rounded-lg bg-neutral-50 px-4 py-3 gap-4 w-full justify-between">
                <span className="text-[#07b6d3] font-normal text-base truncate select-all">
                  {generatedLink}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="text-black hover:text-[#07b6d3] transition-colors focus:outline-none flex items-center shrink-0 cursor-pointer"
                  title="Copy link"
                >
                  <Image
                    src={"/send-booking/copy.svg"}
                    alt="Copy link"
                    width={26}
                    height={26}
                    className="object-contain"
                  />
                </button>
              </div>

              <div className="hidden md:grid grid-cols-[auto_auto_auto] gap-x-[70px] gap-y-[10px] pt-4 border-t border-neutral-100 select-none text-left items-baseline">
                <span className="text-[#c3c3c3] text-[14px] font-normal tracking-[-0.266px]">Expires</span>
                <span className="text-[#c3c3c3] text-[14px] font-normal tracking-[-0.266px]">Scope</span>
                <span className="text-[#c3c3c3] text-[14px] font-normal tracking-[-0.266px]">Access </span>
                <span className="text-[#ffa010] text-[16px] font-normal tracking-[-0.304px]">{expiresFormatted}</span>
                <span className="text-[#0f1422] text-[16px] font-normal tracking-[-0.304px]">Read Only</span>
                <span className="text-[#0f1422] text-[16px] font-normal tracking-[-0.304px]">Estimate Quotation, Snapshot and product summary</span>
              </div>
              <div className="flex flex-col gap-4 pt-4 border-t border-neutral-100 select-none text-left md:hidden">
                <div className="flex flex-col gap-1">
                  <span className="text-[#c3c3c3] text-[14px] font-normal tracking-[-0.266px]">Expires</span>
                  <span className="text-[#ffa010] text-[16px] font-normal tracking-[-0.304px]">{expiresFormatted}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[#c3c3c3] text-[14px] font-normal tracking-[-0.266px]">Scope</span>
                  <span className="text-[#0f1422] text-[16px] font-normal tracking-[-0.304px]">Read Only</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[#c3c3c3] text-[14px] font-normal tracking-[-0.266px]">Access </span>
                  <span className="text-[#0f1422] text-[16px] font-normal tracking-[-0.304px] whitespace-normal">
                    Estimate Quotation, Snapshot and product summary
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating success toast */}
      {copied && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#0f1422] text-white py-3.5 px-5 rounded-[12px] shadow-xl flex items-center gap-3 border border-neutral-800 transition-all duration-300">
          <div className="bg-[#05b64b] flex items-center justify-center w-5 h-5 rounded-full shrink-0">
            <Image
              src="/send-booking/check.svg"
              alt="Success"
              width={10}
              height={10}
              className="object-contain"
            />
          </div>
          <span className="text-sm font-normal tracking-tight">Copied link successfully</span>
        </div>
      )}
    </div>
  );
}
