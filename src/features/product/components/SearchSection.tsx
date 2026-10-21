"use client";

import React, { useContext } from "react";
import { SearchBar } from "@/components/shared/SearchBar";
import { ProductFilterContext } from "./ProductFilterContext";

interface SearchSectionProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function SearchSection({ value, onChange, className }: SearchSectionProps = {}) {
  const context = useContext(ProductFilterContext);

  const activeValue = value !== undefined ? value : context?.filters.searchQuery ?? "";
  const handleChange = (val: string) => {
    if (onChange) {
      onChange(val);
    } else if (context) {
      context.updateFilter("searchQuery", val);
    }
  };

  return (
    <div className={`flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 lg:gap-72 ${className ?? ""}`}>
      <div className="max-w-105">
        <h2 className="text-black text-3xl font-medium leading-10 font-heading tracking-tight">
          Browse Glass and Aluminum Products
        </h2>
      </div>

      <SearchBar
        value={activeValue}
        onChange={handleChange}
        placeholder="Search for windows, doors, partitions, cabinets, or other products..."
        className="w-full max-w-175.5"
      />
    </div>
  );
}

