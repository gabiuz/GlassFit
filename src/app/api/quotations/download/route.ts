import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  QuotationDocumentSnapshotV1Schema,
  QuotationItemPriceOverridesV1Schema,
  createQuotationDocumentViewModel,
  reconstructLegacyQuotationDocument,
} from "@/lib/pricing/quotationDocument";
import { generateQuotationPdfHtml } from "@/lib/pricing/quotationPdfGenerator";
import { resolveSnapshotUrl } from "@/lib/booking/snapshotStorage";

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const codeParam = searchParams.get("code") || searchParams.get("referenceNo") || searchParams.get("key") || searchParams.get("id");

  if (!codeParam) {
    return new NextResponse("Quotation reference is required.", { status: 400 });
  }

  const trimmed = codeParam.trim();
  const serviceClient = createSupabaseServiceClient();

  // 1. Resolve quotation record either by quotation_number, quotation_id, or signed_booking_links token/code
  let quotationQuery = serviceClient
    .from("quotation_estimates")
    .select(`
      quotation_id,
      quotation_number,
      total_estimated_amount,
      negotiated_amount,
      negotiated_by,
      negotiated_at,
      item_price_overrides,
      quotation_document_snapshot,
      pdf_r2_object_key,
      created_at,
      updated_at,
      quotation_items (
        item_name,
        quantity,
        unit,
        unit_price,
        estimated_subtotal,
        pricing_details
      )
    `);

  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmed)) {
    quotationQuery = quotationQuery.eq("quotation_id", trimmed);
  } else {
    const cleanCode = trimmed.toUpperCase().replace(/\.PDF$/i, "");
    const formattedQuoteNo = cleanCode.startsWith("CF-")
      ? cleanCode.replace("CF-", "Q-")
      : cleanCode.startsWith("Q-")
      ? cleanCode
      : cleanCode.includes("/")
      ? cleanCode.split("/")[1] ?? cleanCode
      : `Q-${cleanCode}`;

    quotationQuery = quotationQuery.eq("quotation_number", formattedQuoteNo);
  }

  const { data: quoteRecord, error } = await quotationQuery.maybeSingle();

  if (error || !quoteRecord) {
    return new NextResponse("Quotation record not found.", { status: 404 });
  }

  // 2. Fetch associated snapshot or booking link for customer profile / snapshot image
  const { data: linkRecord } = await serviceClient
    .from("signed_booking_links")
    .select(`
      profiles (
        full_name,
        email,
        contact_number
      ),
      visualization_snapshots (
        final_image_r2_key
      )
    `)
    .eq("quotation_id", quoteRecord.quotation_id)
    .maybeSingle();

  const profile = Array.isArray(linkRecord?.profiles) ? linkRecord?.profiles[0] : linkRecord?.profiles;
  const snapshot = Array.isArray(linkRecord?.visualization_snapshots) ? linkRecord?.visualization_snapshots[0] : linkRecord?.visualization_snapshots;

  const snapshotImageUrl = snapshot?.final_image_r2_key
    ? resolveSnapshotUrl(snapshot.final_image_r2_key)
    : null;

  const parsedDoc = QuotationDocumentSnapshotV1Schema.safeParse(quoteRecord.quotation_document_snapshot);
  const parsedOverrides = QuotationItemPriceOverridesV1Schema.safeParse(quoteRecord.item_price_overrides);
  const itemPriceOverrides = parsedOverrides.success ? parsedOverrides.data : null;

  let html: string;
  const origin = request.nextUrl.origin;
  const origins = [origin];
  const r2Base = process.env.NEXT_PUBLIC_R2_ASSET_BASE_URL;
  if (r2Base) {
    try {
      origins.push(new URL(r2Base).origin);
    } catch {
      // Ignore invalid URL
    }
  }

  if (parsedDoc.success) {
    const view = createQuotationDocumentViewModel(parsedDoc.data, {
      brandLogoUrl: `${origin}/Logo.svg`,
      shareableUrl: `${origin}/q/${quoteRecord.quotation_number.replace("Q-", "CF-")}`,
      snapshotImageUrl,
      allowedImageOrigins: origins,
      negotiatedAmount: quoteRecord.negotiated_amount === null ? null : Number(quoteRecord.negotiated_amount),
      itemPriceOverrides,
    });
    html = generateQuotationPdfHtml(view);
  } else {
    const rawItems = Array.isArray(quoteRecord.quotation_items) ? quoteRecord.quotation_items : [];
    const legacyDoc = reconstructLegacyQuotationDocument({
      quotationNumber: quoteRecord.quotation_number,
      referenceCode: quoteRecord.quotation_number.replace("Q-", "CF-"),
      createdAt: quoteRecord.created_at,
      customer: {
        name: profile?.full_name ?? "Valued Customer",
        email: profile?.email ?? null,
        phone: profile?.contact_number ?? null,
        siteLocation: null,
      },
      totalEstimatedAmount: Number(quoteRecord.total_estimated_amount),
      snapshotObjectKey: snapshot?.final_image_r2_key ?? null,
      rows: rawItems.map((item) => ({
        item_name: item.item_name ?? "Custom Fixture",
        quantity: item.quantity ?? 1,
        unit: item.unit ?? "item",
        unit_price: Number(item.unit_price) || 0,
        estimated_subtotal: Number(item.estimated_subtotal) || 0,
        pricing_details: (item.pricing_details as Record<string, unknown>) ?? null,
      })),
    });

    if (legacyDoc) {
      const view = createQuotationDocumentViewModel(legacyDoc, {
        brandLogoUrl: `${origin}/Logo.svg`,
        shareableUrl: `${origin}/q/${quoteRecord.quotation_number.replace("Q-", "CF-")}`,
        snapshotImageUrl,
        allowedImageOrigins: origins,
        negotiatedAmount: quoteRecord.negotiated_amount === null ? null : Number(quoteRecord.negotiated_amount),
        itemPriceOverrides,
      });
      html = generateQuotationPdfHtml(view);
    } else {
      return new NextResponse("Unable to render quotation document.", { status: 500 });
    }
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
