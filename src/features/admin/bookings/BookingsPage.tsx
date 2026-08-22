import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BookingsContent } from "./BookingsContent";
import type { AdminBookingItem, BookingStatus } from "./bookingData";

export async function BookingsPage() {
  const supabase = await createSupabaseServerClient();

  // Fetch bookings with related links, quotations, and profiles
  // We use type any because the deeply nested join types from Supabase can be problematic
  const { data: bookingsData } = await supabase
    .from("booking_requests")
    .select(`
      booking_request_id,
      status,
      created_at,
      selected_platform,
      signed_booking_links!inner (
        quotation_estimates!inner (
          quotation_number,
          pdf_r2_object_key,
          created_at,
          quotation_items (
            item_name
          )
        )
      ),
      profiles!inner (
        full_name,
        email,
        contact_number
      )
    `)
    .order("created_at", { ascending: false });

  const formattedBookings: AdminBookingItem[] = (bookingsData || []).map((b: any) => {
    const profile = b.profiles;
    const link = Array.isArray(b.signed_booking_links) ? b.signed_booking_links[0] : b.signed_booking_links;
    const quotation = link?.quotation_estimates;
    
    // Determine product summary
    const items = quotation?.quotation_items || [];
    const itemCount = items.length;
    const itemNames = items.slice(0, 2).map((i: any) => i.item_name).join(", ");
    const extraItems = itemCount > 2 ? ` and ${itemCount - 2} more` : "";
    const productSummary = `${itemCount} Product${itemCount > 1 ? "s" : ""} · ${itemNames}${extraItems}`;

    // Format dates
    const dateObj = new Date(b.created_at);
    const dateFormatted = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dateObj); // e.g. "Jun 3, 10:22 AM"

    const fullDateFormatted = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(dateObj); // e.g. "May 18, 2026"

    const timeFormatted = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dateObj); // e.g. "10:22 AM"

    const quoteDateObj = new Date(quotation?.created_at || b.created_at);
    const quoteFormatted = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(quoteDateObj); // e.g. "May 21, 2026, 3:42 PM"

    let status = b.status as BookingStatus;
    // Map "Ongoing" or "Done" to specific types if needed, though the UI supports Pending/Reviewing/Confirmed/Cancelled
    if (status === ("Ongoing" as any)) status = "Reviewing";
    if (status === ("Done" as any)) status = "Confirmed";

    return {
      id: b.booking_request_id,
      referenceNo: quotation?.quotation_number || "N/A",
      customer: {
        name: profile?.full_name || "Unknown",
        email: profile?.email || "Unknown",
        phone: profile?.contact_number || "Unknown",
      },
      productSummary,
      date: dateFormatted.replace(",", " ·"),
      receivedDate: `Received ${fullDateFormatted} at ${timeFormatted} via ${b.selected_platform}`,
      status: status,
      quotation: {
        filename: quotation?.pdf_r2_object_key?.split("/").pop() || "Quotation.pdf",
        generatedDate: `Generated ${quoteFormatted.replace(",", " ·")}`,
        size: "N/A", // We don't track file size in DB currently
      },
    };
  });

  return <BookingsContent initialBookings={formattedBookings} />;
}
