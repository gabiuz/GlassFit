"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Search, X } from "lucide-react";
import type { CatalogProduct } from "@/lib/products/types";

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: CatalogProduct) => Promise<void> | void;
  products: CatalogProduct[];
  currentProductId?: string;
  allowCurrentProduct?: boolean;
  title?: string;
}

export function AddProductModal({
  isOpen,
  onClose,
  onSelectProduct,
  products,
  currentProductId,
  allowCurrentProduct = false,
  title = "Add Product",
}: AddProductModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [selectingProductId, setSelectingProductId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.type))).sort(),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.description?.toLowerCase().includes(normalizedQuery);
      const matchesCategory = !selectedCategory || product.type === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  if (!isOpen) return null;

  const handleSelect = async (product: CatalogProduct) => {
    setSelectingProductId(product.id);
    setSelectionError(null);

    try {
      await onSelectProduct(product);
      onClose();
    } catch (error) {
      setSelectionError(
        error instanceof Error
          ? error.message
          : "This product could not be loaded for visualization.",
      );
    } finally {
      setSelectingProductId(null);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-picker-title"
        className="fixed inset-x-4 top-4 bottom-4 z-40 mx-auto flex w-auto max-w-[500px] flex-col gap-4 overflow-hidden rounded-[20px] border border-[#c3c3c3]/40 bg-white p-5 shadow-[0px_10px_35px_rgba(0,0,0,0.2)] animate-in fade-in slide-in-from-top-2 duration-200 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-3 sm:max-h-[calc(100dvh-12rem)] sm:w-[500px] sm:gap-6 sm:p-8"
      >
        <div className="flex w-full shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="product-picker-title"
              className="text-2xl font-medium text-[#0f1422] tracking-tight"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Choose from the active GlassFit product catalog.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-black rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
            aria-label="Close product catalog"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-grad-light rounded-[10px] p-[2px] flex items-center shadow-xs shrink-0 pr-[8px]">
          <div className="bg-white rounded-[8px] h-[56px] flex items-center px-4 w-full overflow-hidden shadow-[0px_4px_12px_0px_rgba(13,10,44,0.06)]">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search for products"
              className="w-full text-base sm:text-lg font-normal text-black placeholder-[#abb7c2] focus:outline-none bg-transparent"
            />
          </div>
          <div className="px-3 text-white flex items-center justify-center shrink-0">
            <Search className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="flex flex-col shrink-0 border-b border-neutral-100 pb-3">
          <button
            type="button"
            onClick={() => setIsCategoryOpen((current) => !current)}
            className="flex justify-between items-center w-full py-1 text-left cursor-pointer"
            aria-expanded={isCategoryOpen}
          >
            <span className="text-[#0f1422] text-[18px] font-medium tracking-[-0.342px]">
              Product Category {selectedCategory ? `: ${selectedCategory}` : ""}
            </span>
            <Image
              src="/visualization/dropdown-btn.svg"
              alt=""
              width={20}
              height={20}
              className={`transition-transform duration-200 ${isCategoryOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isCategoryOpen && (
            <div className="flex flex-wrap gap-2 pt-3 animate-in fade-in duration-150">
              {[null, ...categories].map((category) => (
                <button
                  key={category ?? "all"}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(category);
                    setIsCategoryOpen(false);
                  }}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
                    selectedCategory === category
                      ? "bg-[#07b6d3] text-white border-[#07b6d3]"
                      : "bg-neutral-50 text-black border-neutral-200 hover:bg-neutral-100"
                  }`}
                >
                  {category ?? "All"}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectionError && (
          <p role="alert" className="rounded-[10px] bg-red-50 px-3 py-2 text-sm text-red-700">
            {selectionError}
          </p>
        )}

        {/* PRD-F6, SDD-C5, DSD-UI4: preserve each complete card and scroll the catalog. */}
        <div className="custom-scrollbar grid min-h-0 flex-1 auto-rows-max grid-cols-1 content-start gap-4 overflow-y-auto pr-1 min-[420px]:grid-cols-2">
          {filteredProducts.map((product) => {
            const isCurrent = product.id === currentProductId;
            const isSelecting = selectingProductId === product.id;
            const price = product.basePrice > 0
              ? `₱ ${product.basePrice.toLocaleString("en-PH")}`
              : "Price after configuration";

            return (
              <article
                key={product.id}
                className="bg-white border border-neutral-200/80 rounded-[10px] shadow-[0px_0px_2.5px_0px_rgba(0,0,0,0.25)] flex flex-col justify-between overflow-hidden hover:border-[#07b6d3] transition-colors"
              >
                <div className="relative w-full h-[125px] bg-[#e5e5e5] overflow-hidden">
                  <Image
                    src={product.imageUrl ?? "/product_card_placeholder.png"}
                    alt={product.name}
                    fill
                    className="object-cover"
                    unoptimized={Boolean(product.imageUrl?.startsWith("http"))}
                  />
                </div>

                <div className="bg-white/50 p-3 sm:p-4 flex flex-col gap-2.5 flex-1 justify-between">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-black text-sm sm:text-base font-normal tracking-[-0.38px] uppercase line-clamp-1">
                      {product.name}
                    </h3>
                    <div>
                      <span className="px-2 py-0.5 text-[11px] text-[#0f1422] border border-[#c3c3c3] rounded-[20px]">
                        {product.type}
                      </span>
                    </div>
                    <p className="text-[#a4a4a4] text-xs font-normal leading-4 line-clamp-2">
                      {product.description ?? "Custom GlassFit product"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 mt-2">
                    <span className="text-[#0f1422] text-sm sm:text-base font-medium">
                      {price}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleSelect(product)}
                      disabled={
                        (isCurrent && !allowCurrentProduct) ||
                        selectingProductId !== null
                      }
                      className="w-full py-1.5 sm:py-2 bg-black text-white text-xs sm:text-sm font-medium rounded-full hover:bg-neutral-800 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:bg-neutral-300"
                    >
                      {isCurrent
                        ? allowCurrentProduct
                          ? isSelecting
                            ? "Adding..."
                            : "Add Another"
                          : "Current Product"
                        : isSelecting
                          ? "Loading..."
                          : "Select Product"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="rounded-[16px] bg-neutral-50 px-5 py-10 text-center text-sm text-neutral-500 min-[420px]:col-span-2">
              {products.length === 0
                ? "No active products are available in the catalog yet."
                : "No products match your search and category."}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
