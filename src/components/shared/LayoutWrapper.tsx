"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { AuthProvider } from "@/features/auth";
import { VisualizationSessionProvider } from "@/lib/visualization/visualizationSession";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Paths where navbar and footer should be hidden (auth & admin dashboard pages)
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/create-account" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  if (isAuthPage) {
    return (
      <AuthProvider>
        <VisualizationSessionProvider>{children}</VisualizationSessionProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <div>
        <VisualizationSessionProvider>
          <div className="flex justify-center">
            <Navbar />
          </div>
          {children}
          <Footer />
        </VisualizationSessionProvider>
      </div>
    </AuthProvider>
  );
}
