"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { SearchBar } from "@/components/shared/SearchBar";
import {
  type AdminProductItem,
  type AdminProductStatus,
  type ProductStatusFilter,
  type ProductTypeFilter,
} from "./productData";
import {
  deriveProductTypeOptions,
  filterAdminProducts,
} from "./productFilters";
import Link from "next/link";
import { Check, Copy, Plus } from "lucide-react";
import { Select } from "radix-ui";
import { deleteProduct } from "@/lib/admin/products/productMutations";
import { duplicateProductPreset } from "@/lib/admin/products/presetDuplication";
import { DeleteProductModal } from "./DeleteProductModal";
import { useRouter } from "next/navigation";

const statusBg: Record<AdminProductStatus, string> = {
  Published: "bg-[#05b64b]",
  Draft: "bg-[#ffc876]",
};

function ProductIdBadge({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
    }
  };

  const shortId = id.length > 8 ? `${id.slice(0, 8)}...` : id;

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Click to copy full ID: ${id}`}
      className="group relative inline-flex items-center gap-1.5 px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-black rounded-md text-xs font-mono transition-colors cursor-pointer"
    >
      <span>{shortId}</span>
      {copied ? (
        <Check className="size-3 text-green-600 animate-in zoom-in-50 duration-150 shrink-0" />
      ) : (
        <Copy className="size-3 text-neutral-400 group-hover:text-neutral-700 transition-colors shrink-0" />
      )}
      {copied && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-sans px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap animate-in fade-in duration-150 z-10">
          Copied!
        </span>
      )}
    </button>
  );
}

function ColHeader({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex-1 min-w-0 p-[5px] flex items-center",
        align === "left" && "justify-start text-left",
        align === "center" && "justify-center text-center",
        align === "right" && "justify-end text-right",
        className
      )}
    >
      <p
        className={cn(
          "flex-1 min-w-0 text-black text-sm font-medium leading-[1.4] tracking-[-0.266px]",
          align === "left" && "text-left",
          align === "center" && "text-center",
          align === "right" && "text-right"
        )}
      >
        {children}
      </p>
    </div>
  );
}

function ColCell({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex-1 min-w-0 p-[5px] flex items-center",
        align === "left" && "justify-start text-left",
        align === "center" && "justify-center text-center",
        align === "right" && "justify-end text-right",
        className
      )}
    >
      {typeof children === "string" ? (
        <p
          className={cn(
            "flex-1 min-w-0 text-black text-sm font-normal leading-[1.4] tracking-[-0.266px]",
            align === "left" && "text-left",
            align === "center" && "text-center",
            align === "right" && "text-right"
          )}
        >
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

function ActionButtons({
  productId,
  onDelete,
  onDuplicate,
  isDuplicating,
}: {
  productId: string;
  onDelete: () => void;
  onDuplicate: () => void;
  isDuplicating?: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2 shrink-0">
      <Link
        href={`/admin/products/${productId}/setup`}
        className="bg-[#0f1422] px-[12px] py-[5px] rounded-[10px] text-white text-xs font-normal leading-[1.4] tracking-[-0.228px] whitespace-nowrap cursor-pointer hover:bg-black transition-colors"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={onDuplicate}
        disabled={isDuplicating}
        className="bg-[#07b6d3] px-[12px] py-[5px] rounded-[10px] text-white text-xs font-normal leading-[1.4] tracking-[-0.228px] whitespace-nowrap cursor-pointer hover:bg-[#06a2bc] transition-colors disabled:opacity-50"
      >
        {isDuplicating ? "Cloning..." : "Duplicate"}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="bg-[#c50000] px-[12px] py-[5px] rounded-[10px] text-white text-xs font-normal leading-[1.4] tracking-[-0.228px] whitespace-nowrap cursor-pointer hover:bg-red-700 transition-colors"
      >
        Delete
      </button>
    </div>
  );
}

const ALL_FILTER_VALUE = "__glassfit_all__";

function ProductFilterSelect({
  accessibleName,
  allLabel,
  value,
  options,
  onValueChange,
}: {
  accessibleName: string;
  allLabel: string;
  value: string | null;
  options: readonly string[];
  onValueChange: (value: string | null) => void;
}) {
  return (
    <Select.Root
      value={value ?? ALL_FILTER_VALUE}
      onValueChange={(nextValue) =>
        onValueChange(nextValue === ALL_FILTER_VALUE ? null : nextValue)
      }
    >
      <Select.Trigger
        aria-label={accessibleName}
        className="group flex items-center gap-2.5 whitespace-nowrap rounded-[25px] bg-[#c3c3c3] px-4 py-2 text-xs font-normal text-white shadow-xs transition-colors hover:bg-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 sm:text-sm"
      >
        <Select.Value />
        <Select.Icon asChild>
          <svg
            width="25"
            height="25"
            viewBox="0 0 25 25"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="shrink-0 transition-transform duration-200 ease-in-out group-data-[state=open]:rotate-180 motion-reduce:transition-none"
          >
            <path
              opacity="0.4"
              d="M7.75781 10.625L12.5 15.3672L17.2422 10.625H7.75781Z"
              fill="white"
            />
            <path
              d="M13.3829 17.1328C12.8946 17.6211 12.1017 17.6211 11.6134 17.1328L5.36339 10.8828C5.00402 10.5234 4.89855 9.98828 5.09386 9.51953C5.28917 9.05078 5.7462 8.75 6.25011 8.75H18.7501C19.254 8.75 19.711 9.05469 19.9064 9.52344C20.1017 9.99219 19.9923 10.5273 19.6368 10.8867L13.3868 17.1367L13.3829 17.1328ZM17.2423 10.625H7.75792L12.5001 15.3672L17.2423 10.625Z"
              fill="white"
            />
          </svg>
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[16px] border border-neutral-200 bg-white p-1.5 text-[#0f1422] shadow-[0_12px_32px_rgba(15,20,34,0.14)]"
        >
          <Select.Viewport>
            <ProductFilterOption value={ALL_FILTER_VALUE} label={allLabel} />
            {options.map((option) => (
              <ProductFilterOption key={option} value={option} label={option} />
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function ProductFilterOption({ value, label }: { value: string; label: string }) {
  return (
    <Select.Item
      value={value}
      className="relative flex min-h-10 cursor-default select-none items-center rounded-[10px] py-2 pl-3 pr-9 text-sm outline-none data-[highlighted]:bg-[#e9f9fb] data-[highlighted]:text-[#097283] data-[state=checked]:font-medium data-[state=checked]:text-[#097283]"
    >
      <Select.ItemText>{label}</Select.ItemText>
      <Select.ItemIndicator className="absolute right-3 inline-flex items-center justify-center text-[#07b6d3]">
        <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
      </Select.ItemIndicator>
    </Select.Item>
  );
}

export function ProductsContent({ initialProducts }: { initialProducts: AdminProductItem[] }) {
  const router = useRouter();
  const [products, setProducts] = useState<AdminProductItem[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<ProductTypeFilter>(null);
  const [selectedStatus, setSelectedStatus] = useState<ProductStatusFilter>(null);
  const [productToDelete, setProductToDelete] = useState<AdminProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const productTypeOptions = useMemo(
    () => deriveProductTypeOptions(products),
    [products],
  );
  const filtered = useMemo(
    () =>
      filterAdminProducts(products, {
        searchQuery,
        selectedType,
        selectedStatus,
      }),
    [products, searchQuery, selectedStatus, selectedType],
  );

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedType(null);
    setSelectedStatus(null);
  };

  const handleDuplicateProduct = async (product: AdminProductItem) => {
    try {
      setDuplicatingId(product.id);
      const res = await duplicateProductPreset(product.id, `${product.name} (Copy)`);
      router.push(`/admin/products/${res.newProductId}/setup`);
    } catch (e: unknown) {
      console.error("Duplicate failed:", e);
      alert(`Error duplicating preset: ${e instanceof Error ? e.message : "Something went wrong"}`);
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProduct(productToDelete.id);
      const remainingProducts = products.filter((p) => p.id !== productToDelete.id);
      setProducts(remainingProducts);
      if (
        selectedType !== null &&
        !deriveProductTypeOptions(remainingProducts).includes(selectedType)
      ) {
        setSelectedType(null);
      }
      setProductToDelete(null);
    } catch (e: unknown) {
      alert(`Error deleting product: ${e instanceof Error ? e.message : "Something went wrong"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-6 sm:gap-8 w-full max-w-[1240px] select-none">
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
            className="bg-[#0f1422] text-white rounded-[25px] px-5 py-3 sm:py-3.5 flex items-center justify-center gap-2 cursor-pointer hover:bg-black transition-colors shrink-0 shadow-xs"
          >
            <Plus className="size-4" />
            <span className="text-white text-base sm:text-lg font-medium leading-tight whitespace-nowrap">
              Add Product
            </span>
          </Link>
        </div>
      </div>

      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <ProductFilterSelect
            accessibleName="Filter products by product type"
            allLabel="All categories"
            value={selectedType}
            options={productTypeOptions}
            onValueChange={setSelectedType}
          />
          <ProductFilterSelect
            accessibleName="Filter products by status"
            allLabel="All Status"
            value={selectedStatus}
            options={["Published", "Draft"] satisfies readonly AdminProductStatus[]}
            onValueChange={(value) => setSelectedStatus(value as ProductStatusFilter)}
          />
        </div>
        <p
          aria-live="polite"
          className="text-[#c3c3c3] text-xs sm:text-sm font-normal leading-snug whitespace-nowrap"
        >
          Showing {filtered.length} of {products.length} products
        </p>
      </div>

      <div className="bg-white rounded-[20px] p-4 sm:p-6 lg:p-[30px] flex flex-col items-start w-full shadow-xs overflow-hidden">
        <div className="w-full overflow-x-auto pb-2">
          <div className="w-full min-w-[760px] flex flex-col gap-2.5 items-start">
            <div className="w-full flex items-center gap-4">
              <ColHeader align="left">Product ID</ColHeader>
              <ColHeader align="left">Product Name</ColHeader>
              <ColHeader align="left">Product Type</ColHeader>
              <ColHeader align="left">Description</ColHeader>
              <ColHeader align="right">Base Price</ColHeader>
              <ColHeader align="center">Status</ColHeader>
              <ColHeader align="center">Actions</ColHeader>
            </div>

            <div className="w-full border-t border-[#e5e5e5]" />

            {products.length === 0 ? (
              <div className="w-full py-12 text-center text-sm text-neutral-500">
                No products are currently available.
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex w-full flex-col items-center gap-4 py-12 text-center">
                <p className="text-sm text-neutral-600">
                  No products match the current search and filters.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="min-h-11 rounded-[25px] bg-[#0f1422] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              filtered.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  onDelete={() => setProductToDelete(product)}
                  onDuplicate={() => handleDuplicateProduct(product)}
                  isDuplicating={duplicatingId === product.id}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Delete Product Confirmation Modal */}
      <DeleteProductModal
        isOpen={!!productToDelete}
        onClose={() => {
          if (!isDeleting) setProductToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        productName={productToDelete?.name || ""}
        isDeleting={isDeleting}
      />
    </div>
  );
}

function ProductRow({
  product,
  onDelete,
  onDuplicate,
  isDuplicating,
}: {
  product: AdminProductItem;
  onDelete: () => void;
  onDuplicate: () => void;
  isDuplicating?: boolean;
}) {
  return (
    <div className="w-full flex items-center gap-4 py-2 hover:bg-neutral-50/70 rounded-lg transition-colors">
      <ColCell align="left">
        <ProductIdBadge id={product.id} />
      </ColCell>
      <ColCell align="left" className="font-medium text-[#0f1422]">
        {product.name}
      </ColCell>
      <ColCell align="left">{product.type}</ColCell>
      <ColCell align="left" className="truncate text-neutral-600">
        {product.description?.trim() ? (
          <span className="truncate">{product.description}</span>
        ) : (
          <span className="text-neutral-300 font-light">—</span>
        )}
      </ColCell>
      <ColCell align="right" className="font-medium text-[#0f1422]">
        {product.basePrice}
      </ColCell>
      <ColCell align="center">
        <StatusBadge status={product.status} />
      </ColCell>
      <ColCell align="center">
        <ActionButtons
          productId={product.id}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          isDuplicating={isDuplicating}
        />
      </ColCell>
    </div>
  );
}
