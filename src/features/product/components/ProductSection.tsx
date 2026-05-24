import { ProductFilter } from "./ProductFilter";
import { ProductCard } from "./ProductCard";

export function ProductSection() {
  return (
    <section className="w-full flex justify-between items-start gap-8.25">
      <ProductFilter />
      <div className="flex justify-between  flex-col gap-7.25">
        <p className="text-base font-normal leading-6 text-[#C3C3C3]">
          24 results • Sorted by: Popular
        </p>
        <div className="flex flex-wrap gap-7 self-stretch">
          <ProductCard />
          <ProductCard />
          <ProductCard />
          <ProductCard />
          <ProductCard />
          <ProductCard />
          <ProductCard />
          <ProductCard />
          <ProductCard />
          <ProductCard />
          <ProductCard />
          <ProductCard />
        </div>
      </div>
    </section>
  );
}
