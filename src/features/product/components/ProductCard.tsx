"use client";
import Button from "@/components/shared/Button";
import Image from "next/image";
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
  const { name, description, basePrice, rendererKey, imageUrl } = product;

  const priceDisplay = formatPrice(basePrice);
  const canVisualize = rendererKey !== null;

  // Generate tag-like chips from product type for display
  const typeTags = [product.type];

  const imageSrc = imageUrl ?? "/product_card_placeholder.png";
  const isExternalImage = imageSrc.startsWith("http");

  return (
    <div className="max-w-68.25 rounded-[10px] bg-white/50 shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] w-full flex flex-col justify-between overflow-hidden">
      <div>
        <Image
          src={imageSrc}
          alt={name}
          width={273}
          height={224}
          className="w-full h-[224px] object-cover"
          unoptimized={isExternalImage}
        />
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
            {!canVisualize && (
              <div className="px-2.5 py-1.25 rounded-[20px] border border-amber-400/60 bg-amber-50">
                <span className="text-amber-700 text-xs">Preview coming soon</span>
              </div>
            )}
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
            <Button
              leftIcon={null}
              rightIcon={null}
              variant="greenBtnWhiteText"
              value="View Product"
              className="whitespace-nowrap text-sm!"
              style={{
                gap: "8px",
                borderRadius: "10px",
                padding: "5px 10px",
                flex: "1 1 105px",
                width: "auto",
                justifyContent: "center",
              }}
            />
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
              className="whitespace-nowrap text-sm!"
              title={
                canVisualize
                  ? undefined
                  : "This product is available in the catalog, but its visualization model is not available yet."
              }
              disabled={!canVisualize}
              style={{
                gap: "8px",
                borderRadius: "10px",
                padding: "5px 10px",
                flex: "1 1 105px",
                width: "auto",
                justifyContent: "center",
                opacity: canVisualize ? 1 : 0.5,
                cursor: canVisualize ? "pointer" : "not-allowed",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
