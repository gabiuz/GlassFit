"use client";

import React from "react";

export function BookingInfo() {
  return (
    <div className="bg-[#f5f5f5] flex flex-col gap-9.75 items-start p-6 md:p-12.5 relative rounded-[20px] w-full select-none">
      <div>
        <h2 className="text-black text-[32px] font-medium tracking-[-0.608px] leading-[1.2] whitespace-nowrap">
          Good to know before booking
        </h2>
      </div>
      {/* info card */}
      <div className="bg-white drop-shadow-[0px_0px_2.5px_rgba(0,0,0,0.25)] flex flex-col lg:flex-row gap-42 items-start px-6 md:px-12.5 py-7.5 relative rounded-[20px] w-full">
        <div className="flex flex-col gap-2.5 items-start relative shrink-0 w-full lg:w-auto">
          <div className="flex flex-col gap-2.5 items-start relative shrink-0 w-full">
            <div className="flex items-center justify-start py-2.5 relative shrink-0">
              <h3 className="font-medium text-green text-lg whitespace-nowrap leading-4">
                Payment Terms
              </h3>
            </div>
            <div
              className="flex flex-col gap-2.5 text-sm leading-[1.4] w-full"
            >
              <div className="flex gap-7.5 items-start justify-start w-full">
                <span className="text-[#c3c3c3] w-27.5 shrink-0">
                  Initial Payment:
                </span>
                <span className="text-black flex-1 font-normal">
                  50% to be paid at the time of ordering and fabrication
                </span>
              </div>
              <div className="flex gap-7.5 items-start justify-start w-full">
                <span className="text-[#c3c3c3] w-27.5 shrink-0">
                  Partial Payment:
                </span>
                <span className="text-black flex-1 font-normal">
                  20% of price upon 80% completed the installation
                </span>
              </div>
              <div className="flex gap-7.5 items-start justify-start w-full">
                <span className="text-[#c3c3c3] w-27.5 shrink-0">
                  Final Payment:
                </span>
                <span className="text-black flex-1 font-normal">
                  30% of price upon 100% completed the installation
                </span>
              </div>
            </div>
          </div>
          {/* delivery section */}
          <div className="flex flex-col gap-2.5 items-start relative shrink-0 w-full">
            <div className="flex items-center justify-start py-2.5 relative shrink-0">
              <h3 className="font-medium leading-4 text-green text-lg whitespace-nowrap">
                Delivery
              </h3>
            </div>
            <div
              className="flex flex-col items-start relative shrink-0 w-full"
            >
              <p className="text-black text-sm leading-5 font-medium">
                Transportation all into glass fabricator
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-5 items-start relative shrink-0 w-full lg:w-auto">
          <div className="flex flex-col gap-2.5 items-start relative shrink-0 w-full">
            <div className="flex items-center justify-start py-2.5 relative shrink-0">
              <h3 className="font-medium leading-4 text-green text-lg whitespace-nowrap">
                Installation Period
              </h3>
            </div>
            <div
              className="flex flex-col items-start relative shrink-0 w-full"
            >
              <p className="text-black text-sm leading-5 font-normal">
                2-3 weeks AFTER CONFIRMATION.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 items-start relative shrink-0 w-full">
            <div className="flex items-center justify-start py-2.5 relative shrink-0">
              <h3 className="font-medium leading-none text-green text-lg whitespace-nowrap w-25">
                Warranty
              </h3>
            </div>
            <div
              className="flex flex-col gap-2.5 text-sm leading-5 w-full"
            >
              <div className="flex gap-7.5 items-start justify-start w-full">
                <span className="text-[#c3c3c3] w-35 shrink-0">
                  Installation Works
                </span>
                <span className="text-black flex-1 font-normal">
                  Six (6) months against workmanship
                </span>
              </div>
              <div className="flex gap-7.5 items-start justify-start w-full">
                <span className="text-[#c3c3c3] w-35 shrink-0">
                  Consumable Material
                </span>
                <span className="text-black flex-1 font-normal">
                  Six (6) months against factory defects
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
