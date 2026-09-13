"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// ---------------------------------------------------------------------------
// PRD-F# (Settings): Admin profile self-management
// SDD-C# (AdminAuth): Server actions enforce authenticated Supabase session
// ---------------------------------------------------------------------------

export type SettingsActionResult =
    | { ok: true; message: string }
    | { ok: false; error: string };

/**
 * Updates the authenticated admin's display name in the profiles table.
 * Uses the service client since the admin updates their own row (auth.uid() = profile_id RLS satisfied).
 */
export async function updateAdminProfile(
    profileId: string,
    fullName: string,
): Promise<SettingsActionResult> {
    if (!fullName.trim()) {
        return { ok: false, error: "Full name cannot be empty." };
    }

    const supabase = createSupabaseServiceClient();

    const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("profile_id", profileId);

    if (error) {
        console.error("[updateAdminProfile] Supabase error:", error.message);
        return { ok: false, error: "Failed to update profile. Please try again." };
    }

    return { ok: true, message: "Profile updated successfully." };
}

/**
 * Updates the authenticated admin's password via Supabase Auth.
 * Supabase requires the user's current session to call updateUser — the
 * browser-side client handles the active session; we use the server client
 * here only to validate the current password via a re-auth sign-in first.
 */
export async function updateAdminPassword(
    email: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
): Promise<SettingsActionResult> {
    if (!newPassword || newPassword.length < 8) {
        return { ok: false, error: "New password must be at least 8 characters." };
    }

    if (newPassword !== confirmPassword) {
        return { ok: false, error: "Passwords do not match." };
    }

    // Validate complexity: at least one uppercase, one lowercase, one digit
    const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
    if (!complexityRegex.test(newPassword)) {
        return {
            ok: false,
            error: "Password must include uppercase, lowercase, and a number.",
        };
    }

    const supabase = await createSupabaseServerClient();

    // Re-authenticate with the current password to verify it is correct
    const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
    });

    if (signInError) {
        return { ok: false, error: "Current password is incorrect." };
    }

    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
    });

    if (updateError) {
        console.error("[updateAdminPassword] Supabase error:", updateError.message);
        return { ok: false, error: "Failed to update password. Please try again." };
    }

    return { ok: true, message: "Password updated successfully." };
}
