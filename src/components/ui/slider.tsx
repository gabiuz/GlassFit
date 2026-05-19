"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  onThumbPointerEnter?: (index: number) => void;
  onThumbPointerLeave?: (index: number) => void;
  renderThumbContent?: (index: number) => React.ReactNode;
};

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  onThumbPointerEnter,
  onThumbPointerLeave,
  renderThumbContent,
  ...props
}: SliderProps) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-[5px] bg-neutral-700 data-horizontal:h-2.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-2.5"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-grad-light select-none data-horizontal:h-full data-vertical:w-full"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="group relative block size-6 shrink-0 rounded-full bg-green shadow-[0_2px_6px_rgba(7,182,211,0.35)] transition-[color,box-shadow] select-none after:absolute after:inset-1.5 after:rounded-full after:bg-white hover:ring-4 hover:ring-[rgba(7,182,211,0.25)] focus-visible:ring-4 focus-visible:ring-[rgba(7,182,211,0.35)] focus-visible:outline-hidden active:ring-4 disabled:pointer-events-none disabled:opacity-50"
          onPointerEnter={() => onThumbPointerEnter?.(index)}
          onPointerLeave={() => onThumbPointerLeave?.(index)}
        >
          {renderThumbContent?.(index)}
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
