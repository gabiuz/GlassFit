"use client";
import { SearchBar } from "@/components/shared/SearchBar";

export function SearchSection() {
  return (
    <div className=" flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 lg:gap-72">
      <div className="max-w-105">
        <h2 className="text-black text-3xl font-medium leading-10 font-heading tracking-tight">
          Browse Glass and Aluminum Products
        </h2>
      </div>

      <SearchBar
        placeholder="Search for windows, doors, partitions, cabinets, or other products..."
        className="w-full max-w-175.5"
      />
    </div>
  );
}

