"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { validateEmail } from "@/features/auth/utils/auth-utils";

export type StaffActionResult =
    | { success: true; message: string }
    | { success: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// inviteStaff
// ─────────────────────────────────────────────────────────────────────────────

export async function inviteStaff(formData: {
    firstName: string;
    lastName: string;
    email: string;
}): Promise<StaffActionResult> {
    // Layer 3 authorization — must have manage_roles permission
    const ctx = await requirePermission("manage_roles");

    const { firstName, lastName, email } = formData;

    // Validate inputs
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!validateEmail(trimmedEmail)) {
        return { success: false, error: "Please enter a valid email address." };
    }

    if (trimmedFirst.length < 1 || trimmedFirst.length > 50) {
        return { success: false, error: "First name must be between 1 and 50 characters." };
    }

    if (trimmedLast.length < 1 || trimmedLast.length > 50) {
        return { success: false, error: "Last name must be between 1 and 50 characters." };
    }

    const supabase = await createSupabaseServerClient();

    // Check for existing profile — block if account already exists (Customer or Admin)
    const { data: existingProfile } = await supabase
        .from("profiles")
        .select("profile_id, account_type")
        .eq("email", trimmedEmail)
        .maybeSingle();

    if (existingProfile) {
        return {
            success: false,
            error: "An account with this email already exists.",
        };
    }

    // Look up the Staff role
    const { data: staffRole } = await supabase
        .from("admin_roles")
        .select("role_id")
        .eq("role_name", "Staff")
        .eq("status", "Active")
        .single();

    if (!staffRole) {
        return {
            success: false,
            error: "Staff role is not available. Please contact the system administrator.",
        };
    }

    // Use service client to invite via Supabase Auth Admin API
    let invitedUserId: string | null = null;

    try {
        const service = createSupabaseServiceClient();

        const origin =
            process.env.NEXT_PUBLIC_SITE_URL ??
            process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(".supabase.co", "").replace("https://", "https://") ??
            "http://localhost:3000";

        const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(
            trimmedEmail,
            {
                data: {
                    first_name: trimmedFirst,
                    last_name: trimmedLast,
                },
                redirectTo: `${origin}/admin/auth/callback?type=invite`,
            }
        );

        if (inviteError || !inviteData?.user) {
            console.error("[inviteStaff] Supabase invite failed:", inviteError?.message);
            return {
                success: false,
                error: "Failed to send invitation. Please try again.",
            };
        }

        invitedUserId = inviteData.user.id;
    } catch (err) {
        console.error("[inviteStaff] Service client error:", err);
        return {
            success: false,
            error: "Failed to send invitation. Please try again.",
        };
    }

    // Promote the profile to Admin with the Staff role.
    // The auth trigger creates a Customer profile on invite; we update it here.
    try {
        // Wait briefly for the trigger to fire
        await new Promise((r) => setTimeout(r, 800));

        const { error: profileError } = await supabase
            .from("profiles")
            .upsert(
                {
                    profile_id: invitedUserId,
                    first_name: trimmedFirst,
                    last_name: trimmedLast,
                    email: trimmedEmail,
                    auth_provider: "Email",
                    account_type: "Admin",
                    admin_role_id: staffRole.role_id,
                    status: "Active",
                },
                { onConflict: "profile_id" }
            );

        if (profileError) {
            console.error("[inviteStaff] Profile promotion failed:", profileError.message);
            // The Auth user was created but profile promotion failed.
            // Log and return an error — do not silently report success.
            return {
                success: false,
                error:
                    "Invitation sent but account setup failed. " +
                    "Please check the Staff list and retry if needed.",
            };
        }
    } catch (err) {
        console.error("[inviteStaff] Profile upsert error:", err);
        return {
            success: false,
            error: "Account setup failed after invitation. Please check the Staff list.",
        };
    }

    revalidatePath("/admin/staff");

    return {
        success: true,
        message: `Invitation sent to ${trimmedEmail}. They will receive an email to activate their account.`,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// suspendStaff
// ─────────────────────────────────────────────────────────────────────────────

export async function suspendStaff(targetProfileId: string): Promise<StaffActionResult> {
    const ctx = await requirePermission("manage_roles");

    // Protect: cannot suspend yourself
    if (ctx.profileId === targetProfileId) {
        return { success: false, error: "You cannot suspend your own account." };
    }

    const supabase = await createSupabaseServerClient();

    // Ensure target is an Admin (not a Customer)
    const { data: targetProfile } = await supabase
        .from("profiles")
        .select("profile_id, account_type, status")
        .eq("profile_id", targetProfileId)
        .single();

    if (!targetProfile || targetProfile.account_type !== "Admin") {
        return { success: false, error: "Account not found." };
    }

    if (targetProfile.status === "Suspended") {
        return { success: false, error: "Account is already suspended." };
    }

    const { error } = await supabase
        .from("profiles")
        .update({ status: "Suspended" })
        .eq("profile_id", targetProfileId);

    if (error) {
        console.error("[suspendStaff] Update failed:", error.message);
        return { success: false, error: "Failed to suspend account. Please try again." };
    }

    // Best-effort: revoke active sessions via service client
    try {
        const service = createSupabaseServiceClient();
        await service.auth.admin.signOut(targetProfileId, "others");
    } catch (err) {
        // Non-fatal — the status change already blocks future Admin checks
        console.warn("[suspendStaff] Session revocation failed (non-fatal):", err);
    }

    revalidatePath("/admin/staff");
    return { success: true, message: "Account suspended successfully." };
}

// ─────────────────────────────────────────────────────────────────────────────
// reactivateStaff
// ─────────────────────────────────────────────────────────────────────────────

export async function reactivateStaff(targetProfileId: string): Promise<StaffActionResult> {
    await requirePermission("manage_roles");

    const supabase = await createSupabaseServerClient();

    // Verify target + role is still active before reactivating
    const { data: targetProfile } = await supabase
        .from("profiles")
        .select(`
            profile_id,
            account_type,
            status,
            admin_roles ( status )
        `)
        .eq("profile_id", targetProfileId)
        .single();

    if (!targetProfile || targetProfile.account_type !== "Admin") {
        return { success: false, error: "Account not found." };
    }

    const role = (targetProfile.admin_roles as unknown) as { status: string } | null;
    if (!role || role.status !== "Active") {
        return {
            success: false,
            error: "Cannot reactivate: the assigned role is not active.",
        };
    }

    const { error } = await supabase
        .from("profiles")
        .update({ status: "Active" })
        .eq("profile_id", targetProfileId);

    if (error) {
        console.error("[reactivateStaff] Update failed:", error.message);
        return { success: false, error: "Failed to reactivate account. Please try again." };
    }

    revalidatePath("/admin/staff");
    return { success: true, message: "Account reactivated successfully." };
}

// ─────────────────────────────────────────────────────────────────────────────
// resendInvite
// ─────────────────────────────────────────────────────────────────────────────

export async function resendInvite(email: string): Promise<StaffActionResult> {
    await requirePermission("manage_roles");

    if (!validateEmail(email)) {
        return { success: false, error: "Invalid email address." };
    }

    try {
        const service = createSupabaseServiceClient();

        const origin =
            process.env.NEXT_PUBLIC_SITE_URL ??
            "http://localhost:3000";

        const { error } = await service.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
            redirectTo: `${origin}/admin/auth/callback?type=invite`,
        });

        if (error) {
            console.error("[resendInvite] Failed:", error.message);
            return { success: false, error: "Failed to resend invitation. Please try again." };
        }
    } catch (err) {
        console.error("[resendInvite] Service error:", err);
        return { success: false, error: "Failed to resend invitation. Please try again." };
    }

    return { success: true, message: `Invitation resent to ${email}.` };
}
