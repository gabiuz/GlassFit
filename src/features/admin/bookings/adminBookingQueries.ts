/** PostgREST relation contracts for IMP-MS15 and QAD-TC29. */
export const ADMIN_BOOKINGS_SELECT = `
  booking_request_id,
  status,
  created_at,
  selected_platform,
  booking_link:signed_booking_links!booking_requests_link_fk (
    quotation:quotation_estimates!signed_booking_links_quotation_fk (
      quotation_id,
      quotation_number,
      pdf_r2_object_key,
      created_at,
      updated_at,
      total_estimated_amount,
      negotiated_amount,
      negotiated_by,
      negotiated_at,
      item_price_overrides,
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
