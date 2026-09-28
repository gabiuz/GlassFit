/**
 * GlassFit Customer-Facing Route Authentication & Authorization Guard (IMP-MS19)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C10, ERD-E2, QAD-TC32, BAN-RLS-07
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CustomerProfile {
  profile_id: string;
  full_name: string | null;
  email: string | null;
  account_type: string;
  status: string;
}

export interface CustomerContext {
  userId: string;
  profileId: string;
  fullName: string;
  email: string;
  accountType: "Customer" | "Admin";
  status: "Active";
}

export type CustomerAuthOutcome =
  | { status: "authenticated"; context: CustomerContext }
  | { status: "unauthenticated"; redirectTo: "/login?next=/my-requests" }
  | { status: "unauthorized"; redirectTo: "/" };

export interface CustomerAuthQueryClient {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string; email?: string } | null };
      error?: unknown | null;
    }>;
  };
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{
          data: CustomerProfile | null;
          error: unknown | null;
        }>;
      };
    };
  };
}

/**
 * Isolated customer authorization evaluator.
 * Throws on profile query infrastructure failure (fail-closed) and returns outcome otherwise.
 */
export async function evaluateCustomerAuth(
  client: CustomerAuthQueryClient
): Promise<CustomerAuthOutcome> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    return {
      status: "unauthenticated",
      redirectTo: "/login?next=/my-requests",
    };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("profile_id, full_name, email, account_type, status")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    return {
      status: "unauthorized",
      redirectTo: "/",
    };
  }

  const accountType = profile.account_type;
  const hasSupportedAccountType =
    accountType === "Customer" || accountType === "Admin";

  if (!hasSupportedAccountType || profile.status !== "Active") {
    return {
      status: "unauthorized",
      redirectTo: "/",
    };
  }

  return {
    status: "authenticated",
    context: {
      userId: user.id,
      profileId: profile.profile_id,
      fullName: profile.full_name ?? user.email ?? "Customer",
      email: profile.email ?? user.email ?? "",
      accountType,
      status: "Active",
    },
  };
}

/**
 * Server guard requiring an active Customer or Admin profile.
 * Redirects unauthenticated or unauthorized users, or throws on query failure.
 */
export async function requireActiveCustomer(
  customClient?: CustomerAuthQueryClient
): Promise<CustomerContext> {
  const client =
    customClient ??
    ((await createSupabaseServerClient()) as unknown as CustomerAuthQueryClient);
  const outcome = await evaluateCustomerAuth(client);

  if (outcome.status === "unauthenticated") {
    redirect(outcome.redirectTo);
  }

  if (outcome.status === "unauthorized") {
    redirect(outcome.redirectTo);
  }

  return outcome.context;
}
