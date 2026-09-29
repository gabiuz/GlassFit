"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import {
  validateEmail,
  checkPasswordRequirements,
  validatePhoneNumber,
  formatPhoneNumber,
} from "../utils/auth-utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function RegisterForm() {
  const router = useRouter();

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Error & validation states
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const passwordReqs = checkPasswordRequirements(password);
  const isPasswordValid = passwordReqs.minLength && passwordReqs.hasNumber && passwordReqs.hasLetter;
  const isEmailValid = email !== "" && validateEmail(email);
  const isPhoneValid = phone !== "" && validatePhoneNumber(phone);
  const isFormValid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    isEmailValid &&
    isPhoneValid &&
    isPasswordValid;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
    if (phoneError) setPhoneError("");
  };


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setFirstNameError("");
    setLastNameError("");
    setEmailError("");
    setPhoneError("");
    setGeneralError("");

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.replace(/\D/g, "");

    let hasErrors = false;

    if (!normalizedFirstName) {
      setFirstNameError("First name is required.");
      hasErrors = true;
    } else if (normalizedFirstName.length < 2) {
      setFirstNameError("First name must contain at least 2 characters.");
      hasErrors = true;
    } else if (!/^[\p{L} .'-]+$/u.test(normalizedFirstName)) {
      setFirstNameError("First name contains invalid characters.");
      hasErrors = true;
    }

    if (!normalizedLastName) {
      setLastNameError("Last name is required.");
      hasErrors = true;
    } else if (normalizedLastName.length < 2) {
      setLastNameError("Last name must contain at least 2 characters.");
      hasErrors = true;
    } else if (!/^[\p{L} .'-]+$/u.test(normalizedLastName)) {
      setLastNameError("Last name contains invalid characters.");
      hasErrors = true;
    }

    if (!normalizedEmail) {
      setEmailError("Email address is required.");
      hasErrors = true;
    } else if (!validateEmail(normalizedEmail)) {
      setEmailError("Enter a valid email address.");
      hasErrors = true;
    }

    if (!normalizedPhone) {
      setPhoneError("Contact number is required.");
      hasErrors = true;
    } else if (!validatePhoneNumber(normalizedPhone)) {
      setPhoneError(
        "Enter a valid Philippine mobile number beginning with 9."
      );
      hasErrors = true;
    }

    if (!password) {
      setGeneralError("Password is required.");
      hasErrors = true;
    } else if (!isPasswordValid) {
      setGeneralError("Password does not meet all requirements.");
      hasErrors = true;
    }

    if (hasErrors) return;

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          // ?next=/ tells /auth/confirm where to redirect after email verification
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
          data: {
            first_name: normalizedFirstName,
            last_name: normalizedLastName,
            full_name: `${normalizedFirstName} ${normalizedLastName}`,
            phone: `+63${normalizedPhone}`,
          },
        },
      });

      if (error) {
        const message = error.message.toLowerCase();

        if (
          message.includes("already registered") ||
          message.includes("already exists")
        ) {
          setEmailError("An account with this email already exists.");
        } else if (message.includes("invalid email")) {
          setEmailError("Enter a valid email address.");
        } else if (
          message.includes("password") &&
          (message.includes("weak") || message.includes("least"))
        ) {
          setGeneralError(
            "The password is too weak. Use a stronger password."
          );
        } else if (
          message.includes("rate limit") ||
          message.includes("too many requests")
        ) {
          setGeneralError(
            "Too many registration attempts. Please wait and try again."
          );
        } else if (message.includes("signup is disabled")) {
          setGeneralError(
            "Account registration is temporarily unavailable."
          );
        } else {
          setGeneralError(
            "We could not create your account. Please try again."
          );
        }

        return;
      }

      if (!data.user) {
        setGeneralError(
          "Your account could not be created. Please try again."
        );
        return;
      }

      // If email confirmation is required (no immediate session), send to login
      // with a "check your inbox" message embedded in the URL.
      if (!data.session) {
        router.push(
          `/login?registered=1&email=${encodeURIComponent(normalizedEmail)}`
        );
        return;
      }

      // Auto-confirmed (e.g. email confirmation disabled in Supabase settings)
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Registration failed:", error);

      setGeneralError(
        navigator.onLine
          ? "Something went wrong while creating your account."
          : "You appear to be offline. Check your internet connection."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGeneralError("");
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
        const message = error.message.toLowerCase();

        if (
          message.includes("provider") &&
          message.includes("not enabled")
        ) {
          setGeneralError(
            "Google account registration is not available right now."
          );
        } else if (
          message.includes("rate limit") ||
          message.includes("too many requests")
        ) {
          setGeneralError(
            "Too many attempts. Please wait before trying again."
          );
        } else {
          setGeneralError(
            "We could not continue with Google. Please try again."
          );
        }

        setIsGoogleSubmitting(false);
      }
    } catch (error) {
      console.error("Google registration failed:", error);

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
      <div className="absolute inset-0 bg-grad-dark opacity-85 backdrop-blur-[2px] z-0"></div>

      {/* Register Glassmorphism Card */}
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

        {/* Heading & Subtitle */}
        <div className="flex flex-col gap-2 items-center w-full text-center">
          <h1 className="bg-grad-light bg-clip-text text-[32px] font-medium leading-1.2 tracking-[-0.608px] text-transparent uppercase">
            Create an account
          </h1>
          <p className="text-black text-base font-normal tracking-[-0.304px] leading-[1.4]">
            Create an account to send your booking consultation.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5 max-w-[633px]">
          {generalError && (
            <div className="bg-destructive/10 border border-destructive text-destructive text-sm rounded-lg p-3 text-center">
              {generalError}
            </div>
          )}

          {/* Name Fields (First & Last Name row) */}
          <div className="flex flex-col sm:flex-row gap-5 w-full">
            {/* First Name */}
            <div className="flex flex-col gap-1.25 flex-1 items-start">
              <label className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (firstNameError) setFirstNameError("");
                }}
                placeholder="Juan"
                className="w-full bg-white border border-[#c3c3c3] rounded-lg px-4 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                required
                autoComplete="given-name"
                maxLength={60}
                aria-invalid={Boolean(firstNameError)}
                aria-describedby={firstNameError ? "first-name-error" : undefined}
              />
              {firstNameError && (
                <span id="first-name-error" className="text-destructive text-xs mt-1">
                  {firstNameError}
                </span>
              )}
            </div>

            {/* Last Name */}
            <div className="flex flex-col gap-1.25 flex-1 items-start">
              <label className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (lastNameError) setLastNameError("");
                }}
                placeholder="Dela Cruz"
                className="w-full bg-white border border-[#c3c3c3] rounded-lg px-4 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                required
                autoComplete="family-name"
                maxLength={60}
                aria-invalid={Boolean(lastNameError)}
                aria-describedby={lastNameError ? "last-name-error" : undefined}
              />
              {lastNameError && (
                <span id="last-name-error" className="text-destructive text-xs mt-1">
                  {lastNameError}
                </span>
              )}
            </div>
          </div>

          {/* Email Address */}
          <div className="flex flex-col gap-1.25 w-full items-start">
            <label className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError("");
              }}
              onBlur={() => {
                const normalizedEmail = email.trim().toLowerCase();
                setEmail(normalizedEmail);

                if (normalizedEmail && !validateEmail(normalizedEmail)) {
                  setEmailError("Enter a valid email address.");
                }
              }}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              spellCheck={false}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "email-error" : undefined}
              className="w-full bg-white border border-[#c3c3c3] rounded-lg px-4 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
              required
            />
            {emailError && (
              <span id="email-error" className="text-destructive text-xs mt-1">
                {emailError}
              </span>
            )}
          </div>

          {/* Contact Number */}
          <div className="flex flex-col gap-1.25 w-full items-start">
            <label className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]">
              Contact Number
            </label>
            <div className="flex w-full border border-[#c3c3c3] rounded-lg overflow-hidden focus-within:border-green focus-within:ring-1 focus-within:ring-green transition-all bg-white">
              {/* Prefix Box */}
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
              {/* Input */}
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="9XX XXX XXXX"
                autoComplete="tel-national"
                inputMode="numeric"
                maxLength={12}
                aria-invalid={Boolean(phoneError)}
                aria-describedby={phoneError ? "phone-error" : undefined}
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
              Password
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
                aria-invalid={password !== "" && !isPasswordValid}
                aria-describedby="password-requirements"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-black hover:text-green focus:outline-none transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Password Validation Requirements */}
            <div id="password-requirements" className="mt-2 text-xs tracking-[-0.228px]">
              <ul className="list-disc flex flex-col gap-1">
                <li
                  className={`ms-[18px] transition-colors duration-200 ${password === ""
                    ? "text-[#c3c3c3]"
                    : passwordReqs.minLength
                      ? "text-green font-medium"
                      : "text-destructive"
                    }`}
                >
                  At least 8 characters
                </li>
                <li
                  className={`ms-[18px] transition-colors duration-200 ${password === ""
                    ? "text-[#c3c3c3]"
                    : passwordReqs.hasNumber
                      ? "text-green font-medium"
                      : "text-destructive"
                    }`}
                >
                  Include 1 number
                </li>
                <li
                  className={`ms-[18px] transition-colors duration-200 ${password === ""
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

          {/* Divider */}
          <div className="flex gap-[23px] items-center w-[399px] max-w-full mx-auto justify-center select-none py-1">
            <div className="bg-[#c3c3c3]/80 flex-1 h-[1px] border-0" />
            <span className="font-normal text-[#c3c3c3] text-base tracking-[-0.304px] leading-[1.4]">
              Or
            </span>
            <div className="bg-[#c3c3c3]/80 flex-1 h-[1px] border-0" />
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={isSubmitting || isGoogleSubmitting}
            aria-busy={isGoogleSubmitting}
            className={`border border-[#c3c3c3] bg-white transition-colors w-full flex items-center justify-center gap-4 py-2.5 px-5 rounded-[10px] ${isSubmitting || isGoogleSubmitting
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:bg-neutral-50 active:bg-neutral-100"
              }`}
          >
            <span className="font-normal text-[14px] text-[#19181f] tracking-[-0.266px] leading-[1.4]">
              {isGoogleSubmitting
                ? "Connecting to Google..."
                : "Create account with Google"}
            </span>

            <div className="relative w-[23px] h-[23px]">
              <Image
                src="/google_icon.svg"
                alt=""
                aria-hidden="true"
                fill
                className="object-contain"
              />
            </div>
          </button>

          {/* Sign Up Submit Button & Log In Link */}
          <div className="flex flex-col gap-6 items-center w-full mt-2">
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className={`w-full flex items-center justify-center px-[16px] py-[10px] rounded-[20px] text-sm text-white tracking-[-0.266px] font-normal leading-[1.4] transition-all ${isFormValid && !isSubmitting
                ? "bg-[#07b6d3] cursor-pointer hover:bg-[#06a4be] active:translate-y-px"
                : "bg-[#c3c3c3] pointer-events-none"
                }`}
            >
              {isSubmitting ? "Signing Up..." : "Sign Up"}
            </button>

            <div className="flex gap-2 items-center text-base tracking-[-0.304px] leading-[1.4]">
              <span className="text-[#c3c3c3]">Already have an account?</span>
              <Link
                href="/login"
                className="text-green hover:underline font-medium transition-all"
              >
                Log In
              </Link>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
