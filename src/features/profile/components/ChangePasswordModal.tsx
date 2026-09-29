"use client";

import React, { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface ChangePasswordModalProps {
  isOpen: boolean;
  userEmail: string;
  onClose: () => void;
}

export function ChangePasswordModal({
  isOpen,
  userEmail,
  onClose,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Dismiss on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // Validate current password provided
    if (!currentPassword) {
      setErrorMessage("Please enter your current password.");
      return;
    }

    // Validate new password rules: 8+ characters with uppercase, lowercase, and a number
    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }

    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasUpper || !hasLower || !hasNumber) {
      setErrorMessage(
        "New password must contain uppercase, lowercase, and a number."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage("New password must be different from current password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      // Verify current password by attempting a signIn
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (verifyError) {
        setErrorMessage("Current password is incorrect.");
        setIsSubmitting(false);
        return;
      }

      // Update password via Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setSuccessMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        onClose();
        setSuccessMessage("");
      }, 1400);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to update password. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      {/* Modal Card - Figma node 1375:8063 */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-white rounded-[20px] p-[24px] sm:p-[30px] max-w-[620px] w-full shadow-2xl flex flex-col gap-[20px]"
      >
        {/* Header - Figma node 1375:8064 */}
        <div className="flex items-start justify-between w-full">
          <div className="flex flex-col gap-[5px] items-start">
            <h3 className="text-[#07b6d3] text-[24px] font-medium tracking-[-0.456px] leading-[1.2]">
              Change Password
            </h3>
            <p className="text-black text-[15px] sm:text-[16px] tracking-[-0.304px] leading-[1.4]">
              Change your password to keep your account secure
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 cursor-pointer text-lg leading-none"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="p-3 text-sm text-green-800 bg-green-50 rounded-lg border border-green-200">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-[16px] w-full">
          {/* Current Password Row - Figma node 1375:8068 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 w-full">
            <label className="text-[#0f1422] text-[15px] sm:text-[16px] font-medium tracking-[-0.304px] sm:w-[150px] shrink-0">
              Current Password
            </label>
            <div className="border border-[#c3c3c3] rounded-[8px] px-[16px] py-[10px] sm:py-[12px] flex items-center justify-between flex-1 bg-white focus-within:border-[#07b6d3] transition-colors">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full text-[14px] text-[#0f1422] placeholder:text-[#c3c3c3] tracking-[-0.266px] focus:outline-none bg-transparent"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="text-[#0f1422] hover:text-[#07b6d3] transition-colors p-0.5 ml-2 cursor-pointer focus:outline-none"
                aria-label={showCurrentPassword ? "Hide password" : "Show password"}
              >
                {showCurrentPassword ? (
                  <EyeOff className="size-[20px]" />
                ) : (
                  <Eye className="size-[20px]" />
                )}
              </button>
            </div>
          </div>

          {/* New Password Row - Figma node 1375:8076 */}
          <div className="flex flex-col gap-[6px] w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 w-full">
              <label className="text-[#0f1422] text-[15px] sm:text-[16px] font-medium tracking-[-0.304px] sm:w-[150px] shrink-0">
                New Password
              </label>
              <div className="border border-[#c3c3c3] rounded-[8px] px-[16px] py-[10px] sm:py-[12px] flex items-center justify-between flex-1 bg-white focus-within:border-[#07b6d3] transition-colors">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  className="w-full text-[14px] text-[#0f1422] placeholder:text-[#c3c3c3] tracking-[-0.266px] focus:outline-none bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="text-[#0f1422] hover:text-[#07b6d3] transition-colors p-0.5 ml-2 cursor-pointer focus:outline-none"
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? (
                    <EyeOff className="size-[20px]" />
                  ) : (
                    <Eye className="size-[20px]" />
                  )}
                </button>
              </div>
            </div>
            {/* Helper Text - Figma node 1375:8085 */}
            <div className="sm:pl-[166px] w-full">
              <p className="text-[#c3c3c3] text-[12px] tracking-[-0.228px] leading-[1.4]">
                8+ characters with uppercase, lowercase, and a number.
              </p>
            </div>
          </div>

          {/* Confirm Password Row - Figma node 1375:8087 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 w-full">
            <label className="text-[#0f1422] text-[15px] sm:text-[16px] font-medium tracking-[-0.304px] sm:w-[150px] shrink-0">
              Confirm Password
            </label>
            <div className="border border-[#c3c3c3] rounded-[8px] px-[16px] py-[10px] sm:py-[12px] flex items-center justify-between flex-1 bg-white focus-within:border-[#07b6d3] transition-colors">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                className="w-full text-[14px] text-[#0f1422] placeholder:text-[#c3c3c3] tracking-[-0.266px] focus:outline-none bg-transparent"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-[#0f1422] hover:text-[#07b6d3] transition-colors p-0.5 ml-2 cursor-pointer focus:outline-none"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-[20px]" />
                ) : (
                  <Eye className="size-[20px]" />
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons - Figma node 1375:8107 */}
          <div className="flex gap-[10px] items-center justify-end pt-2 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="bg-[#c3c3c3] hover:bg-[#b5b5b5] transition-colors text-[#0f1422] text-[14px] tracking-[-0.266px] px-[16px] py-[6px] rounded-[10px] cursor-pointer disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#07b6d3] hover:bg-[#07b6d3]/85 transition-colors text-white text-[14px] tracking-[-0.266px] px-[15px] py-[6px] rounded-[10px] cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
