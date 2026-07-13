"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import Button from "@/components/shared/Button";

const BEFORE_IMAGE = "/comparison_assets/room_without_furniture.png";
const AFTER_IMAGE = "/comparison_assets/room_with_furniture.png";

type ToggleSwitchProps = {
  value: "left" | "right";
  onChange: (value: "left" | "right") => void;
  textLeft: string;
  textRight: string;
};

function ToggleSwitch({ value, onChange, textLeft, textRight }: ToggleSwitchProps) {
  const isLeft = value === "left";
  return (
    <div className="flex items-center select-none relative">
      <button
        type="button"
        onClick={() => onChange("left")}
        className={`px-4 py-1.5 flex items-center justify-center cursor-pointer text-xl leading-7 rounded-l-[10px] ${isLeft
          ? "bg-green border border-green text-white font-medium"
          : "bg-white border border-[#c3c3c3] text-black font-normal hover:bg-neutral-50"
          }`}
      >
        {textLeft}
      </button>
      <button
        type="button"
        onClick={() => onChange("right")}
        className={`px-4 py-1.5 flex items-center justify-center cursor-pointer text-xl leading-7 rounded-r-[10px] -ml-px ${!isLeft
          ? "bg-green border border-green text-white font-medium"
          : "bg-white border border-[#c3c3c3] text-black font-normal hover:bg-neutral-50"
          }`}
      >
        {textRight}
      </button>
    </div>
  );
}

function BeforeState() {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none rounded-[20px]">
      <Image
        alt="Original empty room"
        src={BEFORE_IMAGE}
        fill
        className="object-cover rounded-[20px]"
        sizes="(max-w-xl) 100vw, 50vw"
        priority
      />
    </div>
  );
}

function AfterState() {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none rounded-[15px]">
      <Image
        alt="Room with product"
        src={AFTER_IMAGE}
        fill
        className="object-cover rounded-[15px] transition-all duration-300"
        sizes="(max-w-xl) 100vw, 50vw"
        priority
      />
    </div>
  );
}

const getVariantLabel = (variant: "A" | "B" | "C") => {
  return "Variant " + variant;
};

type ComparisonPanelCardProps = {
  title: string;
  label: string;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
};

function ComparisonPanelCard({
  title,
  label,
  isSelected,
  isDisabled,
  onClick,
}: ComparisonPanelCardProps) {
  return (
    <div
      onClick={!isDisabled ? onClick : undefined}
      className={`flex flex-col gap-2.25 items-center relative w-full max-w-[176px] select-none ${isDisabled ? "cursor-not-allowed" : "cursor-pointer group"
        }`}
    >
      <div
        className={`relative rounded-[20px] overflow-hidden shrink-0 w-24 h-24 sm:w-37.5 sm:h-37.5 transition-all duration-300 ${isSelected
          ? "border-[5px] border-[#129044] shadow-lg scale-105"
          : "border border-neutral-200/60 shadow-sm hover:scale-[1.02] hover:shadow-md"
          }`}
      >
        <AfterState />

        {isSelected && (
          <div className="absolute top-2.75 right-2.75 w-7.5 h-7.5 bg-[#129044]/30 border-[2.5px] border-[#129044] rounded-[50%] flex items-center justify-center z-20 animate-in zoom-in duration-200">
            <Check className="w-4 h-4 text-[#129044] stroke-[3.5px]" />
          </div>
        )}
        {isDisabled && (
          <>
            <div className="absolute inset-0 bg-black/55 z-10" />
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="w-9 h-9 bg-black/60 rounded-full flex items-center justify-center border border-white/20">
                <Image
                  src="/eye-slash.svg"
                  alt="Disabled"
                  width={30}
                  height={30}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col items-center w-full leading-[1.4] text-center">
        <p className="font-medium text-black text-[16px] w-full transition-colors duration-200 group-hover:text-black">
          {title}
        </p>
        <p className="font-normal text-black/60 text-[14px] w-full">
          {label}
        </p>
      </div>
    </div>
  );
}

export function Comparison() {
  const [viewAs, setViewAs] = useState<"left" | "right">("left"); // left = Side-by-Side, right = Slider
  const [compareMode, setCompareMode] = useState<"left" | "right">("left"); // left = Before and After, right = Product Variant

  // Variant Selections for Product Variant Comparison
  const [leftVariant, setLeftVariant] = useState<"A" | "B" | "C">("A");
  const [rightVariant, setRightVariant] = useState<"A" | "B" | "C">("B");

  const handleSwap = () => {
    setLeftVariant(rightVariant);
    setRightVariant(leftVariant);
  };

  const isSideBySide = viewAs === "left";
  const isBeforeAfter = compareMode === "left";

  // Slider State & Logic
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      handleMove(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleTouchStart = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging]);

  return (
    <div className="w-full max-w-325 mx-auto px-6 py-12 md:py-16 flex flex-col gap-12 items-center">
      {/* Header Title Section */}
      <div className="flex flex-col gap-5 items-center justify-center text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-black leading-tight">
          Your <span className="text-green">Visual</span> Preview
        </h1>
        <p className="text-lg sm:text-[24px] md:text-[28px] font-normal text-black/90 tracking-tight leading-normal">
          See how your selected product may look in your space.
        </p>
      </div>

      {/* Control Panel Section */}
      <div className="w-full flex flex-col md:flex-row gap-6 md:gap-0 justify-between items-center">
        <div className="flex flex-col md:flex-row gap-8 md:gap-25.75 items-center">
          {/* View As Toggle */}
          <div className="flex flex-col gap-2.5 items-start w-full md:w-auto">
            <span className="text-[#c3c3c3] text-[16px] tracking-[-0.304px] leading-[1.4] font-normal">
              View as:
            </span>
            <ToggleSwitch
              value={viewAs}
              onChange={setViewAs}
              textLeft="Side-by-Side"
              textRight="Slider"
            />
          </div>

          {/* Compare Mode Toggle */}
          <div className="flex flex-col gap-2.5 items-start w-full md:w-auto">
            <span className="text-[#c3c3c3] text-[16px] tracking-[-0.304px] leading-[1.4] font-normal">
              Compare mode:
            </span>
            <ToggleSwitch
              value={compareMode}
              onChange={setCompareMode}
              textLeft="Before and After"
              textRight="Product Variant"
            />
          </div>
        </div>

        <div className="bg-[#c3c3c3] border border-[#c3c3c3] border-solid flex items-center justify-center px-5 py-2.5 rounded-[20px] self-end md:self-center">
          <p className="text-base text-white tracking-wide font-medium">
            Comparing: {isBeforeAfter ? "Raw and Final Out" : `${getVariantLabel(leftVariant)} and ${getVariantLabel(rightVariant)}`}
          </p>
        </div>
      </div>

      {/* Main Compare Views Area */}
      <div className="w-full flex items-center justify-center min-h-64 sm:min-h-96 lg:min-h-144.75">
        {isSideBySide ? (
          /* Side-by-Side View Mode */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 w-full">
            {/* Left Card */}
            <div className="relative flex flex-col h-64 sm:h-96 lg:h-144.75 w-full rounded-[20px] overflow-hidden shadow-md border border-neutral-200/40 p-6">
              {isBeforeAfter ? (
                /* Before: Empty Room */
                <>
                  <BeforeState />
                  <div className="absolute top-6 left-6 bg-black border border-[#c3c3c3] px-3.5 py-1.5 rounded-[20px] z-10 shadow-md">
                    <p className="text-base text-white font-normal tracking-wide">
                      Before - Original Photo
                    </p>
                  </div>
                </>
              ) : (
                /* Variant: Selected Left Finish */
                <>
                  <AfterState />
                  <div className="absolute top-6 left-6 bg-black border border-[#c3c3c3] px-3.5 py-1.5 rounded-[20px] z-10 shadow-md">
                    <p className="text-base text-white font-normal tracking-wide">
                      {getVariantLabel(leftVariant)}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Right Card */}
            <div className="relative flex flex-col h-64 sm:h-96 lg:h-144.75 w-full rounded-[20px] overflow-hidden shadow-md border border-neutral-200/40 p-6">
              {isBeforeAfter ? (
                /* After: Cabinet Installed */
                <>
                  <AfterState />
                  <div className="absolute top-6 left-6 bg-black border border-[#c3c3c3] px-3.5 py-1.5 rounded-[20px] z-10 shadow-md">
                    <p className="text-base text-white font-normal tracking-wide">
                      After - Final Output
                    </p>
                  </div>
                </>
              ) : (
                /* Variant: Selected Right Finish */
                <>
                  <AfterState />
                  <div className="absolute top-6 left-6 bg-black border border-[#c3c3c3] px-3.5 py-1.5 rounded-[20px] z-10 shadow-md">
                    <p className="text-base text-white font-normal tracking-wide">
                      {getVariantLabel(rightVariant)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Premium Interactive Draggable Image Slider Mode */
          <div
            ref={containerRef}
            className="relative w-full h-64 sm:h-96 lg:h-144.75 max-w-225 rounded-[20px] overflow-hidden select-none cursor-ew-resize shadow-lg border border-neutral-200/50"
          >
            {/* Underlay / Bottom state (Visible on the right side of the slider) */}
            <div className="absolute inset-0 w-full h-full">
              <AfterState />
            </div>

            {/* Overlay / Top state (Clipped, visible on the left side of the slider) */}
            <div
              className="absolute inset-0 w-full h-full"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              {isBeforeAfter ? (
                <BeforeState />
              ) : (
                <AfterState />
              )}
            </div>

            {/* Interactive Vertical Slider Line / Handle */}
            <div
              className="absolute top-0 bottom-0 w-2.5 bg-white cursor-ew-resize z-10 flex items-center justify-center transition-opacity"
              style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            >
              <div className="shrink-0 rounded-full bg-grad-dark border-5 p-2.5 border-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-200">
                <Image
                  src="/swap-icons.svg"
                  alt="Slider Handle"
                  width={20}
                  height={20}
                  draggable={false}
                />
              </div>
            </div>

            {/* Floating Labels indicating left/right visual meanings */}
            <div className="absolute top-6 left-6 z-20 bg-black/90 border border-white/10 px-3.5 py-1.5 rounded-[20px] text-white text-sm font-normal select-none pointer-events-none backdrop-blur-sm shadow-sm transition-opacity duration-200">
              {isBeforeAfter ? "Before - Original" : getVariantLabel(leftVariant)}
            </div>
            <div className="absolute top-6 right-6 z-20 bg-black/90 border border-white/10 px-3.5 py-1.5 rounded-[20px] text-white text-sm font-normal select-none pointer-events-none backdrop-blur-sm shadow-sm transition-opacity duration-200">
              {isBeforeAfter ? "After - Installed" : getVariantLabel(rightVariant)}
            </div>
          </div>
        )}
      </div>

      {/* Product Variant Selection Panel */}
      {!isBeforeAfter && (
        <div className="w-full flex flex-col lg:flex-row gap-6 lg:gap-8 justify-center items-center py-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
          {/* Panel A - Left */}
          <div className="bg-[rgba(245,245,245,0.4)] backdrop-blur-md border border-white/30 p-7.5 rounded-[20px] shadow-[0px_0px_10px_0px_rgba(0,0,0,0.08)] flex flex-col gap-5 items-start w-full max-w-155">
            <p className="font-medium text-black text-2xl tracking-[-0.456px] leading-[1.2]">
              Panel A - Left
            </p>
            <div className="flex flex-wrap sm:flex-nowrap gap-4 items-center justify-center sm:justify-between w-full">
              <ComparisonPanelCard
                title="Variant A - Title"
                label="Variant A - Label"
                isSelected={leftVariant === "A"}
                isDisabled={rightVariant === "A"}
                onClick={() => setLeftVariant("A")}
              />
              <ComparisonPanelCard
                title="Variant B - Title"
                label="Variant B - Label"
                isSelected={leftVariant === "B"}
                isDisabled={rightVariant === "B"}
                onClick={() => setLeftVariant("B")}
              />
              <ComparisonPanelCard
                title="Variant C - Title"
                label="Variant C - Label"
                isSelected={leftVariant === "C"}
                isDisabled={rightVariant === "C"}
                onClick={() => setLeftVariant("C")}
              />
            </div>
          </div>

          {/* Swap Button */}
          <button
            type="button"
            onClick={handleSwap}
            className="bg-black hover:bg-black/90 active:scale-95 text-white flex flex-col items-center justify-center gap-1.5 w-19 h-19 rounded-full shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] shrink-0 transition-all cursor-pointer border border-white/10"
          >
            <Image
              src="/swap-icons.svg"
              alt="Swap"
              width={20}
              height={20}
            />
            <span className="text-[12px] font-normal tracking-[-0.228px] leading-[1.4] whitespace-nowrap">
              Swap
            </span>
          </button>

          {/* Panel B - Right */}
          <div className="bg-[rgba(245,245,245,0.4)] backdrop-blur-md border border-white/30 p-7.5 rounded-[20px] shadow-[0px_0px_10px_0px_rgba(0,0,0,0.08)] flex flex-col gap-5 items-start w-full max-w-155">
            <p className="font-medium text-black text-2xl tracking-[-0.456px] leading-[1.2]">
              Panel B - Right
            </p>
            <div className="flex flex-wrap sm:flex-nowrap gap-4 items-center justify-center sm:justify-between w-full">
              <ComparisonPanelCard
                title="Variant A - Title"
                label="Variant A - Label"
                isSelected={rightVariant === "A"}
                isDisabled={leftVariant === "A"}
                onClick={() => setRightVariant("A")}
              />
              <ComparisonPanelCard
                title="Variant B - Title"
                label="Variant B - Label"
                isSelected={rightVariant === "B"}
                isDisabled={leftVariant === "B"}
                onClick={() => setRightVariant("B")}
              />
              <ComparisonPanelCard
                title="Variant C - Title"
                label="Variant C - Label"
                isSelected={rightVariant === "C"}
                isDisabled={leftVariant === "C"}
                onClick={() => setRightVariant("C")}
              />
            </div>
          </div>
        </div>
      )}
      {/* Bottom Footer Actions Box */}
      <div className="bg-[#f5f5f5] w-full flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-[20px] shadow-sm select-none">
        <Link href="/product-details" className="w-full sm:w-auto">
          <Button
            variant="blackBtnWhiteText"
            value="Edit Placement"
            leftIcon={<ChevronLeft className="w-5 h-5 shrink-0 text-white" />}
            rightIcon={null}
            className="w-full sm:w-auto font-medium justify-center cursor-pointer py-3.5 rounded-[25px] flex items-center hover:opacity-90"
          />
        </Link>

        <Button
          variant="lightGradWhiteText"
          value="Proceed to Estimate Price"
          leftIcon={null}
          rightIcon={<ChevronRight className="w-5 h-5 shrink-0 text-white" />}
          className="w-full sm:w-auto font-medium justify-center cursor-pointer py-3.5 rounded-[25px] flex items-center hover:opacity-95"
          onClick={() => alert("Proceeding to Estimate Price...")}
        />
      </div>
    </div>
  );
}