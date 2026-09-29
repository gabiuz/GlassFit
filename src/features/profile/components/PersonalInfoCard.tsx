"use client";

import React, { useState } from "react";
import type { UserProfileData, ProfileFormValues } from "../types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface PersonalInfoCardProps {
  profile: UserProfileData;
  onProfileUpdated: (updated: Partial<UserProfileData>) => void;
}

export function PersonalInfoCard({
  profile,
  onProfileUpdated,
}: PersonalInfoCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [formValues, setFormValues] = useState<ProfileFormValues>({
    firstName: profile.firstName || "",
    lastName: profile.lastName || "",
    contactNumber: profile.contactNumber || "",
    address: profile.address || "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCancel = () => {
    setFormValues({
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      contactNumber: profile.contactNumber || "",
      address: profile.address || "",
    });
    setErrorMessage("");
    setSuccessMessage("");
    setIsEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const trimmedFirstName = formValues.firstName.trim();
    const trimmedLastName = formValues.lastName.trim();

    if (!trimmedFirstName) {
      setErrorMessage("First name is required.");
      return;
    }
    if (!trimmedLastName) {
      setErrorMessage("Last name is required.");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createSupabaseBrowserClient();

      // Update public.profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          contact_number: formValues.contactNumber.trim() || null,
        })
        .eq("profile_id", profile.profileId);

      if (profileError) {
        throw new Error(profileError.message);
      }

      // Also sync user metadata in Supabase Auth
      await supabase.auth.updateUser({
        data: {
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          full_name: `${trimmedFirstName} ${trimmedLastName}`,
          phone: formValues.contactNumber.trim(),
          address: formValues.address.trim(),
        },
      });

      const updatedFullName = `${trimmedFirstName} ${trimmedLastName}`.trim();
      onProfileUpdated({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        fullName: updatedFullName,
        contactNumber: formValues.contactNumber.trim(),
        address: formValues.address.trim(),
      });

      setSuccessMessage("Personal information updated successfully.");
      setIsEditing(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to update personal information. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-[#c3c3c3] shadow-[0px_0px_2.5px_rgba(0,0,0,0.25)] flex flex-col gap-6 sm:gap-7 p-6 sm:p-8 rounded-[20px] w-full lg:flex-1">
      {/* Header Section */}
      <div className="flex items-start justify-between gap-4 w-full">
        <div className="flex flex-col gap-1 items-start">
          <h2 className="text-[#07b6d3] text-2xl sm:text-[28px] lg:text-[30px] font-medium tracking-tight leading-tight">
            Personal Information
          </h2>
          <p className="text-black/70 text-sm sm:text-[15px] tracking-tight leading-snug">
            Update your personal information
          </p>
        </div>

        {/* Edit / Action Button */}
        {!isEditing ? (
          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              setSuccessMessage("");
              setIsEditing(true);
            }}
            className="bg-[#0f1422] hover:bg-[#0f1422]/85 transition-colors text-white text-sm px-4 py-1.5 rounded-[10px] cursor-pointer whitespace-nowrap"
          >
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="border border-[#c3c3c3] hover:bg-gray-100 transition-colors text-[#0f1422] text-sm px-3 py-1 rounded-[10px] cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="personal-info-form"
              disabled={isSaving}
              className="bg-[#07b6d3] hover:bg-[#07b6d3]/85 transition-colors text-white text-sm px-3.5 py-1 rounded-[10px] cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* Status Messages */}
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

      {/* Form Fields - Figma node 1374:7925 */}
      <form
        id="personal-info-form"
        onSubmit={handleSave}
        className="flex flex-col gap-4 sm:gap-4.5 w-full"
      >
        {/* Full Name Row */}
        {!isEditing ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-6 w-full">
            <label className="text-[#0f1422] text-sm sm:text-[15px] font-medium tracking-tight sm:w-[140px] shrink-0">
              Full Name
            </label>
            <div className="border border-[#c3c3c3] bg-white px-3.5 sm:px-4 py-2.5 rounded-[8px] flex-1">
              <span className="text-[#0f1422] text-sm tracking-tight leading-normal block truncate">
                {profile.fullName || `${profile.firstName} ${profile.lastName}`.trim() || "Not set"}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-6 w-full">
            <label className="text-[#0f1422] text-sm sm:text-[15px] font-medium tracking-tight sm:w-[140px] shrink-0">
              Full Name
            </label>
            <div className="flex gap-2.5 sm:gap-3 flex-1">
              <input
                type="text"
                name="firstName"
                placeholder="First Name"
                value={formValues.firstName}
                onChange={handleInputChange}
                required
                className="border border-[#c3c3c3] rounded-[8px] px-3.5 py-2.5 text-sm text-[#0f1422] w-1/2 focus:outline-none focus:border-[#07b6d3] transition-colors"
              />
              <input
                type="text"
                name="lastName"
                placeholder="Last Name"
                value={formValues.lastName}
                onChange={handleInputChange}
                required
                className="border border-[#c3c3c3] rounded-[8px] px-3.5 py-2.5 text-sm text-[#0f1422] w-1/2 focus:outline-none focus:border-[#07b6d3] transition-colors"
              />
            </div>
          </div>
        )}

        {/* Email Address Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-6 w-full">
          <label className="text-[#0f1422] text-sm sm:text-[15px] font-medium tracking-tight sm:w-[140px] shrink-0">
            Email Address
          </label>
          <div className="border border-[#c3c3c3] bg-[#fafafa] px-3.5 sm:px-4 py-2.5 rounded-[8px] flex-1 cursor-not-allowed">
            <span className="text-[#0f1422] text-sm tracking-tight leading-normal block truncate">
              {profile.email}
            </span>
          </div>
        </div>

        {/* Contact Number Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-6 w-full">
          <label className="text-[#0f1422] text-sm sm:text-[15px] font-medium tracking-tight sm:w-[140px] shrink-0">
            Contact Number
          </label>
          {!isEditing ? (
            <div className="border border-[#c3c3c3] bg-white px-3.5 sm:px-4 py-2.5 rounded-[8px] flex-1">
              <span className="text-[#0f1422] text-sm tracking-tight leading-normal block truncate">
                {profile.contactNumber || "Not provided"}
              </span>
            </div>
          ) : (
            <input
              type="tel"
              name="contactNumber"
              placeholder="+639 1234 5678"
              value={formValues.contactNumber}
              onChange={handleInputChange}
              className="border border-[#c3c3c3] rounded-[8px] px-3.5 py-2.5 text-sm text-[#0f1422] flex-1 focus:outline-none focus:border-[#07b6d3] transition-colors"
            />
          )}
        </div>

        {/* Address Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-6 w-full">
          <label className="text-[#0f1422] text-sm sm:text-[15px] font-medium tracking-tight sm:w-[140px] shrink-0">
            Address
          </label>
          {!isEditing ? (
            <div className="border border-[#c3c3c3] bg-white px-3.5 sm:px-4 py-2.5 rounded-[8px] flex-1">
              <span className="text-[#0f1422] text-sm tracking-tight leading-normal block truncate">
                {profile.address || "Not provided"}
              </span>
            </div>
          ) : (
            <input
              type="text"
              name="address"
              placeholder="Enter your address"
              value={formValues.address}
              onChange={handleInputChange}
              className="border border-[#c3c3c3] rounded-[8px] px-3.5 py-2.5 text-sm text-[#0f1422] flex-1 focus:outline-none focus:border-[#07b6d3] transition-colors"
            />
          )}
        </div>
      </form>
    </div>
  );
}
