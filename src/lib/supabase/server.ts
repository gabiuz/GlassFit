import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
        throw new Error("Missing Supabase server environment variables.");
    }

    const cookieStore = await cookies();

    return createServerClient(url, key, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                }
            },
        },
    });
}

export async function getCurrentUser() {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    return { supabase, user, error };
}