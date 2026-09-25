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
import { deriveQuotationPricing, QuotationDocumentSnapshotV1Schema } from "@/lib/pricing/quotationDocument";
import { getServerBaseUrl, generateBookingUrls } from "./urlResolver";
import { uploadSnapshotImage, resolveSnapshotUrl } from "./snapshotStorage";
import { BOOKING_REVALIDATION_PATHS } from "./bookingRevalidationPaths";
import {
  GenerateBookingLinkInputSchema,
  RecordBookingRequestInputSchema,
  UpdateBookingStatusInputSchema,
  UpdateNegotiatedPriceInputSchema,
  type GenerateBookingLinkInput,
  type GeneratedBookingLinkResult,
  type RecordBookingRequestInput,
  type RecordBookingRequestResult,
  type PublicQuotationSummary,
  type UpdateBookingStatusInput,
  type UpdateNegotiatedPriceInput,
  type UpdateNegotiatedPriceResult,
} from "./types";

function revalidateBookingPaths(): void {
  for (const path of BOOKING_REVALIDATION_PATHS) revalidatePath(path);
}

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

  // Use service client for atomic database operations
  const serviceClient = createSupabaseServiceClient();

  // 2. Ensure a visualization_snapshots record exists for this consultation
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const dateYear = new Date().getFullYear();
  const snapshotId = crypto.randomUUID();

  let snapshotObjectKey = `snapshots/${profileId}/${snapshotId}.webp`;
  if (validated.finalSnapshotDataUrl) {
    snapshotObjectKey = await uploadSnapshotImage(
      validated.finalSnapshotDataUrl,
      profileId,
      snapshotId
    );
  }

  const { data: snapshotData, error: snapshotError } = await serviceClient
    .from("visualization_snapshots")
    .insert({
      snapshot_id: snapshotId,
      profile_id: profileId,
      final_image_r2_key: snapshotObjectKey,
    })
    .select("snapshot_id")
    .single();

  if (snapshotError || !snapshotData) {
    console.error("Failed to insert visualization snapshot:", snapshotError);
    throw new Error(`Failed to record visualization snapshot: ${snapshotError?.message}`);
  }

  // 3. Generate unique Quotation Number and Reference Code
  const quotationNumber = `Q-${dateYear}-${randomSuffix}`;
  const referenceCode = `CF-${dateYear}-${randomSuffix}`;
  const pdfObjectKey = `quotations/${quotationNumber}/GlassFit_Quotation_${quotationNumber}.pdf`;
  const quotationId = crypto.randomUUID();

  if (!validated.quotationDocument) {
    throw new Error("A canonical quotation document is required.");
  }

  const quotationDocument = QuotationDocumentSnapshotV1Schema.parse({
    ...validated.quotationDocument,
    quotationNumber,
    referenceCode,
    shareablePath: `/q/${referenceCode}`,
    createdAt: new Date().toISOString(),
    snapshotObjectKey,
  });
  const totalEstimatedAmount = quotationDocument.pricing.calculatedFinalPrice;
  const hasAnyStructuralWaiver = quotationDocument.structuralWaiver;
  const quotationNote = hasAnyStructuralWaiver
    ? "Customer acknowledged structural span waiver"
    : "Standard compliant consultation estimate";
  const quotationItemRows: Array<{
    quotation_id: string;
    item_name: string;
    item_group_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    estimated_subtotal: number;
    pricing_details: Record<string, unknown>;
    display_order: number;
    structural_waiver: boolean;
  }> = [];

  let displayOrder = 1;
  for (const [idx, item] of quotationDocument.items.entries()) {
    for (const group of item.groups) {
        quotationItemRows.push({
          quotation_id: quotationId,
          item_name: `${item.productName} (${group.description})`,
          item_group_name: group.groupName,
          quantity: group.quantity * item.quantity,
          unit: group.unit,
          unit_price: group.unitPrice,
          estimated_subtotal: group.subtotal * item.quantity,
          structural_waiver: item.structuralWaiver,
          pricing_details: {
            item_index: idx + 1,
            item_id: item.itemId,
            product_id: item.productId,
            product_name: item.productName,
            product_type: item.productType,
            variant_name: item.variantName,
            spec_summary: item.specificationSummary,
            dimensions_formatted: item.dimensionsFormatted,
            width_mm: item.widthMm,
            height_mm: item.heightMm,
            panel_count: item.panelCount,
            has_sill: item.hasSill,
            finish_type: item.finishLabel,
            glass_type: item.glassLabel,
            item_quantity: item.quantity,
            item_unit_price: item.unitPrice,
            item_total_price: item.calculatedSubtotal,
            structural_waiver: item.structuralWaiver,
            image_url: item.imageSource,
            is_multi_product: quotationDocument.items.length > 1,
          },
          display_order: displayOrder++,
        });
    }
  }

  // 4. Insert quotation_estimates row
  const { data: quotationData, error: quotationError } = await serviceClient
    .from("quotation_estimates")
    .insert({
      quotation_id: quotationId,
      snapshot_id: snapshotId,
      profile_id: profileId,
      quotation_number: quotationNumber,
      total_estimated_amount: totalEstimatedAmount,
      currency: "PHP",
      quotation_note: quotationNote,
      pdf_r2_object_key: pdfObjectKey,
      status: "Generated",
      quotation_document_snapshot: quotationDocument,
    })
    .select("quotation_id")
    .single();

  if (quotationError || !quotationData) {
    console.error("Failed to insert quotation estimate:", quotationError);
    throw new Error(`Failed to create quotation estimate: ${quotationError?.message}`);
  }

  // 5. Insert itemized quotation_items
  const { error: itemsError } = await serviceClient
    .from("quotation_items")
    .insert(quotationItemRows);

  if (itemsError) {
    console.error("Failed to insert quotation items:", itemsError);
    throw new Error(`Failed to insert quotation line items: ${itemsError.message}`);
  }

  // 6. Generate Cryptographic SHA-256 Token and calculate 7-day expiration
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const expiresDate = new Date();
  expiresDate.setDate(expiresDate.getDate() + 7);
  const expiresAt = expiresDate.toISOString();

  // 7. Insert signed_booking_links record
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
  const baseUrl = await getServerBaseUrl();
  const urls = generateBookingUrls(referenceCode, tokenHash, baseUrl);

  revalidatePath("/admin/bookings");
  revalidatePath("/dashboard");

  return {
    linkId,
    quotationId,
    quotationNumber,
    referenceCode,
    tokenHash,
    signedUrl: urls.tokenUrl,
    shareableUrl: urls.shareableUrl,
    displayLink: urls.displayBadge,
    displayBadge: urls.displayBadge,
    expiresAt,
    totalEstimatedAmount,
    hasStructuralWaiver: hasAnyStructuralWaiver,
    quotationDocument,
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

    revalidateBookingPaths();

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

  for (const path of BOOKING_REVALIDATION_PATHS) revalidatePath(path);

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

  const trimmed = (codeOrHash || "").trim();
  if (!trimmed) {
    return null;
  }

  const isHash = /^[0-9a-fA-F]{64}$/.test(trimmed);

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
      visualization_snapshots (
        snapshot_id,
        final_image_r2_key
      ),
      quotation_estimates!inner (
        quotation_id,
        quotation_number,
        total_estimated_amount,
        negotiated_amount,
        quotation_document_snapshot,
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
    query = query.eq("token_hash", trimmed);
  } else {
    // Lookup by quotation number format or reference code
    const cleanCode = trimmed.toUpperCase();
    const formattedQuoteNo = cleanCode.startsWith("CF-")
      ? cleanCode.replace("CF-", "Q-")
      : cleanCode.startsWith("Q-")
      ? cleanCode
      : `Q-${cleanCode}`;

    query = query.eq("quotation_estimates.quotation_number", formattedQuoteNo);
  }

  const { data: linkRecord, error } = await query.maybeSingle();

  if (error || !linkRecord) {
    return null;
  }

  const profile = Array.isArray(linkRecord.profiles) ? linkRecord.profiles[0] : linkRecord.profiles;
  const quote = Array.isArray(linkRecord.quotation_estimates)
    ? linkRecord.quotation_estimates[0]
    : linkRecord.quotation_estimates;

  if (!quote) return null;

  const snapshot = Array.isArray(linkRecord.visualization_snapshots)
    ? linkRecord.visualization_snapshots[0]
    : linkRecord.visualization_snapshots;

  const snapshotImageUrl = snapshot?.final_image_r2_key
    ? resolveSnapshotUrl(snapshot.final_image_r2_key)
    : null;

  const rawItems = Array.isArray(quote.quotation_items) ? quote.quotation_items : [];

  // Parse multi-product items and aggregated metrics from quotation_items pricing_details
  const itemsMap = new Map<string, {
    itemId: string;
    productId?: string;
    productName: string;
    productType: string;
    variantName?: string;
    specSummary?: string;
    dimensionsFormatted?: string;
    widthMm: number;
    heightMm: number;
    panelCount: number;
    hasSill: boolean;
    structuralWaiver: boolean;
    finishType: string;
    glassType: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    imageUrl?: string | null;
  }>();

  let totalFramingMeters = 0;
  let totalGlazingSqm = 0;
  let totalLaborCost = 0;
  let totalQuantity = 0;
  let hasAnyMultiWaiver = false;

  for (const row of rawItems) {
    const details = row?.pricing_details as Record<string, unknown> | undefined;
    if (details) {
      const isMultiItem = details.is_multi_product || details.product_name || details.item_id || details.item_index;
      if (isMultiItem) {
        const itemKey = String(details.item_id || details.item_index || details.product_name || row.item_name);
        if (!itemsMap.has(itemKey)) {
          const pName = String(details.product_name || row.item_name || "Custom Architectural Fixture");
          const pType = String(details.product_type || "Window & Door");
          const wMm = typeof details.width_mm === "number"
            ? details.width_mm
            : typeof details.width_m === "number"
            ? Math.round(details.width_m * 1000)
            : 1200;
          const hMm = typeof details.height_mm === "number"
            ? details.height_mm
            : typeof details.height_m === "number"
            ? Math.round(details.height_m * 1000)
            : 1200;
          const pCount = typeof details.panel_count === "number" ? details.panel_count : 2;
          const sill = typeof details.has_sill === "boolean" ? details.has_sill : true;
          const waiver = Boolean(details.structural_waiver);
          const finish = String(details.finish_type || "Analok");
          const glass = String(details.glass_type || "6mm_bronze");
          const qty = typeof details.item_quantity === "number" ? details.item_quantity : 1;
          const uPrice = typeof details.item_unit_price === "number" ? details.item_unit_price : Number(row.unit_price);
          const tPrice = typeof details.item_total_price === "number" ? details.item_total_price : uPrice * qty;
          const img = typeof details.image_url === "string" ? details.image_url : null;
          const specSummary = String(details.spec_summary || `${finish} | ${wMm / 10}cm × ${hMm / 10}cm`);
          const dimsFormatted = String(details.dimensions_formatted || `${wMm / 10}cm × ${hMm / 10}cm`);

          if (waiver) hasAnyMultiWaiver = true;
          totalQuantity += qty;

          itemsMap.set(itemKey, {
            itemId: itemKey,
            productId: typeof details.product_id === "string" ? details.product_id : undefined,
            productName: pName,
            productType: pType,
            variantName: typeof details.variant_name === "string" ? details.variant_name : `${pCount}-Panel Configuration`,
            specSummary,
            dimensionsFormatted: dimsFormatted,
            widthMm: wMm,
            heightMm: hMm,
            panelCount: pCount,
            hasSill: sill,
            structuralWaiver: waiver,
            finishType: finish,
            glassType: glass,
            quantity: qty,
            unitPrice: uPrice,
            totalPrice: tPrice,
            imageUrl: img,
          });
        }
      }
    }

    if (row.unit === "m" || row.item_name?.includes("Framing")) {
      totalFramingMeters += Number(row.quantity) || 0;
    } else if (row.unit === "sqm" || row.item_name?.includes("Glass")) {
      totalGlazingSqm += Number(row.quantity) || 0;
    } else if (row.unit === "lot" || row.item_name?.includes("Labor")) {
      totalLaborCost += Number(row.estimated_subtotal) || 0;
    }
  }

  const itemsList = Array.from(itemsMap.values());
  const isMultiProduct = itemsList.length > 1;

  // Single-product fallback parameters
  const firstDetails = rawItems[0]?.pricing_details as Record<string, unknown> | undefined;
  const widthM = typeof firstDetails?.width_m === "number" ? firstDetails.width_m : 1.2;
  const heightM = typeof firstDetails?.height_m === "number" ? firstDetails.height_m : 1.2;
  const panelCount = typeof firstDetails?.panel_count === "number" ? firstDetails.panel_count : 2;
  const hasSill = typeof firstDetails?.has_sill === "boolean" ? firstDetails.has_sill : true;
  const finishType = typeof firstDetails?.finish_type === "string" ? firstDetails.finish_type : "Analok";
  const glassType = typeof firstDetails?.glass_type === "string" ? firstDetails.glass_type : "6mm_bronze";
  const singleStructuralWaiver = panelCount === 2 && Math.round(widthM * 1000) >= 2400;

  const structuralWaiver = isMultiProduct
    ? hasAnyMultiWaiver
    : (itemsList[0]?.structuralWaiver ?? singleStructuralWaiver);

  let productName = "Series 798 Sliding Window";
  let productType = "Sliding Window";

  if (isMultiProduct) {
    productName = `${itemsList.length} Architectural Fixtures (${totalQuantity || itemsList.length} Units)`;
    productType = "Multi-Product Installation";
  } else if (itemsList.length === 1) {
    productName = itemsList[0].productName;
    productType = itemsList[0].productType;
  } else if (firstDetails?.product_name) {
    productName = String(firstDetails.product_name);
    productType = String(firstDetails.product_type || "Sliding Window");
  }

  const referenceCode = quote.quotation_number.replace("Q-", "CF-");

  const createdDate = new Date(linkRecord.created_at);
  const expiresDate = new Date(linkRecord.expires_at);
  const now = new Date();
  const isExpired = now > expiresDate || linkRecord.status === "Expired";

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
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(expiresDate);

  return {
    referenceCode,
    quotationNumber: quote.quotation_number,
    customerName: profile?.full_name || "Valued Customer",
    productName,
    productType,
    widthMm: itemsList[0]?.widthMm || Math.round(widthM * 1000),
    heightMm: itemsList[0]?.heightMm || Math.round(heightM * 1000),
    panelCount: itemsList[0]?.panelCount || panelCount,
    hasSill: itemsList[0]?.hasSill ?? hasSill,
    finishType: itemsList[0]?.finishType || finishType,
    glassType: itemsList[0]?.glassType || glassType,
    structuralWaiver,
    totalEstimatedAmount: Number(quote.total_estimated_amount),
    ...deriveQuotationPricing(Number(quote.total_estimated_amount), quote.negotiated_amount === null ? null : Number(quote.negotiated_amount)),
    createdAtFormatted,
    expiresAtFormatted,
    isExpired,
    snapshotImageUrl,
    status: linkRecord.status as PublicQuotationSummary["status"],
    isMultiProduct,
    items: itemsList.length > 0 ? itemsList : undefined,
    consolidatedMetrics: isMultiProduct
      ? {
          totalQuantity: totalQuantity || itemsList.length,
          totalFramingMeters: Math.round(totalFramingMeters * 10) / 10,
          totalGlazingSqm: Math.round(totalGlazingSqm * 100) / 100,
          totalLaborCost: Math.round(totalLaborCost * 100) / 100,
        }
      : undefined,
    groups: rawItems.map(
      (item: {
        item_name: string;
        quantity: number;
        unit: string;
        unit_price: number;
        estimated_subtotal: number;
        pricing_details?: unknown;
      }) => {
        const det = item.pricing_details as Record<string, unknown> | undefined;
        return {
          item_group_name: item.item_name,
          quantity: Number(item.quantity),
          unit_label: item.unit,
          unit_price: Number(item.unit_price),
          estimated_subtotal: Number(item.estimated_subtotal),
          product_name: typeof det?.product_name === "string" ? det.product_name : undefined,
        };
      }
    ),
  };
}

/** Authenticated owner read used to refresh an already-saved client quotation. */
export async function getOwnQuotationDocument(quotationId: string) {
  if (!zUuid(quotationId)) return null;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("quotation_estimates")
    .select("quotation_id, quotation_document_snapshot, total_estimated_amount, negotiated_amount, updated_at")
    .eq("quotation_id", quotationId).eq("profile_id", user.id).maybeSingle();
  if (error || !data?.quotation_document_snapshot) return null;
  const document = QuotationDocumentSnapshotV1Schema.safeParse(data.quotation_document_snapshot);
  if (!document.success) return null;
  return { quotationId: data.quotation_id, quotationDocument: document.data, updatedAt: data.updated_at, ...deriveQuotationPricing(Number(data.total_estimated_amount), data.negotiated_amount === null ? null : Number(data.negotiated_amount)) };
}

function zUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function updateNegotiatedPrice(input: UpdateNegotiatedPriceInput): Promise<UpdateNegotiatedPriceResult> {
  const admin = await requirePermission("manage_bookings");
  const parsed = UpdateNegotiatedPriceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid negotiated price" };
  const supabase = await createSupabaseServerClient();
  const { data: current, error: readError } = await supabase.from("quotation_estimates")
    .select("quotation_id, total_estimated_amount, updated_at").eq("quotation_id", parsed.data.quotationId).maybeSingle();
  if (readError) return { ok: false, code: "PERSISTENCE_ERROR", message: "Unable to read quotation" };
  if (!current) return { ok: false, code: "NOT_FOUND", message: "Quotation not found" };
  if (current.updated_at !== parsed.data.expectedUpdatedAt) return { ok: false, code: "CONFLICT", message: "This quotation was updated in another session. Review the latest values and try again." };
  const calculated = Number(current.total_estimated_amount);
  const pricing = deriveQuotationPricing(calculated, parsed.data.negotiatedAmount);
  const negotiatedAt = pricing.negotiatedFinalPrice === null ? null : new Date().toISOString();
  const negotiatedBy = pricing.negotiatedFinalPrice === null ? null : admin.profileId;
  const { data: updated, error } = await supabase.from("quotation_estimates").update({ negotiated_amount: pricing.negotiatedFinalPrice, negotiated_by: negotiatedBy, negotiated_at: negotiatedAt })
    .eq("quotation_id", parsed.data.quotationId).eq("updated_at", parsed.data.expectedUpdatedAt)
    .select("updated_at").maybeSingle();
  if (error) return { ok: false, code: "PERSISTENCE_ERROR", message: "Unable to save negotiated price" };
  if (!updated) return { ok: false, code: "CONFLICT", message: "This quotation changed before the price could be saved." };
  revalidateBookingPaths();
  return { ok: true, quotationId: parsed.data.quotationId, ...pricing, negotiatedBy, negotiatedAt, updatedAt: updated.updated_at };
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

  revalidateBookingPaths();

  return { success: true, status: validated.status };
}
