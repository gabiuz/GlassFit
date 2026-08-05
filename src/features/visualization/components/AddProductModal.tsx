"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Search, X, ChevronDown } from "lucide-react";
import { mockProducts, Product } from "@/features/product/data/products";

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct?: (product: Product) => void;
  title?: string;
}

export function AddProductModal({
  isOpen,
  onClose,
  onSelectProduct,
  title = "Add Product",
}: AddProductModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  if (!isOpen) return null;

  // Filter products based on search and category
  const filteredProducts = mockProducts.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(mockProducts.map((p) => p.category)));

  return (
    <>
      {/* Invisible overlay for closing on click outside */}
      <div
        className="fixed inset-0 z-30 bg-transparent"
        onClick={onClose}
      />

      {/* Anchored Popover Card (No background blur or dark overlay) */}
      <div className="absolute top-full right-0 mt-3 z-40 bg-white rounded-[20px] p-6 sm:p-8 w-[340px] sm:w-[500px] flex flex-col gap-6 shadow-[0px_10px_35px_rgba(0,0,0,0.2)] border border-[#c3c3c3]/40 max-h-[80vh] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
        {/* Header & Close Button */}
        <div className="flex justify-between items-center w-full">
          <h2 className="text-2xl font-medium text-[#0f1422] tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-black rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search Bar matching Figma specs */}
        <div className="bg-grad-light rounded-[10px] p-[2px] flex items-center shadow-xs shrink-0 pr-[8px]">
          <div className="bg-white rounded-[8px] h-[56px] flex items-center px-4 w-full overflow-hidden shadow-[0px_4px_12px_0px_rgba(13,10,44,0.06)]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for products"
              className="w-full text-base sm:text-lg font-normal text-black placeholder-[#abb7c2] focus:outline-none bg-transparent"
            />
          </div>
          <div className="px-3 text-white flex items-center justify-center shrink-0">
            <Search className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Category Filter Dropdown Header */}
        <div className="flex flex-col shrink-0 border-b border-neutral-100 pb-3">
          <button
            type="button"
            onClick={() => setIsCategoryOpen(!isCategoryOpen)}
            className="flex justify-between items-center w-full py-1 text-left cursor-pointer"
          >
            <span className="text-[#0f1422] text-[18px] font-medium tracking-[-0.342px]">
              Product Category {selectedCategory ? `: ${selectedCategory}` : ""}
            </span>
            <div
              className={`transform transition-transform duration-200 ${
                isCategoryOpen ? "rotate-180" : "rotate-0"
              }`}
            >
              <Image
                src="/visualization/dropdown-btn.svg"
                alt="Toggle Category"
                width={20}
                height={20}
              />
            </div>
          </button>

          {/* Category choices */}
          {isCategoryOpen && (
            <div className="flex flex-wrap gap-2 pt-3 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(null);
                  setIsCategoryOpen(false);
                }}
                className={`px-3 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
                  selectedCategory === null
                    ? "bg-[#07b6d3] text-white border-[#07b6d3]"
                    : "bg-neutral-50 text-black border-neutral-200 hover:bg-neutral-100"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setIsCategoryOpen(false);
                  }}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-[#07b6d3] text-white border-[#07b6d3]"
                      : "bg-neutral-50 text-black border-neutral-200 hover:bg-neutral-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Cards Grid (Variant 2 layout from Figma) */}
        <div className="overflow-y-auto pr-1 flex-1 grid grid-cols-2 gap-4 max-h-[460px]">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white border border-neutral-200/80 rounded-[10px] shadow-[0px_0px_2.5px_0px_rgba(0,0,0,0.25)] flex flex-col justify-between overflow-hidden hover:border-[#07b6d3] transition-colors"
            >
              {/* Product Image Thumbnail */}
              <div className="relative w-full h-[125px] bg-[#e5e5e5] overflow-hidden">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Product Content Details */}
              <div className="bg-white/50 p-3 sm:p-4 flex flex-col gap-2.5 flex-1 justify-between">
                <div className="flex flex-col gap-2">
                  <h3 className="text-black text-sm sm:text-base font-normal tracking-[-0.38px] uppercase line-clamp-1">
                    {product.name}
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {product.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-[11px] text-[#0f1422] border border-[#c3c3c3] rounded-[20px]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-[#0f1422] text-xs font-normal leading-relaxed line-clamp-2">
                    {product.description}
                  </p>
                </div>

                {/* Add Button */}
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectProduct) onSelectProduct(product);
                      onClose();
                    }}
                    className="bg-[#07b6d3] hover:bg-[#06a3bd] text-white text-xs font-normal px-4 py-1.5 rounded-[10px] transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
