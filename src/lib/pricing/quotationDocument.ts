/** Canonical quotation document domain. Traceability: IMP-MS16, PRD-F10, PRD-F11, SDD-C7. */
import { z } from "zod";
import type { CalculatedBOMResult, ItemizedProductQuotation } from "./types";

const MONEY_MAX = 9_999_999_999.99;
const money = z.number().finite().min(0).max(MONEY_MAX).refine(
  (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
  "Money must have at most two decimal places",
);
const required = z.string().trim().min(1);

export const QuotationDocumentGroupSchema = z.object({
  groupName: required,
  description: required,
  quantity: z.number().finite().nonnegative(),
  unit: required,
  unitPrice: money,
  subtotal: money,
});

export const QuotationDocumentItemSchema = z.object({
  itemId: required,
  productId: z.string().nullable(),
  productName: required,
  productType: required,
  variantName: required,
  specificationSummary: required,
  dimensionsFormatted: required,
  widthMm: z.number().finite().positive(),
  heightMm: z.number().finite().positive(),
  panelCount: z.number().int().positive(),
  hasSill: z.boolean(),
  structuralWaiver: z.boolean(),
  finishLabel: required,
  glassLabel: required,
  quantity: z.number().int().positive(),
  unitPrice: money,
  calculatedSubtotal: money,
  imageSource: z.string().nullable(),
  groups: z.array(QuotationDocumentGroupSchema).min(1),
}).superRefine((item, context) => {
  if (Math.round(item.unitPrice * item.quantity * 100) !== Math.round(item.calculatedSubtotal * 100)) {
    context.addIssue({ code: "custom", path: ["calculatedSubtotal"], message: "Item arithmetic mismatch" });
  }
});

const snapshotShape = {
  schemaVersion: z.literal(1),
  quotationNumber: required,
  referenceCode: required,
  shareablePath: required,
  createdAt: z.string().datetime(),
  customer: z.object({
    name: required,
    phone: z.string().nullable(),
    email: z.string().nullable(),
    siteLocation: z.string().nullable(),
  }),
  projectName: required,
  snapshotObjectKey: z.string().nullable(),
  hasSill: z.boolean(),
  structuralWaiver: z.boolean(),
  items: z.array(QuotationDocumentItemSchema).min(1),
  pricing: z.object({
    directMaterialsSubtotal: money,
    laborSubtotal: money,
    contractorMargin: money,
    calculatedFinalPrice: money,
  }),
};

export const QuotationDocumentSnapshotV1Schema = z.object(snapshotShape).superRefine((document, context) => {
  const itemTotal = document.items.reduce((sum, item) => sum + Math.round(item.calculatedSubtotal * 100), 0);
  if (itemTotal !== Math.round(document.pricing.calculatedFinalPrice * 100)) {
    context.addIssue({ code: "custom", path: ["pricing", "calculatedFinalPrice"], message: "Project total mismatch" });
  }
});
export type QuotationDocumentSnapshotV1 = z.infer<typeof QuotationDocumentSnapshotV1Schema>;

export const QuotationDocumentDraftV1Schema = z.object({
  schemaVersion: z.literal(1),
  customer: snapshotShape.customer,
  projectName: required,
  hasSill: z.boolean(),
  structuralWaiver: z.boolean(),
  items: z.array(QuotationDocumentItemSchema).min(1),
  pricing: snapshotShape.pricing,
}).superRefine((document, context) => {
  const total = document.items.reduce((sum, item) => sum + Math.round(item.calculatedSubtotal * 100), 0);
  if (total !== Math.round(document.pricing.calculatedFinalPrice * 100)) {
    context.addIssue({ code: "custom", path: ["pricing", "calculatedFinalPrice"], message: "Project total mismatch" });
  }
});
export type QuotationDocumentDraftV1 = z.infer<typeof QuotationDocumentDraftV1Schema>;

function groupsFromBom(bom: CalculatedBOMResult) {
  const map = (groupName: string, rows: CalculatedBOMResult["framingItems"]) => rows.map((row) => ({
    groupName,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.unit_price,
    subtotal: row.subtotal,
  }));
  return [
    ...map("Aluminum Framing", bom.framingItems),
    ...map("Glass Infill", bom.glazingItems),
    ...map("Hardware & Accessories", bom.hardwareItems),
    ...map("Miscellaneous", bom.consumableItems),
    { groupName: "Labor & Installation", description: "Shop floor labor", quantity: 1, unit: "lot", unitPrice: bom.fabricationLaborCost, subtotal: bom.fabricationLaborCost },
  ];
}

export function createQuotationDocumentSnapshotV1(input: {
  customer: QuotationDocumentDraftV1["customer"];
  projectName: string;
  items: ItemizedProductQuotation[];
  fallbackBom: CalculatedBOMResult;
  hasSill: boolean;
  structuralWaiver: boolean;
}): QuotationDocumentDraftV1 {
  const sourceItems = input.items.length > 0 ? input.items : [{
    itemId: "primary-item", productId: "", productName: input.projectName, productType: "Window & Door",
    variantName: `${input.fallbackBom.panelCount}-Panel Configuration`, specSummary: `${input.fallbackBom.finishType} | ${input.fallbackBom.widthM * 100}cm × ${input.fallbackBom.heightM * 100}cm`,
    dimensionsFormatted: `${input.fallbackBom.widthM * 100}cm × ${input.fallbackBom.heightM * 100}cm`, widthMm: input.fallbackBom.widthM * 1000,
    heightMm: input.fallbackBom.heightM * 1000, panelCount: input.fallbackBom.panelCount, hasSill: input.hasSill,
    structuralWaiver: input.structuralWaiver, finishType: input.fallbackBom.finishType, glassType: input.fallbackBom.glassType,
    quantity: 1, unitPrice: input.fallbackBom.finalQuotation, totalPrice: input.fallbackBom.finalQuotation, imageUrl: "", bomResult: input.fallbackBom,
  }];
  const items = sourceItems.map((item) => ({
    itemId: item.itemId, productId: item.productId || null, productName: item.productName,
    productType: item.productType, variantName: item.variantName, specificationSummary: item.specSummary,
    dimensionsFormatted: item.dimensionsFormatted, widthMm: item.widthMm, heightMm: item.heightMm,
    panelCount: item.panelCount, hasSill: item.hasSill, structuralWaiver: item.structuralWaiver,
    finishLabel: item.finishType, glassLabel: item.glassType, quantity: item.quantity, unitPrice: item.unitPrice,
    calculatedSubtotal: item.totalPrice, imageSource: item.imageUrl || null, groups: groupsFromBom(item.bomResult),
  }));
  const pricing = sourceItems.reduce((totals, item) => ({
    directMaterialsSubtotal: totals.directMaterialsSubtotal + item.bomResult.directMaterialsSubtotal * item.quantity,
    laborSubtotal: totals.laborSubtotal + item.bomResult.fabricationLaborCost * item.quantity,
    contractorMargin: totals.contractorMargin + item.bomResult.contractorMargin * item.quantity,
    calculatedFinalPrice: totals.calculatedFinalPrice + item.totalPrice,
  }), { directMaterialsSubtotal: 0, laborSubtotal: 0, contractorMargin: 0, calculatedFinalPrice: 0 });
  return QuotationDocumentDraftV1Schema.parse({ schemaVersion: 1, customer: input.customer, projectName: input.projectName, hasSill: input.hasSill, structuralWaiver: input.structuralWaiver, items, pricing });
}

export function deriveQuotationPricing(calculatedFinalPrice: number, negotiatedFinalPrice: number | null) {
  const calculatedCents = Math.round(calculatedFinalPrice * 100);
  const negotiatedCents = negotiatedFinalPrice === null ? null : Math.round(negotiatedFinalPrice * 100);
  const isPriceModified = negotiatedCents !== null && negotiatedCents !== calculatedCents;
  return { calculatedFinalPrice: calculatedCents / 100, negotiatedFinalPrice: isPriceModified ? negotiatedCents / 100 : null, effectiveFinalPrice: (isPriceModified ? negotiatedCents : calculatedCents) / 100, isPriceModified };
}

export interface QuotationDocumentViewModel extends QuotationDocumentSnapshotV1 {
  brandLogoUrl: string;
  shareableUrl: string;
  snapshotImageUrl: string | null;
  allowedImageOrigins: string[];
  calculatedFinalPrice: number;
  negotiatedFinalPrice: number | null;
  effectiveFinalPrice: number;
  isPriceModified: boolean;
}

export function createQuotationDocumentViewModel(snapshot: QuotationDocumentSnapshotV1, runtime: {
  brandLogoUrl: string; shareableUrl: string; snapshotImageUrl: string | null; allowedImageOrigins: string[]; negotiatedAmount: number | null;
}): QuotationDocumentViewModel {
  return { ...snapshot, ...runtime, ...deriveQuotationPricing(snapshot.pricing.calculatedFinalPrice, runtime.negotiatedAmount) };
}

export interface LegacyQuotationRow { item_name: string; item_group_name?: string; quantity: number; unit: string; unit_price: number; estimated_subtotal: number; pricing_details: Record<string, unknown> | null; }

export function reconstructLegacyQuotationDocument(input: { quotationNumber: string; referenceCode: string; createdAt: string; customer: QuotationDocumentSnapshotV1["customer"]; totalEstimatedAmount: number; snapshotObjectKey: string | null; rows: LegacyQuotationRow[]; }): QuotationDocumentSnapshotV1 | null {
  const usable = input.rows.filter((row) => row.pricing_details && typeof row.pricing_details.product_name === "string");
  if (usable.length === 0) return null;
  const grouped = new Map<string, LegacyQuotationRow[]>();
  for (const row of usable) {
    const details = row.pricing_details ?? {};
    const key = String(details.item_id || details.item_index || details.product_name);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const items = [...grouped.entries()].map(([itemId, rows]) => {
    const details = rows[0].pricing_details ?? {};
    const quantity = Number(details.item_quantity) || 1;
    const subtotal = Number(details.item_total_price) || input.totalEstimatedAmount / grouped.size;
    return { itemId, productId: typeof details.product_id === "string" ? details.product_id : null, productName: String(details.product_name), productType: String(details.product_type || "Window & Door"), variantName: String(details.variant_name || "Standard Configuration"), specificationSummary: String(details.spec_summary || "Legacy quotation item"), dimensionsFormatted: String(details.dimensions_formatted || "Dimensions unavailable"), widthMm: Number(details.width_mm || 1), heightMm: Number(details.height_mm || 1), panelCount: Number(details.panel_count || 1), hasSill: details.has_sill !== false, structuralWaiver: Boolean(details.structural_waiver), finishLabel: String(details.finish_type || "Not recorded"), glassLabel: String(details.glass_type || "Not recorded"), quantity, unitPrice: subtotal / quantity, calculatedSubtotal: subtotal, imageSource: typeof details.image_url === "string" ? details.image_url : null, groups: rows.map((row) => ({ groupName: row.item_group_name || row.item_name, description: row.item_name, quantity: Number(row.quantity), unit: row.unit, unitPrice: Number(row.unit_price), subtotal: Number(row.estimated_subtotal) })) };
  });
  const pricing = { directMaterialsSubtotal: usable.filter((r) => !r.item_name.includes("Labor")).reduce((s, r) => s + Number(r.estimated_subtotal), 0), laborSubtotal: usable.filter((r) => r.item_name.includes("Labor")).reduce((s, r) => s + Number(r.estimated_subtotal), 0), contractorMargin: 0, calculatedFinalPrice: input.totalEstimatedAmount };
  return QuotationDocumentSnapshotV1Schema.parse({ schemaVersion: 1, quotationNumber: input.quotationNumber, referenceCode: input.referenceCode, shareablePath: `/q/${input.referenceCode}`, createdAt: input.createdAt, customer: input.customer, projectName: items.length > 1 ? `${items.length} Architectural Fixtures` : items[0].productName, snapshotObjectKey: input.snapshotObjectKey, hasSill: items.some((item) => item.hasSill), structuralWaiver: items.some((item) => item.structuralWaiver), items, pricing });
}
