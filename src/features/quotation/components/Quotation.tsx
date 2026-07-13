"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/components/shared/Button";
import { VisualizationHeader } from "./VisualizationHeader";
import { VisualizationComparison } from "./VisualizationComparison";
import { ProductSummary } from "./ProductSummary";
import { BookingInfo } from "./BookingInfo";

export function Quotation() {
  const router = useRouter();

  const handleSendBooking = () => {
    console.log("Send Booking clicked. Initiating authentication flow...");
    router.push("/login");
  };

  return (
    <div className="w-full max-w-331 mx-auto px-6 py-12 md:py-16 flex flex-col gap-10 items-stretch">
      <div className="flex flex-col gap-5 items-center justify-center text-center select-none mb-2">
        <h1 className="text-black text-3xl md:text-5xl font-medium leading-tight md:leading-[57.60px]">
          Estimate Quotation
        </h1>
        <p className="text-black text-lg md:text-[28px] font-normal tracking-[-0.532px] leading-[1.4] max-w-3xl">
          See how your selected product may look in your space.
        </p>
      </div>
      <VisualizationHeader
        fileName="Livingroom.jpeg"
        productCount={2}
        tags={["Kitchen Cabinet", "Double Swing Door"]}
      />
      <VisualizationComparison />
      <ProductSummary />
      <BookingInfo />
      <div className="bg-[#f5f5f5] w-full flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-[20px] shadow-sm select-none mt-2">
        <Link href="/product-details" className="w-full sm:w-auto">
          <Button
            variant="blackBtnWhiteText"
            value="Edit Placement"
            leftIcon={
              <ChevronLeft className="w-5 h-5 text-white stroke-[2.5px]" />
            }
            rightIcon={null}
            className="w-full sm:w-auto font-medium py-3.5 px-6 rounded-[25px] flex items-center justify-center hover:opacity-90 transition-opacity"
          />
        </Link>
        <Button
          variant="lightGradWhiteText"
          value="Send Booking"
          leftIcon={null}
          rightIcon={
            <ChevronRight className="w-5 h-5 text-white stroke-[2.5px]" />
          }
          className="w-full sm:w-auto font-medium py-3.5 px-6 rounded-[25px] flex items-center justify-center hover:opacity-95 transition-opacity bg-grad-light"
          onClick={handleSendBooking}
        />
      </div>
    </div>
  );
}
