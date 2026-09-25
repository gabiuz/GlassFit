import assert from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  mapAdminBookingRow,
  mapAdminBookingStatus,
  mapDashboardBookingRow,
  mapDashboardBookingStatus,
  summarizeQuotationFixtures,
} from "../../src/features/admin/bookings/adminBookingMapper.js";
import {
  ADMIN_BOOKINGS_SELECT,
  DASHBOARD_RECENT_BOOKINGS_SELECT,
} from "../../src/features/admin/bookings/adminBookingQueries.js";
import {
  createBookingState,
  reconcileBookingState,
} from "../../src/features/admin/bookings/bookingState.js";
import { BOOKING_REVALIDATION_PATHS } from "../../src/lib/booking/bookingRevalidationPaths.js";
import type {
  BookingRequestWithRelationsRow,
  DashboardRecentBookingRow,
  RawQuotationItemRecord,
} from "../../src/lib/booking/types.js";
import type { AdminBookingItem } from "../../src/features/admin/bookings/bookingData.js";

const root = process.cwd();
const source = (path: string) => readFileSync(`${root}/${path}`, "utf8");

function item(
  itemId: string | null,
  productName: string | null,
  quantity: number | null = 1
): RawQuotationItemRecord {
  return {
    item_name: "BOM group",
    pricing_details: {
      ...(itemId ? { item_id: itemId } : {}),
      ...(productName ? { product_name: productName } : {}),
      ...(quantity === null ? {} : { item_quantity: quantity }),
    },
  };
}

function adminBooking(id: string, status: AdminBookingItem["status"]): AdminBookingItem {
  return {
    id,
    referenceNo: "Q-1",
    customer: { name: "Customer", email: "c@example.com", phone: "Unknown" },
    productSummary: "1 Product · Window",
    date: "Sep 24 · 1:00 PM",
    receivedDate: "Received September 24, 2026 at 1:00 PM via Messenger",
    status,
    quotation: { filename: "Quotation.pdf", generatedDate: "Generated today", size: "N/A" },
  };
}

describe("IMP-MS15 admin booking reflection", () => {
  it("uses exact aliases and foreign-key constraints in both queries", () => {
    for (const query of [ADMIN_BOOKINGS_SELECT, DASHBOARD_RECENT_BOOKINGS_SELECT]) {
      assert.match(query, /customer:profiles!booking_requests_profile_fk/);
      assert.match(query, /booking_link:signed_booking_links!booking_requests_link_fk/);
      assert.match(query, /quotation:quotation_estimates!signed_booking_links_quotation_fk/);
      assert.doesNotMatch(query, /!inner/);
    }
  });

  it("maps database statuses exhaustively for both admin views", () => {
    assert.deepStrictEqual(
      ["Pending", "Ongoing", "Done", "Cancelled"].map((status) =>
        mapAdminBookingStatus(status as "Pending" | "Ongoing" | "Done" | "Cancelled")
      ),
      ["Pending", "Reviewing", "Confirmed", "Cancelled"]
    );
    assert.deepStrictEqual(
      ["Pending", "Ongoing", "Done", "Cancelled"].map((status) =>
        mapDashboardBookingStatus(status as "Pending" | "Ongoing" | "Done" | "Cancelled")
      ),
      ["Pending", "Pending", "Confirmed", "Cancelled"]
    );
  });

  it("deduplicates BOM groups and summarizes quantities and multiple fixtures", () => {
    assert.strictEqual(
      summarizeQuotationFixtures([
        item("fixture-1", "Sliding Window", 1),
        item("fixture-1", "Sliding Window", 1),
        item("fixture-1", "Sliding Window", 1),
        item("fixture-1", "Sliding Window", 1),
      ]),
      "1 Product · Sliding Window"
    );
    assert.strictEqual(
      summarizeQuotationFixtures([
        item("one", "Window", 2),
        item("one", "Window", 2),
        item("two", "Door", 1),
        item("three", "Partition", 3),
      ]),
      "6 Products · 2x Window, Door and 1 more"
    );
    assert.strictEqual(
      summarizeQuotationFixtures([item(null, "Legacy Window", 2), item(null, "Legacy Window", 2)]),
      "2 Products · 2x Legacy Window"
    );
    assert.strictEqual(summarizeQuotationFixtures([item(null, null)]), "Product details unavailable");
  });

  it("maps missing relations, profiles, metadata, and PDF keys to explicit fallbacks", () => {
    const row: BookingRequestWithRelationsRow = {
      booking_request_id: "booking-1",
      status: "Pending",
      created_at: "2026-09-24T05:00:00.000Z",
      selected_platform: "Messenger",
      booking_link: null,
      customer: null,
    };
    const mapped = mapAdminBookingRow(row);
    assert.strictEqual(mapped.referenceNo, "N/A");
    assert.deepStrictEqual(mapped.customer, { name: "Unknown", email: "Unknown", phone: "Unknown" });
    assert.strictEqual(mapped.productSummary, "Product details unavailable");
    assert.strictEqual(mapped.quotation.filename, "Quotation.pdf");

    const dashboardRow: DashboardRecentBookingRow = {
      booking_request_id: "booking-1",
      status: "Done",
      customer: null,
      booking_link: { quotation: { quotation_items: [] } },
    };
    assert.deepStrictEqual(mapDashboardBookingRow(dashboardRow), {
      id: "booking-1",
      customer: "Unknown",
      productName: "Product details unavailable",
      status: "Confirmed",
    });

    const rowWithLegacyQuotation: BookingRequestWithRelationsRow = {
      booking_request_id: "booking-legacy",
      status: "Pending",
      created_at: "2026-09-21 17:52:27.857527+00",
      selected_platform: "Messenger",
      customer: {
        full_name: "Legacy User",
        email: "legacy@example.com",
        contact_number: "09123456789",
      },
      booking_link: {
        quotation: {
          quotation_id: "q-legacy-1",
          quotation_number: "Q-2026-5329",
          pdf_r2_object_key: "quotations/Q-2026-5329/GlassFit_Quotation_Q-2026-5329.pdf",
          created_at: "2026-09-21 17:52:27.857527+00",
          updated_at: "2026-09-21 17:52:27.857527+00",
          total_estimated_amount: 2054.21,
          negotiated_amount: null,
          negotiated_by: null,
          negotiated_at: null,
          quotation_document_snapshot: null,
          quotation_items: [
            {
              item_name: "Screen Door (Aluminum Framing)",
              item_group_name: "Aluminum Framing",
              quantity: 8.76,
              unit: "m",
              unit_price: 86.5,
              estimated_subtotal: 757.75,
              pricing_details: {
                product_name: "Screen Door",
                item_id: "item-1",
                item_quantity: 1,
                item_total_price: 2054.21,
                width_mm: 390,
                height_mm: 1200,
              },
            },
          ],
        },
      },
    };
    const mappedLegacy = mapAdminBookingRow(rowWithLegacyQuotation);
    assert.strictEqual(mappedLegacy.referenceNo, "Q-2026-5329");
    assert.ok(mappedLegacy.quotation.document !== null);
    assert.strictEqual(mappedLegacy.quotation.document?.createdAt, "2026-09-21T17:52:27.857Z");
  });

  it("reconciles selection atomically and retains rows on failed refresh", () => {
    const one = adminBooking("one", "Pending");
    const two = adminBooking("two", "Reviewing");
    let state = createBookingState([one, two]);
    state = { ...state, selectedBookingId: "two", currentStatus: "Confirmed" };

    const retained = reconcileBookingState(state, [one, { ...two, status: "Confirmed" }], null);
    assert.strictEqual(retained.selectedBookingId, "two");
    assert.strictEqual(retained.currentStatus, "Confirmed");

    const replaced = reconcileBookingState(retained, [one], null);
    assert.strictEqual(replaced.selectedBookingId, "one");
    assert.strictEqual(replaced.currentStatus, "Pending");

    const empty = reconcileBookingState(replaced, [], null);
    assert.strictEqual(empty.selectedBookingId, "");
    assert.strictEqual(empty.currentStatus, "Pending");

    const failed = reconcileBookingState(replaced, [], "Unable to load");
    assert.deepStrictEqual(failed.bookings, [one]);
    assert.strictEqual(failed.loadError, "Unable to load");
  });

  it("invalidates every booking consumer in each mutation success branch", () => {
    assert.deepStrictEqual([...BOOKING_REVALIDATION_PATHS], ["/admin", "/admin/bookings", "/dashboard"]);
    const actions = source("src/lib/booking/bookingActions.ts");
    assert.strictEqual((actions.match(/revalidateBookingPaths\(\);/g) ?? []).length, 4);
  });

  it("preserves request-time rendering and wires error and refresh accessibility", () => {
    assert.match(source("src/lib/supabase/server.ts"), /await cookies\(\)/);
    assert.doesNotMatch(source("next.config.ts"), /cacheComponents\s*:\s*true/);
    for (const path of [
      "src/features/admin/bookings/BookingsPage.tsx",
      "src/features/admin/components/DashboardPage.tsx",
    ]) {
      const contents = source(path);
      assert.doesNotMatch(contents, /force-dynamic/);
      assert.doesNotMatch(contents, /revalidate\s*=\s*0/);
      assert.match(contents, /overrideTypes</);
    }

    const content = source("src/features/admin/bookings/BookingsContent.tsx");
    assert.match(content, /aria-label="Refresh booking requests"/);
    assert.match(content, /aria-busy=/);
    assert.match(content, /motion-reduce:animate-none/);
    assert.match(content, /role="alert"/);
    assert.match(source("src/features/admin/components/RecentBookingsTable.tsx"), /role="alert"/);
    assert.match(source("docs/qad-glassfit.md"), /QAD-TC29/);
    assert.match(source("docs/index.md"), /QAD-TC29/);
  });
});
