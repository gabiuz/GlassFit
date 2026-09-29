"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { validateEmail } from "@/features/auth/utils/auth-utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminForgotPasswordForm() {
    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [generalError, setGeneralError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isEmailValid = email !== "" && validateEmail(email);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage("");
        setGeneralError("");

        if (!validateEmail(email)) {
            setEmailError("Please enter a valid email address.");
            return;
        }

        setIsSubmitting(true);

        try {
            const supabase = createSupabaseBrowserClient();

            // The redirect lands on /admin/auth/callback?type=recovery
            const { error } = await supabase.auth.resetPasswordForEmail(
                email.trim().toLowerCase(),
                {
                    redirectTo: `${window.location.origin}/admin/auth/callback?type=recovery`,
                }
            );

            if (error) {
                setGeneralError("Something went wrong. Please try again.");
                return;
            }

            // Always show success — do not reveal whether the email exists.
            setSuccessMessage(
                "If that email is registered, you will receive a password reset link shortly."
            );
            setEmail("");
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

            <div className="absolute inset-0 bg-grad-dark opacity-85 backdrop-blur-[2px] z-0" />

            <div className="relative z-10 w-full max-w-[777px] mx-4 bg-white/95 backdrop-blur-md border border-[#c3c3c3] rounded-[20px] px-8 sm:px-[72px] py-12 flex flex-col gap-7.5 items-center justify-center shadow-[0px_4px_30px_0px_rgba(4,94,109,0.25)] select-none">

                <div className="relative h-[114px] w-[268px] flex items-center justify-center mb-2">
                    <Image
                        src="/Logo.svg"
                        alt="GlassFit Logo"
                        fill
                        priority
                        className="object-contain pointer-events-none"
                    />
                </div>

                <div className="flex flex-col gap-2.5 items-center w-full text-center">
                    <h1 className="bg-grad-light bg-clip-text text-[32px] font-medium leading-1.2 tracking-[-0.608px] text-transparent uppercase">
                        Reset Password
                    </h1>
                    <p className="text-black text-base font-normal tracking-[-0.304px] leading-[1.4]">
                        Enter your Admin email to receive a reset link
                    </p>
                </div>

                <form
                    id="admin-forgot-password-form"
                    onSubmit={handleSubmit}
                    noValidate
                    className="w-full flex flex-col gap-6.25 max-w-[633px]"
                >
                    {successMessage && (
                        <div className="bg-green/10 border border-green text-green text-sm rounded-lg p-3 text-center">
                            {successMessage}
                        </div>
                    )}

                    {generalError && (
                        <div
                            role="alert"
                            className="bg-red-50 border border-red-300 text-red-700 text-sm rounded-lg p-3 text-center leading-relaxed"
                        >
                            {generalError}
                        </div>
                    )}

                    <div className="flex flex-col gap-1.25 w-full items-start">
                        <label
                            htmlFor="admin-forgot-email"
                            className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]"
                        >
                            Email
                        </label>
                        <input
                            id="admin-forgot-email"
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
                            aria-describedby={emailError ? "admin-forgot-email-error" : undefined}
                        />
                        {emailError && (
                            <span id="admin-forgot-email-error" className="text-red-600 text-xs mt-1">
                                {emailError}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col gap-4 items-center w-full mt-2">
                        <button
                            id="admin-forgot-submit"
                            type="submit"
                            disabled={!isEmailValid || isSubmitting}
                            className={`w-full flex items-center justify-center gap-2 px-[16px] py-[10px] rounded-[20px] text-sm text-white tracking-[-0.266px] font-normal leading-[1.4] transition-all ${
                                isEmailValid && !isSubmitting
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
                            {isSubmitting ? "Sending..." : "Send Reset Link"}
                        </button>

                        <Link
                            href="/admin/login"
                            className="text-[#c3c3c3] text-sm hover:text-green transition-colors tracking-[-0.266px]"
                        >
                            Back to Sign In
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
}
