import type { Metadata } from "next";
import { AdminInviteForm } from "@/features/admin/auth/AdminInviteForm";

export const metadata: Metadata = {
    title: "Activate Account | GlassFit Admin",
    description: "Set your password to activate your GlassFit Admin account",
    robots: { index: false, follow: false },
};

export default function AdminInvitePage() {
    return <AdminInviteForm />;
}
