"use client";
import Link from "next/link";
import Button from "@/components/shared/Button";
import Image from "next/image";
import { Product } from "../data/products";

const defaultTags = ["Aluminum", "Frosted"];

interface ProductCardProps {
  product?: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  // Use mock product details if provided, fallback to original hardcoded values
  const name = product ? product.name : "Aluminum Sliding Window";
  const tags = product ? product.tags : defaultTags;
  const description = product
    ? product.description
    : "A customizable aluminum-framed window suitable for residential and commercial spaces.";
  const price = product
    ? `₱ ${product.price.toLocaleString()}`
    : "₱ 00,000";
  const imageSrc = product ? product.image : "/product_card_placeholder.png";

  return (
    <div className="max-w-68.25 rounded-[10px] bg-white/50 shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] w-full flex flex-col justify-between overflow-hidden">
      <div>
        <Image
          src={imageSrc}
          alt={name}
          width={273}
          height={224}
          className="w-full h-[224px] object-cover"
        />
      </div>
      <div className="flex flex-col p-5 gap-7.5 flex-1 justify-between">
        <div className="flex flex-col gap-2.5 justify-start items-start">
          <h1 className="text-black text-xl font-normal leading-7 min-h-14">
            {name}
          </h1>
          <div className="flex flex-wrap gap-1.25">
            {tags.map((tag) => {
              return (
                <div
                  key={tag}
                  className="px-2.5 py-1.25 rounded-[20px] border border-[#C3C3C3]"
                >
                  <span className="text-black text-xs">{tag}</span>
                </div>
              );
            })}
          </div>
          <div className="w-fit">
            <p className="text-black text-sm font-normal leading-5">
              {description}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 justify-start items-start mt-4 w-full">
          <div>
            <span className="font-normal leading-4 text-xs text-[#c3c3c3]">
              Starts at
            </span>
          </div>
          <div>
            <span className="text-green text-xl font-medium leading-7 ">
              {price}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 w-full">
            <Link href="/product-details" style={{ flex: "1 1 105px" }}>
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
            <Link href="/visualization" style={{ flex: "1 1 105px" }}>
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
