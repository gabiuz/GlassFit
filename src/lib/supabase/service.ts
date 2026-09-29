import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with the service-role key.
 *
 * IMPORTANT:
 * - This file is server-only (enforced by the "server-only" import).
 * - Never import this in client components or expose the key to the browser.
 * - Use only for trusted Admin operations:
 *     • invite user by email
 *     • resend invite
 *     • revoke Supabase Auth sessions
 */
export function createSupabaseServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        throw new Error(
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
            "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (never prefix with NEXT_PUBLIC_)."
        );
    }

    return createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
