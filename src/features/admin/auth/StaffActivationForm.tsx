"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ShieldAlert, CheckCircle2 } from "lucide-react";
import {
    checkPasswordRequirements,
    validatePhoneNumber,
    formatPhoneNumber,
} from "@/features/auth/utils/auth-utils";
import {
    verifyStaffInviteToken,
    completeStaffRegistration,
} from "@/app/admin/(auth)/invite/actions";

export function StaffActivationForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token") ?? "";

    // Verification states
    const [isVerifyingToken, setIsVerifyingToken] = useState<boolean>(() => Boolean(token));
    const [tokenError, setTokenError] = useState<string | null>(() =>
        !token ? "Missing invitation token. Please use the complete activation link from your email." : null
    );
    const [email, setEmail] = useState("");
    const [roleName, setRoleName] = useState("Staff");

    // Form inputs
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Validation & submission states
    const [codeError, setCodeError] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [generalError, setGeneralError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isActivated, setIsActivated] = useState(false);

    useEffect(() => {
        if (!token) return;

        let isMounted = true;
        verifyStaffInviteToken(token)
            .then((res) => {
                if (!isMounted) return;
                if (!res.success) {
                    setTokenError(res.error);
                } else {
                    setEmail(res.email);
                    setRoleName(res.roleName);
                }
            })
            .catch(() => {
                if (!isMounted) return;
                setTokenError("Unable to verify invitation link. Please check your internet connection.");
            })
            .finally(() => {
                if (isMounted) {
                    setIsVerifyingToken(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [token]);

    const passwordReqs = checkPasswordRequirements(password);
    const isPasswordValid =
        passwordReqs.minLength && passwordReqs.hasNumber && passwordReqs.hasLetter;
    const isPhoneValid = phone !== "" && validatePhoneNumber(phone);
    const isCodeValid = verificationCode.trim().length === 6;
    const passwordsMatch = password === confirmPassword && confirmPassword !== "";

    const isFormValid = isCodeValid && isPhoneValid && isPasswordValid && passwordsMatch;

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        setPhone(formatted);
        if (phoneError) setPhoneError("");
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setCodeError("");
        setPhoneError("");
        setGeneralError("");

        const trimmedCode = verificationCode.trim();
        const rawDigits = phone.replace(/\D/g, "");
        const cleanPhone = rawDigits.startsWith("63") ? rawDigits.slice(2) : rawDigits;

        let hasErrors = false;

        if (!trimmedCode || trimmedCode.length !== 6) {
            setCodeError("Enter the 6-digit numeric verification code.");
            hasErrors = true;
        }

        if (!cleanPhone || !validatePhoneNumber(cleanPhone)) {
            setPhoneError("Enter a valid Philippine mobile number beginning with 9.");
            hasErrors = true;
        }

        if (!password) {
            setGeneralError("Password is required.");
            hasErrors = true;
        } else if (!isPasswordValid) {
            setGeneralError("Password does not meet all complexity requirements.");
            hasErrors = true;
        } else if (!passwordsMatch) {
            setGeneralError("Passwords do not match.");
            hasErrors = true;
        }

        if (hasErrors) return;

        setIsSubmitting(true);

        try {
            const result = await completeStaffRegistration({
                token,
                verificationCode: trimmedCode,
                phone: cleanPhone,
                password,
                firstName: firstName.trim() || undefined,
                lastName: lastName.trim() || undefined,
            });

            if (!result.success) {
                setGeneralError(result.error);
                return;
            }

            setIsActivated(true);
            setTimeout(() => {
                router.push("/admin/login?activated=1");
            }, 2500);
        } catch {
            setGeneralError(
                navigator.onLine
                    ? "Failed to activate staff account. Please try again."
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

            {/* Main Center Card */}
            <div className="relative z-10 w-full max-w-[777px] mx-4 bg-white/95 backdrop-blur-md border border-[#c3c3c3] rounded-[20px] px-8 sm:px-[72px] py-12 flex flex-col gap-6 items-center justify-center shadow-[0px_4px_30px_0px_rgba(4,94,109,0.25)] select-none">
                {/* Logo */}
                <div className="relative h-[99px] w-[232px] flex items-center justify-center mb-1">
                    <Image
                        src="/Logo.svg"
                        alt="GlassFit Logo"
                        fill
                        priority
                        className="object-contain pointer-events-none"
                    />
                </div>

                {isVerifyingToken ? (
                    <div className="flex flex-col items-center gap-4 py-12">
                        <svg className="animate-spin h-8 w-8 text-[#07b6d3]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <p className="text-sm text-[#475569]">Verifying invitation credentials...</p>
                    </div>
                ) : tokenError ? (
                    <div className="flex flex-col items-center gap-5 text-center max-w-[500px] py-6">
                        <div className="p-3 rounded-full bg-red-100 text-red-600">
                            <ShieldAlert className="w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-medium text-[#0f1422]">
                            Invalid Invitation Link
                        </h1>
                        <p className="text-sm text-[#64748b] leading-relaxed">
                            {tokenError}
                        </p>
                        <Link
                            href="/admin/login"
                            className="mt-2 px-6 py-2.5 rounded-[20px] bg-[#07b6d3] text-white text-sm font-medium hover:bg-[#06a4be] transition-colors"
                        >
                            Return to Admin Login
                        </Link>
                    </div>
                ) : isActivated ? (
                    <div className="flex flex-col items-center gap-5 text-center max-w-[500px] py-6">
                        <div className="p-3 rounded-full bg-emerald-100 text-emerald-600">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-medium text-[#0f1422]">
                            Account Activated Successfully!
                        </h1>
                        <p className="text-sm text-[#64748b] leading-relaxed">
                            Your Staff account credentials have been verified. Redirecting you to the back-office login portal...
                        </p>
                        <Link
                            href="/admin/login?activated=1"
                            className="mt-2 px-6 py-2.5 rounded-[20px] bg-[#07b6d3] text-white text-sm font-medium hover:bg-[#06a4be] transition-colors"
                        >
                            Proceed to Login
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Heading & Subtitle */}
                        <div className="flex flex-col gap-2 items-center w-full text-center">
                            <h1 className="bg-grad-light bg-clip-text text-[32px] font-medium leading-1.2 tracking-[-0.608px] text-transparent uppercase">
                                Activate Staff Account
                            </h1>
                            <p className="text-black text-base font-normal tracking-[-0.304px] leading-[1.4]">
                                Complete your registration to access the GlassFit back-office workbench.
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5 max-w-[633px]">
                            {generalError && (
                                <div className="bg-destructive/10 border border-destructive text-destructive text-sm rounded-lg p-3 text-center">
                                    {generalError}
                                </div>
                            )}

                            {/* Email Pill (Read-only) */}
                            <div className="flex flex-col gap-1.25 w-full items-start">
                                <label className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]">
                                    Invited Email Address
                                </label>
                                <div className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-4 py-3 text-sm font-medium text-[#334155] select-text">
                                    {email} ({roleName})
                                </div>
                            </div>

                            {/* Verification Code */}
                            <div className="flex flex-col gap-1.25 w-full items-start">
                                <label className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]">
                                    6-Digit Admin Verification Code *
                                </label>
                                <input
                                    type="text"
                                    value={verificationCode}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                                        setVerificationCode(val);
                                        if (codeError) setCodeError("");
                                    }}
                                    placeholder="123456"
                                    inputMode="numeric"
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                    className="w-full bg-white border border-[#c3c3c3] rounded-lg px-4 py-3 text-xl font-mono tracking-[0.3em] text-center text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                                    required
                                />
                                <span className="text-xs text-[#64748b]">
                                    Enter the 6-digit code provided to you by your administrator.
                                </span>
                                {codeError && (
                                    <span className="text-destructive text-xs mt-1">{codeError}</span>
                                )}
                            </div>

                            {/* Name Row (Optional) */}
                            <div className="flex flex-col sm:flex-row gap-5 w-full">
                                <div className="flex flex-col gap-1.25 flex-1 items-start">
                                    <label className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]">
                                        First Name
                                    </label>
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="Juan"
                                        className="w-full bg-white border border-[#c3c3c3] rounded-lg px-4 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                                        autoComplete="given-name"
                                        maxLength={60}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.25 flex-1 items-start">
                                    <label className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]">
                                        Last Name
                                    </label>
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Dela Cruz"
                                        className="w-full bg-white border border-[#c3c3c3] rounded-lg px-4 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                                        autoComplete="family-name"
                                        maxLength={60}
                                    />
                                </div>
                            </div>

                            {/* Contact Number */}
                            <div className="flex flex-col gap-1.25 w-full items-start">
                                <label className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]">
                                    Contact Number *
                                </label>
                                <div className="flex w-full border border-[#c3c3c3] rounded-lg overflow-hidden focus-within:border-green focus-within:ring-1 focus-within:ring-green transition-all bg-white">
                                    <div className="bg-white border-r border-[#c3c3c3] px-3.5 flex items-center gap-2 select-none shrink-0 text-sm font-normal text-[#323639]">
                                        <Image
                                            src="/auth/ph.svg"
                                            alt="PH Flag"
                                            width={16}
                                            height={16}
                                            className="object-contain"
                                        />
                                        <span className="text-sm font-normal tracking-[-0.266px]">PH (+63)</span>
                                    </div>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={handlePhoneChange}
                                        placeholder="9XX XXX XXXX"
                                        autoComplete="tel-national"
                                        inputMode="numeric"
                                        maxLength={12}
                                        className="flex-1 bg-transparent px-4 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3]"
                                        required
                                    />
                                </div>
                                {phoneError && (
                                    <span className="text-destructive text-xs mt-1">{phoneError}</span>
                                )}
                            </div>

                            {/* Password */}
                            <div className="flex flex-col gap-1.25 w-full items-start">
                                <label className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]">
                                    Set Password *
                                </label>
                                <div className="w-full relative flex items-center">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Create strong password"
                                        className="w-full bg-white border border-[#c3c3c3] rounded-lg pl-4 pr-12 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                                        required
                                        autoComplete="new-password"
                                        minLength={8}
                                        maxLength={72}
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

                                {/* Password Validation Requirements Checklist */}
                                <div className="mt-2 text-xs tracking-[-0.228px]">
                                    <ul className="list-disc flex flex-col gap-1">
                                        <li
                                            className={`ms-[18px] transition-colors duration-200 ${
                                                password === ""
                                                    ? "text-[#c3c3c3]"
                                                    : passwordReqs.minLength
                                                    ? "text-green font-medium"
                                                    : "text-destructive"
                                            }`}
                                        >
                                            At least 8 characters
                                        </li>
                                        <li
                                            className={`ms-[18px] transition-colors duration-200 ${
                                                password === ""
                                                    ? "text-[#c3c3c3]"
                                                    : passwordReqs.hasNumber
                                                    ? "text-green font-medium"
                                                    : "text-destructive"
                                            }`}
                                        >
                                            Include 1 number
                                        </li>
                                        <li
                                            className={`ms-[18px] transition-colors duration-200 ${
                                                password === ""
                                                    ? "text-[#c3c3c3]"
                                                    : passwordReqs.hasLetter
                                                    ? "text-green font-medium"
                                                    : "text-destructive"
                                            }`}
                                        >
                                            Include 1 letter
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div className="flex flex-col gap-1.25 w-full items-start">
                                <label className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]">
                                    Confirm Password *
                                </label>
                                <div className="w-full relative flex items-center">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm your password"
                                        className="w-full bg-white border border-[#c3c3c3] rounded-lg pl-4 pr-12 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                                        required
                                        autoComplete="new-password"
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
                                    <span className="text-destructive text-xs mt-1">Passwords do not match.</span>
                                )}
                            </div>

                            {/* Submit Button */}
                            <div className="flex flex-col gap-6 items-center w-full mt-2">
                                <button
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
                                    {isSubmitting ? "Activating Account..." : "Activate Account"}
                                </button>

                                <div className="flex gap-2 items-center text-base tracking-[-0.304px] leading-[1.4]">
                                    <span className="text-[#c3c3c3]">Already activated?</span>
                                    <Link
                                        href="/admin/login"
                                        className="text-green hover:underline font-medium transition-all"
                                    >
                                        Log In
                                    </Link>
                                </div>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </main>
    );
}
