/**
 * Unit Tests: Customer Server Auth Guard (IMP-MS19)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C10, ERD-E2, QAD-TC32, BAN-RLS-07
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCustomerAuth,
  type CustomerAuthQueryClient,
  type CustomerProfile,
} from "../../src/lib/auth/customer";

function createMockClient(options: {
  user?: { id: string; email?: string } | null;
  userError?: unknown | null;
  profile?: CustomerProfile | null;
  profileError?: unknown | null;
}): CustomerAuthQueryClient {
  return {
    auth: {
      getUser: async () => ({
        data: { user: options.user ?? null },
        error: options.userError ?? null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (options.profileError) {
              return { data: null, error: options.profileError };
            }
            return { data: options.profile ?? null, error: null };
          },
        }),
      }),
    }),
  };
}

describe("IMP-MS19: Customer Auth Guard Evaluation", () => {
  it("TC-01: Missing Supabase user produces unauthenticated outcome with /login redirect", async () => {
    const client = createMockClient({
      user: null,
    });

    const result = await evaluateCustomerAuth(client);
    assert.strictEqual(result.status, "unauthenticated");
    if (result.status === "unauthenticated") {
      assert.strictEqual(result.redirectTo, "/login?next=/my-requests");
    }
  });

  it("TC-02: Auth error from getUser produces unauthenticated outcome with /login redirect", async () => {
    const client = createMockClient({
      user: null,
      userError: new Error("JWT expired or session invalid"),
    });

    const result = await evaluateCustomerAuth(client);
    assert.strictEqual(result.status, "unauthenticated");
    if (result.status === "unauthenticated") {
      assert.strictEqual(result.redirectTo, "/login?next=/my-requests");
    }
  });

  it("TC-03: User exists but profile row is missing produces unauthorized outcome with / redirect", async () => {
    const client = createMockClient({
      user: { id: "usr-123", email: "guest@example.com" },
      profile: null,
    });

    const result = await evaluateCustomerAuth(client);
    assert.strictEqual(result.status, "unauthorized");
    if (result.status === "unauthorized") {
      assert.strictEqual(result.redirectTo, "/");
    }
  });

  it("TC-04: Active Admin profile succeeds and returns authenticated context", async () => {
    const client = createMockClient({
      user: { id: "usr-admin", email: "admin@glassfit.ph" },
      profile: {
        profile_id: "usr-admin",
        full_name: "Admin User",
        email: "admin@glassfit.ph",
        account_type: "Admin",
        status: "Active",
      },
    });

    const result = await evaluateCustomerAuth(client);
    assert.strictEqual(result.status, "authenticated");
    if (result.status === "authenticated") {
      assert.strictEqual(result.context.userId, "usr-admin");
      assert.strictEqual(result.context.profileId, "usr-admin");
      assert.strictEqual(result.context.fullName, "Admin User");
      assert.strictEqual(result.context.email, "admin@glassfit.ph");
      assert.strictEqual(result.context.accountType, "Admin");
      assert.strictEqual(result.context.status, "Active");
    }
  });

  it("TC-05: Customer exists but status is Inactive or Suspended produces unauthorized outcome with / redirect", async () => {
    const inactiveClient = createMockClient({
      user: { id: "usr-inactive", email: "inactive@example.com" },
      profile: {
        profile_id: "usr-inactive",
        full_name: "Inactive User",
        email: "inactive@example.com",
        account_type: "Customer",
        status: "Inactive",
      },
    });

    const resultInactive = await evaluateCustomerAuth(inactiveClient);
    assert.strictEqual(resultInactive.status, "unauthorized");
    if (resultInactive.status === "unauthorized") {
      assert.strictEqual(resultInactive.redirectTo, "/");
    }

    const suspendedClient = createMockClient({
      user: { id: "usr-suspended", email: "suspended@example.com" },
      profile: {
        profile_id: "usr-suspended",
        full_name: "Suspended User",
        email: "suspended@example.com",
        account_type: "Customer",
        status: "Suspended",
      },
    });

    const resultSuspended = await evaluateCustomerAuth(suspendedClient);
    assert.strictEqual(resultSuspended.status, "unauthorized");
    if (resultSuspended.status === "unauthorized") {
      assert.strictEqual(resultSuspended.redirectTo, "/");
    }

    const inactiveAdminClient = createMockClient({
      user: { id: "usr-admin-inactive", email: "inactive-admin@glassfit.ph" },
      profile: {
        profile_id: "usr-admin-inactive",
        full_name: "Inactive Admin",
        email: "inactive-admin@glassfit.ph",
        account_type: "Admin",
        status: "Inactive",
      },
    });

    const resultInactiveAdmin = await evaluateCustomerAuth(inactiveAdminClient);
    assert.strictEqual(resultInactiveAdmin.status, "unauthorized");
    if (resultInactiveAdmin.status === "unauthorized") {
      assert.strictEqual(resultInactiveAdmin.redirectTo, "/");
    }
  });

  it("TC-06: Active Customer profile succeeds and returns authenticated context", async () => {
    const client = createMockClient({
      user: { id: "usr-customer-1", email: "customer@example.com" },
      profile: {
        profile_id: "usr-customer-1",
        full_name: "Juan Dela Cruz",
        email: "customer@example.com",
        account_type: "Customer",
        status: "Active",
      },
    });

    const result = await evaluateCustomerAuth(client);
    assert.strictEqual(result.status, "authenticated");
    if (result.status === "authenticated") {
      assert.strictEqual(result.context.userId, "usr-customer-1");
      assert.strictEqual(result.context.profileId, "usr-customer-1");
      assert.strictEqual(result.context.fullName, "Juan Dela Cruz");
      assert.strictEqual(result.context.email, "customer@example.com");
      assert.strictEqual(result.context.accountType, "Customer");
      assert.strictEqual(result.context.status, "Active");
    }
  });

  it("TC-07: Profile query infrastructure failure throws and does not convert to redirect", async () => {
    const queryError = new Error("Connection terminated unexpectedly (PostgREST 500)");
    const client = createMockClient({
      user: { id: "usr-customer-2", email: "customer2@example.com" },
      profileError: queryError,
    });

    await assert.rejects(
      async () => {
        await evaluateCustomerAuth(client);
      },
      (err: unknown) => {
        assert.strictEqual(err, queryError);
        return true;
      }
    );
  });
});
