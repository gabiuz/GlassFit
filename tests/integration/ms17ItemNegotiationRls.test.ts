import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("IMP-MS17 per-item negotiation migration", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/007_per_item_negotiation.sql", import.meta.url), "utf8");

  it("adds constrained JSONB storage and deterministic migration guards", () => {
    assert.match(sql, /item_price_overrides jsonb/i);
    assert.match(sql, /jsonb_typeof\(item_price_overrides\) = 'object'/i);
    assert.match(sql, /blank or duplicate itemId values/);
    assert.match(sql, /remainder desc, position/);
  });

  it("does not weaken the manage_bookings RLS policy", () => {
    const prior = readFileSync(new URL("../../supabase/migrations/006_canonical_quotation_and_negotiated_price.sql", import.meta.url), "utf8");
    assert.match(prior, /has_admin_permission\('manage_bookings'\)/);
    assert.doesNotMatch(sql, /disable row level security|service_role/i);
  });
});
