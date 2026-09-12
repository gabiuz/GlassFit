"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { formatBookingShareMessage } from "@/lib/pricing/quotationPdfGenerator";

interface Step3SendReferenceProps {
  generatedLink: string;
  onSend: (method: "Messenger" | "Viber") => void;
  totalEstimatePhp?: number;
  hasStructuralWaiver?: boolean;
  productName?: string;
  quotationNumber?: string;
  customerName?: string;
}

export function Step3SendReference({
  generatedLink,
  onSend,
  totalEstimatePhp = 50000,
  hasStructuralWaiver = false,
  productName = "Series 798 Sliding Window",
  quotationNumber = "Q-2026-0482",
  customerName = "Juan Dela Cruz",
}: Step3SendReferenceProps) {
  const [copied, setCopied] = useState(false);

  const { messageText, messengerUrl, viberUrl } = formatBookingShareMessage({
    customerName,
    quotationNumber,
    referenceLink: generatedLink,
    productDescription: productName,
    totalEstimatePhp,
    hasStructuralWaiver,
  });

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = (method: "Messenger" | "Viber") => {
    navigator.clipboard.writeText(messageText);
    onSend(method);
    if (typeof window !== "undefined") {
      const url = method === "Messenger" ? messengerUrl : viberUrl;
      window.open(url, "_blank");
    }
  };

  return (
    <div className="flex flex-col gap-[52px] items-center justify-center w-full">
      {/* Title block */}
      <div className="flex flex-col gap-5 items-start justify-center w-full select-none">
        <p className="font-normal text-[#c3c3c3] text-[20px] tracking-[-0.38px] leading-[1.4] uppercase">
          STEP 3 OF 4
        </p>
        <h2 className="font-medium text-[#0f1422] text-3xl sm:text-4xl lg:text-[48px] tracking-[-0.912px] leading-[1.2]">
          Send Your Reference
        </h2>
        <p className="font-normal text-[#0f1422] text-lg sm:text-xl lg:text-[24px] tracking-[-0.456px] leading-[1.2]">
          Continue the conversation through Messenger or Viber.
        </p>
      </div>

      {/* Main card box */}
      <div className="bg-[#f5f5f5] flex flex-col gap-[37px] p-6 md:p-[50px] relative rounded-[20px] w-full">
        {/* Pre-Filled Message Card */}
        <div className="bg-white w-full p-6 md:p-8 rounded-[20px] shadow-sm flex flex-col gap-5">
          <div className="flex justify-between items-center select-none">
            <h3 className="font-medium text-[#07b6d3] text-lg sm:text-[20px] tracking-[-0.38px]">
              Pre-Filled Message · Edit Before Sending
            </h3>
            <button
              onClick={handleCopyMessage}
              className="text-[#0f1422] hover:text-[#07b6d3] transition-colors focus:outline-none flex items-center shrink-0 cursor-pointer"
              title="Copy message"
            >
              <Image
                src="/send-booking/copy.svg"
                alt="Copy Message"
                width={26}
                height={26}
                className="object-contain"
              />
            </button>
          </div>

          {/* Text Area */}
          <textarea
            value={messageText}
            readOnly
            className="w-full bg-[#f5f5f5] border border-[#c3c3c3] rounded-lg p-5 text-[#0f1422] text-sm md:text-base leading-[1.5] h-[210px] resize-none focus:outline-none select-all font-sans cursor-text shadow-inner"
          />
        </div>

        {/* Sharing Options Card */}
        <div className="bg-white w-full px-6 py-[30px] md:px-[50px] rounded-[20px] shadow-sm flex flex-col gap-[30px] select-none">
          <h3 className="font-medium text-[#0f1422] text-lg sm:text-[24px] tracking-[-0.456px] leading-[1.2]">
            Sharing Option
          </h3>
          <div className="flex flex-col lg:flex-row gap-[37px] w-full">
            {/* Messenger button */}
            <div
              onClick={() => handleShare("Messenger")}
              className="bg-[#f5f5f5] border border-[#f5f5f5] rounded-[20px] px-4 py-4 md:px-[30px] md:py-[20px] flex items-center justify-between gap-4 md:gap-[30px] cursor-pointer hover:bg-neutral-100 transition-all flex-1 w-full"
            >
              <div className="flex items-center gap-4 md:gap-[30px]">
                <div className="relative w-16 h-16 md:w-[100px] md:h-[100px] shrink-0">
                  <Image
                    src="/send-booking/messenger.svg"
                    alt="Messenger Logo"
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="flex flex-col gap-2.5 items-start text-left">
                  <p className="font-medium text-lg sm:text-[24px] tracking-[-0.456px] leading-[1.4] text-[#0f1422]">
                    Send via Messenger
                  </p>
                  <p className="font-normal text-sm sm:text-[16px] tracking-[-0.304px] leading-[1.4] text-[#c3c3c3]">
                    Opens in external browser
                  </p>
                </div>
              </div>
              <ArrowRight className="w-[26px] h-[21px] text-[#0f1422] shrink-0" />
            </div>

            {/* Viber button */}
            <div
              onClick={() => handleShare("Viber")}
              className="bg-[#f5f5f5] border border-[#f5f5f5] rounded-[20px] px-4 py-4 md:px-[30px] md:py-[20px] flex items-center justify-between gap-4 md:gap-[30px] cursor-pointer hover:bg-neutral-100 transition-all flex-1 w-full"
            >
              <div className="flex items-center gap-4 md:gap-[30px]">
                <div className="relative w-16 h-16 md:w-[100px] md:h-[100px] shrink-0">
                  <Image
                    src="/send-booking/viber.svg"
                    alt="Viber Logo"
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="flex flex-col gap-2.5 items-start text-left">
                  <p className="font-medium text-lg sm:text-[24px] tracking-[-0.456px] leading-[1.4] text-[#0f1422]">
                    Send via Viber
                  </p>
                  <p className="font-normal text-sm sm:text-[16px] tracking-[-0.304px] leading-[1.4] text-[#c3c3c3]">
                    Opens in external browser
                  </p>
                </div>
              </div>
              <ArrowRight className="w-[26px] h-[21px] text-[#0f1422] shrink-0" />
            </div>
          </div>
        </div>
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
          <span className="text-sm font-normal tracking-tight">Copied message successfully</span>
        </div>
      )}
    </div>
  );
}
