"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { SearchBar } from "@/components/shared/SearchBar";
import {
  type AdminProductItem,
  type AdminProductStatus,
} from "./productData";
import Link from "next/link";
const statusBg: Record<AdminProductStatus, string> = {
  Published: "bg-[#05b64b]",
  Draft: "bg-[#ffc876]",
};

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

import { deleteProduct } from "@/lib/admin/products/productMutations";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

function ActionButtons({ productId }: { productId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this product? This will remove all associated assets from Cloudflare R2 and cannot be undone.")) {
      startTransition(async () => {
        try {
          await deleteProduct(productId);
          // router.refresh() happens automatically because we revalidatePath in the action
        } catch (e: any) {
          alert(`Error deleting product: ${e.message}`);
        }
      });
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 shrink-0">
      <Link
        href={`/admin/products/${productId}/setup`}
        className="bg-[#0f1422] px-[15px] py-[5px] rounded-[10px] text-white text-xs font-normal leading-[1.4] tracking-[-0.228px] whitespace-nowrap cursor-pointer hover:bg-black transition-colors"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="bg-[#c50000] px-[15px] py-[5px] rounded-[10px] text-white text-xs font-normal leading-[1.4] tracking-[-0.228px] whitespace-nowrap cursor-pointer hover:bg-red-700 transition-colors disabled:opacity-50"
      >
        {isPending ? "Deleting..." : "Delete"}
      </button>
    </div>
  );
}

function DropdownChevron({
  isOpen: controlledIsOpen,
  onClick,
}: {
  isOpen?: boolean;
  onClick?: () => void;
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else if (controlledIsOpen === undefined) {
      setInternalIsOpen((prev) => !prev);
    }
  };

  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 25 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onClick={handleClick}
      className={cn(
        "transition-transform duration-200 ease-in-out shrink-0",
        isOpen && "rotate-180"
      )}
    >
      <path opacity="0.4" d="M7.75781 10.625L12.5 15.3672L17.2422 10.625H7.75781Z" fill="white" />
      <path d="M13.3829 17.1328C12.8946 17.6211 12.1017 17.6211 11.6134 17.1328L5.36339 10.8828C5.00402 10.5234 4.89855 9.98828 5.09386 9.51953C5.28917 9.05078 5.7462 8.75 6.25011 8.75H18.7501C19.254 8.75 19.711 9.05469 19.9064 9.52344C20.1017 9.99219 19.9923 10.5273 19.6368 10.8867L13.3868 17.1367L13.3829 17.1328ZM17.2423 10.625H7.75792L12.5001 15.3672L17.2423 10.625Z" fill="white" />
    </svg>
  );
}

export function ProductsContent({ initialProducts }: { initialProducts: AdminProductItem[] }) {
  const [products, setProducts] = useState<AdminProductItem[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  // We could still keep local product state or just let the page refresh handle it
  // For now, we keep local state just in case, though adding new products happens on another page.

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
    <div className="flex flex-col items-start gap-6 sm:gap-8 w-full max-w-[1240px] pb-12 select-none">
      <div className="w-full flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 xl:gap-6">
        <div className="flex flex-col gap-1 items-start min-w-0">
          <h1 className="text-black text-2xl sm:text-3xl lg:text-[32px] font-medium leading-tight tracking-tight">
            Product
          </h1>
          <p className="text-neutral-700 text-sm sm:text-base lg:text-lg font-normal leading-snug">
            Manage your product catalog and variations
          </p>
        </div>

        <div className="w-full xl:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 sm:w-auto">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search for products"
              inputClassName="w-full sm:w-[300px] md:w-[340px]"
            />
          </div>

          <Link
            href="/admin/products/new"
            className="bg-[#0f1422] rounded-[25px] px-5 py-3 sm:py-3.5 flex items-center justify-center gap-2 cursor-pointer hover:bg-black transition-colors shrink-0 shadow-xs"
          >
            <span className="text-white text-base sm:text-lg font-medium leading-tight whitespace-nowrap">
              + Add Product
            </span>
          </Link>
        </div>
      </div>

      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setIsCategoryOpen((prev) => !prev)}
            className="bg-[#c3c3c3] text-white text-xs sm:text-sm font-normal px-4 py-2 rounded-[25px] flex items-center gap-2.5 cursor-pointer hover:bg-stone-400 transition-colors whitespace-nowrap shadow-xs"
          >
            All categories
            <DropdownChevron isOpen={isCategoryOpen} />
          </button>
          <button
            type="button"
            onClick={() => setIsStatusOpen((prev) => !prev)}
            className="bg-[#c3c3c3] text-white text-xs sm:text-sm font-normal px-4 py-2 rounded-[25px] flex items-center gap-2.5 cursor-pointer hover:bg-stone-400 transition-colors whitespace-nowrap shadow-xs"
          >
            All Status
            <DropdownChevron isOpen={isStatusOpen} />
          </button>
        </div>
        <p className="text-[#c3c3c3] text-xs sm:text-sm font-normal leading-snug whitespace-nowrap">
          Showing {filtered.length} of {products.length} products
        </p>
      </div>

      <div className="bg-white rounded-[20px] p-4 sm:p-6 lg:p-[30px] flex flex-col items-start w-full shadow-xs overflow-hidden">
        <div className="w-full overflow-x-auto pb-2">
          <div className="w-full min-w-[760px] flex flex-col gap-2.5 items-start">
            <div className="w-full flex items-center gap-4">
              <ColHeader>Product ID</ColHeader>
              <ColHeader>Product Name</ColHeader>
              <ColHeader>Product Type</ColHeader>
              <ColHeader>Description</ColHeader>
              <ColHeader>Base Price</ColHeader>
              <ColHeader>Status</ColHeader>
              <ColHeader>Actions</ColHeader>
            </div>

            <div className="w-full border-t border-[#e5e5e5]" />

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
    <div className="w-full flex items-center gap-4 py-1">
      <ColCell className="font-medium text-neutral-600">{product.id}</ColCell>
      <ColCell className="font-medium text-[#0f1422]">{product.name}</ColCell>
      <ColCell>{product.type}</ColCell>
      <ColCell className="truncate">{product.description}</ColCell>
      <ColCell className="font-medium">{product.basePrice}</ColCell>
      <ColCell>
        <StatusBadge status={product.status} />
      </ColCell>
      <ColCell className="justify-center">
        <ActionButtons productId={product.id} />
      </ColCell>
    </div>
  );
}

