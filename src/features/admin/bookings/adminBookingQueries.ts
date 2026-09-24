/** PostgREST relation contracts for IMP-MS15 and QAD-TC29. */
export const ADMIN_BOOKINGS_SELECT = `
  booking_request_id,
  status,
  created_at,
  selected_platform,
  booking_link:signed_booking_links!booking_requests_link_fk (
    quotation:quotation_estimates!signed_booking_links_quotation_fk (
      quotation_number,
      pdf_r2_object_key,
      created_at,
      quotation_items (
        item_name,
        pricing_details
      )
    )
  ),
  customer:profiles!booking_requests_profile_fk (
    full_name,
    email,
    contact_number
  )
`;

export const DASHBOARD_RECENT_BOOKINGS_SELECT = `
  booking_request_id,
  status,
  customer:profiles!booking_requests_profile_fk (
    full_name
  ),
  booking_link:signed_booking_links!booking_requests_link_fk (
    quotation:quotation_estimates!signed_booking_links_quotation_fk (
      quotation_items (
        item_name,
        pricing_details
      )
    )
  )
`;
