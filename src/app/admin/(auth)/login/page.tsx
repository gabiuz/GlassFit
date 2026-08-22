import type { Metadata } from "next";
import { AdminLoginForm } from "@/features/admin/auth/AdminLoginForm";

export const metadata: Metadata = {
    title: "Admin Login | GlassFit",
    description: "Sign in to the GlassFit Admin Portal",
    robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
    return <AdminLoginForm />;
}
