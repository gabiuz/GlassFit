"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { validateEmail } from "@/features/auth/utils/auth-utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Safe error messages — do not expose database details. */
const ADMIN_ERRORS: Record<string, string> = {
    unauthorized: "This account does not have access to the Admin portal.",
    suspended: "Your Admin account is currently unavailable. Contact the system Owner.",
    inactive_role: "Your Admin access is currently unavailable. Contact the system Owner.",
    session_expired: "Your session has expired. Please sign in again.",
};

export function AdminLoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [emailError, setEmailError] = useState("");
    const [generalError, setGeneralError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const errorCode = searchParams.get("error");
        if (errorCode && ADMIN_ERRORS[errorCode]) {
            setGeneralError(ADMIN_ERRORS[errorCode]);
        }
    }, [searchParams]);

    const isEmailValid = email !== "" && validateEmail(email);
    const isFormValid = isEmailValid && password !== "";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setGeneralError("");

        if (!validateEmail(email)) {
            setEmailError("Please enter a valid email address.");
            return;
        }

        setIsSubmitting(true);

        try {
            const supabase = createSupabaseBrowserClient();

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            });

            if (error) {
                const msg = error.message.toLowerCase();
                if (
                    msg.includes("invalid login credentials") ||
                    msg.includes("invalid email or password") ||
                    msg.includes("email not confirmed")
                ) {
                    setGeneralError("Invalid email or password.");
                } else if (msg.includes("rate limit") || msg.includes("too many requests")) {
                    setGeneralError("Too many login attempts. Please wait before trying again.");
                } else {
                    setGeneralError("Login failed. Please try again.");
                }
                return;
            }

            if (!data.session) {
                setGeneralError("Login failed. Please try again.");
                return;
            }

            // ── Admin authorization check ─────────────────────────────────────
            // After Supabase Auth succeeds, verify the account is actually an
            // active Admin with an active role. This runs server-side.
            const response = await fetch("/admin/auth/check", { method: "POST" });
            const result = await response.json() as { ok: boolean; reason?: string };

            if (!result.ok) {
                // Sign out the non-Admin user so they don't hold an active session
                await supabase.auth.signOut();
                const reason = result.reason ?? "unauthorized";
                setGeneralError(
                    ADMIN_ERRORS[reason] ?? "This account does not have access to the Admin portal."
                );
                return;
            }

            router.push("/admin");
            router.refresh();
        } catch {
            setGeneralError(
                navigator.onLine
                    ? "Something went wrong. Please try again."
                    : "You appear to be offline. Check your internet connection."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden py-16">
            {/* Background Video */}
            <video
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay
                loop
                muted
                playsInline
            >
                <source src="/auth_background/auth_background_vid.mp4" type="video/mp4" />
            </video>

            {/* Dark Teal Gradient Overlay */}
            <div className="absolute inset-0 bg-grad-dark opacity-85 backdrop-blur-[2px] z-0" />

            {/* Login Card */}
            <div className="relative z-10 w-full max-w-[777px] mx-4 bg-white/95 backdrop-blur-md border border-[#c3c3c3] rounded-[20px] px-8 sm:px-[72px] py-12 flex flex-col gap-7.5 items-center justify-center shadow-[0px_4px_30px_0px_rgba(4,94,109,0.25)] select-none">

                {/* Logo */}
                <div className="relative h-[114px] w-[268px] flex items-center justify-center mb-2">
                    <Image
                        src="/Logo.svg"
                        alt="GlassFit Logo"
                        fill
                        priority
                        className="object-contain pointer-events-none"
                    />
                </div>

                {/* Heading */}
                <div className="flex flex-col gap-2.5 items-center w-full text-center">
                    <h1 className="bg-grad-light bg-clip-text text-[32px] font-medium leading-1.2 tracking-[-0.608px] text-transparent uppercase">
                        Admin Portal
                    </h1>
                    <p className="text-black text-base font-normal tracking-[-0.304px] leading-[1.4]">
                        Sign in to manage GlassFit
                    </p>
                </div>

                {/* Form */}
                <form
                    id="admin-login-form"
                    onSubmit={handleSubmit}
                    noValidate
                    className="w-full flex flex-col gap-6.25 max-w-[633px]"
                >
                    {/* Error banner */}
                    {generalError && (
                        <div
                            role="alert"
                            className="bg-red-50 border border-red-300 text-red-700 text-sm rounded-lg p-3 text-center leading-relaxed"
                        >
                            {generalError}
                        </div>
                    )}

                    {/* Email */}
                    <div className="flex flex-col gap-1.25 w-full items-start">
                        <label
                            htmlFor="admin-login-email"
                            className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]"
                        >
                            Email
                        </label>
                        <input
                            id="admin-login-email"
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (emailError) setEmailError("");
                                if (generalError) setGeneralError("");
                            }}
                            placeholder="admin@example.com"
                            autoComplete="email"
                            inputMode="email"
                            spellCheck={false}
                            className="w-full bg-white border border-[#c3c3c3] rounded-lg px-4 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                            required
                            aria-invalid={Boolean(emailError)}
                            aria-describedby={emailError ? "admin-login-email-error" : undefined}
                        />
                        {emailError && (
                            <span id="admin-login-email-error" className="text-red-600 text-xs mt-1">
                                {emailError}
                            </span>
                        )}
                    </div>

                    {/* Password */}
                    <div className="flex flex-col gap-1.25 w-full items-start">
                        <label
                            htmlFor="admin-login-password"
                            className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]"
                        >
                            Password
                        </label>
                        <div className="w-full relative flex items-center">
                            <input
                                id="admin-login-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (generalError) setGeneralError("");
                                }}
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                className="w-full bg-white border border-[#c3c3c3] rounded-lg pl-4 pr-12 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                                required
                            />
                            <button
                                type="button"
                                id="admin-login-toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 text-black hover:text-green focus:outline-none transition-colors"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex flex-col gap-4 items-center w-full mt-2">
                        <button
                            id="admin-login-submit"
                            type="submit"
                            disabled={!isFormValid || isSubmitting}
                            className={`w-full flex items-center justify-center gap-2 px-[16px] py-[10px] rounded-[20px] text-sm text-white tracking-[-0.266px] font-normal leading-[1.4] transition-all ${
                                isFormValid && !isSubmitting
                                    ? "bg-[#07b6d3] cursor-pointer hover:bg-[#06a4be] active:translate-y-px"
                                    : "bg-[#c3c3c3] pointer-events-none"
                            }`}
                        >
                            {isSubmitting && (
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            )}
                            {isSubmitting ? "Signing In..." : "Sign In"}
                        </button>

                        <Link
                            href="/admin/forgot-password"
                            className="text-[#c3c3c3] text-sm hover:text-green transition-colors tracking-[-0.266px]"
                        >
                            Forgot password?
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
}
