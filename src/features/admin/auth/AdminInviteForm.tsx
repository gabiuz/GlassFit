"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { checkPasswordRequirements } from "@/features/auth/utils/auth-utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminInviteForm() {
    const router = useRouter();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [generalError, setGeneralError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const passwordReqs = checkPasswordRequirements(password);
    const isPasswordValid =
        passwordReqs.minLength && passwordReqs.hasNumber && passwordReqs.hasLetter;
    const passwordsMatch = password === confirmPassword && confirmPassword !== "";
    const isFormValid = isPasswordValid && passwordsMatch;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setGeneralError("");

        if (!isPasswordValid) {
            setGeneralError("Password does not meet the requirements.");
            return;
        }

        if (!passwordsMatch) {
            setGeneralError("Passwords do not match.");
            return;
        }

        setIsSubmitting(true);

        try {
            const supabase = createSupabaseBrowserClient();

            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                setGeneralError("Failed to activate account. The invitation link may have expired.");
                return;
            }

            // Verify the account is a valid active Admin
            const response = await fetch("/admin/auth/check", { method: "POST" });
            const result = await response.json() as { ok: boolean; reason?: string };

            if (!result.ok) {
                await supabase.auth.signOut();
                const reason = result.reason ?? "unauthorized";
                router.push(`/admin/login?error=${reason}`);
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
                        Set Your Password
                    </h1>
                    <p className="text-black text-base font-normal tracking-[-0.304px] leading-[1.4]">
                        Activate your Admin account by setting a password
                    </p>
                </div>

                <form
                    id="admin-invite-form"
                    onSubmit={handleSubmit}
                    noValidate
                    className="w-full flex flex-col gap-6.25 max-w-[633px]"
                >
                    {generalError && (
                        <div
                            role="alert"
                            className="bg-red-50 border border-red-300 text-red-700 text-sm rounded-lg p-3 text-center leading-relaxed"
                        >
                            {generalError}
                        </div>
                    )}

                    {/* New Password */}
                    <div className="flex flex-col gap-1.25 w-full items-start">
                        <label
                            htmlFor="admin-invite-password"
                            className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]"
                        >
                            New Password
                        </label>
                        <div className="w-full relative flex items-center">
                            <input
                                id="admin-invite-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (generalError) setGeneralError("");
                                }}
                                placeholder="Enter your password"
                                autoComplete="new-password"
                                className="w-full bg-white border border-[#c3c3c3] rounded-lg pl-4 pr-12 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 text-black hover:text-green focus:outline-none transition-colors"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>

                        {password !== "" && (
                            <div className="mt-2 text-xs tracking-[-0.228px]">
                                <ul className="list-disc flex flex-col gap-1">
                                    {[
                                        { met: passwordReqs.minLength, label: "At least 8 characters" },
                                        { met: passwordReqs.hasNumber, label: "Include 1 number" },
                                        { met: passwordReqs.hasLetter, label: "Include 1 letter" },
                                    ].map(({ met, label }) => (
                                        <li
                                            key={label}
                                            className={`ms-[18px] transition-colors duration-200 ${
                                                met ? "text-green font-medium" : "text-red-500"
                                            }`}
                                        >
                                            {label}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div className="flex flex-col gap-1.25 w-full items-start">
                        <label
                            htmlFor="admin-invite-confirm-password"
                            className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]"
                        >
                            Confirm Password
                        </label>
                        <div className="w-full relative flex items-center">
                            <input
                                id="admin-invite-confirm-password"
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    if (generalError) setGeneralError("");
                                }}
                                placeholder="Confirm your password"
                                autoComplete="new-password"
                                className="w-full bg-white border border-[#c3c3c3] rounded-lg pl-4 pr-12 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-4 text-black hover:text-green focus:outline-none transition-colors"
                                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {confirmPassword !== "" && !passwordsMatch && (
                            <span className="text-red-600 text-xs mt-1">Passwords do not match.</span>
                        )}
                    </div>

                    <div className="flex flex-col gap-4 items-center w-full mt-2">
                        <button
                            id="admin-invite-submit"
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
                            {isSubmitting ? "Activating..." : "Activate Account"}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}
