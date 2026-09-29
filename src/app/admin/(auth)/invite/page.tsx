import { Suspense } from "react";
import type { Metadata } from "next";
import { StaffActivationForm } from "@/features/admin/auth/StaffActivationForm";

export const metadata: Metadata = {
    title: "Activate Staff Account | GlassFit Admin",
    description: "Verify your 6-digit code and set your credentials to activate your GlassFit Staff account",
    robots: { index: false, follow: false },
};

export default function AdminInvitePage() {
    return (
        <Suspense fallback={
            <main className="relative min-h-screen w-full flex items-center justify-center bg-[#045e6d]">
                <div className="flex flex-col items-center gap-4 text-white">
                    <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-sm">Loading invitation...</p>
                </div>
            </main>
        }>
            <StaffActivationForm />
        </Suspense>
    );
}
