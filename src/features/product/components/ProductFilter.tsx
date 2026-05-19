"use client";
import * as React from "react";
import Image from "next/image";
import { useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";

import { Slider } from "@/components/ui/slider";

const MIN_PRICE = 0;
const MAX_PRICE = 50000;

function ThumbTooltip({
  formattedValue,
  value,
  isDragging,
}: {
  formattedValue: string;
  value: number;
  isDragging?: boolean;
}) {
  const x = useMotionValue(value);

  React.useEffect(() => {
    x.set(value);
  }, [value, x]);

  const velocity = useVelocity(x);
  const smoothVelocity = useSpring(velocity, { damping: 50, stiffness: 400 });
  const sway = useTransform(smoothVelocity, [-50000, 0, 50000], [30, 0, -30], {
    clamp: true,
  });

  return (
    <div className={`pointer-events-none absolute -top-18 left-1/2 -translate-x-1/2 translate-y-3 scale-50 opacity-0 origin-bottom transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-active:translate-y-0 group-active:scale-100 group-active:opacity-100 ${isDragging ? "translate-y-0 scale-100 opacity-100" : ""}`}>
      <motion.div
        style={{ rotate: sway, transformOrigin: "bottom center" }}
        className="flex flex-col items-center"
      >
        <div className="bg-green shadow-lg text-white text-base leading-[1.4] px-5 py-2.5 rounded-[32px]">
          {formattedValue}
        </div>
        <div className="h-1.5 w-3 bg-green [clip-path:polygon(50%_100%,0_0,100%_0)]" />
      </motion.div>
    </div>
  );
}

export function ProductFilter() {
  const [range, setRange] = React.useState<[number, number]>([
    MIN_PRICE,
    MAX_PRICE,
  ]);
  const [selectedCategory, setSelectedCategory] = useState("Doors");
  const categoryOptions = [
    { label: "Doors", icon: "/door.svg" },
    { label: "Windows", icon: "/windows.svg" },
    { label: "Cabinets", icon: "/cabinet.svg" },
    { label: "Partition", icon: "/partition.svg" },
    { label: "Shower Enclosure", icon: "/shower.svg" },
    { label: "Exterior Installation", icon: "/exterior.svg" },
  ];

  const [anodized, setAnodizedFinish] = useState<string[]>([]);
  const anodizedFinish = [
    {
      label: "Natural/Silver",
      icon: "/aluminum_finish_icons/natural_silver.svg",
    },
    {
      label: "Analok (Champagne/Gold)",
      icon: "/aluminum_finish_icons/analok.svg",
    },
    {
      label: "Bronze/Brown",
      icon: "/aluminum_finish_icons/bronze_brown.svg",
    },
    { label: "Matte Gray", icon: "/aluminum_finish_icons/matte_gray.svg" },
    { label: "Black", icon: "/aluminum_finish_icons/black.svg" },
  ];

  const [powderCoated, setPowderCoatedFinish] = useState<string[]>([]);
  const powderCoatedFinish = [
    { label: "White", icon: "/powder_coated_icons/white.svg" },
    { label: "Brown", icon: "/powder_coated_icons/brown.svg" },
    { label: "Black", icon: "/powder_coated_icons/black.svg" },
    { label: "Matte Black", icon: "/powder_coated_icons/matte_black.svg" },
  ];

  const [checkedDoors, setCheckedDoors] = useState<string[]>([]);
  const doorStyles = [
    { label: "All" },
    { label: "French Doors" },
    { label: "Sliding Doors" },
    { label: "Swing Doors" },
    { label: "Screen Doors" },
    { label: "Bi-Fold Doors" },
    { label: "Pocket Doors" },
  ];

  const [materialFinish, setMaterialFinish] = useState<string[]>([]);
  const materials = [{ label: "Aluminum" }, { label: "Glass" }];

  const handleRangeChange = (next: number[]) => {
    if (next.length !== 2) return;
    const [nextMin, nextMax] = next;
    setRange([
      Math.min(Math.max(nextMin, MIN_PRICE), MAX_PRICE),
      Math.min(Math.max(nextMax, MIN_PRICE), MAX_PRICE),
    ]);
  };

  const handleMinChange = (value: string) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    setRange([Math.min(Math.max(next, MIN_PRICE), range[1]), range[1]]);
  };

  const handleMaxChange = (value: string) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    setRange([range[0], Math.max(Math.min(next, MAX_PRICE), range[0])]);
  };

  const formatShortPrice = (value: number) => {
    if (value >= 1000) {
      return `${Math.round(value / 1000)}k`;
    }
    return `${value}`;
  };

  return (
    <div className="w-102 flex flex-col p-7.5 justify-start gap-5 shadow-[2px_4px_11.699999809265137px_0px_rgba(0,0,0,0.10)] rounded-[20px]">
      <div className="flex flex-col gap-19.75">
        <h2 className="text-xl text-black font-medium leading-7">
          Price Range
        </h2>
        <div className="relative w-full px-6">
          <Slider
            value={range}
            min={MIN_PRICE}
            max={MAX_PRICE}
            step={500}
            onValueChange={handleRangeChange}
            renderThumbContent={(index, isDragging) => (
              <ThumbTooltip
                formattedValue={formatShortPrice(range[index])}
                value={range[index]}
                isDragging={isDragging}
              />
            )}
            className="cursor-pointer"
          />
          <div className="mt-7 flex items-center justify-between">
            <label className="relative flex h-12 w-30.25 items-center rounded-[20px] border border-[#8b8b8b] px-3">
              <span className="absolute left-3 text-[#8b8b8b] text-base">
                ₱
              </span>
              <input
                type="number"
                min={MIN_PRICE}
                max={MAX_PRICE}
                value={range[0]}
                onChange={(event) => handleMinChange(event.target.value)}
                className="w-full bg-transparent pl-4 text-[#8b8b8b] text-base outline-hidden appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </label>
            <div className="h-px w-2 rounded-[1px] bg-[#8b8b8b]" />
            <label className="relative flex h-12 w-30.25 items-center rounded-[20px] border border-[#8b8b8b] px-3">
              <span className="absolute left-3 text-[#8b8b8b] text-base">
                ₱
              </span>
              <input
                type="number"
                min={MIN_PRICE}
                max={MAX_PRICE}
                value={range[1]}
                onChange={(event) => handleMaxChange(event.target.value)}
                className="w-full flex flex-col justify-between bg-transparent pl-4 text-[#8b8b8b] text-base outline-hidden appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </label>
          </div>
        </div>
      </div>
      <div>
        <h2 className="text-xl text-black font-medium leading-7">
          Product Filter
        </h2>
      </div>
      <div className="flex flex-col items-start">
        <div className="flex items-center gap-3 rounded-[20px] px-3.75 py-2.5">
          <Image
            src="/product_cart.svg"
            alt="Products category"
            width={25}
            height={25}
          />
          <h3 className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
            Products Category
          </h3>
        </div>
        <div className="flex w-full flex-col items-start pl-12.5">
          <p className="text-[12px] leading-[1.4] tracking-[-0.228px] text-[#c3c3c3]">
            Select one
          </p>
          {categoryOptions.map((option) => {
            const isSelected = selectedCategory === option.label;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => setSelectedCategory(option.label)}
                className="flex w-full items-center gap-3 px-3.75 py-2.5 text-left"
              >
                <span
                  className={
                    isSelected
                      ? "h-4 w-4 shrink-0 rounded-full border-3 border-black bg-green"
                      : "h-4 w-4 shrink-0 rounded-full bg-[#c3c3c3]"
                  }
                  aria-hidden="true"
                />
                <Image
                  src={option.icon}
                  alt={option.label}
                  width={25}
                  height={25}
                />
                <span className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-3 rounded-[20px] px-3.75 py-2.5">
          <Image src="/door.svg" alt="door style icon" width={25} height={25} />
          <h3 className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
            Door Style
          </h3>
        </div>
        <div className="flex w-full flex-col items-start pl-12.5">
          <p className="text-[12px] leading-[1.4] tracking-[-0.228px] text-[#c3c3c3]">
            Select all that apply
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {doorStyles.map((door) => {
              const isChecked = checkedDoors.includes(door.label);

              const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const checked = e.target.checked;
                if (door.label === "All") {
                  if (checked) {
                    setCheckedDoors(doorStyles.map((d) => d.label));
                  } else {
                    setCheckedDoors([]);
                  }
                } else {
                  if (checked) {
                    setCheckedDoors((prev) => {
                      const newChecked = [
                        ...prev.filter((d) => d !== "All"),
                        door.label,
                      ];
                      const allSpecificDoors = doorStyles
                        .map((d) => d.label)
                        .filter((l) => l !== "All");
                      const isAllChecked = allSpecificDoors.every((l) =>
                        newChecked.includes(l),
                      );
                      return isAllChecked
                        ? doorStyles.map((d) => d.label)
                        : newChecked;
                    });
                  } else {
                    setCheckedDoors((prev) =>
                      prev.filter((d) => d !== door.label && d !== "All"),
                    );
                  }
                }
              };

              return (
                <label
                  key={door.label}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={handleChange}
                      className="peer sr-only"
                    />
                    <div className="flex size-3 items-center justify-center rounded-xs bg-[#c3c3c3] peer-checked:bg-black">
                      {isChecked && (
                        <svg
                          className="size-2 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={4}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
                    {door.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
      <div>
        <h2 className="text-xl text-black font-medium leading-7">
          Design & Customization Options
        </h2>
      </div>
      <div>
        <div className="flex items-center gap-3 rounded-[20px] px-3.75 py-2.5">
          <Image
            src="/paint_brush.svg"
            alt="material finish icon"
            width={25}
            height={25}
          />
          <h3 className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
            Material Finish
          </h3>
        </div>
        <div className="flex w-full flex-col items-start pl-12.5">
          <p className="text-[12px] leading-[1.4] tracking-[-0.228px] text-[#c3c3c3]">
            Select one or both
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {materials.map((material) => {
              const isChecked = materialFinish.includes(material.label);

              const handleMaterialChange = (
                e: React.ChangeEvent<HTMLInputElement>,
              ) => {
                if (e.target.checked) {
                  setMaterialFinish((prev) => [...prev, material.label]);
                } else {
                  setMaterialFinish((prev) =>
                    prev.filter((m) => m !== material.label),
                  );
                }
              };

              return (
                <label
                  key={material.label}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={handleMaterialChange}
                      className="peer sr-only"
                    />
                    <div className="flex size-3 items-center justify-center rounded-xs bg-[#c3c3c3] peer-checked:bg-black">
                      {isChecked && (
                        <svg
                          className="size-2 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={4}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
                    {material.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-3 rounded-[20px] px-3.75 py-2.5">
          <Image
            src="/paint_roller.svg"
            alt="material finish icon"
            width={25}
            height={25}
          />
          <h3 className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
            Aluminum Finish
          </h3>
        </div>
        <div className="flex w-full flex-col items-start pl-12.5">
          <p className="text-[12px] leading-[1.4] tracking-[-0.228px] text-[#c3c3c3]">
            Anodized Finish
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {anodizedFinish.map((item) => {
              const isChecked = anodized.includes(item.label);

              const handleAnodizedChange = (
                e: React.ChangeEvent<HTMLInputElement>,
              ) => {
                if (e.target.checked) {
                  setAnodizedFinish((prev) => [...prev, item.label]);
                } else {
                  setAnodizedFinish((prev) =>
                    prev.filter((m) => m !== item.label),
                  );
                }
              };

              return (
                <label
                  key={item.label}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={handleAnodizedChange}
                      className="peer sr-only"
                    />
                    <div className="flex size-3 items-center justify-center rounded-xs bg-[#c3c3c3] peer-checked:bg-black">
                      {isChecked && (
                        <svg
                          className="size-2 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={4}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <Image
                    src={item.icon}
                    alt={item.label}
                    width={25}
                    height={25}
                  />
                  <span className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
                    {item.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="mt-5 flex w-full flex-col items-start pl-12.5">
          <p className="text-[12px] leading-[1.4] tracking-[-0.228px] text-[#c3c3c3]">
            Powder-Coated Finish
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {powderCoatedFinish.map((item) => {
              const isChecked = powderCoated.includes(item.label);

              const handlePowderCoatedChange = (
                e: React.ChangeEvent<HTMLInputElement>,
              ) => {
                if (e.target.checked) {
                  setPowderCoatedFinish((prev) => [...prev, item.label]);
                } else {
                  setPowderCoatedFinish((prev) =>
                    prev.filter((m) => m !== item.label),
                  );
                }
              };

              return (
                <label
                  key={item.label}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={handlePowderCoatedChange}
                      className="peer sr-only"
                    />
                    <div className="flex size-3 items-center justify-center rounded-xs bg-[#c3c3c3] peer-checked:bg-black">
                      {isChecked && (
                        <svg
                          className="size-2 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={4}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <Image
                    src={item.icon}
                    alt={item.label}
                    width={25}
                    height={25}
                  />
                  <span className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
                    {item.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
