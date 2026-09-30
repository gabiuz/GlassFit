/**
 * My Requests Page Shell and Hero Composition (IMP-MS20)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C10, DSD-UI12, ERD-E2, ERD-E16, QAD-TC32, QAD-TC33
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes), BAN-RLS-07 (Strict RLS)
 */

import React from "react";
import Image from "next/image";
import { getClientMyRequests } from "../clientRequestQueries";
import { mapBookingRequestRowToClientItem } from "../clientRequestMapper";
import { MyRequestsContent } from "./MyRequestsContent";

const contactItems = [
  {
    key: "location",
    src: "/navbar_icons/location.svg",
    label: "Bicutan, Parañaque",
  },
  {
    key: "phone",
    src: "/navbar_icons/phone.svg",
    label: "0918-601-4737",
  },
  {
    key: "clock",
    src: "/navbar_icons/clock.svg",
    label: "Monday - Friday, 6:00AM - 7:00PM",
  },
];

export async function MyRequestsPage() {
  const { data, error } = await getClientMyRequests();

  const loadError = error
    ? "Unable to load your consultation requests at this time."
    : null;

  const initialRequests = data
    ? data.map(mapBookingRequestRowToClientItem)
    : [];

  return (
    <main className="min-h-screen bg-[#fafbfc] flex flex-col">
      {/* Top Contact Bar */}
      <section className="relative z-0 bg-white">
        <div className="hidden lg:block bg-grad-dark py-2.5 font-normal text-white">
          <div className="flex flex-wrap justify-center items-center gap-6.25">
            {contactItems.map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                <Image
                  src={item.src}
                  alt=""
                  width={16}
                  height={16}
                  aria-hidden="true"
                />
                <p>{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Banner with Video & Reduced-Motion Static Fallback */}
        <div className="relative min-h-60 md:min-h-115">
          <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#045E6D]/15 via-white/80 to-[#045E6D]/10">
            <video
              className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
              autoPlay
              loop
              muted
              playsInline
            >
              <source src="/hero_video.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-white/70" />
          </div>

          <div className="relative z-10 flex min-h-60 md:min-h-115 items-center justify-center px-4 pt-16 lg:pt-20">
            <h1 className="text-4xl sm:text-6xl lg:text-[96px] font-medium text-center uppercase tracking-[-1.824px] leading-tight lg:leading-[115.20px]">
              <span className="bg-grad-light bg-clip-text text-transparent">
                MY REQUESTS
              </span>
            </h1>
          </div>
        </div>
      </section>

      {/* Main Container Area */}
      <div className="max-w-[1360px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <MyRequestsContent
          initialRequests={initialRequests}
          loadError={loadError}
        />
      </div>
    </main>
  );
}
