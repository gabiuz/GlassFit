"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Plus, Minus } from "lucide-react";
import Button from "@/components/shared/Button";
import type { ProductDetail } from "@/lib/products/getProductById";
import dynamic from "next/dynamic";

// Lazy-load the heavy Three.js canvas so it doesn't bloat the initial bundle and avoid SSR issues
const ProductModel3D = dynamic(
  () => import("./ProductModel3D").then((m) => m.ProductModel3D),
  { ssr: false }
);

type BreadcrumbProps = {
  productName?: string;
};

function Breadcrumb({ productName = "Product Name" }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-base tracking-[-0.304px]" aria-label="Breadcrumb">
      <Link href="/" className="text-[#c3c3c3] hover:text-black transition-colors cursor-pointer text-base font-normal leading-6">Home</Link>
      <ChevronRight className="w-4 h-4 text-[#c3c3c3] shrink-0" />
      <Link href="/product" className="text-[#c3c3c3] hover:text-black transition-colors cursor-pointer text-base font-normal leading-6">Catalog</Link>
      <ChevronRight className="w-4 h-4 text-[#c3c3c3] shrink-0" />
      <span className="text-green font-normal select-none text-base leading-6">{productName}</span>
    </nav>
  );
}

const finishOptions = [
  {
    id: "analok",
    name: "Analok (Champagne / Gold)",
    icon: "/aluminum_finish_icons/analok.svg",
  },
  {
    id: "matte_gray",
    name: "Matte Gray",
    icon: "/aluminum_finish_icons/matte_gray.svg",
  },
];

const glassOptions = [
  { name: "Tempered Glass" },
  { name: "Clear Glass" },
];

export function ProductDetails({ product }: { product: ProductDetail }) {
  const [selectedFinish, setSelectedFinish] = useState("analok");
  const [selectedGlass, setSelectedGlass] = useState("Tempered Glass");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [thickness, setThickness] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [view3d, setView3d] = useState(false);

  const priceLabel = product.base_price > 0
    ? `Starting at ₱${product.base_price.toLocaleString("en-PH")}`
    : null;

  const has3d = Boolean(product.preview_glb_url);

  return (
    <div className="w-full flex flex-col gap-8 px-6 pt-8 pb-16 lg:px-21.5 lg:pt-13.75 lg:pb-33">
      <Breadcrumb productName={product.product_name} />

      <div className="w-full flex flex-col lg:flex-row gap-9 items-stretch lg:items-start">
        {/* Product Image / 3D Viewer */}
        <div className="relative w-full lg:w-164.5 h-64 sm:h-96 lg:h-226.75 shrink-0 overflow-hidden rounded-sm bg-[#d9d9d9]">

          {/* ── 2D view ── */}
          {(!view3d || !has3d) && (
            product.catalog_image_url ? (
              <Image
                src={product.catalog_image_url}
                alt={product.product_name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full bg-[#d9d9d9]" />
            )
          )}

          {/* ── 3D view ── */}
          {view3d && has3d && (
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                </div>
              }
            >
              <ProductModel3D glbUrl={product.preview_glb_url!} />
            </Suspense>
          )}

          {/* ── Glassmorphism 2D | 3D toggle ── */}
          {has3d && (
            <div className="absolute bottom-4 right-4 z-10">
              <div className="flex items-center gap-0.5 rounded-full px-1.5 py-1.5 backdrop-blur-md bg-white/20 border border-white/30 shadow-[0_4px_24px_rgba(0,0,0,0.18)] select-none">
                <button
                  type="button"
                  onClick={() => setView3d(false)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
                    !view3d
                      ? "bg-white text-black shadow-sm"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  2D
                </button>
                <button
                  type="button"
                  onClick={() => setView3d(true)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
                    view3d
                      ? "bg-white text-black shadow-sm"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  3D
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-8 w-full">
          <div className="flex flex-col gap-5 w-full">
            <div className="flex flex-col gap-5 items-start">
              <h1 className="font-medium leading-tight lg:leading-[57.60px] text-3xl sm:text-4xl lg:text-5xl text-black">
                {product.product_name}
              </h1>
              <div className="flex flex-wrap gap-1.25">
                <span className="bg-[#c3c3c3] text-white text-base px-2.5 py-1.25 rounded-[20px] select-none font-normal">
                  {product.product_type}
                </span>
              </div>
              <p className="text-lg lg:text-xl text-black leading-7 font-normal">
                {product.description ?? ""}
              </p>
            </div>
            {/* Estimated Price Box */}
            <div className="bg-grad-light p-7.5 flex flex-col gap-2.5 rounded-[20px] text-white w-full select-none">
              <p className="text-2xl text-white font-normal leading-8">
                Estimated Price
              </p>
              {priceLabel ? (
                <div className="flex items-center">
                  <p className="font-medium text-5xl leading-[57.60px]">
                    {priceLabel}
                  </p>
                </div>
              ) : (
                <p className="text-white/80 text-lg font-normal">
                  Price available after configuration
                </p>
              )}
              <p className="text-xs text-white font-normal leading-4">
                excl. install, final after consultation, etc
              </p>
            </div>
          </div>
          <div className="shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] bg-neutral-100/30 rounded-[20px] p-7.5 flex flex-col gap-6">
            <div className="flex flex-col gap-5">
              <p className="font-medium text-base text-black leading-6">
                Design Specs
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-3">
                  <p className="text-[#c3c3c3] text-base font-normal leading-6 ">
                    Aluminum Finish
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {finishOptions.map((option) => {
                      const isSelected = selectedFinish === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedFinish(option.id)}
                          className="flex items-center gap-3 px-1 py-2 w-full text-left select-none transition-all duration-200 cursor-pointer hover:bg-neutral-50/50 rounded-[8px]"
                        >
                          <span
                            className={
                              isSelected
                                ? "h-4 w-4 shrink-0 rounded-full border-3 border-black bg-green"
                                : "h-4 w-4 shrink-0 rounded-full bg-[#c3c3c3]"
                            }
                            aria-hidden="true"
                          />

                          <Image
                            src={option.icon}
                            alt={option.name}
                            width={25}
                            height={25}
                            className="shrink-0"
                          />

                          <span className="text-sm font-medium text-black truncate">
                            {option.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <p className="text-[#c3c3c3] text-base font-normal leading-6 ">
                    Glass Type
                  </p>
                  <div className="flex gap-1.5">
                    {glassOptions.map((glass) => {
                      const isSelected = selectedGlass === glass.name;
                      return (
                        <button
                          key={glass.name}
                          type="button"
                          onClick={() => setSelectedGlass(glass.name)}
                          className={`px-2.5 py-1.5 border border-[#c3c3c3] rounded-[20px] font-normal text-base select-none transition-all duration-200 cursor-pointer ${isSelected
                            ? "bg-black text-white border-[#c3c3c3]"
                            : "border-[#c3c3c3] text-black"
                            }`}
                        >
                          {glass.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-16 w-full">
              <div className="flex flex-col gap-5">
                <p className="font-medium text-black text-base leading-6">
                  Dimension
                </p>
                <div className="flex flex-wrap w-full gap-4 sm:gap-8">
                  {/* Width */}
                  <div className="w-fit flex flex-col gap-2.5">
                    <label className="w-full text-[#c3c3c3] text-base font-normal leading-6">
                      Width (cm)
                    </label>
                    <input
                      type="number"
                      size={1}
                      value={width}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setWidth(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white border border-[#c3c3c3] rounded-[10px] px-2.5 py-1.5 text-center text-base font-normal text-black outline-none shadow-sm focus:border-black transition-colors"
                    />
                  </div>
                  {/* Height */}
                  <div className="w-fit flex flex-col gap-2.5">
                    <label className="w-full text-[#c3c3c3] text-base font-normal leading-6">
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      size={1}
                      value={height}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setHeight(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white border border-[#c3c3c3] rounded-[10px] px-2.5 py-1.5 text-center text-base font-normal text-black outline-none shadow-sm focus:border-black transition-colors"
                    />
                  </div>
                  {/* Thickness */}
                  <div className="w-fit flex flex-col gap-2.5">
                    <label className="w-full text-[#c3c3c3] text-base font-normal leading-6">
                      Thickness (mm)
                    </label>
                    <input
                      type="number"
                      size={1}
                      value={thickness}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setThickness(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white border border-[#c3c3c3] rounded-[10px] px-2.5 py-1.5 text-center text-base font-normal text-black outline-none shadow-sm focus:border-black transition-colors"
                    />
                  </div>
                </div>
              </div>
              <div className="w-fit flex flex-col gap-5 shrink-0">
                <p className="font-medium text-black text-base leading-6">
                  Quantity
                </p>
                <div className="flex flex-col gap-2.5">
                  <label className="text-[#c3c3c3] text-base font-normal leading-6">
                    Qty
                  </label>
                  <div className="flex items-center gap-2.5 bg-white border border-[#c3c3c3] rounded-[10px] px-2 py-1.5 shadow-sm focus-within:border-black transition-colors">
                    <button
                      type="button"
                      onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                      className="text-black hover:text-black transition-colors shrink-0 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      size={1}
                      value={quantity}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                      className="bg-transparent text-center text-base font-normal text-black outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity((prev) => prev + 1)}
                      className="text-black hover:text-black transition-colors shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="w-full">
            <Link href="/visualization" className="block w-full">
              <Button
                variant="blackBtnWhiteText"
                value="Visualize on my own Space"
                leftIcon={null}
                rightIcon={
                  <Image
                    src="/right_arrow.svg"
                    alt="right arrow"
                    width={25}
                    height={25}
                  />
                }
                className="w-full text-center flex justify-center py-4 rounded-[25px] font-medium cursor-pointer"
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
