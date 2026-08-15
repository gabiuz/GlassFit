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
        "p-5 h-34 rounded-3xl flex justify-start items-start",
        metric.widthClass,
        isFeatured ? "bg-[#0F1422]" : "bg-[#FFFFFF]"
      )}
    >
      <div
        className={cn(
          "w-full flex justify-center items-center",
          isFeatured ? "gap-5" : "gap-7"
        )}
      >
        <div className="flex-1 inline-flex flex-col justify-start items-start gap-5">
          <div
            className={cn(
              "justify-start text-xl font-normal  leading-7",
              isFeatured ? "text-white" : "text-[#0F1422]"
            )}
          >
            {metric.label}
          </div>
          <div
            className={cn(
              "justify-start text-5xl font-medium leading-[57.60px]",
              isFeatured ? "text-white" : "text-[#0F1422]"
            )}
          >
            {metric.value}
          </div>
        </div>
        <div
          className={cn(
            "size-16 rounded-[50px] inline-flex justify-center items-center shrink-0",
            isFeatured ? "bg-[#07B6D3]" : "bg-[#F5F5F5]"
          )}
        >
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
  );
}
