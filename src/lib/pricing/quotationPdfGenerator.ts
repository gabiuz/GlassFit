/**
 * GlassFit Consultation PDF & Quotation Document Generator (MS-7)
 *
 * Implements server-side PDF document markup generation, itemized 4-group BOM rendering,
 * RA 7394 (Consumer Act of the Philippines) legal disclaimers, and NSCP 2015 Structural
 * Waiver clauses per docs/milestone.md (MS-7) & docs/pricing.md.
 *
 * Traceability Codes: PRD-F10, PRD-F11, PRD-F13, SDD-C7, SDD-C8, QAD-TC10, QAD-TC11, BAN-TYPE-05
 */

import type { CalculatedBOMResult } from "@/lib/pricing/pricingEngine";
import type {
  ConsolidatedQuotationSummary,
  ItemizedProductQuotation,
  QuotationBOMSummary,
} from "@/lib/pricing/types";

export interface QuotationPdfMetadata {
  quotationNumber: string;
  referenceCode: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  siteLocation?: string;
  createdAtFormatted: string;
  validUntilFormatted: string;
  projectName?: string;
  snapshotImageUrl?: string | null;
  hasSill: boolean;
  structuralWaiver: boolean;
  bomResult: CalculatedBOMResult;
  items?: ItemizedProductQuotation[];
  consolidatedSummary?: ConsolidatedQuotationSummary;
}

export interface GeneratedPdfDocument {
  quotationNumber: string;
  referenceCode: string;
  fileName: string;
  htmlContent: string;
  documentTitle: string;
  r2ObjectKey: string;
  hasStructuralWaiver: boolean;
  totalEstimatedAmount: number;
}

/**
 * Generate standard HTML/CSS print template for server-side PDF rendering and R2 persistence.
 */
export function generateQuotationPdfHtml(metadata: QuotationPdfMetadata): string {
  const {
    quotationNumber,
    referenceCode,
    customerName,
    customerPhone = "+63 (917) 000-0000",
    customerEmail = "client@glassfit.ph",
    siteLocation = "Metro Manila, Philippines",
    createdAtFormatted,
    validUntilFormatted,
    projectName = "Custom Architectural Fenestration",
    snapshotImageUrl,
    hasSill,
    structuralWaiver,
    bomResult,
    items,
    consolidatedSummary,
  } = metadata;

  const isMultiProduct = Boolean(items && items.length > 1 && consolidatedSummary);

  const formattedTotal = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(
    isMultiProduct && consolidatedSummary
      ? consolidatedSummary.finalGrandTotal
      : bomResult.finalQuotation,
  );

  const formattedDirectMaterials = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(
    isMultiProduct && consolidatedSummary
      ? consolidatedSummary.totalDirectMaterialsCost
      : bomResult.directMaterialsSubtotal,
  );

  const formattedLabor = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(
    isMultiProduct && consolidatedSummary
      ? consolidatedSummary.totalLaborCost
      : bomResult.fabricationLaborCost,
  );

  const formattedMargin = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(
    isMultiProduct && consolidatedSummary
      ? consolidatedSummary.totalContractorMargin
      : bomResult.contractorMargin,
  );

  const anyStructuralWaiver = isMultiProduct
    ? Boolean(items?.some((it) => it.structuralWaiver))
    : structuralWaiver;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GlassFit Quotation ${quotationNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f1422;
      background: #ffffff;
      line-height: 1.5;
      font-size: 13px;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      border-bottom: 2px solid #07b6d3;
      padding-bottom: 12px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 700;
      color: #0f1422;
    }
    .brand-subtitle {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .quote-meta-title {
      text-align: right;
      font-size: 18px;
      font-weight: 700;
      color: #07b6d3;
    }
    .quote-meta-sub {
      text-align: right;
      font-size: 11px;
      color: #64748b;
    }
    .info-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      background: #f8fafc;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .info-grid td {
      padding: 10px 14px;
      vertical-align: top;
      font-size: 12px;
    }
    .info-label {
      color: #64748b;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .info-value {
      font-weight: 600;
      color: #0f1422;
    }
    .waiver-banner {
      background-color: #fef2f2;
      border: 1px solid #f87171;
      border-left: 5px solid #dc2626;
      color: #991b1b;
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .waiver-banner strong {
      display: block;
      margin-bottom: 4px;
      font-size: 13px;
      color: #b91c1c;
    }
    .sill-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 4px;
      background: #dbeafe;
      color: #1e40af;
      margin-bottom: 12px;
    }
    .item-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      margin-bottom: 18px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .item-card-header {
      background: #0f1422;
      color: #ffffff;
      padding: 8px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      font-weight: 600;
    }
    .item-badge {
      background: #07b6d3;
      color: #ffffff;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .item-card-body {
      padding: 10px 14px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .items-table th {
      background: #f1f5f9;
      color: #1e293b;
      padding: 8px 10px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
      border-bottom: 1px solid #cbd5e1;
    }
    .items-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
    }
    .items-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .item-subtotal-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #f1f5f9;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 6px;
    }
    .total-table {
      width: 360px;
      margin-left: auto;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .total-table td {
      padding: 6px 12px;
      font-size: 12px;
    }
    .grand-total-row td {
      background: #07b6d3;
      color: #ffffff;
      font-size: 15px;
      font-weight: 700;
      padding: 10px 12px;
      border-radius: 6px;
    }
    .legal-notice {
      background: #f1f5f9;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 10px;
      color: #475569;
      line-height: 1.45;
      margin-top: 15px;
    }
    .legal-notice h4 {
      font-size: 11px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .signature-grid {
      width: 100%;
      border-collapse: collapse;
      margin-top: 25px;
    }
    .signature-grid td {
      width: 50%;
      padding: 10px 20px;
      vertical-align: bottom;
    }
    .sign-line {
      border-bottom: 1px solid #94a3b8;
      height: 35px;
      margin-bottom: 5px;
    }
    .sign-label {
      font-size: 11px;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>

  <!-- Top Header -->
  <table class="header-table">
    <tr>
      <td style="vertical-align: middle;">
        <div class="brand-title">GlassFit</div>
        <div class="brand-subtitle">Architectural Glass & Aluminum Parametric Estimation System</div>
      </td>
      <td style="vertical-align: middle;">
        <div class="quote-meta-title">ESTIMATED QUOTATION</div>
        <div class="quote-meta-sub">Ref: ${referenceCode} | No: ${quotationNumber}</div>
        <div class="quote-meta-sub">Date: ${createdAtFormatted} · Valid: ${validUntilFormatted}</div>
      </td>
    </tr>
  </table>

  <!-- Customer & Project Info -->
  <table class="info-grid">
    <tr>
      <td>
        <div class="info-label">Customer Name</div>
        <div class="info-value">${customerName}</div>
      </td>
      <td>
        <div class="info-label">Contact / Email</div>
        <div class="info-value">${customerPhone} · ${customerEmail}</div>
      </td>
      <td>
        <div class="info-label">Installation Site</div>
        <div class="info-value">${siteLocation}</div>
      </td>
    </tr>
    <tr>
      <td>
        <div class="info-label">${isMultiProduct ? "Project Scope" : "Aperture Dimensions"}</div>
        <div class="info-value">
          ${
            isMultiProduct && consolidatedSummary
              ? `${items?.length ?? 1} Fixtures (${consolidatedSummary.totalQuantity} Total Units)`
              : `W: ${Math.round(bomResult.widthM * 1000)} mm × H: ${Math.round(bomResult.heightM * 1000)} mm (${(bomResult.widthM * bomResult.heightM).toFixed(2)} sqm)`
          }
        </div>
      </td>
      <td>
        <div class="info-label">${isMultiProduct ? "Total Glazing Surface" : "Configuration & Panels"}</div>
        <div class="info-value">
          ${
            isMultiProduct && consolidatedSummary
              ? `${consolidatedSummary.totalGlazingSqm.toFixed(2)} sqm surface infill`
              : `Series 798 (${bomResult.panelCount}-Panel Sliding) · ${hasSill ? "Standard Sill" : "Sill Removed (Flush Base)"}`
          }
        </div>
      </td>
      <td>
        <div class="info-label">${isMultiProduct ? "Total Aluminum Framing" : "Profile Finish & Glass"}</div>
        <div class="info-value">
          ${
            isMultiProduct && consolidatedSummary
              ? `${consolidatedSummary.totalFramingMeters.toFixed(1)} linear meters`
              : `${bomResult.frozenDetails.finish_type} · ${bomResult.frozenDetails.glass_type}`
          }
        </div>
      </td>
    </tr>
  </table>

  ${
    anyStructuralWaiver
      ? `
  <!-- Structural Waiver Banner -->
  <div class="waiver-banner">
    <strong>Notice: NSCP 2015 Structural Span Waiver Attached</strong>
    One or more aperture configurations exceed standard Series 798 structural leaf recommendations (width &ge; 2400mm under a 2-panel configuration). The customer has formally acknowledged potential operational stiffness, roller micro-pitting, and wind-load deflection risks under Philippine typhoon design pressures.
  </div>`
      : ""
  }

  ${
    !isMultiProduct && !hasSill
      ? `
  <div class="sill-badge">
    ✓ Bottom Sill Omitted: Net material reduction applied for flush flooring.
  </div>`
      : ""
  }

  ${
    isMultiProduct && items
      ? `
  <!-- Itemized Breakdown for Each Fixture -->
  <div style="margin-bottom: 20px;">
    <h3 style="font-size: 14px; font-weight: 700; color: #0f1422; margin-bottom: 10px; border-bottom: 2px solid #0f1422; padding-bottom: 4px;">
      ITEMIZED FIXTURE BREAKDOWN (${items.length} FIXTURES)
    </h3>
    ${items
      .map(
        (item, idx) => `
    <div class="item-card">
      <div class="item-card-header">
        <span>Fixture ${idx + 1}: ${item.productName}</span>
        <span class="item-badge">Qty: ${item.quantity}</span>
      </div>
      <div class="item-card-body">
        <table style="width: 100%; font-size: 11px; margin-bottom: 8px; color: #475569;">
          <tr>
            <td style="width: 33%;"><strong>Dimensions:</strong> ${item.widthMm}mm × ${item.heightMm}mm (${((item.widthMm * item.heightMm) / 1000000).toFixed(2)} sqm)</td>
            <td style="width: 33%;"><strong>Configuration:</strong> Series 798 (${item.bomResult.panelCount}-Panel) · ${item.hasSill ? "Standard Sill" : "Flush Sill Omitted"}</td>
            <td style="width: 34%;"><strong>Finish & Glass:</strong> ${item.bomResult.frozenDetails.finish_type} · ${item.bomResult.frozenDetails.glass_type}</td>
          </tr>
        </table>
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 45%;">Component Group</th>
              <th style="width: 15%; text-align: center;">Qty / Extent</th>
              <th style="width: 20%; text-align: right;">Unit Rate</th>
              <th style="width: 20%; text-align: right;">Subtotal (PHP)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1. Aluminum Framing (Head, ${item.hasSill ? "Sill, " : ""}Jambs, Rails)</td>
              <td style="text-align: center;">${item.bomResult.totalLinearMetersFraming.toFixed(2)} m</td>
              <td style="text-align: right;">${(item.bomResult.effectiveFramingCost / (item.bomResult.totalLinearMetersFraming || 1)).toFixed(2)}</td>
              <td style="text-align: right; font-weight: 600;">₱${item.bomResult.effectiveFramingCost.toFixed(2)}</td>
            </tr>
            <tr>
              <td>2. Glazing Infill (${item.bomResult.frozenDetails.glass_type})</td>
              <td style="text-align: center;">${item.bomResult.glazingAreaSqm.toFixed(2)} sqm</td>
              <td style="text-align: right;">${(item.bomResult.effectiveGlazingCost / (item.bomResult.glazingAreaSqm || 1)).toFixed(2)}</td>
              <td style="text-align: right; font-weight: 600;">₱${item.bomResult.effectiveGlazingCost.toFixed(2)}</td>
            </tr>
            <tr>
              <td>3. Hardware, Fasteners & Weatherseals</td>
              <td style="text-align: center;">1 lot</td>
              <td style="text-align: right;">${(item.bomResult.hardwareSubtotal + item.bomResult.consumablesSubtotal).toFixed(2)}</td>
              <td style="text-align: right; font-weight: 600;">₱${(item.bomResult.hardwareSubtotal + item.bomResult.consumablesSubtotal).toFixed(2)}</td>
            </tr>
            <tr>
              <td>4. Workshop Fabrication & Labor</td>
              <td style="text-align: center;">1 lot</td>
              <td style="text-align: right;">${item.bomResult.fabricationLaborCost.toFixed(2)}</td>
              <td style="text-align: right; font-weight: 600;">₱${item.bomResult.fabricationLaborCost.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <div class="item-subtotal-bar">
          <span>Unit Rate: ₱${item.unitPrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })} × Qty ${item.quantity}</span>
          <span>Fixture Subtotal: ₱${item.totalPrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>`,
      )
      .join("")}
  </div>`
      : `
  <!-- Single Itemized Grouped BOM Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 35%;">Item Group / Specification</th>
        <th style="width: 15%; text-align: center;">Qty</th>
        <th style="width: 15%; text-align: center;">Unit</th>
        <th style="width: 15%; text-align: right;">Unit Rate</th>
        <th style="width: 20%; text-align: right;">Subtotal (PHP)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>1. Aluminum Framing Members</strong><br>
          <span style="font-size: 11px; color: #64748b;">
            Head, ${hasSill ? "Sill, " : ""}Jambs, Sash Rails, Interlockers (incl. 12% offcut allowance)
          </span>
        </td>
        <td style="text-align: center;">${bomResult.totalLinearMetersFraming.toFixed(2)}</td>
        <td style="text-align: center;">m</td>
        <td style="text-align: right;">${(bomResult.effectiveFramingCost / (bomResult.totalLinearMetersFraming || 1)).toFixed(2)}</td>
        <td style="text-align: right; font-weight: 600;">${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(bomResult.effectiveFramingCost)}</td>
      </tr>
      <tr>
        <td>
          <strong>2. Glazing Infill Inset</strong><br>
          <span style="font-size: 11px; color: #64748b;">
            ${bomResult.frozenDetails.glass_type} (incl. 10% handling/arrissing scrap)
          </span>
        </td>
        <td style="text-align: center;">${bomResult.glazingAreaSqm.toFixed(2)}</td>
        <td style="text-align: center;">sqm</td>
        <td style="text-align: right;">${(bomResult.effectiveGlazingCost / (bomResult.glazingAreaSqm || 1)).toFixed(2)}</td>
        <td style="text-align: right; font-weight: 600;">${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(bomResult.effectiveGlazingCost)}</td>
      </tr>
      <tr>
        <td>
          <strong>3. Hardware, Fasteners & Weatherseals</strong><br>
          <span style="font-size: 11px; color: #64748b;">
            ${bomResult.panelCount * 2} Single POM Rollers, Mortise Flush Lockset, EPDM Gaskets, Silicone
          </span>
        </td>
        <td style="text-align: center;">1</td>
        <td style="text-align: center;">lot</td>
        <td style="text-align: right;">${(bomResult.hardwareSubtotal + bomResult.consumablesSubtotal).toFixed(2)}</td>
        <td style="text-align: right; font-weight: 600;">${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(bomResult.hardwareSubtotal + bomResult.consumablesSubtotal)}</td>
      </tr>
      <tr>
        <td>
          <strong>4. Workshop Fabrication & Direct Labor</strong><br>
          <span style="font-size: 11px; color: #64748b;">
            Precision miter cutting, hole punching, weatherstrip insertion, shop pre-assembly
          </span>
        </td>
        <td style="text-align: center;">1</td>
        <td style="text-align: center;">lot</td>
        <td style="text-align: right;">${bomResult.fabricationLaborCost.toFixed(2)}</td>
        <td style="text-align: right; font-weight: 600;">${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(bomResult.fabricationLaborCost)}</td>
      </tr>
    </tbody>
  </table>`
  }

  <!-- Consolidated Grand Total Breakdown -->
  <table class="total-table">
    <tr>
      <td style="color: #64748b;">Direct Materials Subtotal:</td>
      <td style="text-align: right; font-weight: 600;">${formattedDirectMaterials}</td>
    </tr>
    <tr>
      <td style="color: #64748b;">Shop Floor Labor Subtotal:</td>
      <td style="text-align: right; font-weight: 600;">${formattedLabor}</td>
    </tr>
    <tr>
      <td style="color: #64748b;">Contractor Overhead & Margin (25%):</td>
      <td style="text-align: right; font-weight: 600;">${formattedMargin}</td>
    </tr>
    <tr class="grand-total-row">
      <td>${isMultiProduct ? "Consolidated Total:" : "Estimated Total:"}</td>
      <td style="text-align: right; font-weight: 700;">${formattedTotal}</td>
    </tr>
  </table>

  <!-- Legal & Statutory Notices -->
  <div class="legal-notice">
    <h4>STATUTORY LEGAL NOTICE & TERMS (Consumer Act of the Philippines RA 7394)</h4>
    <p>
      1. <strong>Preliminary Estimate:</strong> This quotation is a computer-generated preliminary parametric estimate based on client-specified aperture dimensions. Final binding pricing is subject to physical on-site ocular verification of plumbness, wall squareness, and rough opening conditions by an authorized contractor.
    </p>
    <p>
      2. <strong>Price Validity:</strong> Unit prices reflect prevailing Philippine aluminum profile extrusion and float glass wholesale price indices and remain valid for 14 calendar days from the date of issuance.
    </p>
    <p>
      3. <strong>Structural Compliance:</strong> Framing and glazing dimensions conform to NSCP 2015 Section 207 serviceability criteria under standard residential load envelopes unless a specific structural waiver clause is formally executed.
    </p>
  </div>

  <!-- Signatures -->
  <table class="signature-grid">
    <tr>
      <td>
        <div class="sign-line"></div>
        <div class="sign-label">Prepared By: GlassFit Authorized Fabricator</div>
      </td>
      <td>
        <div class="sign-line"></div>
        <div class="sign-label">Client Acceptance & Acknowledgement (Signature Over Printed Name)</div>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

/**
 * Creates consultation PDF package representation and R2 S3 storage metadata.
 */
export function createQuotationPdfDocument(metadata: QuotationPdfMetadata): GeneratedPdfDocument {
  const htmlContent = generateQuotationPdfHtml(metadata);
  const fileName = `GlassFit_Quotation_${metadata.quotationNumber}.pdf`;
  const r2ObjectKey = `quotations/${metadata.quotationNumber}/${fileName}`;
  const totalEstimatedAmount =
    metadata.consolidatedSummary?.finalGrandTotal ?? metadata.bomResult.finalQuotation;
  const hasStructuralWaiver =
    metadata.items?.some((it) => it.structuralWaiver) ?? metadata.structuralWaiver;

  return {
    quotationNumber: metadata.quotationNumber,
    referenceCode: metadata.referenceCode,
    fileName,
    htmlContent,
    documentTitle: `GlassFit Quotation - ${metadata.quotationNumber}`,
    r2ObjectKey,
    hasStructuralWaiver,
    totalEstimatedAmount,
  };
}

/**
 * Format deep shareable links for Viber and Messenger booking handoffs.
 */
export function formatBookingShareMessage(options: {
  customerName: string;
  quotationNumber: string;
  referenceLink: string;
  productDescription: string;
  totalEstimatePhp: number;
  hasStructuralWaiver?: boolean;
}): {
  messageText: string;
  messengerUrl: string;
  viberUrl: string;
} {
  const waiverNote = options.hasStructuralWaiver
    ? "\n(Note: Structural waiver attached for aperture span >= 2400mm)"
    : "";

  const formattedPrice = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(options.totalEstimatePhp).replace("PHP", "Php");

  const messageText = `Hello R.R.D! I would like to inquire about a consultation for my customized glass and aluminum project:

Product: ${options.productDescription}
Quotation No: ${options.quotationNumber}
Estimated Amount: ${formattedPrice}${waiverNote}

Here is my saved reference link:
${options.referenceLink}

Can we schedule an ocular inspection and site measurement? Thank you! - ${options.customerName}`;

  const encodedMessage = encodeURIComponent(messageText);

  // Standard Viber and Messenger deep links
  const messengerUrl = `https://m.me/rrdaluminumglass?text=${encodedMessage}`;
  const viberUrl = `viber://forward?text=${encodedMessage}`;

  return {
    messageText,
    messengerUrl,
    viberUrl,
  };
}
