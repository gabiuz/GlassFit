"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Paths where navbar and footer should be hidden (auth pages)
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/create-account";

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex justify-center">
        <Navbar />
      </div>
      {children}
      <Footer />
    </>
  );
}
