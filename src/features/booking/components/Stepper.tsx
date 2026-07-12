"use client";

import React from "react";
import Image from "next/image";

interface StepperProps {
  currentStep: number;
}

const steps = [
  { stepNo: 1, text: "View PDF" },
  { stepNo: 2, text: "Generate Link" },
  { stepNo: 3, text: "Send" },
  { stepNo: 4, text: "Confirm" },
];

export function Stepper({ currentStep }: StepperProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center justify-center select-none py-4 w-full">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.stepNo;
        const isActive = currentStep === step.stepNo;
        const isPending = currentStep < step.stepNo;

        let badgeBg = "bg-[#c3c3c3]";
        let textColor = "text-[#c3c3c3]";

        if (isCompleted) {
          badgeBg = "bg-[#05b64b]";
          textColor = "text-[#05b64b]";
        } else if (isActive) {
          badgeBg = "bg-[#07b6d3]";
          textColor = "text-[#07b6d3]";
        }

        return (
          <React.Fragment key={step.stepNo}>
            {/* Step Element */}
            <div className="flex gap-5 items-center h-[54px]">
              {/* Circle Badge */}
              <div
                className={`flex items-center justify-center w-14 h-14 rounded-full transition-colors duration-300 ${badgeBg}`}
              >
                {isCompleted ? (
                  <Image
                    src="/send-booking/check.svg"
                    alt="Completed"
                    width={26}
                    height={26}
                    className="object-contain"
                  />
                ) : (
                  <p className="text-white text-xl font-normal tracking-[-0.38px] leading-[1.4] text-center">
                    {step.stepNo}
                  </p>
                )}
              </div>

              {/* Step Title Label */}
              <p
                className={`text-xl font-normal tracking-[-0.38px] leading-[1.4] whitespace-nowrap transition-colors duration-300 ${textColor}`}
              >
                {step.text}
              </p>
            </div>

            {/* Connecting Line (except for last step) */}
            {index < steps.length - 1 && (
              <div className="hidden lg:block w-[152px] h-[1.5px] bg-[#c3c3c3] relative overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full bg-[#07b6d3] transition-all duration-500 ${
                    currentStep > step.stepNo ? "w-full bg-[#05b64b]" : "w-0"
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
