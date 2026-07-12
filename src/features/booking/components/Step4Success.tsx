"use client";

import React from "react";
import Image from "next/image";
import Button from "@/components/shared/Button";

interface Step4SuccessProps {
  sharingMethod: string;
  onBackToHome: () => void;
}

export function Step4Success({
  sharingMethod,
  onBackToHome,
}: Step4SuccessProps) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm transition-all duration-300">
      <div className="bg-white w-full max-w-[550px] rounded-[24px] p-6 md:p-8 shadow-2xl relative flex flex-col gap-6 items-center justify-center select-none my-8 animate-in fade-in zoom-in-95 duration-200">

        {/* Success Icon Badge */}
        <div className="mt-2">
          <Image
            src="/send-booking/booking_sent.svg"
            alt="Success Check"
            width={90}
            height={90}
            className="object-contain"
          />
        </div>

        {/* Heading & Subtitle */}
        <div className="flex flex-col gap-3 items-center justify-center text-center w-full">
          <h2 className="font-semibold text-[#0f1422] text-[28px] tracking-[-0.532px] leading-[1.2]">
            Booking sent successfully
          </h2>
          <p className="font-normal text-black/70 text-[16px] tracking-[-0.304px] leading-[1.4] max-w-md">
            Your consultation request has been delivered. They will get back to you within 1-2 business days.
          </p>
        </div>

        {/* Details Area */}
        <div className="bg-[#f5f5f5] flex flex-col gap-4 p-4 rounded-[16px] w-full shadow-sm">

          {/* Reference details card */}
          <div className="bg-white p-4 sm:p-5 rounded-[12px] shadow-sm">
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-[#0f1422] text-sm">
              <p className="text-[#c3c3c3] font-medium leading-[1.4]">Reference Number</p>
              <p className="font-normal text-right leading-[1.4]">CF-2026-001</p>

              <p className="text-[#c3c3c3] font-medium leading-[1.4]">Sent via</p>
              <p className="font-normal text-right leading-[1.4]">{sharingMethod}</p>

              <p className="text-[#c3c3c3] font-medium leading-[1.4]">Date Created</p>
              <p className="font-normal text-right leading-[1.4]">June 3, 2026</p>

              <p className="text-[#c3c3c3] font-medium leading-[1.4]">Estimated Price</p>
              <p className="text-right leading-[1.4] font-semibold text-[#0f1422]">
                Php 50,000
              </p>
            </div>
          </div>

          {/* Expect next card */}
          <div className="bg-white p-4 sm:p-5 rounded-[12px] shadow-sm">
            <div className="w-full text-left">
              <h3 className="font-medium text-green text-[18px] tracking-[-0.342px] leading-[1.2] mb-3.5 uppercase">
                What to expect next
              </h3>
              <ul className="flex flex-col gap-3 text-neutral-700 text-sm leading-[1.4]">
                <li className="list-disc ms-4">
                  <span>Reply from RRD in chat (1-2 business days)</span>
                </li>
                <li className="list-disc ms-4">
                  <span>Formal quotation contract sent for signature</span>
                </li>
                <li className="list-disc ms-4">
                  <span>Site assessment scheduled</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Back to Home Button */}
        <div className="flex justify-center w-full mt-2 mb-2">
          <Button
            onClick={onBackToHome}
            variant="greenBtnWhiteText"
            value="Back to Home"
            leftIcon={null}
            rightIcon={null}
            className="px-8 py-3 rounded-[20px] flex items-center justify-center cursor-pointer font-medium text-lg tracking-[-0.342px] leading-[1.4] transition-all shadow-md"
          />
        </div>
      </div>
    </div>
  );
}
