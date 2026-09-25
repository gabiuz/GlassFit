import type {
  BookingDatabaseStatus,
  BookingRequestWithRelationsRow,
  DashboardRecentBookingRow,
  RawQuotationItemRecord,
} from "@/lib/booking/types";
import type { BookingRequest } from "../data";
import type { AdminBookingItem, BookingStatus } from "./bookingData";
import { deriveQuotationPricing, QuotationDocumentSnapshotV1Schema, reconstructLegacyQuotationDocument } from "@/lib/pricing/quotationDocument";

type Fixture = { name: string; quantity: number };

function positiveQuantity(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 1;
}

export function extractQuotationFixtures(
  items: RawQuotationItemRecord[]
): Fixture[] {
  const fixtures = new Map<string, Fixture>();

  for (const item of items) {
    const details = item.pricing_details;
    if (!details) continue;

    const itemId = typeof details.item_id === "string" && details.item_id.trim()
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

export function summarizeQuotationFixtures(
  items: RawQuotationItemRecord[]
): string {
  const fixtures = extractQuotationFixtures(items);
  if (fixtures.length === 0) return "Product details unavailable";

  const totalQuantity = fixtures.reduce((sum, fixture) => sum + fixture.quantity, 0);
  const names = fixtures
    .slice(0, 2)
    .map((fixture) =>
      fixture.quantity > 1 ? `${fixture.quantity}x ${fixture.name}` : fixture.name
    )
    .join(", ");
  const remainder = fixtures.length > 2 ? ` and ${fixtures.length - 2} more` : "";
  return `${totalQuantity} Product${totalQuantity === 1 ? "" : "s"} · ${names}${remainder}`;
}

export function mapAdminBookingStatus(status: BookingDatabaseStatus): BookingStatus {
  switch (status) {
    case "Pending":
      return "Pending";
    case "Ongoing":
      return "Reviewing";
    case "Done":
      return "Confirmed";
    case "Cancelled":
      return "Cancelled";
  }
}

export function mapDashboardBookingStatus(
  status: BookingDatabaseStatus
): BookingRequest["status"] {
  switch (status) {
    case "Pending":
    case "Ongoing":
      return "Pending";
    case "Done":
      return "Confirmed";
    case "Cancelled":
      return "Cancelled";
  }
}

function formatDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

export function mapAdminBookingRow(
  row: BookingRequestWithRelationsRow
): AdminBookingItem {
  const quotation = row.booking_link?.quotation;
  const bookingDate = new Date(row.created_at);
  const quotationDate = new Date(quotation?.created_at ?? row.created_at);
  const items = quotation?.quotation_items ?? [];

  const shortDate = formatDate(bookingDate, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(",", " ·");
  const fullDate = formatDate(bookingDate, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = formatDate(bookingDate, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const generated = formatDate(quotationDate, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(",", " ·");
  const parsedDocument = QuotationDocumentSnapshotV1Schema.safeParse(quotation?.quotation_document_snapshot);
  const document = parsedDocument.success ? parsedDocument.data : quotation ? reconstructLegacyQuotationDocument({
    quotationNumber: quotation.quotation_number,
    referenceCode: quotation.quotation_number.replace("Q-", "CF-"),
    createdAt: quotation.created_at,
    customer: { name: row.customer?.full_name ?? "Unknown", email: row.customer?.email ?? null, phone: row.customer?.contact_number ?? null, siteLocation: null },
    totalEstimatedAmount: Number(quotation.total_estimated_amount), snapshotObjectKey: null, rows: quotation.quotation_items.map((item) => ({ ...item, quantity: item.quantity ?? 0, unit: item.unit ?? "item", unit_price: item.unit_price ?? 0, estimated_subtotal: item.estimated_subtotal ?? 0 })),
  }) : null;
  const pricing = deriveQuotationPricing(Number(quotation?.total_estimated_amount ?? 0), quotation?.negotiated_amount === null || quotation?.negotiated_amount === undefined ? null : Number(quotation.negotiated_amount));

  return {
    id: row.booking_request_id,
    referenceNo: quotation?.quotation_number ?? "N/A",
    customer: {
      name: row.customer?.full_name ?? "Unknown",
      email: row.customer?.email ?? "Unknown",
      phone: row.customer?.contact_number ?? "Unknown",
    },
    productSummary: summarizeQuotationFixtures(items),
    date: shortDate,
    receivedDate: `Received ${fullDate} at ${time} via ${row.selected_platform}`,
    status: mapAdminBookingStatus(row.status),
    quotation: {
      id: quotation?.quotation_id ?? "",
      filename: quotation?.pdf_r2_object_key?.split("/").pop() ?? "Quotation.pdf",
      generatedDate: `Generated ${generated}`,
      size: "N/A",
      document,
      ...pricing,
      negotiatedBy: quotation?.negotiated_by ?? null,
      negotiatedAt: quotation?.negotiated_at ?? null,
      updatedAt: quotation?.updated_at ?? quotation?.created_at ?? row.created_at,
    },
  };
}

export function mapDashboardBookingRow(
  row: DashboardRecentBookingRow
): BookingRequest {
  const fixtures = extractQuotationFixtures(
    row.booking_link?.quotation?.quotation_items ?? []
  );
  const productName = fixtures.length === 0
    ? "Product details unavailable"
    : `${fixtures[0].name}${fixtures.length > 1 ? ` and ${fixtures.length - 1} more` : ""}`;

  return {
    id: row.booking_request_id,
    customer: row.customer?.full_name ?? "Unknown",
    productName,
    status: mapDashboardBookingStatus(row.status),
  };
}
