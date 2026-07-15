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
  // Helper to resolve styles for a step
  const getStepStyles = (stepNo: number) => {
    const isCompleted = currentStep > stepNo;
    const isActive = currentStep === stepNo;

    let badgeBg = "bg-[#c3c3c3]";
    let textColor = "text-[#c3c3c3]";

    if (isCompleted) {
      badgeBg = "bg-[#05b64b]";
      textColor = "text-[#05b64b]";
    } else if (isActive) {
      badgeBg = "bg-[#07b6d3]";
      textColor = "text-[#07b6d3]";
    }

    return { isCompleted, isActive, badgeBg, textColor };
  };

  return (
    <>
      {/* 1. Desktop Stepper (>= 1024px) - Keeps horizontal flow and shrinks lines slightly to prevent wrapping */}
      <div className="hidden lg:flex flex-nowrap gap-4 items-center justify-center select-none py-4 w-full min-w-0">
        {steps.map((step, index) => {
          const { isCompleted, badgeBg, textColor } = getStepStyles(step.stepNo);
          return (
            <React.Fragment key={step.stepNo}>
              {/* Step Element */}
              <div className="flex gap-5 items-center h-[54px] shrink-0">
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
                <div className="hidden lg:block flex-1 max-w-[152px] min-w-[16px] h-[1.5px] bg-[#c3c3c3] relative overflow-hidden">
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

      {/* 2. Tablet & Intermediate Stepper (640px to 1023px) - Single horizontal row with scaled-down steps */}
      <div className="hidden sm:flex lg:hidden flex-row items-center justify-between gap-3 w-full max-w-[800px] mx-auto select-none py-4 px-2 min-w-0">
        {steps.map((step, index) => {
          const { isCompleted, badgeBg, textColor } = getStepStyles(step.stepNo);
          return (
            <React.Fragment key={step.stepNo}>
              {/* Step Element */}
              <div className="flex gap-3 items-center h-[48px] shrink-0">
                {/* Circle Badge */}
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-full transition-colors duration-300 ${badgeBg}`}
                >
                  {isCompleted ? (
                    <Image
                      src="/send-booking/check.svg"
                      alt="Completed"
                      width={22}
                      height={22}
                      className="object-contain"
                    />
                  ) : (
                    <p className="text-white text-lg font-normal tracking-[-0.3px] leading-none text-center">
                      {step.stepNo}
                    </p>
                  )}
                </div>

                {/* Step Title Label */}
                <p
                  className={`text-base font-normal tracking-[-0.3px] whitespace-nowrap transition-colors duration-300 ${textColor}`}
                >
                  {step.text}
                </p>
              </div>

              {/* Connecting Line (except for last step) */}
              {index < steps.length - 1 && (
                <div className="flex-1 min-w-[10px] max-w-[120px] h-[1.5px] bg-[#c3c3c3] relative overflow-hidden">
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

      {/* 3. Mobile Stepper (< 640px) - Shrunk Horizontal Flow */}
      <div className="flex sm:hidden items-start justify-between w-full select-none py-4 px-1">
        {steps.map((step, index) => {
          const { isCompleted, badgeBg, textColor } = getStepStyles(step.stepNo);
          return (
            <React.Fragment key={step.stepNo}>
              {/* Step Element */}
              <div className="flex flex-col items-center gap-1.5 w-16 shrink-0">
                {/* Circle Badge */}
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-300 ${badgeBg}`}
                >
                  {isCompleted ? (
                    <Image
                      src="/send-booking/check.svg"
                      alt="Completed"
                      width={16}
                      height={16}
                      className="object-contain"
                    />
                  ) : (
                    <p className="text-white text-sm font-normal tracking-[-0.3px] leading-none text-center">
                      {step.stepNo}
                    </p>
                  )}
                </div>

                {/* Step Title Label */}
                <p
                  className={`text-[10px] font-normal tracking-[-0.2px] text-center leading-tight transition-colors duration-300 ${textColor}`}
                >
                  {step.text}
                </p>
              </div>

              {/* Connecting Line (except for last step) */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-[1.5px] bg-[#c3c3c3] mt-[15px] relative overflow-hidden">
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
    </>
  );
}
