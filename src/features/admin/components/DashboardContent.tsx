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
    <div className="flex flex-col justify-start items-start gap-6 sm:gap-8 w-full max-w-[1240px] pb-12">
      <div className="w-full flex flex-col justify-start items-start">
        <h1 className="text-black text-2xl sm:text-3xl lg:text-[32px] font-medium leading-tight tracking-tight">
          {dashboardSummary.title}
        </h1>
      </div>

      <WelcomeBanner summary={dashboardSummary} />

      <div className="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {dashboardMetrics.map((metric) => (
          <DashboardMetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <div className="w-full md:col-span-5 xl:col-span-3">
          <QuickActions actions={quickActions} />
        </div>
        <div className="w-full md:col-span-7 xl:col-span-6">
          <RecentBookingsTable bookings={recentBookingRequests} />
        </div>
        <div className="w-full md:col-span-12 xl:col-span-3">
          <ProductUpdates updates={productUpdates} />
        </div>
      </div>
    </div>
  );
}

