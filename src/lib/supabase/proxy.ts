import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Admin paths that do NOT require authentication.
const ADMIN_PUBLIC_PATHS = [
    "/admin/login",
    "/admin/forgot-password",
    "/admin/reset-password",
    "/admin/invite",
    "/admin/auth/callback",
];

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value);
                    });

                    response = NextResponse.next({ request });

                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    await supabase.auth.getClaims();

    // ── Admin route protection (Layer 1) ───────────────────────────────────
    // This is an early-exit gate that blocks unauthenticated sessions from
    // reaching any protected Admin page. The full authorization check
    // (account_type, profile.status, role.status, permissions) happens in
    // the protected layout via requireAdmin().
    const { pathname } = request.nextUrl;
    const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
    const isPublicAdminPath = ADMIN_PUBLIC_PATHS.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
    );

    if (isAdminRoute && !isPublicAdminPath) {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            const loginUrl = new URL("/admin/login", request.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    return response;
}