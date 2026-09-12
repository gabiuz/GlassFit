"use server";

/**
 * GlassFit Consultation Booking & Signed Link Server Actions (MS-7)
 *
 * Implements server-side SHA-256 token-hashed reference link generation,
 * consultation booking logging, public quotation retrieval, and admin status updates.
 *
 * Upstream Specifications: docs/sdd-glassfit.md (Contract 2), docs/erd-glassfit.md (ERD-E15, ERD-E16),
 * docs/prd-glassfit.md (PRD-F12, PRD-F13), docs/milestone.md (MS-7).
 * Traceability Codes: PRD-F12, PRD-F13, SDD-C8, ERD-E15, ERD-E16, QAD-TC12, QAD-TC13, BAN-TYPE-05
 */

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requirePermission } from "@/lib/auth/admin";
import { calculateStandardSeries798, generateQuotationSnapshot } from "@/lib/pricing/pricingEngine";
import {
  GenerateBookingLinkInputSchema,
  RecordBookingRequestInputSchema,
  UpdateBookingStatusInputSchema,
  type GenerateBookingLinkInput,
  type GeneratedBookingLinkResult,
  type RecordBookingRequestInput,
  type RecordBookingRequestResult,
  type PublicQuotationSummary,
  type UpdateBookingStatusInput,
} from "./types";

/**
 * Generates a signed consultation booking reference link backed by public.signed_booking_links.
 * Ensures an active snapshot and quotation estimate exist, generates a 64-hex SHA-256 token,
 * and sets a 7-day expiration timestamp.
 */
export async function generateSignedBookingLink(
  input: GenerateBookingLinkInput
): Promise<GeneratedBookingLinkResult> {
  const validated = GenerateBookingLinkInputSchema.parse(input);
  const supabase = await createSupabaseServerClient();

  // 1. Verify authenticated customer session
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Authentication required to generate consultation booking link.");
  }

  const profileId = user.id;

  // 2. Compute accurate Parametric BOM quotation
  const finishType = validated.finishType === "white" || validated.finishType === "PowderCoatedWhite"
    ? "PowderCoatedWhite"
    : "Analok";
  const glassType = validated.glassType === "6mm_clear" ? "6mm_clear" : "6mm_bronze";

  const bomResult = calculateStandardSeries798({
    widthMm: validated.widthMm,
    heightMm: validated.heightMm,
    panelCount: validated.panelCount,
    hasSill: validated.hasSill,
    finishType,
    glassType,
    structuralWaiver: validated.structuralWaiver,
  });

  // Use service client for atomic database operations
  const serviceClient = createSupabaseServiceClient();

  // 3. Ensure a visualization_snapshots record exists for this consultation
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const dateYear = new Date().getFullYear();
  const snapshotObjectKey = `snapshots/${profileId}/${Date.now()}_consultation.webp`;

  const { data: snapshotData, error: snapshotError } = await serviceClient
    .from("visualization_snapshots")
    .insert({
      profile_id: profileId,
      final_image_r2_key: snapshotObjectKey,
    })
    .select("snapshot_id")
    .single();

  if (snapshotError || !snapshotData) {
    console.error("Failed to insert visualization snapshot:", snapshotError);
    throw new Error(`Failed to record visualization snapshot: ${snapshotError?.message}`);
  }

  const snapshotId = snapshotData.snapshot_id;

  // 4. Generate unique Quotation Number and Reference Code
  const quotationNumber = `Q-${dateYear}-${randomSuffix}`;
  const referenceCode = `CF-${dateYear}-${randomSuffix}`;
  const pdfObjectKey = `quotations/${quotationNumber}/GlassFit_Quotation_${quotationNumber}.pdf`;

  // 5. Insert quotation_estimates row
  const { data: quotationData, error: quotationError } = await serviceClient
    .from("quotation_estimates")
    .insert({
      snapshot_id: snapshotId,
      profile_id: profileId,
      quotation_number: quotationNumber,
      total_estimated_amount: bomResult.finalQuotation,
      currency: "PHP",
      quotation_note: validated.structuralWaiver
        ? "Customer acknowledged NSCP 2015 Structural Span Waiver (Aperture >= 2400mm)"
        : "Standard compliant consultation estimate",
      pdf_r2_object_key: pdfObjectKey,
      status: "Generated",
    })
    .select("quotation_id")
    .single();

  if (quotationError || !quotationData) {
    console.error("Failed to insert quotation estimate:", quotationError);
    throw new Error(`Failed to create quotation estimate: ${quotationError?.message}`);
  }

  const quotationId = quotationData.quotation_id;

  // 6. Insert itemized 4-group quotation_items
  const snapshotSummary = generateQuotationSnapshot(quotationId, bomResult, {
    structuralWaiver: validated.structuralWaiver,
  });

  const quotationItemRows = snapshotSummary.groups.map((group, idx) => ({
    quotation_id: quotationId,
    item_name: group.item_group_name,
    quantity: group.quantity,
    unit: group.unit_label,
    unit_price: group.unit_price,
    estimated_subtotal: group.estimated_subtotal,
    pricing_details: group.pricing_details,
    display_order: idx + 1,
  }));

  const { error: itemsError } = await serviceClient
    .from("quotation_items")
    .insert(quotationItemRows);

  if (itemsError) {
    console.error("Failed to insert quotation items:", itemsError);
    throw new Error(`Failed to insert quotation line items: ${itemsError.message}`);
  }

  // 7. Generate Cryptographic SHA-256 Token and calculate 7-day expiration
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const expiresDate = new Date();
  expiresDate.setDate(expiresDate.getDate() + 7);
  const expiresAt = expiresDate.toISOString();

  // 8. Insert signed_booking_links record
  const { data: linkData, error: linkError } = await serviceClient
    .from("signed_booking_links")
    .insert({
      profile_id: profileId,
      quotation_id: quotationId,
      snapshot_id: snapshotId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      status: "Active",
    })
    .select("link_id")
    .single();

  if (linkError || !linkData) {
    console.error("Failed to create signed booking link:", linkError);
    throw new Error(`Failed to create signed booking link: ${linkError?.message}`);
  }

  const linkId = linkData.link_id;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://glassfit.ph";
  const signedUrl = `${baseUrl}/q/${tokenHash}`;
  const displayLink = `glassfit.ph/q/${referenceCode.toLowerCase()}`;

  revalidatePath("/admin/bookings");
  revalidatePath("/dashboard");

  return {
    linkId,
    quotationId,
    quotationNumber,
    referenceCode,
    tokenHash,
    signedUrl,
    displayLink,
    expiresAt,
    totalEstimatedAmount: bomResult.finalQuotation,
    hasStructuralWaiver: validated.structuralWaiver,
  };
}

/**
 * Records customer handoff to Messenger or Viber in public.booking_requests.
 */
export async function recordBookingRequest(
  input: RecordBookingRequestInput
): Promise<RecordBookingRequestResult> {
  const validated = RecordBookingRequestInputSchema.parse(input);
  const supabase = await createSupabaseServerClient();

  // Verify authenticated customer session
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Authentication required to submit consultation request.");
  }

  const profileId = user.id;
  const serviceClient = createSupabaseServiceClient();

  // Check if a booking request already exists for this link_id
  const { data: existingBooking } = await serviceClient
    .from("booking_requests")
    .select("booking_request_id, status, created_at")
    .eq("link_id", validated.linkId)
    .single();

  if (existingBooking) {
    // Update platform and status
    const { data: updated, error: updateError } = await serviceClient
      .from("booking_requests")
      .update({
        selected_platform: validated.platform,
        status: "Pending",
        updated_at: new Date().toISOString(),
      })
      .eq("booking_request_id", existingBooking.booking_request_id)
      .select("booking_request_id, status, selected_platform, created_at")
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to update booking request: ${updateError?.message}`);
    }

    revalidatePath("/admin/bookings");
    revalidatePath("/dashboard");

    return {
      bookingRequestId: updated.booking_request_id,
      status: updated.status as RecordBookingRequestResult["status"],
      selectedPlatform: updated.selected_platform as RecordBookingRequestResult["selectedPlatform"],
      createdAt: updated.created_at,
    };
  }

  // Insert new booking request
  const { data: created, error: insertError } = await serviceClient
    .from("booking_requests")
    .insert({
      profile_id: profileId,
      link_id: validated.linkId,
      selected_platform: validated.platform,
      status: "Pending",
    })
    .select("booking_request_id, status, selected_platform, created_at")
    .single();

  if (insertError || !created) {
    console.error("Failed to record booking request:", insertError);
    throw new Error(`Failed to record booking request: ${insertError?.message}`);
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/dashboard");

  return {
    bookingRequestId: created.booking_request_id,
    status: created.status as RecordBookingRequestResult["status"],
    selectedPlatform: created.selected_platform as RecordBookingRequestResult["selectedPlatform"],
    createdAt: created.created_at,
  };
}

/**
 * Public consultation reference resolver for `/q/[code]`.
 * Looks up by token_hash or reference code.
 */
export async function getPublicBookingReference(
  codeOrHash: string
): Promise<PublicQuotationSummary | null> {
  const serviceClient = createSupabaseServiceClient();

  const isHash = /^[0-9a-fA-F]{64}$/.test(codeOrHash);

  let query = serviceClient
    .from("signed_booking_links")
    .select(`
      link_id,
      token_hash,
      status,
      expires_at,
      created_at,
      profiles (
        full_name,
        email,
        contact_number
      ),
      quotation_estimates!inner (
        quotation_id,
        quotation_number,
        total_estimated_amount,
        created_at,
        quotation_items (
          item_name,
          quantity,
          unit,
          unit_price,
          estimated_subtotal,
          pricing_details
        )
      )
    `);

  if (isHash) {
    query = query.eq("token_hash", codeOrHash);
  } else {
    // Lookup by quotation number format or reference code
    const cleanCode = codeOrHash.toUpperCase();
    const formattedQuoteNo = cleanCode.startsWith("CF-")
      ? cleanCode.replace("CF-", "Q-")
      : cleanCode.startsWith("Q-")
      ? cleanCode
      : `Q-${cleanCode}`;

    query = query.eq("quotation_estimates.quotation_number", formattedQuoteNo);
  }

  const { data: linkRecord, error } = await query.single();

  if (error || !linkRecord) {
    return null;
  }

  const profile = Array.isArray(linkRecord.profiles) ? linkRecord.profiles[0] : linkRecord.profiles;
  const quote = Array.isArray(linkRecord.quotation_estimates)
    ? linkRecord.quotation_estimates[0]
    : linkRecord.quotation_estimates;

  if (!quote) return null;

  const rawItems = Array.isArray(quote.quotation_items) ? quote.quotation_items : [];
  const pricingDetails = rawItems[0]?.pricing_details as Record<string, unknown> | undefined;

  const widthM = typeof pricingDetails?.width_m === "number" ? pricingDetails.width_m : 1.2;
  const heightM = typeof pricingDetails?.height_m === "number" ? pricingDetails.height_m : 1.2;
  const panelCount = typeof pricingDetails?.panel_count === "number" ? pricingDetails.panel_count : 2;
  const hasSill = typeof pricingDetails?.has_sill === "boolean" ? pricingDetails.has_sill : true;
  const finishType = typeof pricingDetails?.finish_type === "string" ? pricingDetails.finish_type : "Analok";
  const glassType = typeof pricingDetails?.glass_type === "string" ? pricingDetails.glass_type : "6mm_bronze";
  const structuralWaiver = panelCount === 2 && Math.round(widthM * 1000) >= 2400;

  const referenceCode = quote.quotation_number.replace("Q-", "CF-");

  const createdDate = new Date(linkRecord.created_at);
  const expiresDate = new Date(linkRecord.expires_at);

  const createdAtFormatted = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(createdDate);

  const expiresAtFormatted = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(expiresDate);

  return {
    referenceCode,
    quotationNumber: quote.quotation_number,
    customerName: profile?.full_name || "Valued Customer",
    productName: "Series 798 Sliding Window",
    productType: "Sliding Window",
    widthMm: Math.round(widthM * 1000),
    heightMm: Math.round(heightM * 1000),
    panelCount,
    hasSill,
    finishType,
    glassType,
    structuralWaiver,
    totalEstimatedAmount: Number(quote.total_estimated_amount),
    createdAtFormatted,
    expiresAtFormatted,
    snapshotImageUrl: null,
    status: linkRecord.status as PublicQuotationSummary["status"],
    groups: rawItems.map((item: { item_name: string; quantity: number; unit: string; unit_price: number; estimated_subtotal: number }) => ({
      item_group_name: item.item_name,
      quantity: Number(item.quantity),
      unit_label: item.unit,
      unit_price: Number(item.unit_price),
      estimated_subtotal: Number(item.estimated_subtotal),
    })),
  };
}

/**
 * Admin action to triage and update booking request statuses.
 */
export async function updateBookingRequestStatus(
  input: UpdateBookingStatusInput
): Promise<{ success: boolean; status: string }> {
  const adminCtx = await requirePermission("manage_bookings");
  const validated = UpdateBookingStatusInputSchema.parse(input);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("booking_requests")
    .update({
      status: validated.status,
      updated_by: adminCtx.profileId,
      updated_at: new Date().toISOString(),
    })
    .eq("booking_request_id", validated.bookingRequestId);

  if (error) {
    console.error("Failed to update booking request status:", error);
    throw new Error(`Failed to update booking status: ${error.message}`);
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/dashboard");

  return { success: true, status: validated.status };
}
