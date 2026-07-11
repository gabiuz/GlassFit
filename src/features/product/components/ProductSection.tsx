import { ProductFilter } from "./ProductFilter";
import { ProductCard } from "./ProductCard";

export function ProductSection(){
  return (
    <section className="p-10">
      <ProductFilter />
      <ProductCard />
    </section>
  )
}