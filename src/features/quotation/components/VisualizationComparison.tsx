"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Check } from "lucide-react";

type VariantKey = "A" | "B" | "C";

interface VariantData {
  key: VariantKey;
  title: string;
  label: string;
  image: string;
  status: "active" | "hidden" | "normal";
}

export function VisualizationComparison() {
  const [variants, setVariants] = useState<VariantData[]>([
    {
      key: "A",
      title: "Variant A - Title",
      label: "Variant A - Label",
      image: "/comparison_assets/room_with_furniture.png",
      status: "hidden",
    },
    {
      key: "B",
      title: "Variant B - Title",
      label: "Variant B - Label",
      image: "/comparison_assets/room_with_furniture.png",
      status: "active",
    },
    {
      key: "C",
      title: "Variant C - Title",
      label: "Variant C - Label",
      image: "/comparison_assets/room_with_furniture.png",
      status: "normal",
    },
  ]);

  const handleVariantClick = (clickedKey: VariantKey) => {
    setVariants((prev) =>
      prev.map((v) => {
        if (v.key === clickedKey) {
          // Toggle between states
          if (v.status === "active") {
            return { ...v, status: "hidden" };
          } else if (v.status === "hidden") {
            return { ...v, status: "normal" };
          } else {
            return { ...v, status: "active" };
          }
        } else {
          if (clickedKey === "A" || clickedKey === "B" || clickedKey === "C") {
            if (v.status === "active") {
              return { ...v, status: "normal" };
            }
          }
        }
        return v;
      }),
    );
  };

  const isAnyVariantActive = variants.some((v) => v.status === "active");

  return (
    <div className="w-full flex flex-col gap-9 select-none">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        <div className="relative flex flex-col h-64 sm:h-96 lg:h-144.75 w-full rounded-[20px] overflow-hidden shadow-[0px_0px_5px_0px_rgba(0,0,0,0.15)] bg-neutral-100">
          <Image
            alt="Before - Original Photo"
            className="object-cover rounded-[20px]"
            src="/comparison_assets/room_without_furniture.png"
            fill
            sizes="(max-w-md) 100vw, 50vw"
            priority
          />
          <div className="absolute top-7.5 left-6 bg-black border border-[#c3c3c3] border-solid flex items-center justify-center px-3.5 py-1.5 rounded-[20px] z-10">
            <span className="text-white text-base font-normal leading-6 whitespace-nowrap">
              Before - Original Photo
            </span>
          </div>
        </div>
        <div className="relative flex flex-col h-64 sm:h-96 lg:h-144.75 w-full rounded-[20px] overflow-hidden shadow-[0px_0px_5px_0px_rgba(0,0,0,0.15)] bg-neutral-100">
          <Image
            alt="After - Final Output"
            className={`object-cover rounded-[20px] transition-opacity duration-500 ${isAnyVariantActive ? "opacity-100" : "opacity-0"
              }`}
            src="/comparison_assets/room_with_furniture.png"
            fill
            sizes="(max-w-md) 100vw, 50vw"
            priority
          />
          {!isAnyVariantActive && (
            <Image
              alt="Empty Room"
              className="object-cover rounded-[20px] opacity-100"
              src="/comparison_assets/room_without_furniture.png"
              fill
              sizes="(max-w-md) 100vw, 50vw"
              priority
            />
          )}
          <div className="absolute top-7.5 left-6 bg-black border border-[#c3c3c3] border-solid flex items-center justify-center px-3.5 py-1.5 rounded-[20px] z-10">
            <span className="text-white text-base font-normal leading-6 whitespace-nowrap">
              After - Final Output
            </span>
          </div>
        </div>
      </div>
      <div className="bg-black border border-[#c3c3c3] border-solid drop-shadow-[0px_0px_2.5px_rgba(0,0,0,0.25)] flex flex-col gap-5 items-start p-7.5 rounded-[20px] w-full">
        <div>
          <h3 className="font-medium leading-7 text-2xl text-white whitespace-nowrap">
            Compare
          </h3>
        </div>
        <div className="flex flex-wrap gap-4 items-center justify-start w-full">
          {variants.map((v) => {
            const isActive = v.status === "active";
            const isHidden = v.status === "hidden";
            return (
              <div
                key={v.key}
                onClick={() => handleVariantClick(v.key)}
                className="flex flex-col gap-2.25 items-center relative w-44 cursor-pointer group select-none"
              >
                <div
                  className={`relative rounded-[20px] overflow-hidden shrink-0 w-37.5 h-37.5 transition-all duration-300 ${isActive
                      ? "border-5 border-[#129044] shadow-lg scale-105"
                      : "border border-neutral-800 hover:scale-[1.02] shadow-sm"
                    }`}
                >
                  <Image
                    alt={v.title}
                    className="object-cover rounded-[15px]"
                    src={v.image}
                    fill
                    sizes="150px"
                  />

                  {isActive && (
                    <div className="absolute top-3.25 right-3.25 w-7.5 h-7.5 bg-[#129044]/50 border-[2.5px] border-[#129044] rounded-[50%] flex items-center justify-center z-20 animate-in zoom-in duration-200 shadow-sm">
                      <Check className="w-4 h-4 text-[#129044] stroke-[3.5px]" />
                    </div>
                  )}
                  {isHidden && (
                    <>
                      <div className="absolute inset-0 bg-black/60 z-10 transition-opacity duration-300" />
                      <div className="absolute inset-0 flex items-center justify-center z-20">
                        <div className="w-7.5 h-7.5 rounded-full flex items-center justify-center border border-white/20">
                          <Image
                            src="/eye-slash.svg"
                            alt="Hidden"
                            width={30}
                            height={30}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-col items-center w-full leading-[1.4] text-center mt-1">
                  <p className="font-medium text-[16px] text-white tracking-[-0.304px] w-full transition-colors duration-200 group-hover:text-green">
                    {v.title}
                  </p>
                  <p className="font-normal text-[14px] text-neutral-400 tracking-[-0.266px] w-full">
                    {v.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
