"use client";

import Image from "next/image";

type SearchBarProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  inputClassName?: string;
  className?: string;
};

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  inputClassName,
  className,
}: SearchBarProps) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-[12px_10px_10px_12px] bg-grad-light pr-2.5 ${className ?? ""}`}
    >
      <div
        className={`flex h-15 flex-1 items-center overflow-hidden rounded-[10px] border border-white bg-white px-2 shadow-[0px_4px_12px_0px_rgba(13,10,44,0.06)] ${inputClassName ?? ""}`}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="w-full outline-none bg-transparent px-2.5 text-[20px] font-normal leading-[1.4] tracking-[-0.38px] text-[#0f1422] placeholder:text-[#abb7c2]"
        />
      </div>
      <button
        type="button"
        aria-label="Search"
        className="flex items-center justify-center rounded-[25px] p-2.5"
      >
        <Image src="/search.svg" alt="" width={24} height={24} />
      </button>
    </div>
  );
}
