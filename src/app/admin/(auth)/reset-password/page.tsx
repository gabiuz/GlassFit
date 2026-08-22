import type { Metadata } from "next";
import { AdminResetPasswordForm } from "@/features/admin/auth/AdminResetPasswordForm";

export const metadata: Metadata = {
    title: "New Password | GlassFit Admin",
    description: "Set a new password for your GlassFit Admin account",
    robots: { index: false, follow: false },
};

export default function AdminResetPasswordPage() {
    return <AdminResetPasswordForm />;
}
