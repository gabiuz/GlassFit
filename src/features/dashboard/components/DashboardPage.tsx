import AdminNavbar from "@/components/ui/adminNavbar";
import AdminSidePanel from "@/components/ui/adminSidePanel";
import { DashboardContent } from "./DashboardContent";

export function DashboardPage() {
  return (
    <main className="flex flex-col min-h-screen">
      <AdminNavbar />
      <div className="flex gap-15 bg-[#F6F6F6]">
        <AdminSidePanel />
        <DashboardContent />
      </div>
    </main>
  );
}
