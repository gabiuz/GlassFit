"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import type { CatalogProduct } from "@/lib/products/types";

export { type CatalogProduct };

export const MIN_PRICE = 0;
export const MAX_PRICE = 100000;

export interface FilterState {
  searchQuery: string;
  range: [number, number];
  selectedCategory: string;
  anodized: string[];
  powderCoated: string[];
  glass: string[];
  checkedDoors: string[];
  materialFinish: string[];
  aluminumProfile: string[];
  glassProfile: string[];
  glassThickness: string[];
}

const initialFilterState: FilterState = {
  searchQuery: "",
  range: [MIN_PRICE, MAX_PRICE],
  selectedCategory: "All",
  anodized: [],
  powderCoated: [],
  glass: [],
  checkedDoors: [],
  materialFinish: [],
  aluminumProfile: [],
  glassProfile: [],
  glassThickness: [],
};

interface ProductFilterContextProps {
  filters: FilterState;
  draftFilters: FilterState;
  isMobileSheetOpen: boolean;
  setIsMobileSheetOpen: (open: boolean) => void;
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  updateDraftFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  applyDraftFilters: () => void;
  resetFilters: () => void;
  resetDraftFilters: () => void;
  removeChipFilter: (type: string, value?: string) => void;
  activeFiltersCount: number;
  filteredProducts: CatalogProduct[];
  draftFilteredProducts: CatalogProduct[];
  allProducts: CatalogProduct[];
}

export const ProductFilterContext = createContext<ProductFilterContextProps | undefined>(undefined);

export function useProductFilter() {
  const context = useContext(ProductFilterContext);
  if (!context) {
    throw new Error("useProductFilter must be used within a ProductFilterProvider");
  }
  return context;
}

/**
 * Maps the database product_type to the display category label used in the filter UI.
 * These labels must match the categoryOptions defined in ProductFilter.tsx.
 */
export function productTypeToCategory(type: CatalogProduct["type"]): string {
  switch (type) {
    case "Window":
      return "Windows";
    case "Door":
      return "Doors";
    case "Cabinet":
      return "Cabinets";
    case "Partition":
      return "Partition";
    case "Enclosure":
      return "Shower Enclosure";
    case "Railing":
      return "Railing";
    default:
      return "Other";
  }
}

export function filterProductList(products: CatalogProduct[], state: FilterState): CatalogProduct[] {
  const terms = state.searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return products.filter((product) => {
    // 0. Search Query (name, type, description, category, and id)
    if (terms.length > 0) {
      const category = productTypeToCategory(product.type).toLowerCase();
      const name = product.name.toLowerCase();
      const type = product.type.toLowerCase();
      const desc = (product.description ?? "").toLowerCase();
      const id = product.id.toLowerCase();

      const matchesAllTerms = terms.every((term) =>
        name.includes(term) ||
        type.includes(term) ||
        desc.includes(term) ||
        category.includes(term) ||
        id.includes(term)
      );

      if (!matchesAllTerms) {
        return false;
      }
    }

    // 1. Price Range
    if (product.basePrice > 0) {
      if (product.basePrice < state.range[0] || product.basePrice > state.range[1]) {
        return false;
      }
    }
    // Products with basePrice = 0 pass the price filter regardless (price not yet set)

    // 2. Category
    if (state.selectedCategory !== "All") {
      const category = productTypeToCategory(product.type);
      if (category !== state.selectedCategory) {
        return false;
      }
    }

    return true;
  });
}

export function calculateActiveFilters(state: FilterState): number {
  let count = 0;
  if (state.searchQuery.trim().length > 0) {
    count++;
  }
  if (state.range[0] !== MIN_PRICE || state.range[1] !== MAX_PRICE) {
    count++;
  }
  if (state.selectedCategory !== "All") {
    count++;
  }
  const specificDoors = state.checkedDoors.filter((d) => d !== "All");
  count += specificDoors.length;
  count += state.materialFinish.length;
  count += state.anodized.length;
  count += state.powderCoated.length;
  count += state.glass.length;
  count += state.aluminumProfile.length;
  count += state.glassProfile.length;
  count += state.glassThickness.length;
  return count;
}

interface ProductFilterProviderProps {
  children: React.ReactNode;
  /** Active products loaded from Supabase, passed in from the server component. */
  initialProducts: CatalogProduct[];
}

export function ProductFilterProvider({ children, initialProducts }: ProductFilterProviderProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [draftFilters, setDraftFilters] = useState<FilterState>(initialFilterState);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const openOrCloseMobileSheet = (open: boolean) => {
    if (open && !isMobileSheetOpen) {
      setDraftFilters({ ...filters });
    }
    setIsMobileSheetOpen(open);
  };

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "selectedCategory" && value !== "Doors" ? { checkedDoors: [] } : {}),
    }));
  };

  const updateDraftFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setDraftFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "selectedCategory" && value !== "Doors" ? { checkedDoors: [] } : {}),
    }));
  };

  const applyDraftFilters = () => {
    setFilters({ ...draftFilters });
    setIsMobileSheetOpen(false);
  };

  const resetFilters = () => {
    setFilters(initialFilterState);
  };

  const resetDraftFilters = () => {
    setDraftFilters((prev) => ({
      ...initialFilterState,
      searchQuery: prev.searchQuery,
    }));
  };

  const removeChipFilter = (type: string, value?: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      switch (type) {
        case "searchQuery":
        case "search":
          next.searchQuery = "";
          break;
        case "range":
          next.range = [MIN_PRICE, MAX_PRICE];
          break;
        case "category":
          next.selectedCategory = "All";
          next.checkedDoors = [];
          break;
        case "checkedDoors":
          if (value) {
            next.checkedDoors = prev.checkedDoors.filter((d) => d !== value && d !== "All");
          } else {
            next.checkedDoors = [];
          }
          break;
        case "materialFinish":
          if (value) {
            next.materialFinish = prev.materialFinish.filter((m) => m !== value);
            if (value === "Aluminum") {
              next.anodized = [];
              next.powderCoated = [];
              next.aluminumProfile = [];
            }
            if (value === "Glass") {
              next.glass = [];
              next.glassProfile = [];
              next.glassThickness = [];
            }
          } else {
            next.materialFinish = [];
            next.anodized = [];
            next.powderCoated = [];
            next.aluminumProfile = [];
            next.glass = [];
            next.glassProfile = [];
            next.glassThickness = [];
          }
          break;
        case "anodized":
          next.anodized = value ? prev.anodized.filter((v) => v !== value) : [];
          break;
        case "powderCoated":
          next.powderCoated = value ? prev.powderCoated.filter((v) => v !== value) : [];
          break;
        case "glass":
          next.glass = value ? prev.glass.filter((v) => v !== value) : [];
          break;
        case "aluminumProfile":
          next.aluminumProfile = value ? prev.aluminumProfile.filter((v) => v !== value) : [];
          break;
        case "glassProfile":
          next.glassProfile = value ? prev.glassProfile.filter((v) => v !== value) : [];
          break;
        case "glassThickness":
          next.glassThickness = value ? prev.glassThickness.filter((v) => v !== value) : [];
          break;
      }
      return next;
    });
  };

  const activeFiltersCount = useMemo(() => calculateActiveFilters(filters), [filters]);
  const filteredProducts = useMemo(
    () => filterProductList(initialProducts, filters),
    [initialProducts, filters]
  );
  const draftFilteredProducts = useMemo(
    () => filterProductList(initialProducts, draftFilters),
    [initialProducts, draftFilters]
  );

  return (
    <ProductFilterContext.Provider
      value={{
        filters,
        draftFilters,
        isMobileSheetOpen,
        setIsMobileSheetOpen: openOrCloseMobileSheet,
        updateFilter,
        updateDraftFilter,
        applyDraftFilters,
        resetFilters,
        resetDraftFilters,
        removeChipFilter,
        activeFiltersCount,
        filteredProducts,
        draftFilteredProducts,
        allProducts: initialProducts,
      }}
    >
      {children}
    </ProductFilterContext.Provider>
  );
}
