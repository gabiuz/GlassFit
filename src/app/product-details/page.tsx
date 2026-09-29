import { redirect } from "next/navigation";

// Static /product-details route — redirect to catalog.
// Real product detail pages live at /product-details/[id]
export default function ProductDetailsIndexPage() {
  redirect("/product");
}
