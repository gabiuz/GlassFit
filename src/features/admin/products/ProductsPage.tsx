import AdminNavbar from "@/components/ui/adminNavbar";
import AdminSidePanel from "@/components/ui/adminSidePanel";
import { ProductsContent } from "./ProductsContent";

export function ProductsPage() {
  return (
    <main className="flex flex-col min-h-screen">
      <AdminNavbar />
      <div className="flex gap-15 bg-[#F6F6F6]">
        <AdminSidePanel />
        <ProductsContent />
      </div>
    </main>
  );
}
