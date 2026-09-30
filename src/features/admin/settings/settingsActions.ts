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
import { checkAdminAuth } from "@/lib/auth/admin";
import { normalizePersonName, type NormalizedPersonName, type PersonNameInput } from "@/lib/identity/personName";
import { validateEmail } from "@/features/auth/utils/auth-utils";
import { sendStaffEmailChangeApprovalEmail } from "@/lib/email/resendClient";
import { createHash, randomBytes } from "node:crypto";

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
    input: PersonNameInput,
): Promise<SettingsActionResult<NormalizedPersonName>> {
    const authorization = await checkAdminAuth();
    if (!authorization.ok) return { ok: false, error: "An active administrator session is required." };
    const normalized = normalizePersonName(input);
    if (!normalized.ok) return { ok: false, error: normalized.error };
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
        .from("profiles")
        .update({ first_name: normalized.value.firstName, last_name: normalized.value.lastName })
        .eq("profile_id", authorization.context.profileId);

    if (error) {
        console.error("[updateAdminProfile] Supabase error:", error.message);
        return { ok: false, error: "Failed to update profile. Please try again." };
    }

    return { ok: true, message: "Name updated successfully.", data: normalized.value };
}

export interface AdminEmailChangeData {
    mode: "staff_approval_required" | "privileged_immediate";
    email: string;
}

export interface AdminEmailChangeEventView {
    eventId: string;
    staffName: string;
    previousEmail: string;
    proposedEmail: string;
    status: string;
    deliveryStatus: string;
    requestedAt: string;
    expiresAt: string | null;
}

type DeliveryRecord = {
    profileId: string;
    email: string;
    status: "Delivered" | "Failed";
    providerMessageId: string | null;
    attemptedAt: string;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const isPrivileged = (role: string) => role === "Owner" || role === "Manager";

function mapAuthError(message: string): string {
    const normalized = message.toLowerCase();
    if (normalized.includes("already") || normalized.includes("duplicate")) return "That email address is already in use.";
    if (normalized.includes("session") || normalized.includes("jwt")) return "Your session has expired. Please sign in again.";
    return "The email address could not be changed. Please try again.";
}

async function activeSupervisorRecipients() {
    const service = createSupabaseServiceClient();
    const { data } = await service.from("profiles").select("profile_id, email, admin_roles!inner(role_name, status)")
        .eq("account_type", "Admin").eq("status", "Active").eq("admin_roles.status", "Active")
        .in("admin_roles.role_name", ["Owner", "Manager"]);
    const recipients = new Map<string, { profileId: string; email: string }>();
    for (const row of data ?? []) {
        const email = String(row.email).trim().toLowerCase();
        if (validateEmail(email)) recipients.set(email, { profileId: row.profile_id, email });
    }
    return [...recipients.values()];
}

export async function changeAdminEmail(newEmail: string): Promise<SettingsActionResult<AdminEmailChangeData>> {
    const authorization = await checkAdminAuth();
    if (!authorization.ok) return { ok: false, error: "An active administrator session is required." };
    const context = authorization.context;
    const email = newEmail.trim().toLowerCase();
    if (!email || email.length > 254 || !validateEmail(email)) return { ok: false, error: "Enter a valid email address." };
    if (email === context.email.trim().toLowerCase()) {
        return { ok: true, message: "This is already your current email address.", data: { mode: isPrivileged(context.role.roleName) ? "privileged_immediate" : "staff_approval_required", email } };
    }
    const service = createSupabaseServiceClient();
    const requestedAt = new Date();

    if (context.role.roleName === "Staff") {
        const rawToken = randomBytes(32).toString("hex");
        const expiresAt = new Date(requestedAt.getTime() + 24 * 60 * 60 * 1000);
        await service.from("admin_email_change_events").update({ status: "Cancelled", decided_at: requestedAt.toISOString() })
            .eq("profile_id", context.profileId).eq("status", "PendingApproval");
        const { data: event, error: insertError } = await service.from("admin_email_change_events").insert({
            profile_id: context.profileId, target_user_id: context.userId, actor_full_name: context.fullName,
            actor_role: "Staff", previous_email: context.email.toLowerCase(), proposed_email: email,
            change_mode: "StaffApproval", status: "PendingApproval", approval_token_hash: hashToken(rawToken),
            approval_expires_at: expiresAt.toISOString(), delivery_status: "Pending",
        }).select("event_id").single();
        if (insertError || !event) return { ok: false, error: "The approval request could not be created." };
        const recipients = await activeSupervisorRecipients();
        const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
        if (!origin || recipients.length === 0) {
            await service.from("admin_email_change_events").update({ status: "Failed", delivery_status: "Failed", last_error: "No configured origin or eligible recipient." }).eq("event_id", event.event_id);
            return { ok: false, error: "No eligible supervisor could receive this request." };
        }
        const reviewUrl = `${origin}/admin/settings/email-change-requests/${rawToken}`;
        const deliveries: DeliveryRecord[] = await Promise.all(recipients.map(async (recipient) => {
            const result = await sendStaffEmailChangeApprovalEmail({ to: recipient.email, staffName: context.fullName,
                previousEmail: context.email, proposedEmail: email, requestedAt: requestedAt.toISOString(), expiresAt: expiresAt.toISOString(), reviewUrl });
            return { profileId: recipient.profileId, email: recipient.email, status: result.success ? "Delivered" : "Failed",
                providerMessageId: result.success ? result.id ?? null : null, attemptedAt: new Date().toISOString() };
        }));
        const delivered = deliveries.filter((item) => item.status === "Delivered").length;
        const status = delivered === 0 ? "Failed" : "PendingApproval";
        const deliveryStatus = delivered === recipients.length ? "Delivered" : delivered > 0 ? "Partial" : "Failed";
        await service.from("admin_email_change_events").update({ status, delivery_status: deliveryStatus,
            approval_deliveries: deliveries, delivery_attempts: 1, last_error: delivered === recipients.length ? null : "One or more approval messages failed." }).eq("event_id", event.event_id);
        if (delivered === 0) return { ok: false, error: "The approval request could not be delivered." };
        return { ok: true, message: "Approval requested. Your current email remains active until an Owner or Manager approves it.", data: { mode: "staff_approval_required", email } };
    }

    if (!isPrivileged(context.role.roleName)) return { ok: false, error: "Your role cannot change this email address." };
    const { data: event, error: eventError } = await service.from("admin_email_change_events").insert({
        profile_id: context.profileId, target_user_id: context.userId, actor_full_name: context.fullName,
        actor_role: context.role.roleName, previous_email: context.email.toLowerCase(), proposed_email: email,
        change_mode: "PrivilegedImmediate", status: "Initiated", delivery_status: "NotRequired",
    }).select("event_id").single();
    if (eventError || !event) return { ok: false, error: "The email change could not be recorded." };
    const { error } = await service.auth.admin.updateUserById(context.userId, { email, email_confirm: true });
    if (error) {
        await service.from("admin_email_change_events").update({ status: "Failed", last_error: mapAuthError(error.message) }).eq("event_id", event.event_id);
        return { ok: false, error: mapAuthError(error.message) };
    }
    await service.from("admin_email_change_events").update({ status: "Completed", completed_at: new Date().toISOString() }).eq("event_id", event.event_id);
    const server = await createSupabaseServerClient();
    const { error: refreshError } = await server.auth.refreshSession();
    return { ok: true, message: refreshError ? "Email changed immediately. Please sign in again to refresh your session." : "Email changed immediately.", data: { mode: "privileged_immediate", email } };
}

function eventView(row: Record<string, unknown>): AdminEmailChangeEventView {
    return {
        eventId: String(row.event_id), staffName: String(row.actor_full_name),
        previousEmail: String(row.previous_email), proposedEmail: String(row.proposed_email),
        status: String(row.status), deliveryStatus: String(row.delivery_status),
        requestedAt: String(row.requested_at), expiresAt: row.approval_expires_at ? String(row.approval_expires_at) : null,
    };
}

export async function getStaffEmailChangeRequest(rawToken: string): Promise<SettingsActionResult<AdminEmailChangeEventView>> {
    const authorization = await checkAdminAuth();
    if (!authorization.ok || !isPrivileged(authorization.context.role.roleName)) return { ok: false, error: "Owner or Manager access is required." };
    if (!/^[0-9a-f]{64}$/.test(rawToken)) return { ok: false, error: "This request link is invalid." };
    const service = createSupabaseServiceClient();
    const { data } = await service.from("admin_email_change_events").select("event_id, actor_full_name, previous_email, proposed_email, status, delivery_status, requested_at, approval_expires_at")
        .eq("approval_token_hash", hashToken(rawToken)).maybeSingle();
    if (!data) return { ok: false, error: "This request link is invalid." };
    if (data.status === "PendingApproval" && new Date(data.approval_expires_at).getTime() <= Date.now()) {
        await service.from("admin_email_change_events").update({ status: "Expired", decided_at: new Date().toISOString() }).eq("event_id", data.event_id).eq("status", "PendingApproval");
        data.status = "Expired";
    }
    return { ok: true, message: "Request loaded.", data: eventView(data) };
}

export async function getOwnStaffEmailChangeRequest(): Promise<SettingsActionResult<AdminEmailChangeEventView | null>> {
    const authorization = await checkAdminAuth();
    if (!authorization.ok || authorization.context.role.roleName !== "Staff") return { ok: false, error: "Staff access is required." };
    const service = createSupabaseServiceClient();
    const { data, error } = await service.from("admin_email_change_events")
        .select("event_id, actor_full_name, previous_email, proposed_email, status, delivery_status, requested_at, approval_expires_at")
        .eq("profile_id", authorization.context.profileId).eq("change_mode", "StaffApproval").order("requested_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return { ok: false, error: "The request status could not be loaded." };
    return { ok: true, message: "Request status loaded.", data: data ? eventView(data) : null };
}

export async function listStaffEmailChangeRequests(): Promise<SettingsActionResult<AdminEmailChangeEventView[]>> {
    const authorization = await checkAdminAuth();
    if (!authorization.ok || !isPrivileged(authorization.context.role.roleName)) return { ok: false, error: "Owner or Manager access is required." };
    const service = createSupabaseServiceClient();
    const { data, error } = await service.from("admin_email_change_events")
        .select("event_id, actor_full_name, previous_email, proposed_email, status, delivery_status, requested_at, approval_expires_at")
        .eq("change_mode", "StaffApproval").in("status", ["PendingApproval", "Failed"]).order("requested_at", { ascending: false });
    if (error) return { ok: false, error: "Staff requests could not be loaded." };
    return { ok: true, message: "Requests loaded.", data: (data ?? []).map((row) => eventView(row)) };
}

export async function approveStaffEmailChange(rawToken: string): Promise<SettingsActionResult> {
    const authorization = await checkAdminAuth();
    if (!authorization.ok || !isPrivileged(authorization.context.role.roleName)) return { ok: false, error: "Owner or Manager approval is required." };
    if (!/^[0-9a-f]{64}$/.test(rawToken)) return { ok: false, error: "This request link is invalid." };
    const service = createSupabaseServiceClient();
    const now = new Date();
    const { data: claimed, error: claimError } = await service.from("admin_email_change_events")
        .update({ status: "Processing", processing_by: authorization.context.profileId, processing_started_at: now.toISOString(), last_error: null })
        .eq("approval_token_hash", hashToken(rawToken)).eq("status", "PendingApproval").gt("approval_expires_at", now.toISOString())
        .select("event_id, profile_id, target_user_id, previous_email, proposed_email").maybeSingle();
    if (claimError || !claimed) return { ok: false, error: "This request is unavailable, expired, or was already decided." };
    if (!validateEmail(claimed.proposed_email)) {
        await service.from("admin_email_change_events").update({ status: "Failed", last_error: "Stored proposed email failed validation.", processing_by: null, processing_started_at: null }).eq("event_id", claimed.event_id);
        return { ok: false, error: "The proposed email is invalid." };
    }
    const { data: possibleDuplicates } = await service.from("profiles").select("profile_id, email")
        .neq("profile_id", claimed.profile_id).limit(1000);
    const duplicate = possibleDuplicates?.some((profile) => profile.email.trim().toLowerCase() === claimed.proposed_email.trim().toLowerCase());
    if (duplicate) {
        await service.from("admin_email_change_events").update({ status: "PendingApproval", last_error: "Proposed email is no longer available.", processing_by: null, processing_started_at: null }).eq("event_id", claimed.event_id);
        return { ok: false, error: "That email address is already in use." };
    }
    const { data: target } = await service.from("profiles").select("profile_id, email, status, account_type, admin_roles!inner(role_name, status)")
        .eq("profile_id", claimed.profile_id).maybeSingle();
    const targetRole = target?.admin_roles as unknown as { role_name?: string; status?: string } | null;
    if (!target || target.status !== "Active" || target.account_type !== "Admin" || targetRole?.role_name !== "Staff" || targetRole.status !== "Active" || target.email.toLowerCase() !== claimed.previous_email.toLowerCase()) {
        await service.from("admin_email_change_events").update({ status: "Failed", last_error: "Target Staff state changed.", processing_by: null, processing_started_at: null }).eq("event_id", claimed.event_id);
        return { ok: false, error: "The Staff account is no longer eligible for this change." };
    }
    const { error } = await service.auth.admin.updateUserById(claimed.target_user_id, { email: claimed.proposed_email, email_confirm: true });
    if (error) {
        await service.from("admin_email_change_events").update({ status: "PendingApproval", last_error: mapAuthError(error.message), processing_by: null, processing_started_at: null }).eq("event_id", claimed.event_id);
        return { ok: false, error: mapAuthError(error.message) };
    }
    const { data: synchronized } = await service.from("profiles").select("email").eq("profile_id", claimed.profile_id).eq("email", claimed.proposed_email).maybeSingle();
    if (!synchronized) {
        await service.from("admin_email_change_events").update({ status: "Failed", last_error: "Auth email changed but profile synchronization was not observed.", processing_by: null, processing_started_at: null }).eq("event_id", claimed.event_id);
        return { ok: false, error: "Email changed, but profile synchronization requires administrator review." };
    }
    await service.from("admin_email_change_events").update({ status: "Completed", decided_by: authorization.context.profileId, decided_at: now.toISOString(), completed_at: new Date().toISOString(), processing_by: null, processing_started_at: null }).eq("event_id", claimed.event_id);
    return { ok: true, message: "The Staff email change was approved and completed." };
}

export async function rejectStaffEmailChange(rawToken: string): Promise<SettingsActionResult> {
    const authorization = await checkAdminAuth();
    if (!authorization.ok || !isPrivileged(authorization.context.role.roleName)) return { ok: false, error: "Owner or Manager approval is required." };
    if (!/^[0-9a-f]{64}$/.test(rawToken)) return { ok: false, error: "This request link is invalid." };
    const service = createSupabaseServiceClient();
    const { data } = await service.from("admin_email_change_events").update({ status: "Rejected", decided_by: authorization.context.profileId, decided_at: new Date().toISOString() })
        .eq("approval_token_hash", hashToken(rawToken)).eq("status", "PendingApproval").gt("approval_expires_at", new Date().toISOString()).select("event_id").maybeSingle();
    return data ? { ok: true, message: "The email change request was rejected." } : { ok: false, error: "This request is unavailable, expired, or was already decided." };
}

export async function cancelOwnStaffEmailChange(eventId: string): Promise<SettingsActionResult> {
    const authorization = await checkAdminAuth();
    if (!authorization.ok || authorization.context.role.roleName !== "Staff") return { ok: false, error: "Staff access is required." };
    const service = createSupabaseServiceClient();
    const { data } = await service.from("admin_email_change_events").update({ status: "Cancelled", decided_at: new Date().toISOString() })
        .eq("event_id", eventId).eq("profile_id", authorization.context.profileId).eq("status", "PendingApproval").gt("approval_expires_at", new Date().toISOString()).select("event_id").maybeSingle();
    return data ? { ok: true, message: "The pending email change request was cancelled." } : { ok: false, error: "Only your active pending request can be cancelled." };
}

export async function retryStaffEmailChangeApprovalDelivery(eventId: string): Promise<SettingsActionResult> {
    const authorization = await checkAdminAuth();
    if (!authorization.ok || !isPrivileged(authorization.context.role.roleName)) return { ok: false, error: "Owner or Manager access is required." };
    const service = createSupabaseServiceClient();
    const { data: event } = await service.from("admin_email_change_events").select("*").eq("event_id", eventId).eq("change_mode", "StaffApproval").in("status", ["PendingApproval", "Failed"]).gt("approval_expires_at", new Date().toISOString()).maybeSingle();
    if (!event) return { ok: false, error: "Only an active pending Staff request can be retried." };
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    if (!origin) return { ok: false, error: "The application origin is not configured." };
    const previous = (event.approval_deliveries ?? []) as DeliveryRecord[];
    const deliveredEmails = new Set(previous.filter((item) => item.status === "Delivered").map((item) => item.email));
    const recipients = (await activeSupervisorRecipients()).filter((item) => !deliveredEmails.has(item.email));
    if (recipients.length === 0) return { ok: true, message: "Every eligible recipient has already received this request." };
    const replacementToken = randomBytes(32).toString("hex");
    const reviewUrl = `${origin}/admin/settings/email-change-requests/${replacementToken}`;
    // Only a one-way token hash is persisted, so retry rotates the token. Every
    // eligible recipient receives the new link and the prior link becomes invalid.
    const rotatedRecipients = await activeSupervisorRecipients();
    const attempted = await Promise.all(rotatedRecipients.map(async (recipient): Promise<DeliveryRecord> => {
        const result = await sendStaffEmailChangeApprovalEmail({ to: recipient.email, staffName: event.actor_full_name, previousEmail: event.previous_email, proposedEmail: event.proposed_email, requestedAt: event.requested_at, expiresAt: event.approval_expires_at, reviewUrl });
        return { profileId: recipient.profileId, email: recipient.email, status: result.success ? "Delivered" : "Failed", providerMessageId: result.success ? result.id ?? null : null, attemptedAt: new Date().toISOString() };
    }));
    const merged = attempted;
    const failed = merged.some((item) => item.status === "Failed");
    const deliveredCount = merged.filter((item) => item.status === "Delivered").length;
    await service.from("admin_email_change_events").update({ status: deliveredCount > 0 ? "PendingApproval" : "Failed", approval_token_hash: hashToken(replacementToken), approval_deliveries: merged, delivery_attempts: event.delivery_attempts + 1, delivery_status: deliveredCount === 0 ? "Failed" : failed ? "Partial" : "Delivered", last_error: failed ? "One or more approval messages failed." : null }).eq("event_id", eventId);
    return { ok: true, message: failed ? "Delivery retried. Some recipients still could not be reached." : "Approval request delivery completed." };
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
                lastBackupAt: null,
                lastBackupBy: null,
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
            lastBackupAt: data.last_backup_at ?? null,
            lastBackupBy: data.last_backup_by ?? null,
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
            lastBackupAt: updatedRecord.last_backup_at ?? null,
            lastBackupBy: updatedRecord.last_backup_by ?? null,
            updatedAt: updatedRecord.updated_at,
            updatedBy: updatedRecord.updated_by,
        },
    };
}

/**
 * Fetches aggregated business analytics data for the Business Intelligence Modal.
 */
export async function getAdminBusinessAnalyticsAction(
    startDate?: string | null,
    endDate?: string | null
): Promise<SettingsActionResult<import("@/lib/settings/types").BusinessAnalyticsData>> {
    const authorization = await checkAdminAuth();
    if (!authorization.ok) {
        return { ok: false, error: "An active administrator session is required." };
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_admin_business_analytics", {
        p_start_date: startDate || null,
        p_end_date: endDate || null,
    });

    if (error) {
        console.error("[getAdminBusinessAnalyticsAction] Error:", error.message);
        return { ok: false, error: "Failed to load business analytics." };
    }

    return {
        ok: true,
        message: "Analytics loaded successfully",
        data: data as import("@/lib/settings/types").BusinessAnalyticsData,
    };
}

