"use client";

import React, { useState } from "react";
import type { UserProfileData } from "../types";
import { ChangePasswordModal } from "./ChangePasswordModal";

interface AccountSecurityCardProps {
  profile: UserProfileData;
}

export function AccountSecurityCard({ profile }: AccountSecurityCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatMemberSince = (isoDateString: string) => {
    try {
      const date = new Date(isoDateString);
      if (isNaN(date.getTime())) return "June 2026";
      return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    } catch {
      return "June 2026";
    }
  };

  const memberSince = formatMemberSince(profile.createdAt);

  return (
    <div className="bg-white border border-[#c3c3c3] shadow-[0px_0px_2.5px_rgba(0,0,0,0.25)] flex flex-col gap-6 p-6 sm:p-8 rounded-[20px] w-full">
      {/* Header */}
      <div className="flex flex-col gap-1 items-start w-full">
        <h2 className="text-[#07b6d3] text-2xl sm:text-[28px] lg:text-[30px] font-medium tracking-tight leading-tight">
          Account Security
        </h2>
        <p className="text-black/70 text-sm sm:text-[15px] tracking-tight leading-snug">
          Keep your account secure by using a strong password
        </p>
      </div>

      {/* Security Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8 lg:gap-x-14 w-full">
        {/* Email Verification */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-start gap-1.5 sm:gap-6 w-full">
          <span className="text-[#0f1422] text-sm sm:text-[15px] font-medium tracking-tight sm:w-[150px] shrink-0">
            Email Verification
          </span>
          <div className="flex items-center">
            <span className="bg-[#05b64b] text-white text-[12px] px-3.5 py-1 rounded-[20px] font-medium tracking-tight whitespace-nowrap">
              {profile.emailVerified ? "Verified" : "Verified"}
            </span>
          </div>
        </div>

        {/* Last Password Change */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 w-full">
          <span className="text-[#0f1422] text-sm sm:text-[15px] font-medium tracking-tight sm:w-[150px] shrink-0">
            Last Password Change
          </span>
          <div className="flex items-center flex-1">
            <span className="text-[#c3c3c3] text-sm sm:text-[15px] tracking-tight">
              Member since {memberSince}
            </span>
          </div>
        </div>

        {/* Active Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-start gap-1.5 sm:gap-6 w-full">
          <span className="text-[#0f1422] text-sm sm:text-[15px] font-medium tracking-tight sm:w-[150px] shrink-0">
            Active Status
          </span>
          <div className="flex items-center">
            <span className="bg-[#05b64b] text-white text-[12px] px-3.5 py-1 rounded-[20px] font-medium tracking-tight whitespace-nowrap">
              {profile.status || "Active"}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Action: Change Password Button */}
      <div className="flex justify-end pt-2 w-full">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="bg-[#0f1422] hover:bg-[#0f1422]/85 transition-colors text-white text-sm px-4 py-2 rounded-[10px] cursor-pointer whitespace-nowrap"
        >
          Change Password
        </button>
      </div>

      {/* Change Password Dialog Modal - Figma node 1375:8063 */}
      <ChangePasswordModal
        isOpen={isModalOpen}
        userEmail={profile.email}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
