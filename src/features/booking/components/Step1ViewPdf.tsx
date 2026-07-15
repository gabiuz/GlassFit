"use client";

import React from "react";
import Image from "next/image";
import { FileText, Download } from "lucide-react";

interface Step1ViewPdfProps {
  onPreview: () => void;
  onSave: () => void;
}

const listItems = [
  "Selected products & specifications",
  "Visual output snapshot",
  "Customization details",
  "Estimated price breakdown",
  "Payment terms & warranty",
  "Client Information",
];

const tags = ["2 products", "Estimated Quotation", "Snapshot included"];

export function Step1ViewPdf({ onPreview, onSave }: Step1ViewPdfProps) {
  return (
    <div className="flex flex-col gap-[52px] items-center justify-center w-full">
      {/* Title block */}
      <div className="flex flex-col gap-5 items-start justify-center w-full select-none">
        <p className="font-normal text-[#c3c3c3] text-[20px] tracking-[-0.38px] leading-[1.4] uppercase">
          STEP 1 OF 4
        </p>
        <h2 className="font-medium text-[#0f1422] text-3xl sm:text-4xl lg:text-[48px] tracking-[-0.912px] leading-[1.2]">
          Check the PDF Quotation
        </h2>
        <p className="font-normal text-[#0f1422] text-lg sm:text-xl lg:text-[24px] tracking-[-0.456px] leading-[1.2]">
          Review and save your estimated quotation as PDF before generating a shareable link.
        </p>
      </div>

      {/* Main card box */}
      <div className="bg-[#f5f5f5] flex flex-col gap-[37px] items-center justify-center p-6 md:p-[50px] relative rounded-[20px] w-full">
        {/* PDF Metadata Box */}
        <div className="flex flex-col md:flex-row gap-[37px] items-center relative w-full">
          {/* PDF Icon container */}
          <div className="bg-white flex items-center justify-center p-6 md:p-[50px] relative rounded-[20px] shrink-0 w-32 h-32 md:w-[215px] md:h-[215px] shadow-sm select-none">
            <div className="relative w-16 h-16 md:w-[115px] md:h-[115px]">
              <Image
                src="/send-booking/pdf_icon.svg"
                alt="PDF Icon"
                fill
                priority
                className="object-contain pointer-events-none"
              />
            </div>
          </div>

          {/* PDF info details */}
          <div className="flex flex-col gap-5 items-start relative select-none text-center md:text-left">
            <p className="font-normal text-[#0f1422] text-base md:text-[20px] tracking-[-0.38px] leading-[1.4]">
              Generated May 21, 2026 · 3:42 PM · 248 KB
            </p>
            <p className="font-medium text-[#0f1422] text-xl sm:text-[32px] tracking-[-0.608px] leading-[1.2]">
              GlassFit_Quotation_Q-2026-0482.pdf
            </p>
            {/* Tags row */}
            <div className="flex flex-wrap gap-3.5 items-center justify-center md:justify-start">
              {tags.map((tag) => (
                <div
                  key={tag}
                  className="bg-[#c3c3c3] border border-[#c3c3c3] px-2.5 py-1.25 rounded-[20px]"
                >
                  <p className="text-white text-base font-normal tracking-[-0.304px] leading-[1.4] whitespace-nowrap">
                    {tag}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quotation checklist box */}
        <div className="bg-white w-full px-6 py-6 md:px-[50px] md:py-[30px] rounded-[20px] shadow-sm select-none">
          <div className="flex flex-col gap-2.5 items-start">
            <h3 className="font-medium text-[#07b6d3] text-lg sm:text-[24px] tracking-[-0.456px] py-2.5 leading-[1.2]">
              Quotation Content
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-x-[50px] gap-y-4 w-full">
              {listItems.map((item) => (
                <li key={item} className="list-disc ms-6 text-[#0f1422] text-[16px] tracking-[-0.304px] leading-[1.4]">
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-[37px] items-center justify-center md:justify-start w-full">
          {/* Preview button */}
          <button
            onClick={onPreview}
            className="w-full sm:w-auto bg-[#0f1422] hover:bg-black transition-colors px-5 py-3.5 rounded-[25px] flex items-center justify-center gap-3.5 cursor-pointer text-white font-normal text-base sm:text-[20px] tracking-[-0.38px] leading-[1.4] shadow-sm"
          >
            <FileText className="w-[25px] h-[25px] text-white" />
            <span>Preview PDF</span>
          </button>

          {/* Save button */}
          <button
            onClick={onSave}
            className="w-full sm:w-auto border border-[#0f1422] bg-white hover:bg-neutral-50 transition-colors px-5 py-3.5 rounded-[25px] flex items-center justify-center gap-3.5 cursor-pointer text-[#0f1422] font-normal text-base sm:text-[20px] tracking-[-0.38px] leading-[1.4] shadow-sm"
          >
            <Download className="w-[25px] h-[25px] text-[#0f1422]" />
            <span>Save to Device</span>
          </button>
        </div>
      </div>
    </div>
  );
}
