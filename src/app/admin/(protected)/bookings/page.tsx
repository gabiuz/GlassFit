import { BookingsPage } from "@/features/admin";
import { requirePermission } from "@/lib/auth/admin";

export const metadata = {
  title: "Admin Bookings | GlassFit",
  description: "Review and process customer booking consultations",
};

export default async function AdminBookingsRoute() {
  await requirePermission("manage_bookings");
  return <BookingsPage />;
}
