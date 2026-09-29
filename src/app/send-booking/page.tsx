import { BackgroundNavbar } from "@/components/shared/BackgroundNavbar";
import { BookingFlow } from "@/features/booking";

export default function SendBookingPage() {
  return (
    <main className="w-full bg-white relative">
      <BackgroundNavbar />
      <BookingFlow />
    </main>
  );
}
