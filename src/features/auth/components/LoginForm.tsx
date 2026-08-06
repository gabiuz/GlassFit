"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { validateEmail, checkPasswordRequirements } from "../utils/auth-utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Rich error content keyed by the `?error=` URL param. */
const ERROR_NODES: Record<string, React.ReactNode> = {
  missing_confirmation_code: (
    <>
      This confirmation link is invalid or has already expired.{" "}
      <Link href="/register" className="underline font-medium hover:opacity-80">
        Create a new account
      </Link>{" "}
      to receive a fresh link.
    </>
  ),
  confirmation_failed: (
    <>Email confirmation failed. Please try registering again or contact support.</>
  ),
  invalid_credentials: (
    <>The email or password you entered is incorrect.</>
  ),
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorNode, setErrorNode] = useState<React.ReactNode>(null);

  // Read status messages forwarded from auth/confirm or the register form
  useEffect(() => {
    const errorCode = searchParams.get("error");
    const confirmed = searchParams.get("confirmed");
    const registered = searchParams.get("registered");
    const registeredEmail = searchParams.get("email");

    if (errorCode && ERROR_NODES[errorCode]) {
      setErrorNode(ERROR_NODES[errorCode]);
    }

    if (confirmed === "1") {
      setSuccessMessage("Your email has been confirmed! You can now log in.");
    }

    if (registered === "1") {
      const emailHint = registeredEmail ? ` to ${registeredEmail}` : "";
      setSuccessMessage(
        `We sent a confirmation link${emailHint}. Please check your inbox and click the link to activate your account.`
      );
    }
  }, [searchParams]);

  const passwordReqs = checkPasswordRequirements(password);
  const isPasswordValid =
    passwordReqs.minLength && passwordReqs.hasNumber && passwordReqs.hasLetter;
  const isEmailValid = email !== "" && validateEmail(email);
  const isFormValid = isEmailValid && password !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");
    setSuccessMessage("");

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
          setGeneralError("The email or password you entered is incorrect.");
        } else if (msg.includes("rate limit") || msg.includes("too many requests")) {
          setGeneralError("Too many login attempts. Please wait before trying again.");
        } else if (msg.includes("email not confirmed")) {
          setGeneralError(
            "Please confirm your email address before logging in. Check your inbox."
          );
        } else {
          setGeneralError("Login failed. Please try again.");
        }
        return;
      }

      if (!data.session) {
        setGeneralError("Login failed. Please try again.");
        return;
      }

      // Redirect to the page they came from, or home
      const next = searchParams.get("next") ?? "/";
      router.push(next);
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

  const handleGoogleLogin = async () => {
    setGeneralError("");
    setErrorNode(null);
    setIsGoogleSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/confirm?next=/&type=oauth`,
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();

        if (msg.includes("provider") && msg.includes("not enabled")) {
          setGeneralError("Google login is not available right now.");
        } else if (msg.includes("rate limit") || msg.includes("too many requests")) {
          setGeneralError("Too many attempts. Please wait before trying again.");
        } else {
          setGeneralError("We could not continue with Google. Please try again.");
        }

        setIsGoogleSubmitting(false);
      }
      // On success Supabase redirects the browser — no further action needed here.
    } catch {
      setGeneralError(
        navigator.onLine
          ? "Something went wrong while connecting to Google."
          : "You appear to be offline. Check your internet connection."
      );
      setIsGoogleSubmitting(false);
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

        {/* Heading & Subtitle */}
        <div className="flex flex-col gap-2.5 items-center w-full text-center">
          <h1 className="bg-grad-light bg-clip-text text-[32px] font-medium leading-1.2 tracking-[-0.608px] text-transparent uppercase">
            Welcome back!
          </h1>
          <p className="text-black text-base font-normal tracking-[-0.304px] leading-[1.4]">
            Log in to continue your booking
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="w-full flex flex-col gap-6.25 max-w-[633px]">

          {/* Success banner */}
          {successMessage && (
            <div className="bg-green/10 border border-green text-green text-sm rounded-lg p-3 text-center">
              {successMessage}
            </div>
          )}

          {/* Error banner — generalError for runtime errors, errorNode for URL-param errors */}
          {(generalError || errorNode) && (
            <div
              role="alert"
              className="bg-red-50 border border-red-300 text-red-700 text-sm rounded-lg p-3 text-center leading-relaxed"
            >
              {generalError || errorNode}
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col gap-1.25 w-full items-start">
            <label htmlFor="login-email" className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError("");
                if (generalError) setGeneralError("");
              }}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              className="w-full bg-white border border-[#c3c3c3] rounded-lg px-4 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
              required
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "login-email-error" : undefined}
            />
            {emailError && (
              <span id="login-email-error" className="text-red-600 text-xs mt-1">
                {emailError}
              </span>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.25 w-full items-start">
            <div className="flex justify-between items-center w-full">
              <label htmlFor="login-password" className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]">
                Password
              </label>
            </div>
            <div className="w-full relative flex items-center">
              <input
                id="login-password"
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
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-black hover:text-green focus:outline-none transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Password requirements (only shown if there's input) */}
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

          {/* Divider */}
          <div className="flex gap-[23px] items-center w-[399px] max-w-full mx-auto justify-center select-none py-1">
            <div className="bg-[#c3c3c3]/80 flex-1 h-[1px] border-0" />
            <span className="font-normal text-[#c3c3c3] text-base tracking-[-0.304px] leading-[1.4]">Or</span>
            <div className="bg-[#c3c3c3]/80 flex-1 h-[1px] border-0" />
          </div>

          {/* Google Login */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSubmitting || isGoogleSubmitting}
            aria-busy={isGoogleSubmitting}
            className={`border border-[#c3c3c3] bg-white transition-colors w-full flex items-center justify-center gap-3 py-2.5 px-5 rounded-[10px] ${
              isSubmitting || isGoogleSubmitting
                ? "opacity-60 cursor-not-allowed"
                : "hover:bg-neutral-50 active:bg-neutral-100 cursor-pointer"
            }`}
          >
            {isGoogleSubmitting ? (
              <svg className="animate-spin h-[21px] w-[21px] text-[#c3c3c3]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <div className="relative w-[21px] h-[21px] shrink-0">
                <Image src="/google_icon.svg" alt="" aria-hidden="true" fill className="object-contain" />
              </div>
            )}
            <span className="font-normal text-[14px] text-[#19181f] tracking-[-0.266px] leading-[1.4]">
              {isGoogleSubmitting ? "Connecting to Google..." : "Log In with Google"}
            </span>
          </button>

          {/* Submit */}
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
              {isSubmitting ? "Logging In..." : "Log In"}
            </button>

            <div className="flex gap-2 items-center text-base tracking-[-0.304px] leading-[1.4]">
              <span className="text-[#c3c3c3]">Don&apos;t have an account?</span>
              <Link href="/register" className="text-green hover:underline font-medium transition-all">
                Register here
              </Link>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
