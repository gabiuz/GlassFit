/**
 * Unit Tests: My Requests State, Selectors, and Status Mappings (IMP-MS19)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C10, DSD-UI12, ERD-E2, QAD-TC32
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { BookingRequestStatus } from "../../src/lib/booking/types";
import {
  CANONICAL_REQUEST_FIXTURES,
  getBookingStatusLabel,
  getBookingStatusFilter,
  getBookingStatusBadge,
  getBookingStatusBanner,
  getBookingProgressBehavior,
  assertNever,
  type ClientRequestItem,
} from "../../src/features/my-requests/requestData";
import {
  createInitialRequestState,
  filterRequests,
  getFilterCounts,
  getSelectedRequest,
  getSortedTimelineUpdates,
  requestReducer,
} from "../../src/features/my-requests/requestState";

describe("IMP-MS19: My Requests State and Mappings", () => {
  it("TC-01: Exhaustive mapping of all four database statuses", () => {
    const statuses: BookingRequestStatus[] = ["Pending", "Ongoing", "Done", "Cancelled"];

    for (const status of statuses) {
      const label = getBookingStatusLabel(status);
      const filter = getBookingStatusFilter(status);
      const badge = getBookingStatusBadge(status);
      const banner = getBookingStatusBanner(status);
      const progress = getBookingProgressBehavior(status);

      assert.ok(label.length > 0, `Label missing for ${status}`);
      assert.ok(["Active", "Completed", "Cancelled"].includes(filter));
      assert.ok(badge.label.length > 0);
      assert.ok(banner.title.length > 0);
      assert.strictEqual(typeof progress.isCancelled, "boolean");
    }

    assert.strictEqual(getBookingStatusLabel("Pending"), "Submitted");
    assert.strictEqual(getBookingStatusLabel("Ongoing"), "Under Review");
    assert.strictEqual(getBookingStatusLabel("Done"), "Completed");
    assert.strictEqual(getBookingStatusLabel("Cancelled"), "Cancelled");
  });

  it("TC-02: Active filter composition from Pending and Ongoing only", () => {
    const activeRequests = filterRequests(CANONICAL_REQUEST_FIXTURES, "Active");

    assert.strictEqual(activeRequests.length, 2);
    for (const req of activeRequests) {
      assert.ok(req.status === "Pending" || req.status === "Ongoing");
    }
  });

  it("TC-03: Completed and Cancelled filter membership", () => {
    const completedRequests = filterRequests(CANONICAL_REQUEST_FIXTURES, "Completed");
    assert.strictEqual(completedRequests.length, 2);
    for (const req of completedRequests) {
      assert.strictEqual(req.status, "Done");
    }

    const cancelledRequests = filterRequests(CANONICAL_REQUEST_FIXTURES, "Cancelled");
    assert.strictEqual(cancelledRequests.length, 1);
    for (const req of cancelledRequests) {
      assert.strictEqual(req.status, "Cancelled");
    }
  });

  it("TC-04: Correct deterministic counts for all five fixtures", () => {
    const counts = getFilterCounts(CANONICAL_REQUEST_FIXTURES);

    assert.deepStrictEqual(counts, {
      All: 5,
      Active: 2,
      Completed: 2,
      Cancelled: 1,
    });
  });

  it("TC-05: Initial selection selects the first request in All filter", () => {
    const state = createInitialRequestState(CANONICAL_REQUEST_FIXTURES);

    assert.strictEqual(state.activeFilter, "All");
    assert.strictEqual(state.selectedRequestId, CANONICAL_REQUEST_FIXTURES[0].id);
    assert.strictEqual(state.expandedTimelineRequestId, null);

    const selected = getSelectedRequest(state);
    assert.ok(selected !== null);
    assert.strictEqual(selected.referenceNo, "CF-2026-001");
  });

  it("TC-06: Selection retention when still visible across filter change", () => {
    const initial = createInitialRequestState(CANONICAL_REQUEST_FIXTURES);
    // Request CF-2026-001 has status 'Ongoing' which belongs to 'Active'
    assert.strictEqual(initial.selectedRequestId, CANONICAL_REQUEST_FIXTURES[0].id);

    const nextState = requestReducer(initial, { type: "set-filter", filter: "Active" });

    assert.strictEqual(nextState.activeFilter, "Active");
    assert.strictEqual(nextState.selectedRequestId, CANONICAL_REQUEST_FIXTURES[0].id);
  });

  it("TC-07: First-visible selection when current request is hidden by filter", () => {
    const initial = createInitialRequestState(CANONICAL_REQUEST_FIXTURES);
    // Initial selection is CF-2026-001 (Ongoing)
    // Switching to 'Completed' should change selection to CF-2026-003 (the first completed request)
    const nextState = requestReducer(initial, { type: "set-filter", filter: "Completed" });

    assert.strictEqual(nextState.activeFilter, "Completed");
    assert.strictEqual(nextState.selectedRequestId, CANONICAL_REQUEST_FIXTURES[2].id);
    assert.strictEqual(getSelectedRequest(nextState)?.referenceNo, "CF-2026-003");
  });

  it("TC-08: Empty selection when a filter has no rows", () => {
    // Provide a dataset with no cancelled requests
    const noCancelledList: ClientRequestItem[] = CANONICAL_REQUEST_FIXTURES.filter(
      (r) => r.status !== "Cancelled"
    );

    const state = createInitialRequestState(noCancelledList);
    const filteredState = requestReducer(state, { type: "set-filter", filter: "Cancelled" });

    assert.strictEqual(filteredState.activeFilter, "Cancelled");
    assert.strictEqual(filteredState.selectedRequestId, "");
    assert.strictEqual(getSelectedRequest(filteredState), null);
  });

  it("TC-09: Timeline newest-first sorting without mutating fixture input", () => {
    const firstFixture = CANONICAL_REQUEST_FIXTURES[0];
    const originalUpdates = firstFixture.updates;
    const originalFirstId = originalUpdates[0].id;

    // First fixture has 5 updates deliberately stored out-of-order: U1-3, U1-1, U1-5, U1-2, U1-4
    assert.strictEqual(originalFirstId, "U1-3");

    const sorted = getSortedTimelineUpdates(originalUpdates);

    // Verify original array was not mutated
    assert.strictEqual(firstFixture.updates[0].id, "U1-3");

    // Expected newest first: U1-5 (Jan 18), U1-4 (Jan 17), U1-3 (Jan 16), U1-2 (Jan 15 10:10), U1-1 (Jan 15 09:30)
    assert.strictEqual(sorted[0].id, "U1-5");
    assert.strictEqual(sorted[1].id, "U1-4");
    assert.strictEqual(sorted[2].id, "U1-3");
    assert.strictEqual(sorted[3].id, "U1-2");
    assert.strictEqual(sorted[4].id, "U1-1");
  });

  it("TC-10: Three-item collapsed timeline and full expanded timeline toggling", () => {
    let state = createInitialRequestState(CANONICAL_REQUEST_FIXTURES);
    const targetRequestId = CANONICAL_REQUEST_FIXTURES[0].id;

    assert.strictEqual(state.expandedTimelineRequestId, null);

    // Toggle expand
    state = requestReducer(state, { type: "toggle-timeline", requestId: targetRequestId });
    assert.strictEqual(state.expandedTimelineRequestId, targetRequestId);

    // Toggle collapse
    state = requestReducer(state, { type: "toggle-timeline", requestId: targetRequestId });
    assert.strictEqual(state.expandedTimelineRequestId, null);

    // Expansion resets when selecting another request
    state = requestReducer(state, { type: "toggle-timeline", requestId: targetRequestId });
    assert.strictEqual(state.expandedTimelineRequestId, targetRequestId);

    const secondRequestId = CANONICAL_REQUEST_FIXTURES[1].id;
    state = requestReducer(state, { type: "select", requestId: secondRequestId });
    assert.strictEqual(state.selectedRequestId, secondRequestId);
    assert.strictEqual(state.expandedTimelineRequestId, null);
  });

  it("TC-11: Empty update-list behavior", () => {
    // 4th fixture (CF-2026-004) has zero updates
    const fourthFixture = CANONICAL_REQUEST_FIXTURES[3];
    assert.strictEqual(fourthFixture.updates.length, 0);

    const sorted = getSortedTimelineUpdates(fourthFixture.updates);
    assert.strictEqual(sorted.length, 0);
  });

  it("TC-12: Empty fixture collection initialization", () => {
    const emptyState = createInitialRequestState([]);

    assert.strictEqual(emptyState.requests.length, 0);
    assert.strictEqual(emptyState.selectedRequestId, "");
    assert.strictEqual(emptyState.activeFilter, "All");
    assert.strictEqual(emptyState.expandedTimelineRequestId, null);
    assert.strictEqual(getSelectedRequest(emptyState), null);

    const counts = getFilterCounts([]);
    assert.deepStrictEqual(counts, { All: 0, Active: 0, Completed: 0, Cancelled: 0 });
  });

  it("TC-13: Compile-time and runtime exhaustive status mapping through never assertion", () => {
    assert.throws(
      () => {
        // Force an invalid status at runtime
        assertNever("UnknownStatus" as unknown as never);
      },
      {
        message: /Unhandled booking request status: UnknownStatus/,
      }
    );
  });

  it("TC-14: sync-requests action preserves selected request or falls back to first visible", () => {
    let state = createInitialRequestState(CANONICAL_REQUEST_FIXTURES);
    const selectedId = CANONICAL_REQUEST_FIXTURES[0].id;
    assert.strictEqual(state.selectedRequestId, selectedId);

    // Sync with same requests retains selection and active filter
    state = requestReducer(state, {
      type: "sync-requests",
      requests: [...CANONICAL_REQUEST_FIXTURES],
    });
    assert.strictEqual(state.selectedRequestId, selectedId);

    // Filter to Completed (where CF-2026-003 is selected)
    state = requestReducer(state, { type: "set-filter", filter: "Completed" });
    assert.strictEqual(state.selectedRequestId, CANONICAL_REQUEST_FIXTURES[2].id);

    // If new request list removes CF-2026-003, fallback to CF-2026-004 (next completed request)
    const updatedList = CANONICAL_REQUEST_FIXTURES.filter(
      (r) => r.id !== CANONICAL_REQUEST_FIXTURES[2].id
    );
    state = requestReducer(state, {
      type: "sync-requests",
      requests: updatedList,
    });
    assert.strictEqual(state.selectedRequestId, CANONICAL_REQUEST_FIXTURES[3].id);

    // If active filter has zero items after sync, selectedRequestId is empty
    state = requestReducer(state, {
      type: "sync-requests",
      requests: CANONICAL_REQUEST_FIXTURES.filter((r) => r.status === "Pending"),
    });
    assert.strictEqual(state.selectedRequestId, "");
    assert.strictEqual(getSelectedRequest(state), null);
  });
});

