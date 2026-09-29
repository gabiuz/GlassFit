"use client";
import React, { useState } from "react";
import Link from "next/link";
import Button from "@/components/shared/Button";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CatalogProduct } from "@/lib/products/types";

interface ProductCardProps {
  product: CatalogProduct;
}

/**
 * Returns the price display string according to the implementation plan:
 *   base_price > 0  → "Starting at ₱X,XXX"
 *   base_price = 0  → "Price available after configuration"
 */
function formatPrice(basePrice: number): { label: string; value: string } | { message: string } {
  if (basePrice > 0) {
    return {
      label: "Starting at",
      value: `₱ ${basePrice.toLocaleString("en-PH")}`,
    };
  }
  return { message: "Price available after configuration" };
}

export function ProductCard({ product }: ProductCardProps) {
  const { name, description, basePrice, imageUrl, imageUrls = [] } = product;

  // Use array of images if available, fallback to single imageUrl or placeholder
  const images = imageUrls.length > 0 ? imageUrls : imageUrl ? [imageUrl] : ["/product_card_placeholder.png"];
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const totalImages = images.length;

  // Infinite wrap-around marquee navigation (no hard left or right boundaries)
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (totalImages <= 1) return;
    setCurrentImgIndex((prev) => (prev + 1) % totalImages);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (totalImages <= 1) return;
    setCurrentImgIndex((prev) => (prev - 1 + totalImages) % totalImages);
  };

  const activeSrc = images[currentImgIndex] || "/product_card_placeholder.png";
  const isExternalImage = activeSrc.startsWith("http");

  const priceDisplay = formatPrice(basePrice);

  // Generate tag-like chips from product type for display
  const typeTags = [product.type];

  return (
    <div className="max-w-68.25 rounded-[10px] bg-white/50 shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] w-full flex flex-col justify-between overflow-hidden group">
      {/* Image Carousel Area */}
      <div className="relative w-full h-[224px] overflow-hidden bg-neutral-100">
        <Image
          src={activeSrc}
          alt={`${name} - Image ${currentImgIndex + 1}`}
          fill
          className="object-cover transition-all duration-300"
          unoptimized={isExternalImage}
        />

        {/* Infinite Loop Arrow Controls (only displayed when multiple images exist) */}
        {totalImages > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous product image"
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 hover:bg-white text-neutral-800 shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-105 cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next product image"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 hover:bg-white text-neutral-800 shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-105 cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>

            {/* Pagination Indicators */}
            <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-1 z-10 pointer-events-none">
              {images.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentImgIndex ? "w-3 bg-white shadow-xs" : "w-1.5 bg-white/60"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-col p-5 gap-7.5 flex-1 justify-between">
        <div className="flex flex-col gap-2.5 justify-start items-start">
          <h2 className="text-black text-xl font-normal leading-7 min-h-14">{name}</h2>
          <div className="flex flex-wrap gap-1.25">
            {typeTags.map((tag) => (
              <div
                key={tag}
                className="px-2.5 py-1.25 rounded-[20px] border border-[#C3C3C3]"
              >
                <span className="text-black text-xs">{tag}</span>
              </div>
            ))}
          </div>
          <div className="w-fit">
            <p className="text-black text-sm font-normal leading-5">
              {description ?? ""}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 justify-start items-start mt-4 w-full">
          {"message" in priceDisplay ? (
            <p className="text-xs text-neutral-400 italic">{priceDisplay.message}</p>
          ) : (
            <>
              <div>
                <span className="font-normal leading-4 text-xs text-[#c3c3c3]">
                  {priceDisplay.label}
                </span>
              </div>
              <div>
                <span className="text-green text-xl font-medium leading-7">
                  {priceDisplay.value}
                </span>
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-2 w-full">
            {/* feat/sql: routed buttons */}
            <Link href={`/product-details/${product.id}`} style={{ flex: "1 1 105px" }}>
              <Button
                leftIcon={null}
                rightIcon={null}
                variant="greenBtnWhiteText"
                value="View Product"
                className="whitespace-nowrap text-sm! "
                style={{
                  gap: "8px",
                  borderRadius: "10px",
                  padding: "5px 10px",
                  width: "100%",
                  justifyContent: "center",
                }}
              />
            </Link>
            <Link href={`/visualize/${product.id}/upload`} style={{ flex: "1 1 105px" }}>
              <Button
                leftIcon={null}
                rightIcon={
                  <Image
                    src="/right_arrow.svg"
                    width={10}
                    height={7.5}
                    alt="right arrow"
                  />
                }
                variant="blackBtnWhiteText"
                value="Visualize"
                className="whitespace-nowrap text-sm! "
                style={{
                  gap: "8px",
                  borderRadius: "10px",
                  padding: "5px 10px",
                  width: "100%",
                  justifyContent: "center",
                }}
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
