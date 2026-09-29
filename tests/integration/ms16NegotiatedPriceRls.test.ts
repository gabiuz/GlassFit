import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("IMP-MS16 negotiated-price RLS migration", () => {
  it("restricts quotation updates to manage_bookings", () => {
    const sql = readFileSync(new URL("../../supabase/migrations/006_canonical_quotation_and_negotiated_price.sql", import.meta.url), "utf8");
    assert.match(sql, /quotations_manage_bookings_update/);
    assert.match(sql, /has_admin_permission\('manage_bookings'\)/);
    assert.doesNotMatch(sql, /for all/);
  });
});
