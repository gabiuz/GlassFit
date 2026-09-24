/** Browser quotation preview. Traceability: IMP-MS14, PRD-F9, PRD-F10, partial PRD-F11, SDD-C6, SDD-C7, QAD-TC10. */
import type { CalculatedBOMResult } from "@/lib/pricing/pricingEngine";
import { QUOTATION_TERMS_CONTENT } from "@/lib/pricing/quotationPdfContent";
import type { ConsolidatedQuotationSummary, ItemizedProductQuotation } from "@/lib/pricing/types";
import { SNAPSHOT_FALLBACK_DATA_URL } from "@/lib/pricing/pdfAssets";

export interface QuotationPdfMetadata {
  quotationNumber: string;
  referenceCode?: string | null;
  shareableUrl?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  siteLocation?: string | null;
  createdAtFormatted: string;
  quotationValidityText?: string | null;
  projectName: string;
  snapshotImageUrl?: string | null;
  brandLogoUrl: string;
  allowedImageOrigins?: readonly string[];
  hasSill: boolean;
  structuralWaiver: boolean;
  bomResult: CalculatedBOMResult;
  items?: ItemizedProductQuotation[];
  consolidatedSummary?: ConsolidatedQuotationSummary;
}

export interface GeneratedPdfDocument { quotationNumber: string; referenceCode: string; fileName: string; htmlContent: string; documentTitle: string; r2ObjectKey: string; hasStructuralWaiver: boolean; totalEstimatedAmount: number; }

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

export function sanitizeImageSource(value: string | null | undefined, allowedOrigins: readonly string[]): string | null {
  if (!value) return null;
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) return value;
  if (value.startsWith("//")) return null;
  try {
    const url = new URL(value);
    if (!allowedOrigins.includes(url.origin)) return null;
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch { return null; }
}

const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(value);

function bomTable(result: CalculatedBOMResult, hasSill: boolean): string {
  const hardware = result.hardwareSubtotal + result.consumablesSubtotal;
  return `<table class="items-table"><thead><tr><th>Component group</th><th>Qty / extent</th><th>Unit rate</th><th>Subtotal</th></tr></thead><tbody>
<tr><td><strong>1. Aluminum Framing Members</strong><br>Head, ${hasSill ? "Sill, " : ""}Jambs, Sash Rails, Interlockers</td><td>${result.totalLinearMetersFraming.toFixed(2)} m</td><td>${money(result.effectiveFramingCost / (result.totalLinearMetersFraming || 1))}</td><td>${money(result.effectiveFramingCost)}</td></tr>
<tr><td><strong>2. Glazing Infill Inset</strong><br>${escapeHtml(result.frozenDetails.glass_type)}</td><td>${result.glazingAreaSqm.toFixed(2)} sqm</td><td>${money(result.effectiveGlazingCost / (result.glazingAreaSqm || 1))}</td><td>${money(result.effectiveGlazingCost)}</td></tr>
<tr><td><strong>3. Hardware, Fasteners &amp; Weatherseals</strong></td><td>1 lot</td><td>${money(hardware)}</td><td>${money(hardware)}</td></tr>
<tr><td><strong>4. Workshop Fabrication &amp; Direct Labor</strong></td><td>1 lot</td><td>${money(result.fabricationLaborCost)}</td><td>${money(result.fabricationLaborCost)}</td></tr></tbody></table>`;
}

function snapshot(source: string | null, alt: string): string {
  return source
    ? `<figure class="snapshot"><img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}"><figcaption>${escapeHtml(alt)}</figcaption></figure>`
    : `<div class="snapshot-fallback"><img src="${SNAPSHOT_FALLBACK_DATA_URL}" alt=""><p>Visualization preview not available. Product specifications and preliminary dimensions remain subject to on-site verification.</p></div>`;
}

function termsAppendix(): string {
  const paragraphs = (values: readonly string[]) => values.map((value) => `<p>${escapeHtml(value)}</p>`).join("");
  return `<section class="terms-appendix" aria-label="Quotation terms and warranty"><div class="terms-section"><h2>TERMS AND CONDITIONS</h2>${paragraphs(QUOTATION_TERMS_CONTENT.terms)}</div><div class="terms-section"><h2>WARRANTY</h2>${paragraphs(QUOTATION_TERMS_CONTENT.warranty)}</div></section>`;
}

export function generateQuotationPdfHtml(metadata: QuotationPdfMetadata): string {
  const items = metadata.items ?? [];
  const isMulti = items.length > 1 && Boolean(metadata.consolidatedSummary);
  const summary = metadata.consolidatedSummary;
  const origins = metadata.allowedImageOrigins ?? [];
  const anyWaiver = isMulti ? items.some((item) => item.structuralWaiver) : metadata.structuralWaiver;
  const total = isMulti && summary ? summary.finalGrandTotal : metadata.bomResult.finalQuotation;
  const materials = isMulti && summary ? summary.totalDirectMaterialsCost : metadata.bomResult.directMaterialsSubtotal;
  const labor = isMulti && summary ? summary.totalLaborCost : metadata.bomResult.fabricationLaborCost;
  const margin = isMulti && summary ? summary.totalContractorMargin : metadata.bomResult.contractorMargin;
  const field = (label: string, value?: string | null) => value ? `<div><span>${label}</span><strong>${escapeHtml(value)}</strong></div>` : "";
  const reference = metadata.referenceCode ? `<div>Reference: ${escapeHtml(metadata.referenceCode)}${metadata.shareableUrl ? ` · <a href="${escapeHtml(metadata.shareableUrl)}">${escapeHtml(metadata.shareableUrl)}</a>` : ""}</div>` : "";
  const waiver = anyWaiver ? `<aside class="waiver-banner"><strong>Notice: NSCP 2015 Structural Span Waiver Attached</strong><p>This configuration exceeds standard Series 798 2-panel structural width recommendations (W &gt;= 2400mm). The customer has acknowledged potential operational stiffness and wind-load deflection risks.</p></aside>` : "";
  const fixtures = isMulti ? items.map((item, index) => {
    const itemImage = sanitizeImageSource(item.imageUrl, origins);
    return `<section class="item-card"><header><h3>Fixture ${index + 1}: ${escapeHtml(item.productName)}</h3><span>Qty: ${item.quantity}</span></header>${itemImage ? snapshot(itemImage, `${item.productName} visualization preview`) : ""}<div class="fixture-specs"><span><b>Dimensions:</b> ${item.widthMm}mm × ${item.heightMm}mm</span><span><b>Panels:</b> ${item.panelCount}</span><span><b>Finish:</b> ${escapeHtml(item.finishType)}</span><span><b>Glass:</b> ${escapeHtml(item.glassType)}</span><span><b>Sill:</b> ${item.hasSill ? "Standard sill" : "Flush sill omitted"}</span></div>${item.structuralWaiver ? `<p class="item-waiver">Structural waiver attached for this fixture.</p>` : ""}${bomTable(item.bomResult, item.hasSill)}<div class="item-subtotal"><span>Unit price: ${money(item.unitPrice)} × ${item.quantity}</span><strong>Fixture subtotal: ${money(item.totalPrice)}</strong></div></section>`;
  }).join("") : bomTable(metadata.bomResult, metadata.hasSill);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>GlassFit Quotation ${escapeHtml(metadata.quotationNumber)}</title><style>
@page { size: A4 portrait; margin: 15mm; } * { box-sizing: border-box; } html,body { min-width:0; } body { margin:0; padding:24px 16px 48px; background:#f1f5f9; color:#0f1422; font:13px/1.5 Arial,sans-serif; overflow-wrap:anywhere; }
.preview-toolbar { width:min(210mm, 100%); margin:0 auto 16px; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; } .toolbar-actions { display:flex; flex-wrap:wrap; gap:8px; } button { border:1px solid #0f1422; border-radius:999px; padding:10px 16px; background:#fff; color:#0f1422; cursor:pointer; font:inherit; font-weight:700; } button.primary { background:#0f1422; color:#fff; } button:focus-visible,a:focus-visible { outline:3px solid #07b6d3; outline-offset:2px; }
.document-sheet { box-sizing:border-box; width:min(210mm, 100%); margin:0 auto; padding:clamp(24px, 5vw, 20mm); background:#fff; border-radius:8px; box-shadow:0 10px 30px rgba(15,20,34,.12); } .document-header { display:flex; justify-content:space-between; gap:24px; padding-bottom:16px; border-bottom:2px solid #07b6d3; } .brand-logo { display:block; width:150px; max-width:42vw; height:56px; object-fit:contain; object-position:left center; } h1 { margin:0; color:#07b6d3; font-size:19px; } h2 { font-size:16px; margin:24px 0 10px; } h3 { margin:0; font-size:14px; }
.meta-grid,.fixture-specs { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 20px; } .meta-grid { margin:18px 0; padding:16px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; } .meta-grid span { display:block; color:#64748b; font-size:10px; text-transform:uppercase; }
.snapshot { margin:18px 0; } .snapshot img { display:block; width:100%; max-height:380px; object-fit:contain; background:#f8fafc; border-radius:8px; } figcaption { margin-top:6px; color:#64748b; } .snapshot-fallback { margin:18px 0; padding:28px; text-align:center; border:1px dashed #94a3b8; border-radius:8px; background:#f8fafc; } .snapshot-fallback img { width:96px; max-width:30%; }
.summary-card { margin:18px 0; padding:18px; border-radius:8px; background:#0f1422; color:#fff; } .summary-card strong { display:block; color:#67e8f9; font-size:24px; } .waiver-banner,.item-waiver { padding:12px 16px; border:1px solid #f59e0b; border-left:5px solid #d97706; border-radius:6px; background:#fffbeb; color:#78350f; }
.item-card { margin:18px 0; border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; } .item-card>header { display:flex; justify-content:space-between; gap:12px; padding:10px 14px; background:#0f1422; color:#fff; } .item-card .snapshot,.item-card .fixture-specs,.item-card .items-table,.item-card .item-waiver { margin:12px; } .item-card .snapshot img { max-height:230px; }
.items-table { width:100%; border-collapse:collapse; margin:12px 0 20px; } .items-table th,.items-table td { padding:8px; border-bottom:1px solid #e2e8f0; text-align:left; vertical-align:top; } .items-table th { background:#f1f5f9; font-size:10px; text-transform:uppercase; } .items-table td:nth-child(n+2),.items-table th:nth-child(n+2) { text-align:right; }
.item-subtotal { display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; padding:12px; background:#f1f5f9; } .total-table { width:min(100%,390px); margin-left:auto; border-collapse:collapse; } .total-table td { padding:7px; } .total-table td:last-child { text-align:right; font-weight:700; } .grand-total-row { background:#07b6d3; color:#fff; font-size:15px; }
.ocular-card,.consumer-notice { margin-top:24px; padding:16px; border:1px solid #cbd5e1; border-radius:8px; } .checklist { padding-left:20px; } .checklist li { margin:7px 0; list-style:"☐  "; } .signature-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:28px; margin-top:32px; } .signature-block .line { height:30px; border-bottom:1px solid #64748b; } .consumer-notice { background:#f8fafc; color:#475569; font-size:11px; }
@media screen and (max-width:640px) { body { padding:12px 8px 32px; } .document-header,.preview-toolbar { align-items:flex-start; flex-direction:column; } .meta-grid,.fixture-specs,.signature-grid { grid-template-columns:1fr; } .items-table { font-size:10px; } .items-table th,.items-table td { padding:5px 3px; } }
.terms-appendix { margin-top:32px; padding-top:24px; border-top:2px solid #07b6d3; } .terms-section + .terms-section { margin-top:28px; } .terms-section h2 { color:#0f1422; letter-spacing:.02em; } .terms-section p { margin:0 0 14px; }
@media print {
  html,body { width:100%; margin:0; padding:0; background:transparent; font-size:9pt; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  .no-print { display:none !important; }
  .document-sheet { box-sizing:border-box; width:100%; max-width:none; margin:0; padding:0; border-radius:0; box-shadow:none; }
  .document-header { display:flex; flex-direction:row; align-items:flex-start; gap:8mm; padding-bottom:4mm; }
  .meta-grid,.fixture-specs,.signature-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .meta-grid { margin:4mm 0; padding:4mm; }
  .brand-logo { width:40mm; max-width:none; height:15mm; }
  h1 { font-size:14pt; } h2 { margin:6mm 0 2.5mm; font-size:12pt; } h3 { font-size:10pt; }
  .items-table { font-size:9pt; margin:3mm 0 5mm; }
  .items-table th,.items-table td { padding:2mm; }
  .item-card { overflow:visible; border-radius:0; }
  .item-card>header { break-after:avoid; page-break-after:avoid; }
  .document-header,.meta-grid,.summary-card,.fixture-specs,.ocular-card,.consumer-notice { break-inside:avoid; page-break-inside:avoid; }
  .snapshot { break-inside:avoid; page-break-inside:avoid; }
  .snapshot img { width:100%; height:auto; max-height:82mm; object-fit:contain; }
  .item-card .snapshot img { max-height:58mm; }
  .snapshot-fallback { break-inside:avoid; page-break-inside:avoid; margin:4mm 0; padding:6mm; }
  .terms-appendix { break-before:page; page-break-before:always; margin:0; padding:0; border:0; }
  .terms-section { break-inside:avoid; page-break-inside:avoid; }
  .terms-section + .terms-section { margin-top:7mm; }
  .terms-section h2 { margin-top:0; }
  .terms-section p { margin:0 0 4mm; }
  tr { break-inside:avoid; page-break-inside:avoid; }
  thead { display:table-header-group; }
  p,li { orphans:3; widows:3; }
}
</style></head><body><nav class="preview-toolbar no-print" aria-label="Quotation preview controls"><div><strong>Quotation preview</strong><div>${escapeHtml(metadata.quotationNumber)}</div></div><div class="toolbar-actions"><button class="primary" type="button" onclick="window.print()">Print / Save as PDF</button><button type="button" onclick="window.close()">Close preview</button></div></nav>
<main class="document-sheet"><header class="document-header"><div><img class="brand-logo" src="${escapeHtml(metadata.brandLogoUrl)}" alt="GlassFit"><p>Consultation Partner: R.R.D. Aluminum &amp; Glass Works</p></div><div><h1>PRELIMINARY CONSULTATION ESTIMATE</h1><strong>No. ${escapeHtml(metadata.quotationNumber)}</strong><div>${escapeHtml(metadata.createdAtFormatted)}</div>${reference}${metadata.quotationValidityText ? `<div>${escapeHtml(metadata.quotationValidityText)}</div>` : ""}</div></header>
<section class="meta-grid"><div><span>Customer</span><strong>${escapeHtml(metadata.customerName)}</strong></div>${field("Phone",metadata.customerPhone)}${field("Email",metadata.customerEmail)}${field("Site location",metadata.siteLocation)}<div><span>Project</span><strong>${escapeHtml(metadata.projectName)}</strong></div></section>${waiver}${snapshot(sanitizeImageSource(metadata.snapshotImageUrl,origins),"Client-space visualization preview")}${!isMulti ? `<div class="fixture-specs"><span><b>Dimensions:</b> W: ${Math.round(metadata.bomResult.widthM * 1000)} mm × H: ${Math.round(metadata.bomResult.heightM * 1000)} mm</span><span><b>Panels:</b> ${metadata.bomResult.panelCount}</span><span><b>Finish:</b> ${escapeHtml(metadata.bomResult.frozenDetails.finish_type)}</span><span><b>Glass:</b> ${escapeHtml(metadata.bomResult.frozenDetails.glass_type)}</span><span><b>Sill:</b> ${metadata.hasSill ? "Standard sill" : "Bottom Sill Omitted. Net material reduction applied."}</span></div>` : ""}
<section class="summary-card"><span>${escapeHtml(metadata.projectName)}</span><strong>${money(total)}</strong><span>Preliminary estimated total</span></section><h2>${isMulti ? `ITEMIZED FIXTURE BREAKDOWN (${items.length} FIXTURES)` : "Itemized quotation breakdown"}</h2>${fixtures}
<table class="total-table"><tr><td>Direct materials subtotal</td><td>${money(materials)}</td></tr><tr><td>Shop floor labor subtotal</td><td>${money(labor)}</td></tr><tr><td>Contractor overhead &amp; margin (25%)</td><td>${money(margin)}</td></tr><tr class="grand-total-row"><td>${isMulti ? "Consolidated Total:" : "Estimated Total:"}</td><td>${money(total)}</td></tr></table>
<section class="ocular-card"><h2>Ocular inspection checklist</h2><ul class="checklist"><li>Aperture dimensions physically measured.</li><li>Opening checked for square, plumb, and level.</li><li>Perimeter substrate inspected.</li><li>Access and work area reviewed.</li><li>Final specifications reviewed with customer.</li></ul><div class="signature-grid"><div class="signature-block"><div class="line"></div><p>Customer signature / Printed name / Date</p></div><div class="signature-block"><div class="line"></div><p>Estimator signature / Printed name / Date</p></div></div></section>
<footer class="consumer-notice"><strong>Preliminary Estimate and Consumer Notice</strong><p>This is a preliminary computer-generated estimate based on customer-provided inputs and current configured material rates. It is not a final binding contract. Dimensions, site conditions, access requirements, structural conditions, accessories, and final pricing must be verified during the on-site consultation before material cutting or fabrication.</p><small>Project traceability reference: Consumer Act of the Philippines RA 7394.</small></footer>${termsAppendix()}</main></body></html>`;
}

export function createQuotationPdfDocument(metadata: QuotationPdfMetadata): GeneratedPdfDocument {
  const fileName = `GlassFit_Quotation_${metadata.quotationNumber}.pdf`;
  return { quotationNumber:metadata.quotationNumber, referenceCode:metadata.referenceCode ?? "", fileName, htmlContent:generateQuotationPdfHtml(metadata), documentTitle:`GlassFit Quotation - ${metadata.quotationNumber}`, r2ObjectKey:`quotations/${metadata.quotationNumber}/${fileName}`, hasStructuralWaiver:metadata.items?.some((item)=>item.structuralWaiver) ?? metadata.structuralWaiver, totalEstimatedAmount:metadata.consolidatedSummary?.finalGrandTotal ?? metadata.bomResult.finalQuotation };
}

export function formatBookingShareMessage(options: { customerName:string; quotationNumber:string; referenceLink:string; productDescription:string; totalEstimatePhp:number; hasStructuralWaiver?:boolean }): { messageText:string; messengerUrl:string; viberUrl:string } {
  const waiver = options.hasStructuralWaiver ? "\n(Note: Structural waiver attached for aperture span >= 2400mm)" : "";
  const price = new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",maximumFractionDigits:0}).format(options.totalEstimatePhp).replace("PHP","Php");
  const messageText = `Hello R.R.D! I would like to inquire about a consultation for my customized glass and aluminum project:\n\nProduct: ${options.productDescription}\nQuotation No: ${options.quotationNumber}\nEstimated Amount: ${price}${waiver}\n\nHere is my saved reference link:\n${options.referenceLink}\n\nCan we schedule an ocular inspection and site measurement? Thank you! - ${options.customerName}`;
  const encoded = encodeURIComponent(messageText); return { messageText, messengerUrl:`https://m.me/rrdaluminumglass?text=${encoded}`, viberUrl:`viber://forward?text=${encoded}` };
}
