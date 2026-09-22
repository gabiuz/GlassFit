import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackgroundNavbar } from "@/components/shared/BackgroundNavbar";
import { getPublicBookingReference } from "@/lib/booking/bookingActions";
import { SnapshotViewer } from "./SnapshotViewer";
import { CheckCircle2, ShieldAlert, ArrowLeft, AlertTriangle } from "lucide-react";

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

  const isLinkActive = data.status === "Active" && !data.isExpired;

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

          <div className="flex items-center gap-2">
            {isLinkActive ? (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified Consultation Reference</span>
              </div>
            ) : data.status === "Revoked" ? (
              <div className="flex items-center gap-2 bg-red-50 text-red-800 border border-red-200 px-3 py-1 rounded-full text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>Revoked Reference</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Expired Reference</span>
              </div>
            )}
          </div>
        </div>

        {/* Expiration or Revocation Alert if inactive */}
        {(data.isExpired || data.status === "Expired") && (
          <div className="w-full bg-amber-50 border border-amber-300 rounded-[16px] p-5 text-left flex items-start gap-3.5 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-amber-900 text-sm">
                Expired Consultation Reference
              </span>
              <p className="text-amber-800 text-xs leading-relaxed">
                This quotation reference expired on {data.expiresAtFormatted}. Unit pricing indices and aluminum profile material rates are subject to re-validation with R.R.D Aluminum & Glass Works.
              </p>
            </div>
          </div>
        )}

        {data.status === "Revoked" && (
          <div className="w-full bg-red-50 border border-red-300 rounded-[16px] p-5 text-left flex items-start gap-3.5 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-red-900 text-sm">
                Revoked Reference Link
              </span>
              <p className="text-red-800 text-xs leading-relaxed">
                This consultation reference link has been revoked and is no longer active for consultation scheduling.
              </p>
            </div>
          </div>
        )}

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

        {/* Prominent Visualization Snapshot Preview */}
        <div className="w-full">
          <SnapshotViewer
            snapshotImageUrl={data.snapshotImageUrl}
            productName={data.productName}
            referenceCode={data.referenceCode}
          />
        </div>

        {/* Multi-Product Architectural Fixtures Breakdown */}
        {data.isMultiProduct && data.items && data.items.length > 0 ? (
          <div className="flex flex-col gap-5 w-full">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-xl text-[#0f1422]">
                Architectural Fixtures Included ({data.items.length} Items)
              </h2>
              {data.consolidatedMetrics && (
                <span className="text-xs font-semibold text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full">
                  Total {data.consolidatedMetrics.totalQuantity} Units
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.items.map((item, idx) => (
                <div
                  key={item.itemId || idx}
                  className="bg-[#f5f5f5] rounded-[20px] p-5 flex flex-col justify-between gap-4 border border-neutral-200/60 shadow-xs"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#07b6d3] uppercase tracking-wider">
                        Fixture #{idx + 1}
                      </span>
                      <span className="text-xs font-medium text-neutral-600 bg-white px-2.5 py-0.5 rounded-full shadow-2xs">
                        Qty: {item.quantity}
                      </span>
                    </div>
                    <h3 className="font-semibold text-base text-[#0f1422] leading-snug">
                      {item.productName}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {item.variantName || `${item.panelCount}-Panel Configuration`}
                    </p>

                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-xs pt-2 border-t border-neutral-200/70">
                      <span className="text-neutral-500">Dimensions:</span>
                      <span className="text-[#0f1422] font-medium text-right">
                        {item.dimensionsFormatted || `${item.widthMm / 10}cm × ${item.heightMm / 10}cm`}
                      </span>

                      <span className="text-neutral-500">Finish:</span>
                      <span className="text-[#0f1422] font-medium text-right">
                        {item.finishType === "PowderCoatedWhite" ? "White" : "Analok"}
                      </span>

                      <span className="text-neutral-500">Glass:</span>
                      <span className="text-[#0f1422] font-medium text-right">
                        {item.glassType === "6mm_clear" ? "6mm Clear" : "6mm Bronze"}
                      </span>

                      <span className="text-neutral-500">Sill:</span>
                      <span className="text-[#0f1422] font-medium text-right">
                        {item.hasSill ? "Standard" : "Flush (No Sill)"}
                      </span>
                    </div>

                    {item.structuralWaiver && (
                      <div className="mt-1 bg-amber-100/70 text-amber-900 border border-amber-300/80 px-2.5 py-1 rounded-[8px] text-[11px] font-medium flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Span Waiver (&ge;2400mm)</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between border-t border-neutral-200/70 pt-3 mt-1 bg-white/70 -mx-5 -mb-5 p-4 rounded-b-[20px]">
                    <span className="text-xs text-neutral-500">Unit Price: ₱{item.unitPrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                    <span className="font-bold text-sm text-emerald-800">
                      ₱{item.totalPrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 2-Column Specification & Consultation details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Specifications Box */}
          <div className="bg-[#f5f5f5] rounded-[20px] p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-lg text-[#0f1422]">
              {data.isMultiProduct ? "Project Scope & Dimensions" : "Design Specifications"}
            </h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              {data.isMultiProduct ? (
                <>
                  <span className="text-neutral-500">Total Fixtures:</span>
                  <span className="text-[#0f1422] font-medium text-right">
                    {data.items?.length || 1} Products ({data.consolidatedMetrics?.totalQuantity || data.items?.length || 1} Units)
                  </span>

                  {data.consolidatedMetrics && (
                    <>
                      <span className="text-neutral-500">Aluminum Framing:</span>
                      <span className="text-[#0f1422] font-medium text-right">
                        {data.consolidatedMetrics.totalFramingMeters.toFixed(1)} linear meters
                      </span>

                      <span className="text-neutral-500">Glazing Surface:</span>
                      <span className="text-[#0f1422] font-medium text-right">
                        {data.consolidatedMetrics.totalGlazingSqm.toFixed(2)} sqm
                      </span>

                      <span className="text-neutral-500">Fabrication Labor:</span>
                      <span className="text-[#0f1422] font-medium text-right">
                        ₱{data.consolidatedMetrics.totalLaborCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </span>
                    </>
                  )}

                  <span className="text-neutral-500">Structural Compliance:</span>
                  <span className="text-[#0f1422] font-medium text-right">
                    {data.structuralWaiver ? "Waiver Attached" : "NSCP 2015 Compliant"}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-neutral-500">Dimensions:</span>
                  <span className="text-[#0f1422] font-medium text-right">
                    {data.widthMm}mm W × {data.heightMm}mm H
                  </span>

                  <span className="text-neutral-500">Aperture Area:</span>
                  <span className="text-[#0f1422] font-medium text-right">
                    {((data.widthMm * data.heightMm) / 1000000).toFixed(2)} sqm
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
                </>
              )}
            </div>
          </div>

          {/* Consultation Notes & Fabricator Info */}
          <div className="bg-[#f5f5f5] rounded-[20px] p-6 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="font-semibold text-lg text-[#0f1422]">Consultation Status</h2>
              <p className="text-sm text-neutral-600 leading-relaxed">
                This link was shared by the customer for consultation review with R.R.D Aluminum & Glass Works. All dimensions and prices are subject to physical on-site ocular verification.
              </p>
            </div>
            <div className="flex flex-col gap-2 bg-white p-4 rounded-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">Assigned Fabricator</span>
                <span className="text-xs font-semibold text-[#0f1422]">
                  R.R.D Aluminum & Glass Works
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-100 pt-2">
                <span className="text-xs text-neutral-500">Link Status</span>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    isLinkActive
                      ? "bg-emerald-100 text-emerald-800"
                      : data.status === "Revoked"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {data.isExpired ? "Expired" : data.status}
                </span>
              </div>
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
                    <td className="py-3.5 px-4 font-medium text-[#0f1422]">
                      {group.item_group_name}
                    </td>
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
