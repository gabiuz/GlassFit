"use client";

import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import { mockProducts, Product } from "../data/products";

export const MIN_PRICE = 0;
export const MAX_PRICE = 50000;

export interface FilterState {
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
  range: [MIN_PRICE, MAX_PRICE],
  selectedCategory: "Doors",
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
  filteredProducts: Product[];
  draftFilteredProducts: Product[];
}

const ProductFilterContext = createContext<ProductFilterContextProps | undefined>(undefined);

export function useProductFilter() {
  const context = useContext(ProductFilterContext);
  if (!context) {
    throw new Error("useProductFilter must be used within a ProductFilterProvider");
  }
  return context;
}

function filterProductList(products: Product[], state: FilterState): Product[] {
  return products.filter((product) => {
    // 1. Price Range
    if (product.price < state.range[0] || product.price > state.range[1]) {
      return false;
    }

    // 2. Category
    if (product.category !== state.selectedCategory) {
      return false;
    }

    // 3. Door Style (only filters if doors category and filters exist)
    if (state.selectedCategory === "Doors" && state.checkedDoors.length > 0 && !state.checkedDoors.includes("All")) {
      if (!product.doorStyle || !state.checkedDoors.includes(product.doorStyle)) {
        return false;
      }
    }

    // 4. Material Finish
    if (state.materialFinish.length > 0) {
      const hasMatchingMaterial = product.materials.some((m) => state.materialFinish.includes(m));
      if (!hasMatchingMaterial) {
        return false;
      }
    }

    // 5. Aluminum Finish (Anodized & Powder Coated) - apply only if Aluminum is active
    if (state.materialFinish.includes("Aluminum")) {
      const hasAnodizedFilters = state.anodized.length > 0;
      const hasPowderFilters = state.powderCoated.length > 0;

      if (hasAnodizedFilters || hasPowderFilters) {
        const matchesAnodized = hasAnodizedFilters && product.aluminumFinish && state.anodized.includes(product.aluminumFinish);
        const matchesPowder = hasPowderFilters && product.powderCoatedFinish && state.powderCoated.includes(product.powderCoatedFinish);
        
        if (!matchesAnodized && !matchesPowder) {
          return false;
        }
      }

      // Profile (Aluminum)
      if (state.aluminumProfile.length > 0) {
        if (!product.aluminumProfile || !state.aluminumProfile.includes(product.aluminumProfile)) {
          return false;
        }
      }
    }

    // 6. Glass Finish - apply only if Glass is active
    if (state.materialFinish.includes("Glass")) {
      if (state.glass.length > 0) {
        if (!product.glassFinish || !state.glass.includes(product.glassFinish)) {
          return false;
        }
      }

      // Profile (Glass)
      if (state.glassProfile.length > 0) {
        if (!product.glassProfile || !state.glassProfile.includes(product.glassProfile)) {
          return false;
        }
      }

      // Glass Thickness
      if (state.glassThickness.length > 0) {
        if (!product.thickness || !state.glassThickness.includes(product.thickness)) {
          return false;
        }
      }
    }

    return true;
  });
}

function calculateActiveFilters(state: FilterState): number {
  let count = 0;
  if (state.range[0] !== MIN_PRICE || state.range[1] !== MAX_PRICE) {
    count++;
  }
  // Category defaults to "Doors". If changed, it's counted as a custom filter context.
  if (state.selectedCategory !== "Doors") {
    count++;
  }
  // Count checked doors (excluding "All")
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

export function ProductFilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [draftFilters, setDraftFilters] = useState<FilterState>(initialFilterState);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  // Sync draft filters when mobile sheet opens
  useEffect(() => {
    if (isMobileSheetOpen) {
      setDraftFilters({ ...filters });
    }
  }, [isMobileSheetOpen, filters]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateDraftFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setDraftFilters((prev) => ({
      ...prev,
      [key]: value,
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
    setDraftFilters(initialFilterState);
  };

  const removeChipFilter = (type: string, value?: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      switch (type) {
        case "range":
          next.range = [MIN_PRICE, MAX_PRICE];
          break;
        case "category":
          next.selectedCategory = "Doors";
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
            // Auto clean up dependent selections
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
          if (value) {
            next.anodized = prev.anodized.filter((v) => v !== value);
          } else {
            next.anodized = [];
          }
          break;
        case "powderCoated":
          if (value) {
            next.powderCoated = prev.powderCoated.filter((v) => v !== value);
          } else {
            next.powderCoated = [];
          }
          break;
        case "glass":
          if (value) {
            next.glass = prev.glass.filter((v) => v !== value);
          } else {
            next.glass = [];
          }
          break;
        case "aluminumProfile":
          if (value) {
            next.aluminumProfile = prev.aluminumProfile.filter((v) => v !== value);
          } else {
            next.aluminumProfile = [];
          }
          break;
        case "glassProfile":
          if (value) {
            next.glassProfile = prev.glassProfile.filter((v) => v !== value);
          } else {
            next.glassProfile = [];
          }
          break;
        case "glassThickness":
          if (value) {
            next.glassThickness = prev.glassThickness.filter((v) => v !== value);
          } else {
            next.glassThickness = [];
          }
          break;
      }
      return next;
    });
  };

  const activeFiltersCount = useMemo(() => calculateActiveFilters(filters), [filters]);
  const filteredProducts = useMemo(() => filterProductList(mockProducts, filters), [filters]);
  const draftFilteredProducts = useMemo(() => filterProductList(mockProducts, draftFilters), [draftFilters]);

  return (
    <ProductFilterContext.Provider
      value={{
        filters,
        draftFilters,
        isMobileSheetOpen,
        setIsMobileSheetOpen,
        updateFilter,
        updateDraftFilter,
        applyDraftFilters,
        resetFilters,
        resetDraftFilters,
        removeChipFilter,
        activeFiltersCount,
        filteredProducts,
        draftFilteredProducts,
      }}
    >
      {children}
    </ProductFilterContext.Provider>
  );
}
