"use client";

import React from "react";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";

interface Step4ConfirmSentProps {
  sharingMethod: string;
  onConfirm: () => void;
  onBack: () => void;
}

export function Step4ConfirmSent({
  sharingMethod,
  onConfirm,
  onBack,
}: Step4ConfirmSentProps) {
  const channelName = sharingMethod === "Viber" ? "Viber" : "Messenger";

  return (
    <div className="flex flex-col gap-[52px] items-center justify-center w-full">
      {/* Title block */}
      <div className="flex flex-col gap-5 items-start justify-center w-full select-none">
        <p className="font-normal text-[#c3c3c3] text-[20px] tracking-[-0.38px] leading-[1.4] uppercase">
          STEP 4 OF 4
        </p>
        <h2 className="font-medium text-[#0f1422] text-[48px] tracking-[-0.912px] leading-[1.2]">
          Confirm Message Sent
        </h2>
        <p className="font-normal text-[#0f1422] text-[24px] tracking-[-0.456px] leading-[1.2]">
          Verify that you've sent the message in {channelName}.
        </p>
      </div>

      {/* Main card box */}
      <div className="bg-[#f5f5f5] flex flex-col gap-[37px] p-8 md:p-[50px] relative rounded-[20px] w-full">
        {/* Verification Checklist Card */}
        <div className="bg-white w-full p-8 md:p-[50px] rounded-[20px] shadow-sm select-none">
          <div className="flex flex-col gap-[30px] items-start w-full">
            {/* Step 1: Opened Chat */}
            <div className="flex gap-[30px] items-center w-full">
              <div className="bg-[#07b6d3] flex items-center justify-center w-12 h-12 rounded-full shrink-0">
                <Image
                  src="/send-booking/check.svg"
                  alt="Check"
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col gap-1 text-[#0f1422] text-left">
                <p className="font-medium text-[20px] tracking-[-0.38px] leading-[1.4]">
                  Opened {channelName} chat
                </p>
                <p className="font-normal text-[16px] text-[#c3c3c3] tracking-[-0.304px] leading-[1.4]">
                  Just now
                </p>
              </div>
            </div>

            {/* Step 2: Tap Send */}
            <div className="flex gap-[30px] items-center w-full">
              <div className="bg-[#07b6d3] text-white flex items-center justify-center w-12 h-12 rounded-full shrink-0 text-[20px] font-normal tracking-[-0.38px] leading-[1.4]">
                2
              </div>
              <div className="flex flex-col gap-1 text-[#0f1422] text-left">
                <p className="font-medium text-[20px] tracking-[-0.38px] leading-[1.4]">
                  Tap "Send" in {channelName}
                </p>
                <p className="font-normal text-[16px] text-[#c3c3c3] tracking-[-0.304px] leading-[1.4]">
                  Make sure your message is fully sent in the chat app
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons row */}
        <div className="flex flex-wrap gap-[37px] items-center justify-center w-full">
          {/* Yes Confirm Button */}
          <button
            onClick={onConfirm}
            className="bg-[#0f1422] hover:bg-black transition-colors px-[20px] py-[15px] rounded-[25px] flex items-center justify-center gap-[15px] cursor-pointer text-white font-normal text-[20px] tracking-[-0.38px] leading-[1.4] shadow-sm"
          >
            <Image
              src="/send-booking/check_no_border.svg"
              alt="Confirm"
              width={25}
              height={25}
              className="object-contain"
            />
            <span>Yes, I've sent the message</span>
          </button>

          {/* No Back Button */}
          <button
            onClick={onBack}
            className="border border-[#0f1422] bg-white hover:bg-neutral-50 transition-colors px-[21px] py-[16px] rounded-[25px] flex items-center justify-center gap-[15px] cursor-pointer text-[#0f1422] font-normal text-[20px] tracking-[-0.38px] leading-[1.4] shadow-sm"
          >
            <Image
              src="/left_arrow.svg"
              alt="Back"
              width={25}
              height={25}
              className="object-contain"
            />
            <span>No, Take Me Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}
