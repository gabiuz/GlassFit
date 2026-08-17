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
    <div className="flex flex-col justify-start items-start gap-[30px] w-full max-w-[1136px] pt-4 pb-12">
      <div className="w-full flex flex-col justify-start items-start">
        <h1 className="text-black text-[32px] font-medium leading-[1.2] tracking-[-0.608px]">
          {dashboardSummary.title}
        </h1>
      </div>

      <WelcomeBanner summary={dashboardSummary} />

      <div className="w-full flex justify-start items-center gap-5">
        {dashboardMetrics.map((metric) => (
          <DashboardMetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="w-full flex justify-start items-start gap-[23px]">
        <QuickActions actions={quickActions} />
        <RecentBookingsTable bookings={recentBookingRequests} />
        <ProductUpdates updates={productUpdates} />
      </div>
    </div>
  );
}
