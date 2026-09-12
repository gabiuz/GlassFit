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

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function Quotation() {
  const router = useRouter();

  const handleSendBooking = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        router.push("/send-booking");
      } else {
        router.push("/login?next=/send-booking");
      }
    } catch {
      router.push("/login?next=/send-booking");
    }
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
      <div className="bg-[#f5f5f5] w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 rounded-[20px] shadow-sm select-none mt-2">
        <Link href="/comparison" className="w-full sm:w-auto">
          <Button
            variant="blackBtnWhiteText"
            value="Edit Placement"
            leftIcon={
              <ChevronLeft className="w-5 h-5 text-white stroke-[2.5px]" />
            }
            rightIcon={null}
            className="w-full sm:w-auto font-medium py-3.5 px-6 rounded-[25px] flex items-center justify-center hover:opacity-90 transition-opacity [--btn-width:100%] sm:[--btn-width:fit-content] [--btn-padding:12px_16px] sm:[--btn-padding:15px_20px] [--btn-font-size:16px] sm:[--btn-font-size:20px] [--btn-gap:10px] sm:[--btn-gap:15px] whitespace-nowrap"
            style={{
              width: "var(--btn-width, fit-content)",
              padding: "var(--btn-padding, 15px 20px)",
              fontSize: "var(--btn-font-size, 20px)",
              gap: "var(--btn-gap, 15px)",
            }}
          />
        </Link>
        <Button
          variant="lightGradWhiteText"
          value="Send Booking"
          leftIcon={null}
          rightIcon={
            <ChevronRight className="w-5 h-5 text-white stroke-[2.5px]" />
          }
          className="w-full sm:w-auto font-medium py-3.5 px-6 rounded-[25px] flex items-center justify-center hover:opacity-95 transition-opacity bg-grad-light [--btn-width:100%] sm:[--btn-width:fit-content] [--btn-padding:12px_16px] sm:[--btn-padding:15px_20px] [--btn-font-size:16px] sm:[--btn-font-size:20px] [--btn-gap:10px] sm:[--btn-gap:15px] whitespace-nowrap"
          style={{
            width: "var(--btn-width, fit-content)",
            padding: "var(--btn-padding, 15px 20px)",
            fontSize: "var(--btn-font-size, 20px)",
            gap: "var(--btn-gap, 15px)",
          }}
          onClick={handleSendBooking}
        />
      </div>
    </div>
  );
}
