import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /admin/auth/callback
 *
 * Handles Supabase invite and password-recovery callbacks for Admin accounts.
 *
 * After Supabase validates the token:
 *   - invite  → /admin/invite   (Staff sets their password)
 *   - recovery → /admin/reset-password
 *   - fallback → /admin/login?error=session_expired
 */
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const type = requestUrl.searchParams.get("type");

    if (!code) {
        return NextResponse.redirect(
            new URL("/admin/login?error=session_expired", request.url)
        );
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        console.error("[Admin Auth Callback] Token exchange failed:", error.message);
        return NextResponse.redirect(
            new URL("/admin/login?error=session_expired", request.url)
        );
    }

    // Invite flow: Staff needs to set their password
    if (type === "invite") {
        return NextResponse.redirect(new URL("/admin/invite", request.url));
    }

    // Password recovery flow: Admin resets their password
    if (type === "recovery") {
        return NextResponse.redirect(new URL("/admin/reset-password", request.url));
    }

    // Default: send to invite (most common use for this callback)
    return NextResponse.redirect(new URL("/admin/invite", request.url));
}
