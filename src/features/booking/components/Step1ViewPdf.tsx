"use client";

import React from "react";
import Image from "next/image";
import { FileText, Download } from "lucide-react";

interface Step1ViewPdfProps {
  onPreview: () => void;
  onSave: () => void;
  structuralWaiver?: boolean;
  hasSill?: boolean;
  totalEstimatePhp?: number;
  quotationNumber?: string;
  dateFormatted?: string;
  fileName?: string;
}

const listItems = [
  "Itemized 4-Group BOM & Cost Breakdown",
  "Visual output snapshot",
  "Customization details & finish",
  "Statutory legal disclaimer (RA 7394)",
  "NSCP 2015 Structural Compliance",
  "Client & site information",
];

export function Step1ViewPdf({
  onPreview,
  onSave,
  structuralWaiver = false,
  hasSill = true,
  totalEstimatePhp = 4362.93,
  quotationNumber = "Q-2026-0482",
  dateFormatted = "May 21, 2026 · 3:42 PM",
  fileName = "Livingroom.jpeg",
}: Step1ViewPdfProps) {
  const formattedEstimate = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(totalEstimatePhp).replace("PHP", "Php");

  const tags = [
    "Parametric Series 798",
    formattedEstimate,
    !hasSill ? "No Sill (Flush)" : "Standard Sill",
    structuralWaiver ? "Structural Waiver Attached" : "NSCP 2015 Compliant",
  ];

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
        {/* Structural Waiver Alert in Step 1 */}
        {structuralWaiver && (
          <div className="w-full bg-amber-50 border border-amber-300 rounded-[14px] p-4 text-left flex flex-col gap-1 select-none">
            <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
              <span>⚠️</span>
              <span>NSCP 2015 Structural Waiver Clause Included in PDF</span>
            </div>
            <p className="text-amber-700 text-xs">
              This estimate notes that your configuration exceeds standard 2-panel span limits (&ge;2400mm). The formal disclaimer is printed directly on the generated PDF document.
            </p>
          </div>
        )}

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
              Generated {dateFormatted} · 248 KB
            </p>
            <p className="font-medium text-[#0f1422] text-xl sm:text-[32px] tracking-[-0.608px] leading-[1.2]">
              GlassFit_Quotation_{quotationNumber}.pdf
            </p>
            {/* Tags row */}
            <div className="flex flex-wrap gap-3.5 items-center justify-center md:justify-start">
              {tags.map((tag) => (
                <div
                  key={tag}
                  className={`border px-2.5 py-1.25 rounded-[20px] ${
                    tag.includes("Waiver")
                      ? "bg-amber-100 border-amber-300 text-amber-900"
                      : "bg-[#c3c3c3] border-[#c3c3c3] text-white"
                  }`}
                >
                  <p className="text-base font-normal tracking-[-0.304px] leading-[1.4] whitespace-nowrap">
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
