/**
 * Pure Domain Mapper and Chronological Timeline Synthesizer (IMP-MS20)
 *
 * Traceability: PRD-F17, SDD-C8, SDD-C10, DSD-UI12, ERD-E13, ERD-E15, ERD-E16, QAD-TC33
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

import type { RawQuotationItemRecord } from "@/lib/booking/types";
import { QuotationDocumentSnapshotV1Schema } from "@/lib/pricing/quotationDocument";
import type {
  ClientBookingRequestRow,
  ClientQuotationSnapshotDto,
} from "./clientRequestQueries";
import type {
  ClientRequestItem,
  ClientRequestQuotation,
  RequestUpdate,
} from "./requestData";
import { getSortedTimelineUpdates } from "./requestState";

export interface FixtureSummary {
  name: string;
  quantity: number;
}

function positiveQuantity(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 1;
}

/**
 * Extracts distinct product fixtures and quantities from raw legacy quotation items.
 */
export function extractQuotationFixtures(
  items: RawQuotationItemRecord[]
): FixtureSummary[] {
  const fixtures = new Map<string, FixtureSummary>();

  for (const item of items) {
    const details = item.pricing_details;
    if (!details) continue;

    const itemId =
      typeof details.item_id === "string" && details.item_id.trim()
        ? details.item_id.trim()
        : null;
    const productName =
      typeof details.product_name === "string" && details.product_name.trim()
        ? details.product_name.trim()
        : null;
    if (!productName) continue;

    const key = itemId ? `id:${itemId}` : `name:${productName}`;
    if (!fixtures.has(key)) {
      fixtures.set(key, {
        name: productName,
        quantity: positiveQuantity(details.item_quantity),
      });
    }
  }

  return [...fixtures.values()];
}

/**
 * Derives canonical product name and total item quantity from quotation snapshot or legacy items.
 */
export function deriveProductSummary(
  quotation: ClientQuotationSnapshotDto | null | undefined
): { productName: string; productCount: number } {
  if (!quotation) {
    return {
      productName: "Custom Consultation Fixture",
      productCount: 1,
    };
  }

  const parsedSnapshot = QuotationDocumentSnapshotV1Schema.safeParse(
    quotation.quotation_document_snapshot
  );

  if (parsedSnapshot.success && parsedSnapshot.data.items.length > 0) {
    const items = parsedSnapshot.data.items;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    if (items.length === 1) {
      return {
        productName: items[0].productName,
        productCount: items[0].quantity,
      };
    }

    return {
      productName: `${items[0].productName} and ${items.length - 1} more`,
      productCount: totalQuantity,
    };
  }

  const legacyFixtures = extractQuotationFixtures(
    quotation.quotation_items ?? []
  );

  if (legacyFixtures.length > 0) {
    const totalQuantity = legacyFixtures.reduce(
      (sum, fixture) => sum + fixture.quantity,
      0
    );
    const productName = `${legacyFixtures[0].name}${
      legacyFixtures.length > 1 ? ` and ${legacyFixtures.length - 1} more` : ""
    }`;

    return {
      productName,
      productCount: totalQuantity,
    };
  }

  return {
    productName: "Custom Consultation Fixture",
    productCount: 1,
  };
}

/**
 * Formats canonical reference code for customer display (e.g. CF-2026-001).
 */
export function deriveReferenceNumber(
  row: ClientBookingRequestRow,
  quotation: ClientQuotationSnapshotDto | null | undefined
): string {
  if (quotation?.quotation_number) {
    return quotation.quotation_number.replace(/^Q-/, "CF-");
  }
  return `CF-${row.booking_request_id.slice(0, 8).toUpperCase()}`;
}

/**
 * Maps database quotation attributes to ClientRequestQuotation structure.
 */
export function mapClientQuotationArtifact(
  row: ClientBookingRequestRow,
  quotation: ClientQuotationSnapshotDto | null | undefined,
  referenceCode: string
): ClientRequestQuotation {
  const filename = quotation?.pdf_r2_object_key
    ? quotation.pdf_r2_object_key.split("/").pop() ?? "Quotation.pdf"
    : `${referenceCode}-quotation.pdf`;

  const generatedAt = quotation?.created_at ?? row.created_at;
  const isAvailable = Boolean(
    quotation?.pdf_r2_object_key || quotation?.quotation_id
  );

  return {
    filename,
    generatedAt,
    availability: isAvailable ? "available" : "pending",
    referenceCode,
    shareableUrl: `/q/${referenceCode}`,
    r2ObjectKey: quotation?.pdf_r2_object_key ?? null,
  };
}

/**
 * Synthesizes chronological milestone events deterministically from database timestamps.
 * Returns events sorted newest-first per MS19 Section 5 and MS20 Section 6.
 */
export function synthesizeRequestUpdates(
  row: ClientBookingRequestRow
): RequestUpdate[] {
  const updates: RequestUpdate[] = [];
  const quotation = row.booking_link?.quotation;
  const requestId = row.booking_request_id;
  const platform = row.selected_platform;

  // 1. Initial Submission Milestone (Always present)
  updates.push({
    id: `upd-${requestId}-submitted`,
    occurredAt: row.created_at,
    title: "Request submitted",
    description: `Your consultation request has been received via ${platform}.`,
  });

  // 2. Quotation Generation Milestone (Present if quotation exists)
  if (quotation) {
    updates.push({
      id: `upd-${requestId}-quotation`,
      occurredAt: quotation.created_at,
      title: "Quotation received",
      description: `Consultation quotation ${quotation.quotation_number} is attached to this request.`,
    });
  }

  // 3. Status Milestone: Ongoing (Under Review)
  if (row.status === "Ongoing" || row.status === "Done") {
    const reviewTime =
      row.status === "Ongoing"
        ? row.updated_at
        : quotation?.created_at && row.updated_at > quotation.created_at
        ? new Date(
            (new Date(quotation.created_at).getTime() +
              new Date(row.updated_at).getTime()) /
              2
          ).toISOString()
        : row.updated_at;

    updates.push({
      id: `upd-${requestId}-review`,
      occurredAt: reviewTime,
      title: "Under review",
      description:
        "Our team is reviewing your room specifications and product dimensions.",
    });
  }

  // 4. Quotation Negotiation / Price Confirmation Milestone (Present if negotiated_at exists)
  if (quotation?.negotiated_at) {
    updates.push({
      id: `upd-${requestId}-pricing`,
      occurredAt: quotation.negotiated_at,
      title: "Quotation confirmed",
      description:
        "Consultation pricing has been confirmed by the fabrication team.",
    });
  }

  // 5. Terminal Milestone: Completed
  if (row.status === "Done") {
    updates.push({
      id: `upd-${requestId}-completed`,
      occurredAt: row.updated_at,
      title: "Request completed",
      description: "Your consultation request has been processed.",
    });
  }

  // 6. Terminal Milestone: Cancelled
  if (row.status === "Cancelled") {
    updates.push({
      id: `upd-${requestId}-cancelled`,
      occurredAt: row.updated_at,
      title: "Request cancelled",
      description: "This consultation request is no longer active.",
    });
  }

  return getSortedTimelineUpdates(updates);
}

/**
 * Transforms a raw Supabase booking request row into a canonical ClientRequestItem view model.
 */
export function mapBookingRequestRowToClientItem(
  row: ClientBookingRequestRow
): ClientRequestItem {
  const quotation = row.booking_link?.quotation;
  const referenceNo = deriveReferenceNumber(row, quotation);
  const { productName, productCount } = deriveProductSummary(quotation);
  const quotationArtifact = mapClientQuotationArtifact(
    row,
    quotation,
    referenceNo
  );
  const updates = synthesizeRequestUpdates(row);

  return {
    id: row.booking_request_id,
    referenceNo,
    productName,
    productCount,
    submittedAt: row.created_at,
    status: row.status,
    quotation: quotationArtifact,
    updates,
  };
}
