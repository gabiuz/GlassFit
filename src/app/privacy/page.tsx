import type { Metadata } from "next";
import { HeroSection, TableOfContents, PrivacyContent } from "@/features/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy | GlassFit",
  description:
    "Learn how customer and consultation information is handled when you use GlassFit's glass and aluminum client-space visualization and consultation platform.",
};

export default function PrivacyPage() {
  return (
    <main className="flex flex-col bg-white min-h-screen">
      <HeroSection />

      <div className="w-full max-w-[1520px] mx-auto px-6 sm:px-10 lg:px-16 xl:px-24 py-12 lg:py-20 flex flex-col lg:flex-row gap-12 lg:gap-16 xl:gap-24 items-start justify-center">
        <TableOfContents />
        <PrivacyContent />
      </div>
    </main>
  );
}
