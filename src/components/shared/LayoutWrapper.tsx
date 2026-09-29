"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { AuthProvider } from "@/features/auth";
import { VisualizationSessionProvider } from "@/lib/visualization/visualizationSession";
import {
  NavbarVisibilityProvider,
  useNavbarVisibility,
} from "@/components/shared/NavbarVisibilityContext";

function LayoutContent({
  children,
  isAuthPage,
}: {
  children: React.ReactNode;
  isAuthPage: boolean;
}) {
  const { isNavbarHidden } = useNavbarVisibility();

  if (isAuthPage) {
    return (
      <VisualizationSessionProvider>{children}</VisualizationSessionProvider>
    );
  }

  return (
    <div>
      <VisualizationSessionProvider>
        {!isNavbarHidden && (
          <div className="flex justify-center">
            <Navbar />
          </div>
        )}
        {children}
        <Footer />
      </VisualizationSessionProvider>
    </div>
  );
}

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

  return (
    <AuthProvider>
      <NavbarVisibilityProvider>
        <LayoutContent isAuthPage={isAuthPage}>{children}</LayoutContent>
      </NavbarVisibilityProvider>
    </AuthProvider>
  );
}

