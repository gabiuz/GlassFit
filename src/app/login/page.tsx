"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Button from "@/components/shared/Button";
import {
  validateEmail,
  checkPasswordRequirements,
} from "@/lib/auth-utils";

export default function LogInPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Validation states
  const [emailError, setEmailError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordReqs = checkPasswordRequirements(password);
  const isPasswordValid = passwordReqs.minLength && passwordReqs.hasNumber && passwordReqs.hasLetter;
  const isEmailValid = email !== "" && validateEmail(email);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) {
      setEmailError("");
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    if (!isPasswordValid) {
      setGeneralError("Password does not meet all requirements.");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API Auth Request
    setTimeout(() => {
      setIsSubmitting(false);
      alert("Successfully logged in!");
      router.push("/");
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

      {/* Login Glassmorphism Card */}
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
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6.25 max-w-[633px]">
          {generalError && (
            <div className="bg-destructive/10 border border-destructive text-destructive text-sm rounded-lg p-3 text-center">
              {generalError}
            </div>
          )}

          {/* Email Address */}
          <div className="flex flex-col gap-1.25 w-full items-start">
            <label className="text-green text-base font-normal leading-[1.4] tracking-[-0.304px]">
              Email Address
            </label>
            <div className="w-full relative">
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="you@example.com"
                className="w-full bg-white border border-[#c3c3c3] rounded-lg px-4 py-3 text-sm font-normal text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                required
              />
            </div>
            {emailError && (
              <span className="text-destructive text-xs mt-1">{emailError}</span>
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
                onChange={handlePasswordChange}
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
              Log In with Google
            </span>
            <div className="relative w-[21px] h-[21px]">
              <Image
                src="/google_icon.svg"
                alt="Google Logo"
                fill
                className="object-contain"
              />
            </div>
          </button>

          {/* Log In Submit Button & Sign Up Link */}
          <div className="flex flex-col gap-6 items-center w-full mt-2">
            <button
              type="submit"
              disabled={!isEmailValid || !isPasswordValid || isSubmitting}
              className={`w-full flex items-center justify-center px-[16px] py-[10px] rounded-[20px] text-sm text-white tracking-[-0.266px] font-normal leading-[1.4] transition-all ${
                isEmailValid && isPasswordValid && !isSubmitting
                  ? "bg-[#07b6d3] cursor-pointer hover:bg-[#06a4be] active:translate-y-px"
                  : "bg-[#c3c3c3] pointer-events-none"
              }`}
            >
              {isSubmitting ? "Logging In..." : "Log In"}
            </button>

            <div className="flex gap-2 items-center text-base tracking-[-0.304px] leading-[1.4]">
              <span className="text-[#c3c3c3]">Don’t have an account?</span>
              <Link
                href="/register"
                className="text-green hover:underline font-medium transition-all"
              >
                Register here
              </Link>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
