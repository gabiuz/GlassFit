import React from "react";
import type { UserProfileData } from "../types";

interface ProfileSummaryCardProps {
  profile: UserProfileData;
}

export function ProfileSummaryCard({ profile }: ProfileSummaryCardProps) {
  // Format member since date (e.g., "June 2026")
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
    <div className="bg-white border border-[#c3c3c3] shadow-[0px_0px_2.5px_rgba(0,0,0,0.25)] flex flex-col gap-5 sm:gap-6 items-center justify-between p-6 sm:p-8 rounded-[20px] shrink-0 w-full lg:w-[350px] xl:w-[370px]">
      <div className="flex flex-col gap-5 items-center justify-center w-full">
        {/* Teal Avatar - Figma node 1372:7775 */}
        <div className="relative shrink-0 size-[136px] sm:size-[148px] rounded-full overflow-hidden shadow-sm">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 158 158"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="size-full"
            aria-hidden="true"
          >
            <circle cx="79" cy="79" r="79" fill="#07B6D3" />
            <path
              opacity="0.45"
              d="M56.7 54.7C56.7 67.0 66.7 77.0 79.0 77.0C91.3 77.0 101.3 67.0 101.3 54.7C101.3 42.4 91.3 32.4 79.0 32.4C66.7 32.4 56.7 42.4 56.7 54.7Z"
              fill="white"
            />
            <path
              d="M40.5 120.4C40.5 103.2 55.3 89.2 73.5 89.2H84.5C102.7 89.2 117.5 103.2 117.5 120.4C117.5 123.3 115.0 125.6 112.0 125.6H46.0C43.0 125.6 40.5 123.3 40.5 120.4Z"
              fill="white"
            />
          </svg>
        </div>

        {/* User Identity Details */}
        <div className="flex flex-col gap-1.5 items-center justify-center text-center w-full min-w-0">
          <h2 className="text-[#0f1422] text-2xl sm:text-[28px] lg:text-[32px] font-medium tracking-tight leading-tight break-words max-w-full">
            {profile.fullName || `${profile.firstName} ${profile.lastName}`.trim() || "User"}
          </h2>
          <p className="text-[#07b6d3] text-lg sm:text-xl font-medium tracking-tight leading-snug">
            {profile.accountType || "Customer"}
          </p>
          <p className="text-black/80 text-sm sm:text-[15px] tracking-tight truncate max-w-full">
            {profile.email}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 items-center w-full">
        {/* Hairline Divider */}
        <hr className="border-t border-[#c3c3c3]/40 w-full" />

        {/* Member Since Footnote */}
        <p className="text-[#c3c3c3] text-sm sm:text-[15px] tracking-tight whitespace-nowrap text-center">
          Member since {memberSince}
        </p>
      </div>
    </div>
  );
}
