import { cn } from "@/lib/utils";
import Image from "next/image";
import type { DashboardMetric } from "../data";

type DashboardMetricCardProps = {
  metric: DashboardMetric;
};

export function DashboardMetricCard({ metric }: DashboardMetricCardProps) {
  const isFeatured = metric.isFeatured === true;

  return (
    <div
      data-property-1={isFeatured ? "Default" : "Variant2"}
      className={cn(
        "p-5 rounded-3xl flex items-start shrink-0 select-none",
        isFeatured ? "bg-[#0f1422]" : "bg-white"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center shrink-0",
          isFeatured ? "gap-5" : "gap-[30px]"
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-2.5 items-start shrink-0",
            isFeatured ? "text-white" : "text-[#0f1422]"
          )}
        >
          <p className="text-xl font-normal leading-[1.4] tracking-[-0.38px] whitespace-nowrap">
            {metric.label}
          </p>
          <p className="text-5xl font-medium leading-[1.2] tracking-[-0.912px] whitespace-nowrap">
            {metric.value}
          </p>
        </div>

        <div
          className={cn(
            "size-[65px] rounded-[50px] flex items-center justify-center shrink-0",
            isFeatured ? "bg-[#07b6d3]" : "bg-[#f5f5f5]"
          )}
        >
          <div className="size-[25px] relative shrink-0 overflow-hidden flex items-center justify-center">
            <Image
              src={metric.iconSrc}
              alt=""
              width={25}
              height={25}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
