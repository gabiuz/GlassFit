import HeroSection from "@/features/product/components/HeroSection";
// import { ProductCard } from "@/features/product/components/ProductCard";
import { ProductFilter } from "@/features/product/components/ProductFilter";

export default function ProductPage() {
  return (
    <main className="flex flex-col">
      <HeroSection />
      <div className="flex flex-col justify-center items-center p-10">
        <ProductFilter />
      </div>
    </main>
  );
}
