"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Button from "@/components/shared/Button";
import {
  validateEmail,
  checkPasswordRequirements,
  validatePhoneNumber,
  formatPhoneNumber,
} from "../utils/auth-utils";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFirstNameError("");
    setLastNameError("");
    setEmailError("");
    setPhoneError("");
    setGeneralError("");

    let hasErrors = false;

    if (firstName.trim() === "") {
      setFirstNameError("First name is required.");
      hasErrors = true;
    }

    if (lastName.trim() === "") {
      setLastNameError("Last name is required.");
      hasErrors = true;
    }

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      hasErrors = true;
    }

    if (!validatePhoneNumber(phone)) {
      setPhoneError("Phone number must be 10 digits starting with 9 (e.g. 917 123 4567).");
      hasErrors = true;
    }

    if (!isPasswordValid) {
      setGeneralError("Password does not meet all requirements.");
      hasErrors = true;
    }

    if (hasErrors) return;

    setIsSubmitting(true);

    // Simulate API registration request
    setTimeout(() => {
      setIsSubmitting(false);
      alert("Successfully created account!");
      router.push("/login");
    }, 1500);
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
              />
              {firstNameError && (
                <span className="text-destructive text-xs mt-1">{firstNameError}</span>
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
              />
              {lastNameError && (
                <span className="text-destructive text-xs mt-1">{lastNameError}</span>
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
              placeholder="you@example.com"
              className="w-full bg-white border border-[#c3c3c3] rounded-lg px-4 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
              required
            />
            {emailError && (
              <span className="text-destructive text-xs mt-1">{emailError}</span>
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
            className="border border-[#c3c3c3] bg-white hover:bg-neutral-50 active:bg-neutral-100 transition-colors w-full flex items-center justify-center gap-4 py-2.5 px-5 rounded-[10px] cursor-pointer"
            onClick={() => alert("Google authentication is not configured yet.")}
          >
            <span className="font-normal text-[14px] text-[#19181f] tracking-[-0.266px] leading-[1.4]">
              Create account with Google
            </span>
            <div className="relative w-[23px] h-[23px]">
              <Image
                src="/google_icon.svg"
                alt="Google Logo"
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
              className={`w-full flex items-center justify-center px-[16px] py-[10px] rounded-[20px] text-sm text-white tracking-[-0.266px] font-normal leading-[1.4] transition-all ${
                isFormValid && !isSubmitting
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
