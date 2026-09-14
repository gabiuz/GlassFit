"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ProfileHero } from "./ProfileHero";
import { ProfileSummaryCard } from "./ProfileSummaryCard";
import { PersonalInfoCard } from "./PersonalInfoCard";
import { AccountSecurityCard } from "./AccountSecurityCard";
import type { UserProfileData } from "../types";

export function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    let isMounted = true;

    const loadProfile = async () => {
      try {
        const supabase = createSupabaseBrowserClient();

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("profile_id", user.id)
          .single();

        if (!isMounted) return;

        const userMeta = user.user_metadata || {};
        const resolvedFirstName =
          data?.first_name ||
          userMeta.first_name ||
          user.email?.split("@")[0] ||
          "User";
        const resolvedLastName = data?.last_name || userMeta.last_name || "";
        const resolvedFullName =
          data?.full_name ||
          userMeta.full_name ||
          `${resolvedFirstName} ${resolvedLastName}`.trim();
        const resolvedPhone =
          data?.contact_number || userMeta.phone || user.phone || "";
        const resolvedAddress = userMeta.address || "";

        setProfile({
          profileId: user.id,
          firstName: resolvedFirstName,
          lastName: resolvedLastName,
          fullName: resolvedFullName,
          email: user.email || "",
          contactNumber: resolvedPhone,
          address: resolvedAddress,
          accountType: data?.account_type === "Admin" ? "Admin" : "Customer",
          status: data?.status === "Inactive" ? "Inactive" : "Active",
          createdAt: user.created_at || new Date().toISOString(),
          emailVerified: !!user.email_confirmed_at,
          lastPasswordChange: user.last_sign_in_at,
        });

        if (error && error.code !== "PGRST116") {
          console.warn("Could not fetch full profile from database:", error.message);
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user, isAuthLoading, router]);

  const handleProfileUpdated = (updatedFields: Partial<UserProfileData>) => {
    setProfile((prev) => (prev ? { ...prev, ...updatedFields } : null));
  };

  if (isAuthLoading || isLoadingProfile) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <ProfileHero />
        <div className="max-w-[1293px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-10 flex flex-col gap-6 lg:gap-8 items-center animate-pulse">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 w-full justify-center items-stretch">
            <div className="w-full lg:w-[350px] xl:w-[370px] h-[380px] bg-gray-100 rounded-[20px]" />
            <div className="w-full lg:flex-1 h-[380px] bg-gray-100 rounded-[20px]" />
          </div>
          <div className="w-full h-[240px] bg-gray-100 rounded-[20px]" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <main className="min-h-screen bg-white flex flex-col">
      {/* Hero Banner */}
      <ProfileHero />

      {/* Main Content Area */}
      <div className="max-w-[1293px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-10 flex flex-col items-center gap-6 lg:gap-8">
        {/* Top Cards Row: Summary (Left) & Personal Info (Right) */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-stretch w-full justify-center">
          <ProfileSummaryCard profile={profile} />
          <PersonalInfoCard
            profile={profile}
            onProfileUpdated={handleProfileUpdated}
          />
        </div>

        {/* Bottom Card Row: Account Security */}
        <AccountSecurityCard profile={profile} />
      </div>
    </main>
  );
}
