"use client";
import Image from "next/image";

export function SearchSection() {
  return (
    <div className=" flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 lg:gap-72">
      <div className="max-w-105">
        <h2 className="text-black text-3xl font-medium leading-10 font-heading tracking-tight">
          Browse Glass and Aluminum Products
        </h2>
      </div>

      <div className="flex items-center w-full max-w-175.5 gap-2.5 rounded-[10px] bg-grad-light pr-2.5">
        <div className="flex h-15 flex-1 items-center overflow-hidden rounded-[10px] border border-white bg-white px-2 shadow-[0px_4px_12px_0px_rgba(13,10,44,0.06)]">
          <input
            type="text"
            className="w-full outline-none bg-transparent px-2.5 text-[20px] font-normal leading-[1.4] tracking-[-0.38px] text-black placeholder:text-[#abb7c2]"
            placeholder="Search for windows, doors, partitions, cabinets, or other products..."
          />
        </div>
        <button
          className="flex items-center justify-center rounded-[25px] p-2.5"
          aria-label="Search"
          type="button"
        >
          <Image src="/search.svg" alt="" width={24} height={24} />
        </button>
      </div>
    </div>
  );
}
