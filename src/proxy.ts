import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * Run on all paths EXCEPT:
         * - /auth/* — must be excluded so the Supabase PKCE code in the URL is not
         *             consumed by updateSession before /auth/confirm can exchange it
         * - _next/static, _next/image, favicon.ico
         * - Static asset extensions (svg, png, mp4, fonts, etc.)
         */
        "/((?!auth/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|otf|woff2?)$).*)",
    ],
};
