import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parsePermissions, type AdminPermissions, type AdminPermissionKey } from "./permissions";

/**
 * Authoritative Admin context — loaded server-side per protected request.
 * Passed from the protected layout to client components via AdminSessionProvider.
 */
export type AdminContext = {
    userId: string;
    profileId: string;
    fullName: string;
    email: string;
    role: {
        roleId: string;
        roleName: string;
        permissions: AdminPermissions;
    };
};

/**
 * Result of an admin authorization check (without redirecting).
 * Useful for login-flow checks where we want to inspect the error.
 */
export type AdminAuthResult =
    | { ok: true; context: AdminContext }
    | { ok: false; reason: "unauthenticated" | "not_admin" | "suspended" | "inactive_role" };

/**
 * Loads the authenticated user's Admin profile + role from Supabase.
 * Returns null if the user is unauthenticated or fails authorization checks.
 *
 * Does NOT redirect — use requireAdmin() for pages that should redirect.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
    const result = await checkAdminAuth();
    if (!result.ok) return null;
    return result.context;
}

/**
 * Full authorization check. Returns the result without redirecting.
 * Used in the login form to produce meaningful error messages.
 */
export async function checkAdminAuth(): Promise<AdminAuthResult> {
    const supabase = await createSupabaseServerClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { ok: false, reason: "unauthenticated" };
    }

    // Load profile + role in a single query
    const { data: profile, error } = await supabase
        .from("profiles")
        .select(`
            profile_id,
            full_name,
            email,
            account_type,
            status,
            admin_roles (
                role_id,
                role_name,
                permissions,
                status
            )
        `)
        .eq("profile_id", user.id)
        .single();

    if (error || !profile) {
        return { ok: false, reason: "not_admin" };
    }

    if (profile.account_type !== "Admin") {
        return { ok: false, reason: "not_admin" };
    }

    if (profile.status === "Suspended") {
        return { ok: false, reason: "suspended" };
    }

    if (profile.status !== "Active") {
        return { ok: false, reason: "not_admin" };
    }

    // admin_roles is a FK join — Supabase returns it as an object (or null) for many-to-one
    const role = (profile.admin_roles as unknown) as {
        role_id: string;
        role_name: string;
        permissions: Record<string, boolean>;
        status: string;
    } | null;

    if (!role || role.status !== "Active") {
        return { ok: false, reason: "inactive_role" };
    }

    return {
        ok: true,
        context: {
            userId: user.id,
            profileId: profile.profile_id,
            fullName: profile.full_name ?? profile.email,
            email: profile.email,
            role: {
                roleId: role.role_id,
                roleName: role.role_name,
                permissions: parsePermissions(role.permissions),
            },
        },
    };
}

/**
 * Requires an authenticated active Admin. Redirects to /admin/login if not.
 * Use in protected layout and server components.
 */
export async function requireAdmin(): Promise<AdminContext> {
    const result = await checkAdminAuth();

    if (!result.ok) {
        redirect("/admin/login");
    }

    return result.context;
}

/**
 * Requires an active Admin with a specific permission.
 * Redirects to /admin/login on authentication failure,
 * returns a 403 response for authorization failure.
 */
export async function requirePermission(key: AdminPermissionKey): Promise<AdminContext> {
    const context = await requireAdmin();

    const { permissions } = context.role;

    const hasPermission =
        context.role.roleName.toLowerCase() === "owner" ||
        (() => {
            switch (key) {
                case "manage_products":
                    return permissions.manageProducts;
                case "manage_pricing":
                    return permissions.managePricing;
                case "manage_roles":
                    return permissions.manageRoles;
                case "manage_bookings":
                    return permissions.manageBookings;
                default:
                    return false;
            }
        })();

    if (!hasPermission) {
        // Return 403 by redirecting to the unauthorized page
        redirect("/admin?error=forbidden");
    }

    return context;
}

/**
 * Requires the authenticated admin to be an Owner.
 * Use for highly sensitive operations (account management, role assignment).
 */
export async function requireOwner(): Promise<AdminContext> {
    const context = await requireAdmin();

    if (context.role.roleName.toLowerCase() !== "owner") {
        redirect("/admin?error=forbidden");
    }

    return context;
}
