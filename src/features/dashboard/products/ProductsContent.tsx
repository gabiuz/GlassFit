"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { SearchBar } from "@/components/shared/SearchBar";
import {
  initialAdminProducts,
  type AdminProductItem,
  type AdminProductStatus,
} from "./productData";

const statusBg: Record<AdminProductStatus, string> = {
  Published: "bg-[#05b64b]",
  Draft: "bg-[#ffc876]",
};


// subcomponents

function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0 p-[5px] flex items-center justify-center">
      <p className="flex-1 min-w-0 text-black text-sm font-medium leading-[1.4] tracking-[-0.266px] text-center">
        {children}
      </p>
    </div>
  );
}

function ColCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 min-w-0 p-[5px] flex items-center justify-center", className)}>
      {typeof children === "string" ? (
        <p className="flex-1 min-w-0 text-black text-sm font-normal leading-[1.4] tracking-[-0.266px] text-center">
          {children}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AdminProductStatus }) {
  return (
    <div
      className={cn(
        "px-2.5 py-[5px] rounded-[20px] flex items-center justify-center shrink-0",
        statusBg[status]
      )}
    >
      <span className="text-white text-xs font-normal leading-[1.4] tracking-[-0.228px] whitespace-nowrap">
        {status}
      </span>
    </div>
  );
}

function ActionButtons() {
  return (
    <div className="flex items-center justify-center shrink-0">
      <div className="flex items-center p-[5px] shrink-0">
        <button
          type="button"
          className="bg-[#0f1422] px-[15px] py-[5px] rounded-[10px] text-white text-xs font-normal leading-[1.4] tracking-[-0.228px] whitespace-nowrap cursor-pointer hover:bg-black transition-colors"
        >
          Edit
        </button>
      </div>
      <div className="flex items-center p-[5px] shrink-0 w-[90px]">
        <button
          type="button"
          className="bg-[#c50000] px-[15px] py-[5px] rounded-[10px] text-white text-xs font-normal leading-[1.4] tracking-[-0.228px] whitespace-nowrap cursor-pointer hover:bg-red-700 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function DropdownChevron() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 25 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <path
        d="M6 9L12.5 16L19 9"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


export function ProductsContent() {
  const [products] = useState<AdminProductItem[]>(initialAdminProducts);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  return (
    <div className="flex flex-col items-start gap-[30px] w-full max-w-[1106px] pt-4 pb-12 select-none">

      <div className="w-full h-[72px] flex items-center justify-between gap-[67px]">

        {/* Title + subtitle */}
        <div className="flex flex-col gap-1.5 items-start shrink-0 whitespace-nowrap">
          <h1 className="text-black text-[32px] font-medium leading-[1.2] tracking-[-0.608px]">
            Product
          </h1>
          <p className="text-black text-xl font-normal leading-[1.4] tracking-[-0.38px]">
            Manage your product catalog and variations
          </p>
        </div>

        {/* Search bar */}
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search for products"
          inputClassName="w-[340px]"
        />

        {/* Add Product button */}
        <button
          type="button"
          className="bg-[#0f1422] rounded-[25px] px-5 py-[15px] flex items-start gap-[15px] cursor-pointer hover:bg-black transition-colors shrink-0"
        >
          <span className="text-white text-xl font-normal leading-[1.4] tracking-[-0.38px] whitespace-nowrap">
            Add Product
          </span>
        </button>
      </div>

      {/* Filter row + product count */}
      <div className="w-full flex flex-col gap-[22px] items-start">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="bg-[#c3c3c3] text-white text-base font-normal leading-[1.4] tracking-[-0.304px] px-5 py-2.5 rounded-[25px] flex items-center gap-[15px] cursor-pointer hover:bg-stone-400 transition-colors whitespace-nowrap"
            >
              All categories
              <DropdownChevron />
            </button>
            <button
              type="button"
              className="bg-[#c3c3c3] text-white text-base font-normal leading-[1.4] tracking-[-0.304px] px-5 py-2.5 rounded-[25px] flex items-center gap-[15px] cursor-pointer hover:bg-stone-400 transition-colors whitespace-nowrap"
            >
              All Status
              <DropdownChevron />
            </button>
          </div>
          <p className="text-[#c3c3c3] text-base font-normal leading-[1.4] tracking-[-0.304px] whitespace-nowrap">
            Showing {filtered.length} of {products.length} products
          </p>
        </div>

        {/* Products table */}
        <div className="bg-white rounded-[20px] p-[30px] flex flex-col items-start w-full">
          <div className="flex flex-col gap-2.5 items-start w-full">

            {/* Table header row */}
            <div className="w-full flex items-center gap-[30px]">
              <ColHeader>Product_ID</ColHeader>
              <ColHeader>Product Name </ColHeader>
              <ColHeader>Product Type</ColHeader>
              <ColHeader>Description</ColHeader>
              <ColHeader>Base Price</ColHeader>
              <ColHeader>Status</ColHeader>
              <ColHeader>Actions</ColHeader>
            </div>

            {/* Horizontal divider */}
            <div className="w-full border-t border-[#e5e5e5]" />

            {/* Data rows */}
            {filtered.map((product) => (
              <ProductRow key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductRow({ product }: { product: AdminProductItem }) {
  return (
    <div className="w-full flex items-center gap-[30px]">
      <ColCell>{product.id}</ColCell>
      <ColCell>{product.name}</ColCell>
      <ColCell>{product.type}</ColCell>
      <ColCell>{product.description}</ColCell>
      <ColCell>{product.basePrice}</ColCell>
      <ColCell>
        <StatusBadge status={product.status} />
      </ColCell>
      <ColCell className="justify-center">
        <ActionButtons />
      </ColCell>
    </div>
  );
}
