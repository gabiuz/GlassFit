import type { DashboardSummary } from "../data";
import Image from "next/image";

type WelcomeBannerProps = {
  summary: DashboardSummary;
};

export function WelcomeBanner({ summary }: WelcomeBannerProps) {
  return (
    <div className="h-59 px-5 py-5 relative bg-grad-light rounded-[20px] inline-flex justify-start items-center gap-11 overflow-hidden">
      <Image
        src="/admin/greeting-asset.svg"
        alt="greeting asset"
        width={330}
        height={280}
        className="self-start mt-0"
      />
      <div className=" inline-flex flex-col justify-start items-start gap-12">
        <div className=" flex flex-col justify-start items-start gap-1.5">
          <div className="justify-start text-white text-xl font-light leading-7">
            {summary.date}
          </div>
        </div>
        <div className="size- flex flex-col justify-start items-start gap-2.5">
          <div className="self-stretch justify-start text-white text-5xl font-medium leading-[57.60px]">
            {summary.greeting}
          </div>
          <div className="w-[734px] justify-start text-white text-xl font-light leading-7">
            {summary.description}
          </div>
        </div>
      </div>
    </div>
  );
}
