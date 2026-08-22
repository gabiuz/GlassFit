import {
  quickActions,
  type DashboardMetric,
  type DashboardSummary,
  type BookingRequest,
  type ProductUpdate,
} from "../data";
import { DashboardMetricCard } from "./DashboardMetricCard";
import { ProductUpdates } from "./ProductUpdates";
import { QuickActions } from "./QuickActions";
import { RecentBookingsTable } from "./RecentBookingsTable";
import { WelcomeBanner } from "./WelcomeBanner";

type DashboardContentProps = {
  summary: DashboardSummary;
  metrics: DashboardMetric[];
  recentBookings: BookingRequest[];
  productUpdatesList: ProductUpdate[];
};

export function DashboardContent({ summary, metrics, recentBookings, productUpdatesList }: DashboardContentProps) {
  return (
    <div className="flex flex-col justify-start items-start gap-6 sm:gap-8 w-full max-w-[1240px] pb-12">
      <div className="w-full flex flex-col justify-start items-start">
        <h1 className="text-black text-2xl sm:text-3xl lg:text-[32px] font-medium leading-tight tracking-tight">
          {summary.title}
        </h1>
      </div>

      <WelcomeBanner summary={summary} />

      <div className="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {metrics.map((metric) => (
          <DashboardMetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <div className="w-full md:col-span-5 xl:col-span-3">
          <QuickActions actions={quickActions} />
        </div>
        <div className="w-full md:col-span-7 xl:col-span-6">
          <RecentBookingsTable bookings={recentBookings} />
        </div>
        <div className="w-full md:col-span-12 xl:col-span-3">
          <ProductUpdates updates={productUpdatesList} />
        </div>
      </div>
    </div>
  );
}

