"use client";

import React from "react";

type VisualizationHeaderProps = {
  fileName?: string;
  productCount?: number;
  tags?: string[];
};

export function VisualizationHeader({
  fileName = "Livingroom.jpeg",
  productCount = 2,
  tags = ["Kitchen Cabinet", "Double Swing Door"],
}: VisualizationHeaderProps) {
  return (
    <div className="w-full min-w-0 flex flex-col gap-7.5 items-start select-none">
      <p className="text-[#c3c3c3] text-lg font-normal leading-7">
        Your final visualization
      </p>
      <h1 className="w-full min-w-0 text-green text-3xl font-medium leading-10">
        <span className="[overflow-wrap:anywhere]">{fileName}</span>{" "}
        <span>- {productCount} {productCount === 1 ? "product" : "products"}</span>
      </h1>
      <div className="flex w-full min-w-0 flex-wrap gap-1.25">
        {tags.map((tag) => (
          <div
            key={tag}
            className="max-w-full min-w-0 bg-[#c3c3c3] border border-[#c3c3c3] border-solid flex items-center justify-center px-2.5 py-1.25 rounded-[20px]"
          >
            <span className="min-w-0 text-white text-base font-normal leading-6 [overflow-wrap:anywhere]">
              {tag}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
