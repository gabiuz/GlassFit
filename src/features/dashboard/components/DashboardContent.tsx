import {
  dashboardMetrics,
  dashboardSummary,
  quickActions,
  recentBookingRequests,
  productUpdates,
} from "../data";
import { DashboardMetricCard } from "./DashboardMetricCard";
import { ProductUpdates } from "./ProductUpdates";
import { QuickActions } from "./QuickActions";
import { RecentBookingsTable } from "./RecentBookingsTable";
import { WelcomeBanner } from "./WelcomeBanner";

export function DashboardContent() {
  return (
    <div className="w-full inline-flex flex-col justify-start items-start gap-7 bg-[#F6F6F6] mt-4">
      <div className="self-stretch flex flex-col justify-start items-start gap-1.5">
        <div className="self-stretch justify-start text-black text-3xl font-medium leading-10">
          {dashboardSummary.title}
        </div>
      </div>

      <WelcomeBanner summary={dashboardSummary} />

      <div className="self-stretch inline-flex justify-start items-center gap-5">
        {dashboardMetrics.map((metric) => (
          <DashboardMetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="size- inline-flex justify-start items-start gap-6">
        <QuickActions actions={quickActions} />
        <RecentBookingsTable bookings={recentBookingRequests} />
        <ProductUpdates updates={productUpdates} />
      </div>
    </div>
  );
}
