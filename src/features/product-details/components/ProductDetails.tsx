"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Minus, Plus } from "lucide-react";
import Button from "@/components/shared/Button";
import type { ProductDetail } from "@/lib/products/getProductById";
import {
  DEFAULT_PRODUCT_PREVIEW_CONFIGURATION,
  GLASS_COLOR_OPTIONS,
  GLASS_THICKNESS_OPTIONS,
  getAvailableFinishOptions,
  getAvailableGlassTypeOptions,
  isRrdSupportedProductType,
  mapGlassTypeToAppearanceMode,
  type GlassTypeKey,
} from "@/lib/products/materialMapping";
import {
  normalizeProductQuantity,
  validateDimensionPair,
} from "@/lib/products/productPreviewConfiguration";
import type { RrdAluminumFinishKey } from "@/lib/visualization/colorVariations";
import type { GlassColorKey, GlassThicknessMm } from "@/lib/visualization/types";
import type { ProductMaterialCapabilities } from "@/lib/visualization/materialClassifier";

const ProductModel3D = dynamic(
  () => import("./ProductModel3D").then((module) => module.ProductModel3D),
  { ssr: false },
);

function Breadcrumb({ productName = "Product Name" }: { productName?: string }) {
  return (
    <nav className="flex items-center gap-2 text-base tracking-[-0.304px]" aria-label="Breadcrumb">
      <Link href="/" className="text-base font-normal leading-6 text-[#c3c3c3] transition-colors hover:text-black">Home</Link>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#c3c3c3]" />
      <Link href="/product" className="text-base font-normal leading-6 text-[#c3c3c3] transition-colors hover:text-black">Catalog</Link>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#c3c3c3]" />
      <span className="select-none text-base font-normal leading-6 text-green">{productName}</span>
    </nav>
  );
}

const segmentClass = (selected: boolean) =>
  `rounded-[20px] border px-2.5 py-1.5 text-base font-normal transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
    selected ? "border-black bg-black text-white" : "border-[#c3c3c3] text-black hover:border-black"
  }`;

export function ProductDetails({ product }: { product: ProductDetail }) {
  const defaults = DEFAULT_PRODUCT_PREVIEW_CONFIGURATION;
  const [selectedFinish, setSelectedFinish] = useState<RrdAluminumFinishKey>(defaults.aluminumFinish);
  const [selectedGlassType, setSelectedGlassType] = useState<GlassTypeKey>(defaults.glassType);
  const [selectedGlassColor, setSelectedGlassColor] = useState<GlassColorKey>(defaults.glassColor);
  const [selectedThickness, setSelectedThickness] = useState<GlassThicknessMm>(defaults.glassThicknessMm);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [previewDimensions, setPreviewDimensions] = useState<{ widthCm: number; heightCm: number }>();
  const [quantityInput, setQuantityInput] = useState(String(defaults.quantity));
  const [view3d, setView3d] = useState(false);
  const [detectedMaterials, setDetectedMaterials] = useState<{
    glbUrl: string;
    capabilities: ProductMaterialCapabilities;
  } | null>(null);

  const dimensionResult = validateDimensionPair(width, height);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextDimensions = validateDimensionPair(width, height);
      if (nextDimensions.status === "valid") {
        setPreviewDimensions({ widthCm: nextDimensions.widthCm, heightCm: nextDimensions.heightCm });
      } else if (nextDimensions.status === "empty") {
        setPreviewDimensions(undefined);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [width, height]);

  const has3d = Boolean(product.preview_glb_url);
  const supportedProductType = isRrdSupportedProductType(product.product_type) ? product.product_type : null;
  const supportsConfiguration = supportedProductType !== null;
  const normalizedQuantity = normalizeProductQuantity(quantityInput);
  const glassAppearance = mapGlassTypeToAppearanceMode(selectedGlassType);
  const priceLabel = product.base_price > 0
    ? `Starting at ₱${product.base_price.toLocaleString("en-PH")}`
    : null;
  const finishOptions = supportedProductType ? getAvailableFinishOptions(supportedProductType) : [];
  const glassTypeOptions = supportedProductType ? getAvailableGlassTypeOptions(supportedProductType) : [];
  const glassControlsDisabled = detectedMaterials?.glbUrl === product.preview_glb_url
    && detectedMaterials.capabilities.hasGlass === false;

  const handleCapabilitiesDetected = useCallback((capabilities: ProductMaterialCapabilities) => {
    if (!product.preview_glb_url) return;
    setDetectedMaterials({ glbUrl: product.preview_glb_url, capabilities });
  }, [product.preview_glb_url]);

  const commitQuantity = (value: string | number) => {
    setQuantityInput(String(normalizeProductQuantity(value)));
  };

  return (
    <div className="flex w-full flex-col gap-8 px-6 pt-8 pb-16 lg:px-21.5 lg:pt-13.75 lg:pb-33">
      <Breadcrumb productName={product.product_name} />

      <div className="flex w-full flex-col items-stretch gap-9 lg:flex-row lg:items-start">
        <div className="relative h-64 w-full shrink-0 overflow-hidden rounded-sm bg-[#d9d9d9] sm:h-96 lg:h-226.75 lg:w-164.5">
          {(!view3d || !has3d) && (
            product.catalog_image_url ? (
              <Image src={product.catalog_image_url} alt={product.product_name} fill className="object-cover" unoptimized />
            ) : (
              <div className="h-full w-full bg-[#d9d9d9]" />
            )
          )}

          {view3d && has3d && (
            <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-white/40 border-t-white" /></div>}>
              <ProductModel3D
                glbUrl={product.preview_glb_url!}
                aluminumFinish={supportsConfiguration ? selectedFinish : "white"}
                glassAppearance={supportsConfiguration ? glassAppearance : "clear"}
                glassColor={supportsConfiguration ? selectedGlassColor : "clear"}
                glassThicknessMm={supportsConfiguration ? selectedThickness : 6}
                widthCm={supportsConfiguration ? previewDimensions?.widthCm : undefined}
                heightCm={supportsConfiguration ? previewDimensions?.heightCm : undefined}
                quantity={supportsConfiguration ? normalizedQuantity : 1}
                onCapabilitiesDetected={handleCapabilitiesDetected}
              />
            </Suspense>
          )}

          {has3d && (
            <div className="absolute right-4 bottom-4 z-10">
              <div className="flex select-none items-center gap-0.5 rounded-full border border-white/30 bg-white/20 px-1.5 py-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.18)] backdrop-blur-md">
                {([false, true] as const).map((is3d) => (
                  <button
                    key={String(is3d)}
                    type="button"
                    onClick={() => setView3d(is3d)}
                    aria-pressed={view3d === is3d}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${view3d === is3d ? "bg-white text-black shadow-sm" : "text-white/80 hover:text-white"}`}
                  >
                    {is3d ? "3D" : "2D"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex w-full flex-1 flex-col gap-8">
          <div className="flex w-full flex-col gap-5">
            <div className="flex flex-col items-start gap-5">
              <h1 className="text-3xl leading-tight font-medium text-black sm:text-4xl lg:text-5xl lg:leading-[57.60px]">{product.product_name}</h1>
              <span className="rounded-[20px] bg-[#c3c3c3] px-2.5 py-1.25 text-base font-normal text-white">{product.product_type}</span>
              <p className="text-lg leading-7 font-normal text-black lg:text-xl">{product.description ?? ""}</p>
            </div>
            <div className="flex w-full select-none flex-col gap-2.5 rounded-[20px] bg-grad-light p-7.5 text-white">
              <p className="text-2xl leading-8 font-normal">Estimated Price</p>
              {priceLabel ? <p className="text-5xl leading-[57.60px] font-medium">{priceLabel}</p> : <p className="text-lg font-normal text-white/80">Price available after configuration</p>}
              <p className="text-xs leading-4 font-normal">excl. install, final after consultation, etc</p>
            </div>
          </div>

          {supportsConfiguration && (
            <section className="flex flex-col gap-6 rounded-[20px] bg-neutral-100/30 p-7.5 shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)]" aria-labelledby="design-specs-heading">
              <h2 id="design-specs-heading" className="text-base leading-6 font-medium text-black">Design Specs</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <fieldset className="flex min-w-0 flex-col gap-3">
                  <legend className="text-base leading-6 font-normal text-[#c3c3c3]">Aluminum Finish</legend>
                  <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
                    {finishOptions.map((option) => {
                      const selected = selectedFinish === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedFinish(option.id)}
                          aria-pressed={selected}
                          className={`flex items-center gap-2 rounded-[8px] border px-2 py-2 text-left text-sm transition-colors ${selected ? "border-green bg-white" : "border-transparent hover:bg-neutral-50"}`}
                        >
                          <span className="h-5 w-5 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: option.previewHex }} aria-hidden="true" />
                          <span className="min-w-0 truncate font-medium text-black">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="flex flex-col gap-5">
                  <fieldset
                    disabled={glassControlsDisabled}
                    aria-describedby={glassControlsDisabled ? "glass-capability-feedback" : undefined}
                    className={`flex flex-col gap-3 ${glassControlsDisabled ? "opacity-60" : ""}`}
                  >
                    <legend className="text-base leading-6 font-normal text-[#c3c3c3]">Glass Type</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {glassTypeOptions.map((option) => <button key={option.id} type="button" onClick={() => setSelectedGlassType(option.id)} aria-pressed={selectedGlassType === option.id} className={segmentClass(selectedGlassType === option.id)}>{option.label}</button>)}
                    </div>
                  </fieldset>
                  <fieldset
                    disabled={glassControlsDisabled}
                    aria-describedby={glassControlsDisabled ? "glass-capability-feedback" : undefined}
                    className={`flex flex-col gap-3 ${glassControlsDisabled ? "opacity-60" : ""}`}
                  >
                    <legend className="text-base leading-6 font-normal text-[#c3c3c3]">Glass Color</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {GLASS_COLOR_OPTIONS.map((option) => (
                        <button key={option.id} type="button" onClick={() => setSelectedGlassColor(option.id)} aria-pressed={selectedGlassColor === option.id} className={`${segmentClass(selectedGlassColor === option.id)} flex items-center gap-1.5`}>
                          <span className="h-3.5 w-3.5 rounded-full border border-black/15" style={{ backgroundColor: option.previewHex }} aria-hidden="true" />{option.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset
                    disabled={glassControlsDisabled}
                    aria-describedby={glassControlsDisabled ? "glass-capability-feedback" : undefined}
                    className={`flex flex-col gap-3 ${glassControlsDisabled ? "opacity-60" : ""}`}
                  >
                    <legend className="text-base leading-6 font-normal text-[#c3c3c3]">Thickness</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {GLASS_THICKNESS_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => setSelectedThickness(option.value)} aria-pressed={selectedThickness === option.value} className={segmentClass(selectedThickness === option.value)}>{option.label}</button>)}
                    </div>
                  </fieldset>
                  {glassControlsDisabled && (
                    <p id="glass-capability-feedback" role="status" className="text-sm leading-5 text-[#777]">
                      Glass options are unavailable because this product model has no glass components.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex w-full flex-col gap-8 sm:flex-row">
                <fieldset className="flex flex-1 flex-col gap-5">
                  <legend className="text-base leading-6 font-medium text-black">Dimension</legend>
                  <div className="flex flex-wrap gap-4 sm:gap-8">
                    <div className="flex w-32 flex-col gap-2.5">
                      <label htmlFor="product-width" className="text-base leading-6 font-normal text-[#c3c3c3]">Width (cm)</label>
                      <input id="product-width" type="number" min="0" step="any" value={width} aria-describedby={dimensionResult.status === "invalid" ? "dimension-feedback" : undefined} onChange={(event) => setWidth(event.target.value)} className="w-full rounded-[10px] border border-[#c3c3c3] bg-white px-2.5 py-1.5 text-center text-base text-black shadow-sm outline-none transition-colors focus:border-black" />
                    </div>
                    <div className="flex w-32 flex-col gap-2.5">
                      <label htmlFor="product-height" className="text-base leading-6 font-normal text-[#c3c3c3]">Height (cm)</label>
                      <input id="product-height" type="number" min="0" step="any" value={height} aria-describedby={dimensionResult.status === "invalid" ? "dimension-feedback" : undefined} onChange={(event) => setHeight(event.target.value)} className="w-full rounded-[10px] border border-[#c3c3c3] bg-white px-2.5 py-1.5 text-center text-base text-black shadow-sm outline-none transition-colors focus:border-black" />
                    </div>
                  </div>
                  {dimensionResult.status === "invalid" && <p id="dimension-feedback" role="status" className="text-sm text-red-700">{dimensionResult.message}</p>}
                </fieldset>

                <div className="flex w-fit shrink-0 flex-col gap-5">
                  <p className="text-base leading-6 font-medium text-black">Quantity</p>
                  <label htmlFor="product-quantity" className="text-base leading-6 font-normal text-[#c3c3c3]">Qty</label>
                  <div className="flex items-center gap-2.5 rounded-[10px] border border-[#c3c3c3] bg-white px-2 py-1.5 shadow-sm transition-colors focus-within:border-black">
                    <button type="button" aria-label="Decrease quantity" aria-pressed="false" onClick={() => commitQuantity(normalizedQuantity - 1)} className="shrink-0 text-black"><Minus className="h-3.5 w-3.5" /></button>
                    <input id="product-quantity" type="number" min="1" max="999" step="1" value={quantityInput} onChange={(event) => setQuantityInput(event.target.value)} onBlur={() => commitQuantity(quantityInput)} className="w-16 bg-transparent text-center text-base font-normal text-black outline-none" />
                    <button type="button" aria-label="Increase quantity" aria-pressed="false" onClick={() => commitQuantity(normalizedQuantity + 1)} className="shrink-0 text-black"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            </section>
          )}

          <Link href={`/visualize/${product.product_id}/upload`} className="block w-full">
            <Button variant="blackBtnWhiteText" value="Visualize on my own Space" leftIcon={null} rightIcon={<Image src="/right_arrow.svg" alt="right arrow" width={25} height={25} />} className="flex w-full justify-center rounded-[25px] py-4 text-center font-medium" />
          </Link>
        </div>
      </div>
    </div>
  );
}
