import type { DashboardSummary } from "../data";
import Image from "next/image";

type WelcomeBannerProps = {
  summary: DashboardSummary;
};

export function WelcomeBanner({ summary }: WelcomeBannerProps) {
  return (
    <div className="w-full min-h-[190px] xl:h-59 px-5 py-5 relative bg-grad-light rounded-[20px] flex justify-start items-center gap-6 xl:gap-11 overflow-hidden">
      <Image
        src="/admin/greeting-asset.svg"
        alt="greeting asset"
        width={330}
        height={280}
        className="hidden xl:block self-start mt-0 shrink-0"
      />
      <div className="flex flex-col justify-start items-start gap-4 sm:gap-6 xl:gap-12 flex-1 min-w-0">
        <div className="flex flex-col justify-start items-start gap-1.5">
          <div className="justify-start text-white text-sm sm:text-base xl:text-xl font-light leading-snug xl:leading-7">
            {summary.date}
          </div>
        </div>
        <div className="flex flex-col justify-start items-start gap-1.5 sm:gap-2.5">
          <div className="self-stretch justify-start text-white text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-medium leading-tight xl:leading-[57.60px]">
            {summary.greeting}
          </div>
          <div className="w-full max-w-[734px] justify-start text-white text-xs sm:text-sm xl:text-xl font-light leading-snug xl:leading-7">
            {summary.description}
          </div>
        </div>
      </div>
    </div>
  );
}

