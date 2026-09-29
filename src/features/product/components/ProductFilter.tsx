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
import { ChevronRight } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { useProductFilter, MIN_PRICE, MAX_PRICE } from "./ProductFilterContext";

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
    <div
      className={`pointer-events-none absolute -top-18 left-1/2 -translate-x-1/2 translate-y-3 scale-50 opacity-0 origin-bottom transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-active:translate-y-0 group-active:scale-100 group-active:opacity-100 ${isDragging ? "translate-y-0 scale-100 opacity-100" : ""}`}
    >
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

interface AccordionGroupProps {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

function AccordionGroup({ title, children, isOpen, onToggle }: AccordionGroupProps) {
  return (
    <div className="border-b border-[#C3C3C3]/30 py-3.5 w-full">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-2 text-left"
      >
        <span className="text-base font-medium text-black leading-6">{title}</span>
        <ChevronRight
          className={`h-5 w-5 text-[#c3c3c3] transition-transform duration-300 ${
            isOpen ? "rotate-90 text-green" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="mt-3 animate-in fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

export function ProductFilter({ isMobile = false }: { isMobile?: boolean }) {
  const { filters, draftFilters, updateFilter, updateDraftFilter } = useProductFilter();

  const currentFilters = isMobile ? draftFilters : filters;
  const update = isMobile ? updateDraftFilter : updateFilter;

  // Accordion open states for mobile bottom sheet
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    price: true,
    category: true,
    doorStyle: true,
    materials: true,
    aluminumFinish: true,
    glassFinish: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const categoryOptions = [
    { label: "Doors", icon: "/door.svg" },
    { label: "Windows", icon: "/windows.svg" },
    { label: "Cabinets", icon: "/cabinet.svg" },
    { label: "Partition", icon: "/partition.svg" },
    { label: "Shower Enclosure", icon: "/shower.svg" },
    { label: "Exterior Installation", icon: "/exterior.svg" },
  ];

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

  const powderCoatedFinish = [
    { label: "White", icon: "/powder_coated_icons/white.svg" },
    { label: "Brown", icon: "/powder_coated_icons/brown.svg" },
    { label: "Black", icon: "/powder_coated_icons/black.svg" },
    { label: "Matte Black", icon: "/powder_coated_icons/matte_black.svg" },
  ];

  const glassFinish = [
    { label: "Clear", icon: "/glass_finish_icons/clear.svg" },
    { label: "Bronze", icon: "/glass_finish_icons/bronze.svg" },
    { label: "Smoke", icon: "/glass_finish_icons/smoke.svg" },
  ];

  const doorStyles = [
    { label: "All" },
    { label: "French Doors" },
    { label: "Sliding Doors" },
    { label: "Swing Doors" },
    { label: "Screen Doors" },
    { label: "Bi-Fold Doors" },
    { label: "Pocket Doors" },
  ];

  const materials = [{ label: "Aluminum" }, { label: "Glass" }];

  const aluminumProfiles = [
    { label: "High - End" },
    { label: "Low - End" },
    { label: "Tubular" },
    { label: "Deluxe" },
  ];

  const glassProfiles = [
    { label: "Tempered Glass" },
    { label: "Ordinary Glass" },
    { label: "Reflective Glass" },
  ];

  const thickness = [
    { label: "3 mm" },
    { label: "6 mm" },
    { label: "10 mm" },
    { label: "12 mm" },
  ];

  const handleRangeChange = (next: number[]) => {
    if (next.length !== 2) return;
    const [nextMin, nextMax] = next;
    update("range", [
      Math.min(Math.max(nextMin, MIN_PRICE), MAX_PRICE),
      Math.min(Math.max(nextMax, MIN_PRICE), MAX_PRICE),
    ]);
  };

  const handleMinChange = (value: string) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    update("range", [Math.min(Math.max(next, MIN_PRICE), currentFilters.range[1]), currentFilters.range[1]]);
  };

  const handleMaxChange = (value: string) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    update("range", [currentFilters.range[0], Math.max(Math.min(next, MAX_PRICE), currentFilters.range[0])]);
  };

  const formatShortPrice = (value: number) => {
    if (value >= 1000) {
      return `${Math.round(value / 1000)}k`;
    }
    return `${value}`;
  };

  // Helper renderers for parts of the filters to share between layout routes
  const renderPriceRangeContent = () => (
    <div className="relative w-full px-6">
      <Slider
        value={currentFilters.range}
        min={MIN_PRICE}
        max={MAX_PRICE}
        step={500}
        onValueChange={handleRangeChange}
        renderThumbContent={(index, isDragging) => (
          <ThumbTooltip
            formattedValue={formatShortPrice(currentFilters.range[index])}
            value={currentFilters.range[index]}
            isDragging={isDragging}
          />
        )}
        className="cursor-pointer"
      />
      <div className="mt-7 flex items-center justify-between">
        <label className="relative flex h-12 w-30.25 items-center rounded-[20px] border border-[#8b8b8b] px-3">
          <span className="absolute left-3 text-[#8b8b8b] text-base">₱</span>
          <input
            type="number"
            min={MIN_PRICE}
            max={MAX_PRICE}
            value={currentFilters.range[0] === 0 ? "" : currentFilters.range[0]}
            placeholder="0"
            onChange={(event) => handleMinChange(event.target.value)}
            className="w-full bg-transparent pl-4 text-[#8b8b8b] text-base outline-hidden appearance-none"
          />
        </label>
        <div className="h-px w-2 rounded-[1px] bg-[#8b8b8b]" />
        <label className="relative flex h-12 w-30.25 items-center rounded-[20px] border border-[#8b8b8b] px-3">
          <span className="absolute left-3 text-[#8b8b8b] text-base">₱</span>
          <input
            type="number"
            min={MIN_PRICE}
            max={MAX_PRICE}
            value={currentFilters.range[1] === MAX_PRICE ? "" : currentFilters.range[1]}
            placeholder={String(MAX_PRICE)}
            onChange={(event) => handleMaxChange(event.target.value)}
            className="w-full flex flex-col justify-between bg-transparent pl-4 text-[#8b8b8b] text-base outline-hidden appearance-none"
          />
        </label>
      </div>
    </div>
  );

  const renderCategoryContent = () => (
    <div className="flex w-full flex-col items-start pl-6 lg:pl-12.5">
      <p className="text-[12px] leading-[1.4] tracking-[-0.228px] text-[#c3c3c3] mb-1">
        Select one
      </p>
      {categoryOptions.map((option) => {
        const isSelected = currentFilters.selectedCategory === option.label;
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => update("selectedCategory", option.label)}
            className="flex w-full items-center gap-3 px-3.75 py-2.5 text-left cursor-pointer"
          >
            <span
              className={
                isSelected
                  ? "h-4 w-4 shrink-0 rounded-full border-3 border-black bg-green"
                  : "h-4 w-4 shrink-0 rounded-full bg-[#c3c3c3]"
              }
              aria-hidden="true"
            />
            <Image src={option.icon} alt={option.label} width={25} height={25} />
            <span className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderDoorStylesContent = () => (
    <div className="flex w-full flex-col items-start pl-6 lg:pl-12.5">
      <p className="text-[12px] leading-[1.4] tracking-[-0.228px] text-[#c3c3c3] mb-1">
        Select all that apply
      </p>
      <div className="flex flex-col">
        {doorStyles.map((door) => {
          const isChecked = currentFilters.checkedDoors.includes(door.label);

          const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const checked = e.target.checked;
            if (door.label === "All") {
              if (checked) {
                update("checkedDoors", doorStyles.map((d) => d.label));
              } else {
                update("checkedDoors", []);
              }
            } else {
              if (checked) {
                const newChecked = [
                  ...currentFilters.checkedDoors.filter((d) => d !== "All"),
                  door.label,
                ];
                const allSpecificDoors = doorStyles
                  .map((d) => d.label)
                  .filter((l) => l !== "All");
                const isAllChecked = allSpecificDoors.every((l) =>
                  newChecked.includes(l)
                );
                update(
                  "checkedDoors",
                  isAllChecked ? doorStyles.map((d) => d.label) : newChecked
                );
              } else {
                update(
                  "checkedDoors",
                  currentFilters.checkedDoors.filter((d) => d !== door.label && d !== "All")
                );
              }
            }
          };

          return (
            <label
              key={door.label}
              className="flex cursor-pointer items-center gap-3 px-3.75 py-2.5"
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
  );

  const renderMaterialsContent = () => (
    <div className="flex w-full flex-col items-start pl-6 lg:pl-12.5">
      <p className="text-[12px] leading-[1.4] tracking-[-0.228px] text-[#c3c3c3] mb-1">
        Select one or both
      </p>
      <div className="flex flex-col">
        {materials.map((material) => {
          const isChecked = currentFilters.materialFinish.includes(material.label);

          const handleMaterialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.checked) {
              update("materialFinish", [...currentFilters.materialFinish, material.label]);
            } else {
              const updated = currentFilters.materialFinish.filter((m) => m !== material.label);
              update("materialFinish", updated);
              // Clean up dependent filters on uncheck
              if (material.label === "Aluminum") {
                update("anodized", []);
                update("powderCoated", []);
                update("aluminumProfile", []);
              }
              if (material.label === "Glass") {
                update("glass", []);
                update("glassProfile", []);
                update("glassThickness", []);
              }
            }
          };

          return (
            <label
              key={material.label}
              className="flex cursor-pointer items-center gap-3 px-3.75 py-2.5"
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
  );

  const renderAluminumFinishContent = () => (
    <div className="flex w-full flex-col gap-4">
      <div>
        <p className="text-[12px] leading-[1.4] tracking-[-0.228px] text-[#c3c3c3] pl-6 lg:pl-12.5 mb-1">
          Anodized Finish
        </p>
        <div className="flex flex-col pl-6 lg:pl-12.5">
          {anodizedFinish.map((item) => {
            const isChecked = currentFilters.anodized.includes(item.label);

            const handleAnodizedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target.checked) {
                update("anodized", [...currentFilters.anodized, item.label]);
              } else {
                update("anodized", currentFilters.anodized.filter((m) => m !== item.label));
              }
            };

            return (
              <label
                key={item.label}
                className="flex cursor-pointer items-center gap-3 px-3.75 py-2.5"
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
                <Image src={item.icon} alt={item.label} width={25} height={25} />
                <span className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
                  {item.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[12px] leading-[1.4] tracking-[-0.228px] text-[#c3c3c3] pl-6 lg:pl-12.5 mb-1">
          Powder-Coated Finish
        </p>
        <div className="flex flex-col pl-6 lg:pl-12.5">
          {powderCoatedFinish.map((item) => {
            const isChecked = currentFilters.powderCoated.includes(item.label);

            const handlePowderCoatedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target.checked) {
                update("powderCoated", [...currentFilters.powderCoated, item.label]);
              } else {
                update("powderCoated", currentFilters.powderCoated.filter((m) => m !== item.label));
              }
            };

            return (
              <label
                key={item.label}
                className="flex cursor-pointer items-center gap-3 px-3.75 py-2.5"
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
                <Image src={item.icon} alt={item.label} width={25} height={25} />
                <span className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
                  {item.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex w-full flex-col gap-0.75 items-start pl-6 lg:pl-12.5">
        <p className="text-[12px] leading-[1.4] tracking-[-0.228px] text-[#c3c3c3] mb-1.5">
          Profile
        </p>
        <div className="flex flex-col gap-1.25 w-full">
          {[aluminumProfiles.slice(0, 2), aluminumProfiles.slice(2)].map(
            (row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1.25">
                {row.map((p) => {
                  const isSelected = currentFilters.aluminumProfile.includes(p.label);

                  const handleToggle = () => {
                    if (isSelected) {
                      update("aluminumProfile", currentFilters.aluminumProfile.filter((item) => item !== p.label));
                    } else {
                      update("aluminumProfile", [...currentFilters.aluminumProfile, p.label]);
                    }
                  };

                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={handleToggle}
                      className={`px-2.5 py-1.25 rounded-[20px] border transition-colors duration-200 cursor-pointer text-xs font-normal leading-4 whitespace-nowrap ${
                        isSelected
                          ? "border-green bg-green text-white"
                          : "border-[#C3C3C3] text-gray-900 bg-transparent hover:border-green hover:bg-green hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );

  const renderGlassFinishContent = () => (
    <div className="flex w-full flex-col gap-4">
      <div>
        <p className="text-[12px] leading-[1.4] tracking-[-0.228px] text-[#c3c3c3] pl-6 lg:pl-12.5 mb-1">
          Tint
        </p>
        <div className="flex flex-col pl-6 lg:pl-12.5">
          {glassFinish.map((item) => {
            const isChecked = currentFilters.glass.includes(item.label);

            const handleGlassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target.checked) {
                update("glass", [...currentFilters.glass, item.label]);
              } else {
                update("glass", currentFilters.glass.filter((m) => m !== item.label));
              }
            };

            return (
              <label
                key={item.label}
                className="flex cursor-pointer items-center gap-3 px-3.75 py-2.5"
              >
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={handleGlassChange}
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
                <Image src={item.icon} alt={item.label} width={25} height={25} />
                <span className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
                  {item.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex w-full flex-col gap-0.75 items-start pl-6 lg:pl-12.5">
        <p className="text-[12px] leading-[1.4] tracking-[-0.228px] text-[#c3c3c3] mb-1.5">
          Profile
        </p>
        <div className="flex flex-col gap-1.25 w-full">
          {[glassProfiles.slice(0, 2), glassProfiles.slice(2)].map(
            (row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1.25">
                {row.map((p) => {
                  const isSelected = currentFilters.glassProfile.includes(p.label);

                  const handleToggle = () => {
                    if (isSelected) {
                      update("glassProfile", currentFilters.glassProfile.filter((item) => item !== p.label));
                    } else {
                      update("glassProfile", [...currentFilters.glassProfile, p.label]);
                    }
                  };

                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={handleToggle}
                      className={`px-2.5 py-1.25 rounded-[20px] border transition-colors duration-200 cursor-pointer text-xs font-normal leading-4 whitespace-nowrap ${
                        isSelected
                          ? "border-green bg-green text-white"
                          : "border-[#C3C3C3] text-gray-900 bg-transparent hover:border-green hover:bg-green hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      <div className="flex w-full flex-col gap-0.75 items-start pl-6 lg:pl-12.5">
        <p className="text-[12px] leading-[1.4] tracking-[-0.228px] text-[#c3c3c3] mb-1.5">
          Glass Thickness
        </p>
        <div className="flex gap-1.25 w-full flex-wrap">
          {thickness.map((p) => {
            const isSelected = currentFilters.glassThickness.includes(p.label);

            const handleToggle = () => {
              if (isSelected) {
                update("glassThickness", currentFilters.glassThickness.filter((item) => item !== p.label));
              } else {
                update("glassThickness", [...currentFilters.glassThickness, p.label]);
              }
            };

            return (
              <button
                key={p.label}
                type="button"
                onClick={handleToggle}
                className={`px-2.5 py-1.25 rounded-[20px] border transition-colors duration-200 cursor-pointer text-xs font-normal leading-4 whitespace-nowrap ${
                  isSelected
                    ? "border-green bg-green text-white"
                    : "border-[#C3C3C3] text-gray-900 bg-transparent hover:border-green hover:bg-green hover:text-white"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // If in mobile bottom sheet layout: render with accordion groups
  if (isMobile) {
    return (
      <div className="w-full flex flex-col px-1 pb-6">
        <AccordionGroup
          title="Price Range"
          isOpen={expandedSections.price}
          onToggle={() => toggleSection("price")}
        >
          <div className="py-2">{renderPriceRangeContent()}</div>
        </AccordionGroup>

        <AccordionGroup
          title="Product Category"
          isOpen={expandedSections.category}
          onToggle={() => toggleSection("category")}
        >
          <div className="py-1">{renderCategoryContent()}</div>
        </AccordionGroup>

        {currentFilters.selectedCategory === "Doors" && (
          <AccordionGroup
            title="Door Style"
            isOpen={expandedSections.doorStyle}
            onToggle={() => toggleSection("doorStyle")}
          >
            <div className="py-1">{renderDoorStylesContent()}</div>
          </AccordionGroup>
        )}

        <AccordionGroup
          title="Material Finish"
          isOpen={expandedSections.materials}
          onToggle={() => toggleSection("materials")}
        >
          <div className="py-1">{renderMaterialsContent()}</div>
        </AccordionGroup>

        {currentFilters.materialFinish.includes("Aluminum") && (
          <AccordionGroup
            title="Aluminum Finish & Profile"
            isOpen={expandedSections.aluminumFinish}
            onToggle={() => toggleSection("aluminumFinish")}
          >
            <div className="py-1">{renderAluminumFinishContent()}</div>
          </AccordionGroup>
        )}

        {currentFilters.materialFinish.includes("Glass") && (
          <AccordionGroup
            title="Glass Finish & Profile"
            isOpen={expandedSections.glassFinish}
            onToggle={() => toggleSection("glassFinish")}
          >
            <div className="py-1">{renderGlassFinishContent()}</div>
          </AccordionGroup>
        )}
      </div>
    );
  }

  // --- DESKTOP RENDER PATH (Byte-for-byte identical visually) ---
  return (
    <div className="w-full lg:w-102 flex flex-col p-7.5 justify-start gap-5 shadow-[2px_4px_11.699999809265137px_0px_rgba(0,0,0,0.10)] rounded-[20px]">
      <div className="flex flex-col gap-19.75">
        <h2 className="text-xl text-black font-medium leading-7">
          Price Range
        </h2>
        {renderPriceRangeContent()}
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
        {renderCategoryContent()}
      </div>
      
      {currentFilters.selectedCategory === "Doors" && (
        <div>
          <div className="flex items-center gap-3 rounded-[20px] px-3.75 py-2.5">
            <Image src="/door.svg" alt="door style icon" width={25} height={25} />
            <h3 className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
              Door Style
            </h3>
          </div>
          {renderDoorStylesContent()}
        </div>
      )}

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
        {renderMaterialsContent()}
      </div>

      {currentFilters.materialFinish.includes("Aluminum") && (
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
          {renderAluminumFinishContent()}
        </div>
      )}

      {currentFilters.materialFinish.includes("Glass") && (
        <div>
          <div className="flex items-center gap-3 rounded-[20px] px-3.75 py-2.5">
            <Image
              src="/paint_brush.svg"
              alt="glass finish icon"
              width={25}
              height={25}
            />
            <h3 className="text-[16px] leading-[1.4] tracking-[-0.304px] text-black">
              Glass Finish
            </h3>
          </div>
          {renderGlassFinishContent()}
        </div>
      )}
    </div>
  );
}
