import HeroSection from "@/features/product/components/HeroSection";
import { ProductCard } from "@/features/product/components/ProductCard";

export default function ProductPage() {
  return (
    <main className="flex flex-col">
      <HeroSection />
      <div className="flex flex-col justify-center items-center p-10">
        <ProductCard />
      </div>
    </main>
  );
}
