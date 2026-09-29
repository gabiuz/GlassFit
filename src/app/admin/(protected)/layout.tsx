import { requireAdmin } from "@/lib/auth/admin";
import { AdminSessionProvider } from "@/features/admin/auth/AdminSessionProvider";
import AdminLayout from "@/components/ui/AdminLayout";

/**
 * Protected Admin Layout — Layer 2 authorization gate.
 *
 * Every page inside (protected)/ inherits this layout.
 * requireAdmin() verifies:
 *   1. Authenticated Supabase session
 *   2. profiles.account_type = 'Admin'
 *   3. profiles.status = 'Active'
 *   4. admin_roles.status = 'Active'
 *
 * If any check fails → redirects to /admin/login.
 * AdminContext is then passed to client components via AdminSessionProvider.
 */
export default async function ProtectedAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const context = await requireAdmin();

    return (
        <AdminSessionProvider context={context}>
            <AdminLayout context={context}>{children}</AdminLayout>
        </AdminSessionProvider>
    );
}
