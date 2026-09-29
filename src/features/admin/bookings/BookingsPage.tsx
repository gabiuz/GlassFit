import type { BookingRequestWithRelationsRow } from "@/lib/booking/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapAdminBookingRow } from "./adminBookingMapper";
import { ADMIN_BOOKINGS_SELECT } from "./adminBookingQueries";
import { BookingsContent } from "./BookingsContent";

const LOAD_ERROR = "Unable to load booking requests. Refresh to try again.";

export async function BookingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: bookingsData, error: bookingsError } = await supabase
    .from("booking_requests")
    .select(ADMIN_BOOKINGS_SELECT)
    .order("created_at", { ascending: false })
    .overrideTypes<BookingRequestWithRelationsRow[], { merge: false }>();

  if (bookingsError) {
    console.error(
      "[BookingsPage] Failed to fetch booking requests from Supabase:",
      bookingsError
    );
    return <BookingsContent initialBookings={[]} loadError={LOAD_ERROR} />;
  }

  return (
    <BookingsContent initialBookings={(bookingsData ?? []).map(mapAdminBookingRow)} />
  );
}
