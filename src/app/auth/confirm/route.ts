import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const next = requestUrl.searchParams.get("next") ?? "/";
    // OAuth callbacks pass type=oauth so we can skip the "confirmed" login banner.
    // Email confirmation links do NOT include this param.
    const type = requestUrl.searchParams.get("type");

    if (!code) {
        return NextResponse.redirect(
            new URL("/login?error=missing_confirmation_code", request.url)
        );
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        console.error("Auth callback failed:", error);

        return NextResponse.redirect(
            new URL("/login?error=confirmation_failed", request.url)
        );
    }

    // After session is established, ensure the profile row exists.
    // The DB trigger handles new users automatically, but we upsert here as
    // a safety net (e.g. returning Google users, trigger edge cases).
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (user) {
            const meta = user.user_metadata ?? {};
            const appMeta = user.app_metadata ?? {};
            const provider = (appMeta.provider as string | undefined) ?? "email";

            let firstName: string;
            let lastName: string;
            let phone: string | null;
            let authProvider: "Email" | "Google" | "Other";

            if (provider === "google") {
                // Google provides a single full_name or name field.
                const fullName: string =
                    (meta.full_name as string | undefined) ??
                    (meta.name as string | undefined) ??
                    "";
                const parts = fullName.trim().split(/\s+/);
                firstName = parts[0] || "User";
                lastName = parts.slice(1).join(" ") || firstName;
                phone = null;
                authProvider = "Google";
            } else {
                firstName = (meta.first_name as string | undefined)?.trim() || "User";
                lastName =
                    (meta.last_name as string | undefined)?.trim() || firstName;
                const rawPhone = (meta.phone as string | undefined)?.trim() ?? "";
                phone = rawPhone || null;
                authProvider = "Email";
            }

            // Clamp to DB varchar(50) limits
            firstName = firstName.slice(0, 50);
            lastName = lastName.slice(0, 50);

            const { error: profileError } = await supabase.from("profiles").upsert(
                {
                    profile_id: user.id,
                    first_name: firstName,
                    last_name: lastName,
                    email: user.email ?? meta.email ?? "",
                    contact_number: phone,
                    auth_provider: authProvider,
                    account_type: "Customer",
                    status: "Active",
                },
                {
                    // Only insert if missing; don't overwrite existing data
                    onConflict: "profile_id",
                    ignoreDuplicates: true,
                }
            );

            if (profileError) {
                // Non-fatal: log and continue — the user is authenticated regardless.
                console.error("Profile upsert failed:", profileError.message);
            }
        }
    } catch (profileErr) {
        console.error("Profile creation error:", profileErr);
    }

    // OAuth login/signup: user is already authenticated — go directly to destination.
    if (type === "oauth") {
        return NextResponse.redirect(new URL(next, request.url));
    }

    // Email confirmation: user still needs to log in — show the success banner.
    if (next === "/") {
        return NextResponse.redirect(new URL("/login?confirmed=1", request.url));
    }

    return NextResponse.redirect(new URL(next, request.url));
}