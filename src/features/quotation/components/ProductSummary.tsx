"use client";

import React from "react";
import { PriceCard, ProductDetailsData } from "./PriceCard";

interface ProductItem {
  productId: string;
  productName: string;
  specSummary: string;
  qty: number;
  unitPrice: number;
  imageUrl: string;
  details: ProductDetailsData;
}

const productsData: ProductItem[] = [
  {
    productId: "GF_001",
    productName: "Product Name",
    specSummary: "Cabinet | Analok (Champagne gold) | W90 × H180 × D40cm",
    qty: 1,
    unitPrice: 0o0000,
    imageUrl: "/images/modular_cabinets.png",
    details: {
      category: "Cabinet",
      variant: "Kitchen Cabinet",
      material: "Aluminum/Glass",
      aluminumFinish: "Analok (Champagne Gold)",
      glassFinish: "Clear",
      glassType: "Tempered Glass",
      thickness: "3mm",
      profileGrade: "High-end",
      dimension: "W 90cm X H 180cm x D 40cm",
    },
  },
  {
    productId: "GF_002",
    productName: "Product Name",
    specSummary: "Cabinet | Analok (Champagne gold) | W90 × H180 × D40cm",
    qty: 1,
    unitPrice: 0o0000,
    imageUrl: "/images/modular_cabinets.png",
    details: {
      category: "Cabinet",
      variant: "Kitchen Cabinet",
      material: "Aluminum/Glass",
      aluminumFinish: "Analok (Champagne Gold)",
      glassFinish: "Clear",
      glassType: "Tempered Glass",
      thickness: "3mm",
      profileGrade: "High-end",
      dimension: "W 90cm X H 180cm x D 40cm",
    },
  },
];

export function ProductSummary() {
  const total = productsData.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);

  const formattedTotal = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(total).replace("PHP", "Php");

  return (
    <div className="bg-[#F5F5F5] flex flex-col gap-9 items-start p-6 md:p-12.5 relative rounded-[20px] w-full">
      <div className="flex items-center justify-start select-none">
        <h2 className="text-black text-3xl font-medium leading-10 whitespace-nowrap">
          Product Summary
        </h2>
      </div>
      <div className="flex flex-col gap-6 w-full">
        {productsData.map((prod) => (
          <PriceCard
            key={prod.productId}
            productId={prod.productId}
            productName={prod.productName}
            specSummary={prod.specSummary}
            qty={prod.qty}
            unitPrice={prod.unitPrice}
            imageUrl={prod.imageUrl}
            details={prod.details}
            initiallyExpanded={prod.productId === "GF_001"}
          />
        ))}
      </div>
      <div className="w-full bg-green text-white flex flex-col md:flex-row gap-4 items-center justify-between px-6 md:px-12 py-7.5 rounded-[20px] drop-shadow-[0px_0px_2.5px_rgba(0,0,0,0.25)] select-none">
        <span className="text-xl font-medium leading-7">
          Estimated Total
        </span>
        <span className="text-3xl md:text-5xl font-medium leading-tight md:leading-[57.60px]">
          {formattedTotal}
        </span>
      </div>
    </div>
  );
}
