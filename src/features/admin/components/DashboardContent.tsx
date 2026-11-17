"use client";

import { useState, useSyncExternalStore } from "react";
import { useAdminSession } from "@/features/admin/auth/AdminSessionProvider";
import { AdminHelpButton } from "@/features/admin/onboarding/AdminHelpButton";
import { AdminSurfaceTour } from "@/features/admin/onboarding/AdminSurfaceTour";
import { resolveDashboardTourSteps } from "@/features/admin/onboarding/adminTourConfigs";
import {
  markAdminSurfaceDontShowAgain,
  readAdminOnboardingPreference,
  readAdminOnboardingSession,
  setAdminSurfaceSessionSkipped,
} from "@/lib/onboarding/storage";
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

const subscribeNoop = () => () => {};

type DashboardContentProps = {
  summary: DashboardSummary;
  metrics: DashboardMetric[];
  recentBookings: BookingRequest[];
  recentBookingsError?: string | null;
  productUpdatesList: ProductUpdate[];
};

export function DashboardContent({ summary, metrics, recentBookings, recentBookingsError, productUpdatesList }: DashboardContentProps) {
  const { profileId } = useAdminSession();
  const isHydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [helpTriggerCount, setHelpTriggerCount] = useState(0);
  const [cueDismissed, setCueDismissed] = useState(false);

  const showWelcomeCue =
    isHydrated &&
    !cueDismissed &&
    (readAdminOnboardingPreference(profileId).surfaces.dashboard ?? "unseen") === "unseen" &&
    !readAdminOnboardingSession(profileId).skippedSurfaces.dashboard;

  return (
    <div className="flex flex-col justify-start items-start gap-6 sm:gap-8 w-full max-w-[1240px] pb-12">
      <div className="w-full flex flex-col justify-start items-start">
        <h1 className="text-black text-2xl sm:text-3xl lg:text-[32px] font-medium leading-tight tracking-tight">
          {summary.title}
        </h1>
      </div>

      <WelcomeBanner summary={summary} />

      <div data-onboarding-target="admin-dashboard-metrics" className="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {metrics.map((metric) => (
          <DashboardMetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <div data-onboarding-target="admin-dashboard-quick-actions" className="w-full md:col-span-5 xl:col-span-3">
          <QuickActions actions={quickActions} />
        </div>
        <div data-onboarding-target="admin-dashboard-activity-feeds" className="w-full md:col-span-7 xl:col-span-9 grid grid-cols-1 xl:grid-cols-9 gap-6 items-start">
          <div className="w-full xl:col-span-6">
            <RecentBookingsTable bookings={recentBookings} loadError={recentBookingsError} />
          </div>
          <div className="w-full xl:col-span-3">
            <ProductUpdates updates={productUpdatesList} />
          </div>
        </div>
      </div>

      <AdminSurfaceTour
        profileId={profileId}
        surfaceId="dashboard"
        steps={resolveDashboardTourSteps()}
        autoOpen={false}
        manualTriggerCount={helpTriggerCount}
      />

      {!showWelcomeCue && (
        <AdminHelpButton
          onClick={() => {
            setCueDismissed(true);
            setHelpTriggerCount((prev) => prev + 1);
          }}
          ariaLabel="Dashboard guide help"
        />
      )}

      {showWelcomeCue && (
        <aside
          data-onboarding-target="admin-dashboard-welcome-cue"
          aria-label="Admin workbench welcome guide"
          className="fixed bottom-5 right-5 z-50 w-[min(calc(100vw-24px),360px)] rounded-[20px] border border-[#07b6d3]/40 bg-white p-4 shadow-[0px_10px_30px_rgba(0,0,0,0.18)]"
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-[#0f1422]">
              New to the Admin Workbench?
            </p>
            <p className="text-xs leading-relaxed text-neutral-600">
              Take a quick 3-step tour of your live metrics, quick action shortcuts, and recent activity feeds.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCueDismissed(true);
                setHelpTriggerCount((prev) => prev + 1);
              }}
              className="min-h-10 flex-1 rounded-xl bg-[#07b6d3] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#06a3bd] transition-colors cursor-pointer"
            >
              Take a quick tour
            </button>
            <button
              type="button"
              onClick={() => {
                setCueDismissed(true);
                setAdminSurfaceSessionSkipped(profileId, "dashboard", true);
              }}
              className="min-h-10 rounded-xl px-2.5 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-[#0f1422] transition-colors cursor-pointer"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                setCueDismissed(true);
                markAdminSurfaceDontShowAgain(profileId, "dashboard");
              }}
              className="min-h-10 rounded-xl px-2.5 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-[#0f1422] transition-colors cursor-pointer"
            >
              Don&apos;t show again
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
