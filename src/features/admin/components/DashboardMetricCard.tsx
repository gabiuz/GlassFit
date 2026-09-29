import { cn } from "@/lib/utils";
import Image from "next/image";
import type { DashboardMetric } from "../data";

type DashboardMetricCardProps = {
  metric: DashboardMetric;
};

export function DashboardMetricCard({ metric }: DashboardMetricCardProps) {
  const isDark = metric.variant === "dark";

  return (
    <div
      className={cn(
        "p-4 sm:p-5 xl:p-6 rounded-2xl xl:rounded-[24px] flex items-center justify-between w-full select-none shadow-xs",
        isDark ? "bg-[#0f1422] text-white" : "bg-white text-[#0f1422]"
      )}
    >
      <div className="flex items-center justify-between w-full gap-3 sm:gap-4">
        <div className="flex flex-col gap-1.5 sm:gap-2.5 items-start min-w-0">
          <p
            className={cn(
              "text-xs sm:text-sm xl:text-lg font-normal leading-snug tracking-tight max-w-full",
              isDark ? "text-white" : "text-[#0f1422]"
            )}
          >
            {metric.label}
          </p>
          <p className="text-2xl sm:text-3xl xl:text-5xl font-medium leading-none tracking-tight">
            {metric.value}
          </p>
        </div>

        <div
          className={cn(
            "size-11 sm:size-14 xl:size-[65px] rounded-full flex items-center justify-center shrink-0",
            isDark ? "bg-[#07b6d3]" : "bg-[#f5f5f5]"
          )}
        >
          <div className="size-5 sm:size-6 relative shrink-0 flex items-center justify-center">
            <Image
              src={metric.iconSrc}
              alt=""
              width={25}
              height={25}
              aria-hidden="true"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}



