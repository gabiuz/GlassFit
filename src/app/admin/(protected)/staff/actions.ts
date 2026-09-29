"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { requirePermission, requireOwner } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { validateEmail } from "@/features/auth/utils/auth-utils";
import { sendStaffInviteEmail } from "@/lib/email/resendClient";

export type StaffActionResult =
    | { success: true; message: string }
    | { success: false; error: string };

export type InviteStaffResult =
    | {
          success: true;
          message: string;
          verificationCode: string;
          email: string;
          expiresAt: string;
      }
    | { success: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// inviteStaff
// ─────────────────────────────────────────────────────────────────────────────

export async function inviteStaff(formData: {
    email: string;
    firstName?: string;
    lastName?: string;
}): Promise<InviteStaffResult> {
    // Authorization: requires manage_roles permission or Owner
    const ctx = await requirePermission("manage_roles");

    const { email } = formData;
    const trimmedEmail = email ? email.trim().toLowerCase() : "";

    if (!trimmedEmail || !validateEmail(trimmedEmail)) {
        return { success: false, error: "Please enter a valid email address." };
    }

    const supabase = await createSupabaseServerClient();
    const service = createSupabaseServiceClient();

    // Check for existing profile: block if already an active Admin
    const { data: existingProfile } = await supabase
        .from("profiles")
        .select("profile_id, account_type, status")
        .eq("email", trimmedEmail)
        .maybeSingle();

    if (existingProfile && existingProfile.account_type === "Admin" && existingProfile.status === "Active") {
        return {
            success: false,
            error: "This user is already an active administrator.",
        };
    }

    // Look up the Staff role
    const { data: staffRole } = await supabase
        .from("admin_roles")
        .select("role_id")
        .ilike("role_name", "Staff")
        .eq("status", "Active")
        .maybeSingle();

    if (!staffRole) {
        return {
            success: false,
            error: "Staff role is not available. Please contact the system administrator.",
        };
    }

    // Revoke any existing pending invitations for this email
    await service
        .from("staff_invitations")
        .update({ status: "Revoked" })
        .eq("email", trimmedEmail)
        .eq("status", "Pending");

    // Generate credentials
    const token = crypto.randomBytes(32).toString("hex");
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // Persist invitation record
    const { error: insertError } = await service
        .from("staff_invitations")
        .insert({
            email: trimmedEmail,
            token,
            verification_code: verificationCode,
            role_id: staffRole.role_id,
            invited_by: ctx.profileId,
            status: "Pending",
            expires_at: expiresAt,
        });

    if (insertError) {
        console.error("[inviteStaff] Failed to insert invitation record:", insertError.message);
        return {
            success: false,
            error: "Failed to create invitation record. Please try again.",
        };
    }

    // Dispatch branded invitation email via Resend
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const activationUrl = `${origin}/admin/invite?token=${token}`;

    const emailResult = await sendStaffInviteEmail({
        to: trimmedEmail,
        activationUrl,
    });

    if (!emailResult.success) {
        // Rollback invitation record on email failure
        await service.from("staff_invitations").delete().eq("token", token);
        return {
            success: false,
            error: emailResult.error || "Failed to deliver invitation email. Please try again.",
        };
    }

    revalidatePath("/admin/staff");

    return {
        success: true,
        verificationCode,
        email: trimmedEmail,
        expiresAt,
        message: `Invitation email sent to ${trimmedEmail}. Provide the 6-digit code to the staff member to complete activation.`,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// resendStaffInvite
// ─────────────────────────────────────────────────────────────────────────────

export async function resendStaffInvite(email: string): Promise<InviteStaffResult> {
    const ctx = await requirePermission("manage_roles");

    const trimmedEmail = email ? email.trim().toLowerCase() : "";
    if (!trimmedEmail || !validateEmail(trimmedEmail)) {
        return { success: false, error: "Please enter a valid email address." };
    }

    const supabase = await createSupabaseServerClient();
    const service = createSupabaseServiceClient();

    // Look up Staff role
    const { data: staffRole } = await supabase
        .from("admin_roles")
        .select("role_id")
        .ilike("role_name", "Staff")
        .eq("status", "Active")
        .maybeSingle();

    if (!staffRole) {
        return {
            success: false,
            error: "Staff role is not available. Please contact the system administrator.",
        };
    }

    // Revoke previous pending invitations
    await service
        .from("staff_invitations")
        .update({ status: "Revoked" })
        .eq("email", trimmedEmail)
        .eq("status", "Pending");

    // Generate fresh credentials
    const token = crypto.randomBytes(32).toString("hex");
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await service
        .from("staff_invitations")
        .insert({
            email: trimmedEmail,
            token,
            verification_code: verificationCode,
            role_id: staffRole.role_id,
            invited_by: ctx.profileId,
            status: "Pending",
            expires_at: expiresAt,
        });

    if (insertError) {
        console.error("[resendStaffInvite] Database insert error:", insertError.message);
        return { success: false, error: "Failed to refresh invitation. Please try again." };
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const activationUrl = `${origin}/admin/invite?token=${token}`;

    const emailResult = await sendStaffInviteEmail({
        to: trimmedEmail,
        activationUrl,
    });

    if (!emailResult.success) {
        await service.from("staff_invitations").delete().eq("token", token);
        return {
            success: false,
            error: emailResult.error || "Failed to deliver refreshed invitation email.",
        };
    }

    revalidatePath("/admin/staff");

    return {
        success: true,
        verificationCode,
        email: trimmedEmail,
        expiresAt,
        message: `Invitation resent to ${trimmedEmail}.`,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// removeStaff (Owner Exclusive)
// ─────────────────────────────────────────────────────────────────────────────

export async function removeStaff(targetProfileId: string): Promise<StaffActionResult> {
    const ctx = await requireOwner();

    // Protect: cannot remove yourself
    if (ctx.profileId === targetProfileId) {
        return { success: false, error: "You cannot remove your own account." };
    }

    const supabase = await createSupabaseServerClient();
    const service = createSupabaseServiceClient();

    // Ensure target is an Admin and not an Owner
    const { data: targetProfile, error: profileError } = await supabase
        .from("profiles")
        .select(`
            profile_id,
            email,
            account_type,
            status,
            admin_roles (
                role_name
            )
        `)
        .eq("profile_id", targetProfileId)
        .single();

    if (profileError || !targetProfile || targetProfile.account_type !== "Admin") {
        return { success: false, error: "Staff account not found." };
    }

    const targetRole = (targetProfile.admin_roles as unknown) as { role_name?: string } | null;
    if (targetRole?.role_name?.toLowerCase() === "owner") {
        return { success: false, error: "Owners cannot be removed through this interface." };
    }

    // Invalidate active sessions via service client
    try {
        await service.auth.admin.signOut(targetProfileId, "others");
    } catch (err) {
        console.warn("[removeStaff] Session revocation warning:", err);
    }

    // De-escalate profile to Customer and Inactive status to preserve relational history
    const { error: updateError } = await service
        .from("profiles")
        .update({
            account_type: "Customer",
            admin_role_id: null,
            status: "Inactive",
            updated_at: new Date().toISOString(),
        })
        .eq("profile_id", targetProfileId);

    if (updateError) {
        console.error("[removeStaff] Profile de-escalation failed:", updateError.message);
        return { success: false, error: "Failed to remove staff account. Please try again." };
    }

    // Revoke any pending invitations associated with target email
    if (targetProfile.email) {
        await service
            .from("staff_invitations")
            .update({ status: "Revoked" })
            .eq("email", targetProfile.email.toLowerCase())
            .eq("status", "Pending");
    }

    revalidatePath("/admin/staff");
    return { success: true, message: "Staff member has been removed and back-office access revoked." };
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

    // Ensure target is an Admin
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

    // Revoke active sessions via service client
    try {
        const service = createSupabaseServiceClient();
        await service.auth.admin.signOut(targetProfileId, "others");
    } catch (err) {
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
// resendInvite (Legacy Wrapper)
// ─────────────────────────────────────────────────────────────────────────────

export async function resendInvite(email: string): Promise<StaffActionResult> {
    const res = await resendStaffInvite(email);
    if (!res.success) {
        return { success: false, error: res.error };
    }
    return { success: true, message: res.message };
}
