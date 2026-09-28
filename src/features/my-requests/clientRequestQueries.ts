/**
 * Supabase PostgREST Query Contracts and DTO Types for Customer Portal (IMP-MS20)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C8, SDD-C10, ERD-E13, ERD-E15, ERD-E16, QAD-TC33
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes), BAN-RLS-07 (Strict RLS)
 */

import type { BookingRequestStatus, BookingPlatform, RawQuotationItemRecord } from "@/lib/booking/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const CLIENT_MY_REQUESTS_SELECT = `
  booking_request_id,
  profile_id,
  status,
  selected_platform,
  created_at,
  updated_at,
  booking_link:signed_booking_links!booking_requests_link_fk (
    link_id,
    token_hash,
    status,
    created_at,
    quotation:quotation_estimates!signed_booking_links_quotation_fk (
      quotation_id,
      quotation_number,
      pdf_r2_object_key,
      total_estimated_amount,
      negotiated_amount,
      negotiated_at,
      created_at,
      updated_at,
      quotation_document_snapshot,
      quotation_items (
        item_name,
        item_group_name,
        quantity,
        unit,
        unit_price,
        estimated_subtotal,
        pricing_details
      )
    ),
    snapshot:visualization_snapshots!signed_booking_links_snapshot_fk (
      snapshot_id,
      final_image_r2_key,
      created_at
    )
  )
`;

export interface ClientQuotationSnapshotDto {
  quotation_id: string;
  quotation_number: string;
  pdf_r2_object_key: string | null;
  total_estimated_amount: number;
  negotiated_amount: number | null;
  negotiated_at: string | null;
  created_at: string;
  updated_at: string;
  quotation_document_snapshot: unknown | null;
  quotation_items: RawQuotationItemRecord[];
}

export interface ClientSnapshotDto {
  snapshot_id: string;
  final_image_r2_key: string;
  created_at: string;
}

export interface ClientSignedLinkDto {
  link_id: string;
  token_hash: string;
  status: string;
  created_at: string;
  quotation: ClientQuotationSnapshotDto | null;
  snapshot: ClientSnapshotDto | null;
}

export interface ClientBookingRequestRow {
  booking_request_id: string;
  profile_id: string;
  status: BookingRequestStatus;
  selected_platform: BookingPlatform;
  created_at: string;
  updated_at: string;
  booking_link: ClientSignedLinkDto | null;
}

export interface GetClientMyRequestsResult {
  data: ClientBookingRequestRow[] | null;
  error: Error | null;
}

/**
 * Fetches booking requests for the authenticated customer using server Supabase client.
 * Enforces profile_id = user.id at both application and PostgreSQL RLS layers.
 */
export async function getClientMyRequests(
  customClient?: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<GetClientMyRequestsResult> {
  try {
    const supabase = customClient ?? (await createSupabaseServerClient());
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        data: null,
        error: new Error(authError?.message ?? "Unauthenticated customer session"),
      };
    }

    const { data, error } = await supabase
      .from("booking_requests")
      .select(CLIENT_MY_REQUESTS_SELECT)
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .overrideTypes<ClientBookingRequestRow[], { merge: false }>();

    if (error) {
      return {
        data: null,
        error: new Error(error.message),
      };
    }

    return {
      data: data ?? [],
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected database error";
    return {
      data: null,
      error: new Error(message),
    };
  }
}
