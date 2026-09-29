import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/auth/admin";

/**
 * POST /admin/auth/check
 *
 * Called by the AdminLoginForm after Supabase signInWithPassword succeeds
 * to verify the authenticated account is actually an active Admin.
 *
 * Returns: { ok: true } | { ok: false, reason: string }
 */
export async function POST() {
    const result = await checkAdminAuth();

    if (!result.ok) {
        return NextResponse.json({ ok: false, reason: result.reason }, { status: 200 });
    }

    return NextResponse.json({ ok: true });
}
