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