import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLoginForm } from "@/features/admin/auth/AdminLoginForm";

export const metadata: Metadata = {
    title: "Admin Login | GlassFit",
    description: "Sign in to the GlassFit Admin Portal",
    robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#f8fafc]" />}>
            <AdminLoginForm />
        </Suspense>
    );
}
