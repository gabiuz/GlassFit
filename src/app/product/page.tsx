import { HeroSection, SearchSection, ProductSection } from "@/features/product";

export default function ProductPage() {
  return (
    <main className="flex flex-col">
      <HeroSection />
      <div className="flex flex-col gap-14 px-6 py-8 md:px-12 lg:px-24.25 lg:py-17.75">
        <SearchSection />
        <ProductSection />
      </div>
    </main>
  );
}
