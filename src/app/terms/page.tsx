import type { Metadata } from "next";
import { HeroSection, TableOfContents, TermsContent } from "@/features/terms";

export const metadata: Metadata = {
  title: "Terms & Conditions | GlassFit",
  description:
    "Review the Terms and Conditions for using GlassFit's glass and aluminum client-space visualization and consultation platform.",
};

export default function TermsPage() {
  return (
    <main className="flex flex-col bg-white min-h-screen">
      <HeroSection />

      <div className="w-full max-w-[1520px] mx-auto px-6 sm:px-10 lg:px-16 xl:px-24 py-12 lg:py-20 flex flex-col lg:flex-row gap-12 lg:gap-16 xl:gap-24 items-start justify-center">
        <TableOfContents />
        <TermsContent />
      </div>
    </main>
  );
}
