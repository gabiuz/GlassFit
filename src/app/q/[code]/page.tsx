import React from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BackgroundNavbar } from "@/components/shared/BackgroundNavbar";
import { getPublicBookingReference } from "@/lib/booking/bookingActions";
import { CheckCircle2, ShieldAlert, ArrowLeft, Download } from "lucide-react";

interface PublicQuotationPageProps {
  params: Promise<{
    code: string;
  }>;
}

export const metadata = {
  title: "Public Consultation Reference | GlassFit",
  description: "Verified client quotation reference and project summary",
};

export default async function PublicQuotationPage({ params }: PublicQuotationPageProps) {
  const resolvedParams = await params;
  const code = resolvedParams.code;

  const data = await getPublicBookingReference(code);

  if (!data) {
    notFound();
  }

  const formattedTotal = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(data.totalEstimatedAmount);

  return (
    <main className="w-full min-h-screen bg-white relative pb-20">
      <BackgroundNavbar />

      <div className="w-full max-w-[1000px] mx-auto px-6 py-10 flex flex-col gap-8">
        {/* Top return breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-neutral-600 hover:text-black transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to GlassFit</span>
          </Link>

          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verified Consultation Reference</span>
          </div>
        </div>

        {/* Structural Waiver Alert if active */}
        {data.structuralWaiver && (
          <div className="w-full bg-amber-50 border border-amber-300 rounded-[16px] p-5 text-left flex flex-col gap-1.5 shadow-xs">
            <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
              <ShieldAlert className="w-5 h-5 text-amber-700" />
              <span>NSCP 2015 Structural Span Waiver Attached</span>
            </div>
            <p className="text-amber-800 text-xs leading-relaxed">
              This quotation includes a client-acknowledged waiver noting that the aperture span reaches or exceeds standard 2-panel recommendations (&ge;2400mm).
            </p>
          </div>
        )}

        {/* Main Header Card */}
        <div className="bg-[#f5f5f5] rounded-[24px] p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-[#07b6d3] font-semibold text-sm tracking-wider uppercase">
              Reference #{data.referenceCode}
            </span>
            <h1 className="text-3xl sm:text-4xl font-semibold text-[#0f1422]">
              {data.productName}
            </h1>
            <p className="text-neutral-600 text-sm">
              Prepared for <span className="font-medium text-[#0f1422]">{data.customerName}</span> · Created on {data.createdAtFormatted}
            </p>
          </div>

          <div className="flex flex-col md:items-end bg-white md:bg-transparent p-5 md:p-0 rounded-[16px] w-full md:w-auto shadow-xs md:shadow-none">
            <span className="text-neutral-500 text-xs uppercase tracking-wider">Estimated Total</span>
            <span className="text-3xl sm:text-4xl font-bold text-emerald-700">
              {formattedTotal}
            </span>
            <span className="text-neutral-400 text-xs mt-1">Valid through {data.expiresAtFormatted}</span>
          </div>
        </div>

        {/* 2-Column Specification & Snapshot details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Specifications Box */}
          <div className="bg-[#f5f5f5] rounded-[20px] p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-lg text-[#0f1422]">Design Specifications</h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <span className="text-neutral-500">Dimensions:</span>
              <span className="text-[#0f1422] font-medium text-right">
                {data.widthMm}mm W × {data.heightMm}mm H
              </span>

              <span className="text-neutral-500">Panel Setup:</span>
              <span className="text-[#0f1422] font-medium text-right">{data.panelCount} Panels</span>

              <span className="text-neutral-500">Aluminum Finish:</span>
              <span className="text-[#0f1422] font-medium text-right">
                {data.finishType === "PowderCoatedWhite" ? "Powder Coated White" : "Analok"}
              </span>

              <span className="text-neutral-500">Glass Type:</span>
              <span className="text-[#0f1422] font-medium text-right">
                {data.glassType === "6mm_clear" ? "6mm Clear Float" : "6mm Tinted Bronze"}
              </span>

              <span className="text-neutral-500">Bottom Sill:</span>
              <span className="text-[#0f1422] font-medium text-right">
                {data.hasSill ? "Standard Sill Track" : "Flush Base (No Sill)"}
              </span>
            </div>
          </div>

          {/* Consultation Notes */}
          <div className="bg-[#f5f5f5] rounded-[20px] p-6 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="font-semibold text-lg text-[#0f1422]">Consultation Status</h2>
              <p className="text-sm text-neutral-600 leading-relaxed">
                This link was shared by the client for review with R.R.D Aluminum & Glass Works. All dimensions and prices are subject to final on-site verification.
              </p>
            </div>
            <div className="bg-white p-4 rounded-[12px] flex items-center justify-between">
              <span className="text-xs text-neutral-500">Link Status</span>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                {data.status}
              </span>
            </div>
          </div>
        </div>

        {/* Itemized 4-Group BOM Table */}
        <div className="bg-[#f5f5f5] rounded-[24px] p-6 md:p-8 flex flex-col gap-4">
          <h2 className="font-semibold text-xl text-[#0f1422]">Itemized Cost Breakdown</h2>
          <div className="w-full overflow-x-auto bg-white rounded-[16px] shadow-xs">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
                  <th className="py-3.5 px-4 font-semibold">Item Group</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Quantity</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Unit Price</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.groups.map((group, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50/50">
                    <td className="py-3.5 px-4 font-medium text-[#0f1422]">{group.item_group_name}</td>
                    <td className="py-3.5 px-4 text-neutral-600 text-right">
                      {group.quantity} {group.unit_label}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-600 text-right">
                      ₱{group.unit_price.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#0f1422] text-right">
                      ₱{group.estimated_subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
