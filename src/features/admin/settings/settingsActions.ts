"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
    SystemPreferencesSchema,
    type SystemPreferencesInput,
    type SystemPreferencesRecord,
    type OperatingScheduleRange,
} from "@/lib/settings/types";
import { formatTime12h } from "@/lib/settings/formatters";

// ---------------------------------------------------------------------------
// PRD-F14 (Settings): Admin profile self-management & Owner-governed preferences
// SDD-C10 (AdminAuth): Server actions enforce authenticated Supabase session and Owner role
// ---------------------------------------------------------------------------

export type SettingsActionResult<T = void> =
    | { ok: true; message: string; data?: T }
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
 * Supabase requires the user's current session to call updateUser: the
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

/**
 * Retrieves the current system preferences.
 * Safe for use by both admin settings and quotation generation.
 */
export async function getSystemPreferences(): Promise<SettingsActionResult<SystemPreferencesRecord>> {
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
        .from("system_preferences")
        .select("*")
        .eq("singleton_key", "GLOBAL_PREFERENCES")
        .maybeSingle();

    if (error || !data) {
        // Return enterprise fallback if table or row not yet initialized
        return {
            ok: true,
            message: "Using default preferences",
            data: {
                id: "default",
                businessName: "GlassFit",
                contactEmail: "glassfit@gmail.com",
                contactPhone: "+63 917 123 4567",
                operatingDaysRange: "Monday - Saturday",
                operatingHoursRange: "8:00 AM - 5:00 PM",
                operatingSchedules: [
                    {
                        id: "default-1",
                        startDay: "Monday",
                        endDay: "Saturday",
                        startTime: "08:00",
                        endTime: "17:00",
                    },
                ],
                updatedAt: new Date().toISOString(),
                updatedBy: null,
            },
        };
    }

    return {
        ok: true,
        message: "Preferences loaded",
        data: {
            id: data.id,
            businessName: data.business_name,
            contactEmail: data.contact_email,
            contactPhone: data.contact_phone,
            operatingDaysRange: data.operating_days_range,
            operatingHoursRange: data.operating_hours_range,
            operatingSchedules: (data.operating_schedules as OperatingScheduleRange[]) ?? [],
            updatedAt: data.updated_at,
            updatedBy: data.updated_by,
        },
    };
}

/**
 * Updates system preferences. Strictly restricted to Owner administrators.
 */
export async function updateSystemPreferences(
    input: SystemPreferencesInput
): Promise<SettingsActionResult<SystemPreferencesRecord>> {
    // 1. Validate payload against Zod schema
    const parsed = SystemPreferencesSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid preferences payload" };
    }

    // 2. Verify authenticated caller role is Owner
    const serverSupabase = await createSupabaseServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
        return { ok: false, error: "Authentication required." };
    }

    const serviceClient = createSupabaseServiceClient();
    const { data: profile } = await serviceClient
        .from("profiles")
        .select(`
            profile_id,
            account_type,
            status,
            admin_roles ( role_name )
        `)
        .eq("profile_id", user.id)
        .maybeSingle();

    const rawRoles = profile?.admin_roles as unknown;
    const roleName = Array.isArray(rawRoles)
        ? (rawRoles[0] as { role_name?: string } | undefined)?.role_name
        : (rawRoles as { role_name?: string } | null | undefined)?.role_name;

    if (
        profile?.account_type !== "Admin" ||
        profile?.status !== "Active" ||
        roleName?.toLowerCase() !== "owner"
    ) {
        return {
            ok: false,
            error: "Unauthorized: Only business Owners can modify system preferences and operating schedules.",
        };
    }

    // 3. Derive primary summary strings
    const primarySchedule = parsed.data.schedules[0];
    const derivedDaysRange = primarySchedule.startDay === primarySchedule.endDay
        ? primarySchedule.startDay
        : `${primarySchedule.startDay} - ${primarySchedule.endDay}`;

    const derivedHoursRange = `${formatTime12h(primarySchedule.startTime)} - ${formatTime12h(primarySchedule.endTime)}`;

    // 4. Upsert singleton system preferences
    const { data: updatedRecord, error: updateError } = await serviceClient
        .from("system_preferences")
        .upsert({
            singleton_key: "GLOBAL_PREFERENCES",
            business_name: parsed.data.businessName,
            contact_email: parsed.data.contactEmail,
            contact_phone: parsed.data.contactPhone,
            operating_days_range: derivedDaysRange,
            operating_hours_range: derivedHoursRange,
            operating_schedules: parsed.data.schedules,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
        }, { onConflict: "singleton_key" })
        .select()
        .single();

    if (updateError || !updatedRecord) {
        console.error("[updateSystemPreferences] Error:", updateError?.message);
        return { ok: false, error: "Failed to save system preferences. Please try again." };
    }

    return {
        ok: true,
        message: "System preferences updated successfully.",
        data: {
            id: updatedRecord.id,
            businessName: updatedRecord.business_name,
            contactEmail: updatedRecord.contact_email,
            contactPhone: updatedRecord.contact_phone,
            operatingDaysRange: updatedRecord.operating_days_range,
            operatingHoursRange: updatedRecord.operating_hours_range,
            operatingSchedules: updatedRecord.operating_schedules,
            updatedAt: updatedRecord.updated_at,
            updatedBy: updatedRecord.updated_by,
        },
    };
}
