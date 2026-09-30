"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
    checkPasswordRequirements,
    validatePhoneNumber,
} from "@/features/auth/utils/auth-utils";
import { normalizePersonName } from "@/lib/identity/personName";

export type VerifyInviteTokenResult =
    | { success: true; email: string; roleName: string }
    | { success: false; error: string; code: "EXPIRED" | "NOT_FOUND" | "USED" };

export type CompleteStaffRegistrationInput = {
    token: string;
    verificationCode: string;
    phone: string;
    password: string;
    firstName?: string;
    lastName?: string;
};

export type CompleteStaffRegistrationResult =
    | { success: true; message: string; email: string }
    | { success: false; error: string; field?: "firstName" | "lastName" };

/**
 * Validates the staff invitation token upon landing on /admin/invite.
 */
export async function verifyStaffInviteToken(token: string): Promise<VerifyInviteTokenResult> {
    if (!token || typeof token !== "string" || token.trim().length === 0) {
        return {
            success: false,
            error: "Invitation token is required.",
            code: "NOT_FOUND",
        };
    }

    const service = createSupabaseServiceClient();

    const { data: invitation, error } = await service
        .from("staff_invitations")
        .select(`
            id,
            email,
            status,
            expires_at,
            admin_roles (
                role_name
            )
        `)
        .eq("token", token.trim())
        .maybeSingle();

    if (error || !invitation) {
        return {
            success: false,
            error: "This invitation link is invalid or does not exist.",
            code: "NOT_FOUND",
        };
    }

    if (invitation.status === "Accepted") {
        return {
            success: false,
            error: "This invitation has already been accepted.",
            code: "USED",
        };
    }

    const isExpired = new Date(invitation.expires_at).getTime() <= Date.now();
    if (invitation.status === "Revoked" || invitation.status === "Expired" || isExpired) {
        return {
            success: false,
            error: "This invitation link has expired or been revoked. Please contact your administrator.",
            code: "EXPIRED",
        };
    }

    const role = (invitation.admin_roles as unknown) as { role_name?: string } | null;

    return {
        success: true,
        email: invitation.email,
        roleName: role?.role_name ?? "Staff",
    };
}

/**
 * Completes staff account activation with two-party 6-digit code verification.
 * Seamlessly handles existing Customer promotion or new Staff account creation.
 */
export async function completeStaffRegistration(
    input: CompleteStaffRegistrationInput
): Promise<CompleteStaffRegistrationResult> {
    const { token, verificationCode, phone, password, firstName, lastName } = input;

    let suppliedName: ReturnType<typeof normalizePersonName> | null = null;
    if ((firstName ?? "").trim() || (lastName ?? "").trim()) {
        suppliedName = normalizePersonName({ firstName: firstName ?? "", lastName });
        if (!suppliedName.ok) {
            return { success: false, field: suppliedName.field, error: suppliedName.error };
        }
    }

    if (!token || !token.trim()) {
        return { success: false, error: "Invalid invitation token." };
    }

    const trimmedCode = (verificationCode ?? "").trim();
    if (!trimmedCode || !/^[0-9]{6}$/.test(trimmedCode)) {
        return { success: false, error: "Please enter the 6-digit numeric verification code provided by your administrator." };
    }

    const rawDigits = (phone ?? "").replace(/\D/g, "");
    const cleanPhoneDigits = rawDigits.startsWith("63") ? rawDigits.slice(2) : rawDigits;

    if (!validatePhoneNumber(cleanPhoneDigits)) {
        return { success: false, error: "Please enter a valid Philippine mobile number starting with 9." };
    }

    const passwordReqs = checkPasswordRequirements(password ?? "");
    if (!passwordReqs.minLength || !passwordReqs.hasNumber || !passwordReqs.hasLetter) {
        return { success: false, error: "Password does not meet all complexity requirements." };
    }

    const normalizedPhone = `+63${cleanPhoneDigits}`;
    const service = createSupabaseServiceClient();

    // 1. Fetch invitation record
    const { data: invitation, error: fetchError } = await service
        .from("staff_invitations")
        .select("id, email, token, verification_code, role_id, status, expires_at")
        .eq("token", token.trim())
        .maybeSingle();

    if (fetchError || !invitation) {
        return { success: false, error: "Invitation not found or invalid token." };
    }

    if (invitation.status !== "Pending") {
        return {
            success: false,
            error: invitation.status === "Accepted"
                ? "This invitation has already been accepted."
                : "This invitation is no longer active.",
        };
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
        return { success: false, error: "This invitation link has expired. Please contact your administrator." };
    }

    // 2. Verify 6-digit out-of-band code
    if (invitation.verification_code !== trimmedCode) {
        return {
            success: false,
            error: "Invalid 6-digit verification code. Please request the correct code from your administrator.",
        };
    }

    const inviteEmail = invitation.email.toLowerCase().trim();

    // 3. Resolve user identity and promote/create
    try {
        // Check if profile exists
        const { data: existingProfile } = await service
            .from("profiles")
            .select("profile_id, email, account_type, first_name, last_name")
            .eq("email", inviteEmail)
            .maybeSingle();

        if (existingProfile) {
            const profileUserId = existingProfile.profile_id;
            const updatedFirst = suppliedName?.ok ? suppliedName.value.firstName : existingProfile.first_name || "Staff";
            const updatedLast = suppliedName?.ok ? suppliedName.value.lastName : existingProfile.last_name || "";

            // Update Auth user credentials (password & metadata)
            const { error: authErr } = await service.auth.admin.updateUserById(profileUserId, {
                password,
                user_metadata: {
                    first_name: updatedFirst,
                    last_name: updatedLast,
                    phone: normalizedPhone,
                },
            });

            if (authErr) {
                console.warn("[completeStaffRegistration] Warning updating auth user:", authErr.message);
            }

            // Promote profile to Admin with the Staff role
            const { error: profileErr } = await service
                .from("profiles")
                .update({
                    account_type: "Admin",
                    admin_role_id: invitation.role_id,
                    contact_number: normalizedPhone,
                    status: "Active",
                    first_name: updatedFirst,
                    last_name: updatedLast,
                    updated_at: new Date().toISOString(),
                })
                .eq("profile_id", profileUserId);

            if (profileErr) {
                console.error("[completeStaffRegistration] Profile promotion error:", profileErr.message);
                return { success: false, error: "Failed to update profile to Staff role. Please contact support." };
            }
        } else {
            // Brand new user: create in Supabase Auth
            const effectiveFirst = suppliedName?.ok ? suppliedName.value.firstName : "Staff";
            const effectiveLast = suppliedName?.ok ? suppliedName.value.lastName : "";

            let newUserId: string;

            const { data: createdUserData, error: createAuthError } = await service.auth.admin.createUser({
                email: inviteEmail,
                password,
                email_confirm: true,
                user_metadata: {
                    first_name: effectiveFirst,
                    last_name: effectiveLast,
                    phone: normalizedPhone,
                },
            });

            if (createAuthError || !createdUserData?.user) {
                // If user already exists in auth.users but not in profiles
                const { data: listData } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
                const matchedUser = listData.users.find((u) => u.email?.toLowerCase() === inviteEmail);

                if (matchedUser) {
                    newUserId = matchedUser.id;
                    await service.auth.admin.updateUserById(newUserId, {
                        password,
                        user_metadata: {
                            first_name: effectiveFirst,
                            last_name: effectiveLast,
                            phone: normalizedPhone,
                        },
                    });
                } else {
                    console.error("[completeStaffRegistration] Auth create user error:", createAuthError?.message);
                    return { success: false, error: "Failed to initialize user credentials. Please try again." };
                }
            } else {
                newUserId = createdUserData.user.id;
            }

            // Upsert profile as active Admin
            const { error: upsertErr } = await service
                .from("profiles")
                .upsert(
                    {
                        profile_id: newUserId,
                        email: inviteEmail,
                        first_name: effectiveFirst,
                        last_name: effectiveLast,
                        account_type: "Admin",
                        admin_role_id: invitation.role_id,
                        contact_number: normalizedPhone,
                        auth_provider: "Email",
                        status: "Active",
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: "profile_id" }
                );

            if (upsertErr) {
                console.error("[completeStaffRegistration] Profile upsert error:", upsertErr.message);
                return { success: false, error: "Failed to finalize staff profile." };
            }
        }

        // 4. Mark invitation as Accepted
        await service
            .from("staff_invitations")
            .update({
                status: "Accepted",
                updated_at: new Date().toISOString(),
            })
            .eq("id", invitation.id);

        revalidatePath("/admin/staff");

        return {
            success: true,
            message: "Staff account activated successfully. You may now log in to the back-office workbench.",
            email: inviteEmail,
        };
    } catch (err) {
        console.error("[completeStaffRegistration] Unexpected exception:", err);
        return {
            success: false,
            error: "An unexpected error occurred during account activation.",
        };
    }
}
