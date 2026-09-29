import type { DashboardRecentBookingRow } from "@/lib/booking/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapDashboardBookingRow } from "../bookings/adminBookingMapper";
import { DASHBOARD_RECENT_BOOKINGS_SELECT } from "../bookings/adminBookingQueries";
import type {
  BookingRequest,
  DashboardMetric,
  DashboardSummary,
  ProductUpdate,
} from "../data";
import { DashboardContent } from "./DashboardContent";

interface RecentProductRow {
  product_name: string;
  updated_at: string;
}

function metricValue(count: number | null, hasError: boolean): string {
  return hasError ? "Unavailable" : String(count ?? 0);
}

export async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const renderedAt = new Date();

  let userFullName = "Admin";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("profile_id", user.id)
      .single();
    if (profile?.full_name) userFullName = profile.full_name;
  }

  const summary: DashboardSummary = {
    title: "Dashboard",
    date: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(renderedAt),
    greeting: `Welcome, ${userFullName}!`,
    description: "Here's the summary of Glassfit activity.",
  };

  const [productsResult, pendingResult, ongoingResult, doneResult] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "Active"),
    supabase.from("booking_requests").select("*", { count: "exact", head: true }).eq("status", "Pending"),
    supabase.from("booking_requests").select("*", { count: "exact", head: true }).eq("status", "Ongoing"),
    supabase.from("booking_requests").select("*", { count: "exact", head: true }).eq("status", "Done"),
  ]);

  for (const [index, result] of [productsResult, pendingResult, ongoingResult, doneResult].entries()) {
    if (result.error) {
      console.error(`[DashboardPage] Metric query ${index + 1} failed:`, result.error);
    }
  }

  const metrics: DashboardMetric[] = [
    { label: "All Products", value: metricValue(productsResult.count, Boolean(productsResult.error)), iconSrc: "/admin/all-product.svg", variant: "dark" },
    { label: "New Booking", value: metricValue(pendingResult.count, Boolean(pendingResult.error)), iconSrc: "/admin/new-booking.svg" },
    { label: "Pending booking", value: metricValue(ongoingResult.count, Boolean(ongoingResult.error)), iconSrc: "/admin/pending-booking.svg" },
    { label: "Approved Booking", value: metricValue(doneResult.count, Boolean(doneResult.error)), iconSrc: "/admin/approved-booking.svg" },
  ];

  const { data: recentBookingsData, error: recentError } = await supabase
    .from("booking_requests")
    .select(DASHBOARD_RECENT_BOOKINGS_SELECT)
    .order("created_at", { ascending: false })
    .limit(5)
    .overrideTypes<DashboardRecentBookingRow[], { merge: false }>();

  if (recentError) {
    console.error("[DashboardPage] Failed to fetch recent bookings from Supabase:", recentError);
  }
  const recentBookings: BookingRequest[] = (recentBookingsData ?? []).map(mapDashboardBookingRow);

  const { data: recentProductsData } = await supabase
    .from("products")
    .select("product_name, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5)
    .overrideTypes<RecentProductRow[], { merge: false }>();

  const productUpdatesList: ProductUpdate[] = (recentProductsData ?? []).map((product) => {
    const diffMins = Math.round((renderedAt.getTime() - new Date(product.updated_at).getTime()) / 60000);
    const diffHrs = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHrs / 24);
    let timeAgo = "Just now";
    if (diffDays > 0) timeAgo = diffDays === 1 ? "Yesterday" : `${diffDays}d ago`;
    else if (diffHrs > 0) timeAgo = `${diffHrs}h ago`;
    else if (diffMins > 0) timeAgo = `${diffMins}m ago`;
    return { productName: product.product_name, description: `Updated -- ${timeAgo}` };
  });

  return (
    <DashboardContent
      summary={summary}
      metrics={metrics}
      recentBookings={recentBookings}
      recentBookingsError={recentError ? "Unable to load recent booking requests." : null}
      productUpdatesList={productUpdatesList}
    />
  );
}
