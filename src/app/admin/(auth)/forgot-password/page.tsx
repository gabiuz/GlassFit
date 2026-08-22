import type { Metadata } from "next";
import { AdminForgotPasswordForm } from "@/features/admin/auth/AdminForgotPasswordForm";

export const metadata: Metadata = {
    title: "Reset Password | GlassFit Admin",
    description: "Reset your GlassFit Admin account password",
    robots: { index: false, follow: false },
};

export default function AdminForgotPasswordPage() {
    return <AdminForgotPasswordForm />;
}
