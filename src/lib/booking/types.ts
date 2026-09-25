/**
 * GlassFit Consultation Booking & Signed Link Schemas (MS-7)
 *
 * Upstream Specifications: docs/sdd-glassfit.md (Contract 2), docs/erd-glassfit.md (ERD-E15, ERD-E16),
 * docs/prd-glassfit.md (PRD-F12, PRD-F13), docs/milestone.md (MS-7).
 * Traceability Codes: PRD-F12, PRD-F13, SDD-C8, ERD-E15, ERD-E16, QAD-TC12, QAD-TC13, BAN-TYPE-05
 */

import { z } from "zod";
import { QuotationDocumentDraftV1Schema, QuotationDocumentSnapshotV1Schema } from "@/lib/pricing/quotationDocument";

// ----------------------------------------------------------------------------
// 1. Booking Request Platform & Status Enums
// ----------------------------------------------------------------------------

export const BookingPlatformSchema = z.enum(["Messenger", "Viber"]);
export type BookingPlatform = z.infer<typeof BookingPlatformSchema>;

export const BookingRequestStatusSchema = z.enum([
  "Pending",
  "Ongoing",
  "Done",
  "Cancelled",
]);
export type BookingRequestStatus = z.infer<typeof BookingRequestStatusSchema>;

export const SignedLinkStatusSchema = z.enum([
  "Active",
  "Expired",
  "Revoked",
  "Used",
]);
export type SignedLinkStatus = z.infer<typeof SignedLinkStatusSchema>;

// ----------------------------------------------------------------------------
// 2. Input / Output Schemas for Generating Signed Links
// ----------------------------------------------------------------------------

export const ItemizedProductQuotationInputSchema = z.object({
  itemId: z.string(),
  productId: z.string().optional(),
  productName: z.string(),
  productType: z.string().default("Window & Door"),
  variantName: z.string().optional(),
  specSummary: z.string().optional(),
  dimensionsFormatted: z.string().optional(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  panelCount: z.number().int().positive().default(2),
  hasSill: z.boolean().default(true),
  structuralWaiver: z.boolean().default(false),
  finishType: z.string().default("Analok"),
  glassType: z.string().default("6mm_bronze"),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
  imageUrl: z.string().optional(),
  bomResult: z.unknown().optional(),
});
export type ItemizedProductQuotationInput = z.infer<typeof ItemizedProductQuotationInputSchema>;

export const GenerateBookingLinkInputSchema = z.object({
  quotationId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  productName: z.string().min(1).default("Series 798 Sliding Window"),
  productType: z.string().default("Sliding Window"),
  widthMm: z.number().positive().optional().default(1200),
  heightMm: z.number().positive().optional().default(1200),
  panelCount: z.number().int().positive().default(2),
  hasSill: z.boolean().default(true),
  finishType: z.string().default("Analok"),
  glassType: z.string().default("6mm_bronze"),
  structuralWaiver: z.boolean().default(false),
  finalSnapshotDataUrl: z.string().nullable().optional(),
  items: z.array(ItemizedProductQuotationInputSchema).optional(),
  totalEstimatedAmount: z.number().nonnegative().optional(),
  quotationDocument: QuotationDocumentDraftV1Schema.optional(),
});
export type GenerateBookingLinkInput = z.infer<typeof GenerateBookingLinkInputSchema>;

export const GeneratedBookingLinkResultSchema = z.object({
  linkId: z.string().uuid(),
  quotationId: z.string().uuid(),
  quotationNumber: z.string(),
  referenceCode: z.string(),
  tokenHash: z.string().regex(/^[0-9a-fA-F]{64}$/),
  signedUrl: z.string(),
  shareableUrl: z.string().default(""),
  displayLink: z.string(),
  displayBadge: z.string().default(""),
  expiresAt: z.string(),
  totalEstimatedAmount: z.number().nonnegative(),
  hasStructuralWaiver: z.boolean(),
  quotationDocument: QuotationDocumentSnapshotV1Schema.optional(),
});
export type GeneratedBookingLinkResult = z.infer<typeof GeneratedBookingLinkResultSchema>;

// ----------------------------------------------------------------------------
// 3. Input / Output Schemas for Booking Requests
// ----------------------------------------------------------------------------

export const RecordBookingRequestInputSchema = z.object({
  linkId: z.string().uuid(),
  platform: BookingPlatformSchema,
});
export type RecordBookingRequestInput = z.infer<typeof RecordBookingRequestInputSchema>;

export const RecordBookingRequestResultSchema = z.object({
  bookingRequestId: z.string().uuid(),
  status: BookingRequestStatusSchema,
  selectedPlatform: BookingPlatformSchema,
  createdAt: z.string(),
});
export type RecordBookingRequestResult = z.infer<typeof RecordBookingRequestResultSchema>;

// ----------------------------------------------------------------------------
// 4. Public Reference View Schema (/q/[code])
// ----------------------------------------------------------------------------

export const PublicQuotationItemSchema = z.object({
  itemId: z.string(),
  productId: z.string().optional(),
  productName: z.string(),
  productType: z.string().default("Window & Door"),
  variantName: z.string().optional(),
  specSummary: z.string().optional(),
  dimensionsFormatted: z.string().optional(),
  widthMm: z.number(),
  heightMm: z.number(),
  panelCount: z.number(),
  hasSill: z.boolean(),
  structuralWaiver: z.boolean(),
  finishType: z.string(),
  glassType: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  totalPrice: z.number(),
  imageUrl: z.string().nullable().optional(),
});
export type PublicQuotationItem = z.infer<typeof PublicQuotationItemSchema>;

export const PublicQuotationSummarySchema = z.object({
  referenceCode: z.string(),
  quotationNumber: z.string(),
  customerName: z.string(),
  productName: z.string(),
  productType: z.string(),
  widthMm: z.number(),
  heightMm: z.number(),
  panelCount: z.number(),
  hasSill: z.boolean(),
  finishType: z.string(),
  glassType: z.string(),
  structuralWaiver: z.boolean(),
  totalEstimatedAmount: z.number(),
  calculatedFinalPrice: z.number().default(0),
  negotiatedFinalPrice: z.number().nullable().default(null),
  effectiveFinalPrice: z.number().default(0),
  isPriceModified: z.boolean().default(false),
  createdAtFormatted: z.string(),
  expiresAtFormatted: z.string(),
  isExpired: z.boolean().default(false),
  snapshotImageUrl: z.string().nullable(),
  status: SignedLinkStatusSchema,
  isMultiProduct: z.boolean().default(false),
  items: z.array(PublicQuotationItemSchema).optional(),
  consolidatedMetrics: z
    .object({
      totalQuantity: z.number(),
      totalFramingMeters: z.number(),
      totalGlazingSqm: z.number(),
      totalLaborCost: z.number(),
    })
    .optional(),
  groups: z.array(
    z.object({
      item_group_name: z.string(),
      quantity: z.number(),
      unit_label: z.string(),
      unit_price: z.number(),
      estimated_subtotal: z.number(),
      product_name: z.string().optional(),
    })
  ),
});
export type PublicQuotationSummary = z.infer<typeof PublicQuotationSummarySchema>;

// ----------------------------------------------------------------------------
// 5. Admin Status Update Schema
// ----------------------------------------------------------------------------

export const UpdateBookingStatusInputSchema = z.object({
  bookingRequestId: z.string().uuid(),
  status: z.enum(["Pending", "Ongoing", "Done", "Cancelled"]),
});
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusInputSchema>;

export const UpdateNegotiatedPriceInputSchema = z.object({
  quotationId: z.string().uuid(),
  negotiatedAmount: z.number().finite().min(0).max(9_999_999_999.99).nullable().refine(
    (value) => value === null || Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
    "Negotiated amount must have at most two decimal places",
  ),
  expectedUpdatedAt: z.string().datetime(),
});
export type UpdateNegotiatedPriceInput = z.infer<typeof UpdateNegotiatedPriceInputSchema>;
export type UpdateNegotiatedPriceResult =
  | { ok: true; quotationId: string; calculatedFinalPrice: number; negotiatedFinalPrice: number | null; effectiveFinalPrice: number; isPriceModified: boolean; negotiatedBy: string | null; negotiatedAt: string | null; updatedAt: string }
  | { ok: false; code: "VALIDATION_ERROR" | "NOT_FOUND" | "UNSUPPORTED_QUOTATION" | "CONFLICT" | "PERSISTENCE_ERROR"; message: string };

export const UpdateItemNegotiatedPriceInputSchema = z.object({
  quotationId: z.string().uuid(), itemId: z.string().trim().min(1),
  negotiatedSubtotal: z.number().finite().min(0).max(9_999_999_999.99).nullable().refine(
    (value) => value === null || Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
    "Negotiated subtotal must have at most two decimal places",
  ),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});
export type UpdateItemNegotiatedPriceInput = z.infer<typeof UpdateItemNegotiatedPriceInputSchema>;
export type UpdateItemNegotiatedPriceResult =
  | { ok: true; quotationId: string; item: import("@/lib/pricing/quotationDocument").ItemPricingView; pricing: import("@/lib/pricing/quotationDocument").QuotationPricingView; negotiatedBy: string | null; negotiatedAt: string | null; updatedAt: string }
  | { ok: false; code: "VALIDATION_ERROR" | "NOT_FOUND" | "ITEM_NOT_FOUND" | "UNSUPPORTED_QUOTATION" | "CONFLICT" | "PERSISTENCE_ERROR"; message: string };

// ----------------------------------------------------------------------------
// 6. Admin relational query contracts (IMP-MS15, QAD-TC29)
// ----------------------------------------------------------------------------

export type BookingDatabaseStatus = z.infer<typeof BookingRequestStatusSchema>;

export interface RawQuotationItemRecord {
  item_name: string;
  item_group_name?: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  estimated_subtotal?: number;
  pricing_details: Record<string, unknown> | null;
}

export interface RawQuotationEstimateRecord {
  quotation_id: string;
  quotation_number: string;
  pdf_r2_object_key: string | null;
  created_at: string;
  updated_at: string;
  total_estimated_amount: number;
  negotiated_amount: number | null;
  negotiated_by: string | null;
  negotiated_at: string | null;
  item_price_overrides?: unknown | null;
  quotation_document_snapshot: unknown | null;
  quotation_items: RawQuotationItemRecord[];
}

export interface RawSignedBookingLinkRecord {
  quotation: RawQuotationEstimateRecord | null;
}

export interface RawProfileRecord {
  full_name: string | null;
  email: string | null;
  contact_number: string | null;
}

export interface BookingRequestWithRelationsRow {
  booking_request_id: string;
  status: BookingDatabaseStatus;
  created_at: string;
  selected_platform: BookingPlatform;
  booking_link: RawSignedBookingLinkRecord | null;
  customer: RawProfileRecord | null;
}

export interface DashboardRecentBookingRow {
  booking_request_id: string;
  status: BookingDatabaseStatus;
  customer: { full_name: string | null } | null;
  booking_link: {
    quotation: {
      quotation_items: RawQuotationItemRecord[];
    } | null;
  } | null;
}
