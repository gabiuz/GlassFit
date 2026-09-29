import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StaffContent } from "@/features/admin/staff/StaffContent";

export const metadata: Metadata = {
    title: "Staff Accounts | GlassFit Admin",
    description: "Manage Admin and Staff accounts",
};

export default async function AdminStaffPage() {
    // Layer 2 permission check — only manage_roles users can access this page
    await requirePermission("manage_roles");

    const supabase = await createSupabaseServerClient();

    // Load all Admin profiles with their roles
    const { data: staffList } = await supabase
        .from("profiles")
        .select(`
            profile_id,
            full_name,
            email,
            status,
            created_at,
            admin_roles (
                role_id,
                role_name
            )
        `)
        .eq("account_type", "Admin")
        .order("created_at", { ascending: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <StaffContent initialStaff={(staffList ?? []) as any[]} />;
}
