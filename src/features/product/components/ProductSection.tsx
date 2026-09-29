"use client";
import React from "react";
import { ProductFilterProvider, useProductFilter } from "./ProductFilterContext";
import { ProductFilter } from "./ProductFilter";
import { ProductCard } from "./ProductCard";
import { MobileFilterBar } from "./MobileFilterBar";
import { MobileBottomSheet } from "./MobileBottomSheet";
import { FilterChips } from "./FilterChips";
import type { CatalogProduct } from "@/lib/products/types";

interface ProductSectionProps {
  initialProducts: CatalogProduct[];
  fetchError: string | null;
}

function ProductSectionContent({ fetchError }: { fetchError: string | null }) {
  const { filteredProducts, resetFilters, allProducts } = useProductFilter();

  // Error state
  if (fetchError) {
    return (
      <section className="p-4 md:p-6 lg:p-10 flex flex-col items-center justify-center py-24">
        <p className="text-lg text-red-400 font-medium text-center">{fetchError}</p>
      </section>
    );
  }

  // Empty state — all products returned from DB, no active records
  if (allProducts.length === 0) {
    return (
      <section className="p-4 md:p-6 lg:p-10 flex flex-col items-center justify-center py-24">
        <p className="text-lg text-neutral-400 font-normal text-center">
          No products are currently available.
        </p>
      </section>
    );
  }

  return (
    <section className="p-4 md:p-6 lg:p-10 flex flex-col xl:flex-row gap-8 items-start w-full">
      {/* Desktop Sidebar filter (hidden below xl breakpoint) */}
      <div className="hidden xl:block w-full xl:w-102 shrink-0">
        <ProductFilter />
      </div>

      {/* Grid column */}
      <div className="flex-1 flex flex-col w-full gap-8 xl:gap-4">
        {/* Mobile sticky header (only visible below xl) */}
        <MobileFilterBar />
        {/* Filter chips (visible if active filters count > 0) */}
        <FilterChips />

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3 gap-6 w-fit mx-auto xl:mx-0">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center justify-center py-16 px-4 text-center">
            <p className="text-lg text-neutral-400 font-normal">
              No products match your selected filters.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 text-green font-medium hover:underline cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Mobile filter bottom drawer sheet */}
      <MobileBottomSheet />
    </section>
  );
}

export function ProductSection({ initialProducts, fetchError }: ProductSectionProps) {
  return (
    <ProductFilterProvider initialProducts={initialProducts}>
      <ProductSectionContent fetchError={fetchError} />
    </ProductFilterProvider>
  );
}