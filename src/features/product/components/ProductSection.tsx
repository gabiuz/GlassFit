import { ProductFilter } from "./ProductFilter";
import { ProductCard } from "./ProductCard";

export function ProductSection(){
  return (
    <section className="p-4 md:p-6 lg:p-10 flex flex-col lg:flex-row gap-8 items-start">
      <div className="w-full lg:w-102 shrink-0">
        <ProductFilter />
      </div>
      <div className="flex-1 flex flex-wrap gap-6 justify-center lg:justify-start">
        <ProductCard />
      </div>
    </section>
  )
}