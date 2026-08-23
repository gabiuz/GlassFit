import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardContent } from "./DashboardContent";
import type { DashboardSummary, DashboardMetric, BookingRequest, ProductUpdate, BookingStatus } from "../data";

export async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userFullName = "Admin";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("profile_id", user.id)
      .single();
    if (profile?.full_name) {
      userFullName = profile.full_name;
    }
  }

  const currentDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const summary: DashboardSummary = {
    title: "Dashboard",
    date: currentDate,
    greeting: `Welcome, ${userFullName}!`,
    description: "Here's the summary of Glassfit activity.",
  };

  // Queries for Metrics
  const { count: productsCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("status", "Active");

  const { count: pendingBookingsCount } = await supabase
    .from("booking_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "Pending");

  // In DB, 'Ongoing' maps to 'Reviewing'/'Pending booking' UI state
  const { count: ongoingBookingsCount } = await supabase
    .from("booking_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "Ongoing");

  // 'Done' maps to 'Approved/Confirmed' UI state
  const { count: doneBookingsCount } = await supabase
    .from("booking_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "Done");

  const metrics: DashboardMetric[] = [
    {
      label: "All Products",
      value: String(productsCount || 0),
      iconSrc: "/admin/all-product.svg",
      variant: "dark",
    },
    {
      label: "New Booking",
      value: String(pendingBookingsCount || 0),
      iconSrc: "/admin/new-booking.svg",
    },
    {
      label: "Pending booking",
      value: String(ongoingBookingsCount || 0),
      iconSrc: "/admin/pending-booking.svg",
    },
    {
      label: "Approved Booking",
      value: String(doneBookingsCount || 0),
      iconSrc: "/admin/approved-booking.svg",
    },
  ];

  // Recent Bookings
  const { data: recentBookingsData } = await supabase
    .from("booking_requests")
    .select(`
      booking_request_id,
      status,
      profiles!inner(full_name),
      signed_booking_links!inner(
        quotation_estimates!inner(
          quotation_items(item_name)
        )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(5);

  const recentBookings: BookingRequest[] = (recentBookingsData || []).map((b: any) => {
    const profile = b.profiles;
    const link = Array.isArray(b.signed_booking_links) ? b.signed_booking_links[0] : b.signed_booking_links;
    const quotation = link?.quotation_estimates;
    const items = quotation?.quotation_items || [];
    const productName = items.length > 0 ? items[0].item_name : "Unknown Product";

    let status = b.status;
    if (status === "Ongoing") status = "Pending"; // Mapped for UI colors
    if (status === "Done") status = "Confirmed"; // Mapped for UI colors

    return {
      id: b.booking_request_id,
      customer: profile?.full_name || "Unknown",
      productName,
      status: status as BookingStatus,
    };
  });

  // Recent Product Updates
  const { data: recentProductsData } = await supabase
    .from("products")
    .select("product_name, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  const productUpdatesList: ProductUpdate[] = (recentProductsData || []).map((p: any) => {
    const updatedDate = new Date(p.updated_at);
    const diffMs = new Date().getTime() - updatedDate.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHrs = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHrs / 24);

    let timeAgo = "Just now";
    if (diffDays > 0) {
      timeAgo = diffDays === 1 ? "Yesterday" : `${diffDays}d ago`;
    } else if (diffHrs > 0) {
      timeAgo = `${diffHrs}h ago`;
    } else if (diffMins > 0) {
      timeAgo = `${diffMins}m ago`;
    }

    return {
      productName: p.product_name,
      description: `Updated -- ${timeAgo}`,
    };
  });

  return (
    <DashboardContent
      summary={summary}
      metrics={metrics}
      recentBookings={recentBookings}
      productUpdatesList={productUpdatesList}
    />
  );
}
