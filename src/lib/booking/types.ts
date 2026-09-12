/**
 * GlassFit Consultation Booking & Signed Link Schemas (MS-7)
 *
 * Upstream Specifications: docs/sdd-glassfit.md (Contract 2), docs/erd-glassfit.md (ERD-E15, ERD-E16),
 * docs/prd-glassfit.md (PRD-F12, PRD-F13), docs/milestone.md (MS-7).
 * Traceability Codes: PRD-F12, PRD-F13, SDD-C8, ERD-E15, ERD-E16, QAD-TC12, QAD-TC13, BAN-TYPE-05
 */

import { z } from "zod";

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

export const GenerateBookingLinkInputSchema = z.object({
  quotationId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  productName: z.string().min(1).default("Series 798 Sliding Window"),
  productType: z.string().default("Sliding Window"),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  panelCount: z.number().int().positive().default(2),
  hasSill: z.boolean().default(true),
  finishType: z.string().default("Analok"),
  glassType: z.string().default("6mm_bronze"),
  structuralWaiver: z.boolean().default(false),
  finalSnapshotDataUrl: z.string().nullable().optional(),
});
export type GenerateBookingLinkInput = z.infer<typeof GenerateBookingLinkInputSchema>;

export const GeneratedBookingLinkResultSchema = z.object({
  linkId: z.string().uuid(),
  quotationId: z.string().uuid(),
  quotationNumber: z.string(),
  referenceCode: z.string(),
  tokenHash: z.string().regex(/^[0-9a-fA-F]{64}$/),
  signedUrl: z.string(),
  displayLink: z.string(),
  expiresAt: z.string(),
  totalEstimatedAmount: z.number().nonnegative(),
  hasStructuralWaiver: z.boolean(),
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
  createdAtFormatted: z.string(),
  expiresAtFormatted: z.string(),
  snapshotImageUrl: z.string().nullable(),
  status: SignedLinkStatusSchema,
  groups: z.array(
    z.object({
      item_group_name: z.string(),
      quantity: z.number(),
      unit_label: z.string(),
      unit_price: z.number(),
      estimated_subtotal: z.number(),
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
