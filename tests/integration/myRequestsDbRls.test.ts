/**
 * Integration Tests: My Requests RLS & Database Invariant Verification (IMP-MS20)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C10, ERD-E16, QAD-TC33, BAN-RLS-07
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOOKING_REVALIDATION_PATHS } from "../../src/lib/booking/bookingRevalidationPaths";
import {
  CLIENT_MY_REQUESTS_SELECT,
  getClientMyRequests,
  type ClientBookingRequestRow,
} from "../../src/features/my-requests/clientRequestQueries";

describe("IMP-MS20: My Requests Database Integration & RLS Isolation (QAD-TC33)", () => {
  it("TC33.8: Database migrations enforce customer RLS isolation on booking_requests", () => {
    const backendCoreSql = readFileSync(
      new URL("../../supabase/migrations/001_backend_core.sql", import.meta.url),
      "utf8"
    );

    // Verifies booking_requests RLS policy exists and enforces profile_id = auth.uid()
    assert.match(
      backendCoreSql,
      /create policy ["']?booking_requests_select_own_or_admin["']?/i,
      "Missing booking_requests_select_own_or_admin policy"
    );
    assert.match(
      backendCoreSql,
      /\(?\(?profile_id = auth\.uid\(\)\)? or public\.is_admin\(\)\)?/i,
      "RLS policy does not strictly check profile_id = auth.uid()"
    );
  });

  it("TC33.9: CLIENT_MY_REQUESTS_SELECT eliminates profiles join avoiding PGRST201 ambiguity", () => {
    // Verified: No profiles join in customer query
    assert.doesNotMatch(
      CLIENT_MY_REQUESTS_SELECT,
      /profiles!/,
      "CLIENT_MY_REQUESTS_SELECT should not join profiles (avoiding PGRST201)"
    );
    assert.match(
      CLIENT_MY_REQUESTS_SELECT,
      /booking_link:signed_booking_links!booking_requests_link_fk/
    );
    assert.match(
      CLIENT_MY_REQUESTS_SELECT,
      /quotation:quotation_estimates!signed_booking_links_quotation_fk/
    );
  });

  it("TC33.10: BOOKING_REVALIDATION_PATHS includes /my-requests for automated freshness", () => {
    assert.ok(
      BOOKING_REVALIDATION_PATHS.includes("/my-requests"),
      "/my-requests must be registered in BOOKING_REVALIDATION_PATHS"
    );
  });

  it("TC33.11: getClientMyRequests enforces customer authentication and profile_id isolation", async () => {
    const mockUser = {
      id: "customer-uuid-001",
      email: "client@example.com",
    };

    let selectCalledWith = "";
    let eqField = "";
    let eqValue = "";
    let orderField = "";
    let orderAsc = true;

    const mockRows: ClientBookingRequestRow[] = [
      {
        booking_request_id: "req-1",
        profile_id: mockUser.id,
        status: "Pending",
        selected_platform: "Messenger",
        created_at: "2026-02-01T12:00:00.000Z",
        updated_at: "2026-02-01T12:00:00.000Z",
        booking_link: null,
      },
    ];

    const mockSupabase = {
      auth: {
        getUser: async () => ({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: (table: string) => {
        assert.strictEqual(table, "booking_requests");
        return {
          select: (query: string) => {
            selectCalledWith = query;
            return {
              eq: (field: string, value: string) => {
                eqField = field;
                eqValue = value;
                return {
                  order: (col: string, opts: { ascending: boolean }) => {
                    orderField = col;
                    orderAsc = opts.ascending;
                    return {
                      overrideTypes: () => Promise.resolve({ data: mockRows, error: null }),
                    };
                  },
                };
              },
            };
          },
        };
      },
    };

    // Customer authenticated execution
    const result = await getClientMyRequests(
      mockSupabase as unknown as Parameters<typeof getClientMyRequests>[0]
    );

    assert.strictEqual(result.error, null);
    assert.deepStrictEqual(result.data, mockRows);
    assert.strictEqual(selectCalledWith, CLIENT_MY_REQUESTS_SELECT);
    assert.strictEqual(eqField, "profile_id");
    assert.strictEqual(eqValue, mockUser.id);
    assert.strictEqual(orderField, "created_at");
    assert.strictEqual(orderAsc, false);

    // Unauthenticated execution fails gracefully
    const unauthSupabase = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: new Error("Session expired"),
        }),
      },
    };

    const unauthResult = await getClientMyRequests(
      unauthSupabase as unknown as Parameters<typeof getClientMyRequests>[0]
    );

    assert.strictEqual(unauthResult.data, null);
    assert.ok(unauthResult.error !== null);
    assert.match(unauthResult.error?.message ?? "", /Session expired/);
  });
});
