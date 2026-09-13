"use client";

// ---------------------------------------------------------------------------
// PRD-F# (Settings): Admin self-management UI
// SDD-C# (AdminAuth): Client state backed by server actions; uses AdminSessionProvider
// DSD-UI# (AdminSettings): Matches Figma node 1354-7041
// BAN-UI-09: Strictly reuses existing design tokens and color palette
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Eye, EyeOff, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminSession } from "@/features/admin/auth/AdminSessionProvider";
import {
    updateAdminProfile,
    updateAdminPassword,
} from "./settingsActions";

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

type ToastState = {
    message: string;
    variant: "success" | "error";
} | null;

function useToast() {
    const [toast, setToast] = useState<ToastState>(null);

    const show = (message: string, variant: "success" | "error" = "success") => {
        setToast({ message, variant });
        setTimeout(() => setToast(null), 3500);
    };

    return { toast, show };
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function SectionHeading({
    title,
    subtitle,
    action,
}: {
    title: string;
    subtitle: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4 w-full">
            <div className="flex flex-col gap-1.5 min-w-0">
                <p className="text-[#07b6d3] text-xl sm:text-2xl font-medium leading-tight tracking-[-0.456px] whitespace-nowrap">
                    {title}
                </p>
                <p className="text-black text-sm sm:text-base font-normal leading-snug tracking-[-0.304px]">
                    {subtitle}
                </p>
            </div>
            {action}
        </div>
    );
}

function FormRow({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-4 w-full">
            <span className="text-[#0f1422] text-sm sm:text-base font-medium leading-snug tracking-[-0.304px] whitespace-nowrap w-[130px] shrink-0 text-right">
                {label}
            </span>
            <div className="flex-1 min-w-0">{children}</div>
        </div>
    );
}

function InputField({
    value,
    onChange,
    placeholder,
    disabled,
    type = "text",
    rightElement,
    hint,
}: {
    value: string;
    onChange?: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    type?: string;
    rightElement?: React.ReactNode;
    hint?: string;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <div
                className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-lg border w-full",
                    disabled
                        ? "bg-[#f5f5f5] border-[#c3c3c3] cursor-default"
                        : "bg-white border-[#c3c3c3] focus-within:border-[#07b6d3] transition-colors"
                )}
            >
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange?.(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                        "flex-1 min-w-0 bg-transparent outline-none text-sm font-normal leading-snug tracking-[-0.266px]",
                        disabled ? "text-[#c3c3c3] cursor-default" : "text-[#0f1422] placeholder:text-[#c3c3c3]"
                    )}
                />
                {rightElement}
            </div>
            {hint && (
                <p className="text-[#c3c3c3] text-xs font-normal leading-snug tracking-[-0.228px]">
                    {hint}
                </p>
            )}
        </div>
    );
}

function EditButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="bg-[#0f1422] text-white text-sm font-normal px-4 py-1.5 rounded-[10px] cursor-pointer hover:bg-black transition-colors whitespace-nowrap shrink-0"
        >
            Edit
        </button>
    );
}

function SaveButton({
    onClick,
    loading,
}: {
    onClick: () => void;
    loading: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={loading}
            className="bg-[#07b6d3] text-white text-sm font-normal px-4 py-1.5 rounded-[10px] cursor-pointer hover:bg-cyan-600 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 flex items-center gap-2"
        >
            {loading && (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Save
        </button>
    );
}

// ---------------------------------------------------------------------------
// Admin Profile Card
// ---------------------------------------------------------------------------

function AdminProfileCard({
    initialName,
    email,
    role,
    profileId,
    onToast,
}: {
    initialName: string;
    email: string;
    role: string;
    profileId: string;
    onToast: (msg: string, variant: "success" | "error") => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [fullName, setFullName] = useState(initialName);
    const [draftName, setDraftName] = useState(initialName);
    const [loading, setLoading] = useState(false);

    const handleEdit = () => {
        setDraftName(fullName);
        setIsEditing(true);
    };

    const handleSave = async () => {
        setLoading(true);
        const result = await updateAdminProfile(profileId, draftName);
        setLoading(false);

        if (result.ok) {
            setFullName(draftName);
            setIsEditing(false);
            onToast(result.message, "success");
        } else {
            onToast(result.error, "error");
        }
    };

    return (
        <div className="bg-white rounded-[20px] p-6 sm:p-[30px] flex flex-col gap-5 w-full">
            <SectionHeading
                title="Admin Profile"
                subtitle="Update your administrator information"
                action={
                    isEditing ? (
                        <SaveButton onClick={handleSave} loading={loading} />
                    ) : (
                        <EditButton onClick={handleEdit} />
                    )
                }
            />

            {/* Avatar + name */}
            <div className="flex items-center gap-5">
                <div className="size-[80px] sm:size-[93px] rounded-full bg-[#07b6d3]/10 flex items-center justify-center shrink-0">
                    <User className="w-10 h-10 text-[#07b6d3]" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1">
                    <p className="text-[#0f1422] text-lg sm:text-xl font-medium leading-snug tracking-[-0.38px]">
                        {fullName}
                    </p>
                    <p className="text-black text-sm sm:text-base font-normal leading-snug tracking-[-0.304px]">
                        {role}
                    </p>
                </div>
            </div>

            {/* Fields */}
            <div className="flex flex-col gap-4 w-full">
                <FormRow label="Full Name">
                    <InputField
                        value={isEditing ? draftName : fullName}
                        onChange={setDraftName}
                        placeholder="Full name"
                        disabled={!isEditing}
                    />
                </FormRow>

                <FormRow label="Email Address">
                    <InputField
                        value={email}
                        placeholder="Email address"
                        disabled
                    />
                </FormRow>

                <FormRow label="Role">
                    <InputField
                        value={role}
                        placeholder="Role"
                        disabled
                    />
                </FormRow>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Security Card
// ---------------------------------------------------------------------------

function SecurityCard({
    email,
    onToast,
}: {
    email: string;
    onToast: (msg: string, variant: "success" | "error") => void;
}) {
    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [inlineError, setInlineError] = useState<string | null>(null);

    const handleChangePassword = async () => {
        setInlineError(null);

        if (!currentPw) {
            setInlineError("Please enter your current password.");
            return;
        }
        if (!newPw) {
            setInlineError("Please enter a new password.");
            return;
        }
        if (newPw !== confirmPw) {
            setInlineError("Passwords do not match.");
            return;
        }

        setLoading(true);
        const result = await updateAdminPassword(email, currentPw, newPw, confirmPw);
        setLoading(false);

        if (result.ok) {
            setCurrentPw("");
            setNewPw("");
            setConfirmPw("");
            onToast(result.message, "success");
        } else {
            setInlineError(result.error);
        }
    };

    const EyeToggle = ({
        show,
        onToggle,
    }: {
        show: boolean;
        onToggle: () => void;
    }) => (
        <button
            type="button"
            onClick={onToggle}
            aria-label={show ? "Hide password" : "Show password"}
            className="text-[#c3c3c3] hover:text-[#0f1422] transition-colors shrink-0"
        >
            {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
    );

    return (
        <div className="bg-white rounded-[20px] p-6 sm:p-[30px] flex flex-col gap-5 w-full">
            <SectionHeading
                title="Security"
                subtitle="Change your password to keep your account secure"
            />

            <div className="flex flex-col gap-4 w-full">
                <FormRow label="Current Password">
                    <InputField
                        value={currentPw}
                        onChange={setCurrentPw}
                        placeholder="••••••••"
                        type={showCurrent ? "text" : "password"}
                        rightElement={
                            <EyeToggle
                                show={showCurrent}
                                onToggle={() => setShowCurrent((p) => !p)}
                            />
                        }
                    />
                </FormRow>

                <FormRow label="New Password">
                    <InputField
                        value={newPw}
                        onChange={setNewPw}
                        placeholder="Enter new password"
                        type={showNew ? "text" : "password"}
                        hint="8+ characters with uppercase, lowercase, and a number."
                        rightElement={
                            <EyeToggle
                                show={showNew}
                                onToggle={() => setShowNew((p) => !p)}
                            />
                        }
                    />
                </FormRow>

                <FormRow label="Confirm Password">
                    <InputField
                        value={confirmPw}
                        onChange={setConfirmPw}
                        placeholder="Re-enter new password"
                        type={showConfirm ? "text" : "password"}
                        rightElement={
                            <EyeToggle
                                show={showConfirm}
                                onToggle={() => setShowConfirm((p) => !p)}
                            />
                        }
                    />
                </FormRow>
            </div>

            {inlineError && (
                <p className="text-red-500 text-sm font-normal leading-snug">
                    {inlineError}
                </p>
            )}

            <div className="flex justify-end w-full">
                <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={loading}
                    className="bg-[#0f1422] text-white text-sm font-normal px-5 py-2 rounded-[10px] cursor-pointer hover:bg-black transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                    {loading && (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    Change Password
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Data Management Card
// ---------------------------------------------------------------------------

function DataManagementCard({
    onToast,
}: {
    onToast: (msg: string, variant: "success" | "error") => void;
}) {
    const lastBackupDate = "Sep 12, 2026 · 10:30 AM";

    const handleExportBookings = () => {
        // TODO: Wire to route handler /api/admin/export/bookings when implemented
        onToast("Booking CSV export coming soon.", "success");
    };

    const handleExportProducts = () => {
        // TODO: Wire to route handler /api/admin/export/products when implemented
        onToast("Product CSV export coming soon.", "success");
    };

    const handleDownloadBackup = () => {
        // TODO: Wire to route handler /api/admin/export/backup when implemented
        onToast("System backup download coming soon.", "success");
    };

    return (
        <div className="bg-white rounded-[20px] p-6 sm:p-[30px] flex flex-col gap-5 w-full">
            <SectionHeading
                title="Data Management"
                subtitle="Export records and maintain a system backup."
            />

            <div className="flex flex-col gap-4 w-full">
                {/* Booking Records */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[#0f1422] text-sm sm:text-base font-medium leading-snug tracking-[-0.304px]">
                            Booking Records
                        </span>
                        <p className="text-[#c3c3c3] text-xs font-normal leading-snug tracking-[-0.228px]">
                            All booking request data
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleExportBookings}
                        className="bg-white border border-[#07b6d3] text-[#07b6d3] text-sm font-normal px-4 py-1.5 rounded-[10px] cursor-pointer hover:bg-[#07b6d3]/5 transition-colors whitespace-nowrap shrink-0"
                    >
                        Export CSV
                    </button>
                </div>

                <div className="w-full border-t border-[#f0f0f0]" />

                {/* Product Records */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[#0f1422] text-sm sm:text-base font-medium leading-snug tracking-[-0.304px]">
                            Product Records
                        </span>
                        <p className="text-[#c3c3c3] text-xs font-normal leading-snug tracking-[-0.228px]">
                            Products and availability
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleExportProducts}
                        className="bg-white border border-[#07b6d3] text-[#07b6d3] text-sm font-normal px-4 py-1.5 rounded-[10px] cursor-pointer hover:bg-[#07b6d3]/5 transition-colors whitespace-nowrap shrink-0"
                    >
                        Export CSV
                    </button>
                </div>

                <div className="w-full border-t border-[#f0f0f0]" />

                {/* System Backup */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[#0f1422] text-sm sm:text-base font-medium leading-snug tracking-[-0.304px]">
                            System Backup
                        </span>
                        <p className="text-[#c3c3c3] text-xs font-normal leading-snug tracking-[-0.228px]">
                            Last backup: {lastBackupDate}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleDownloadBackup}
                        className="bg-[#07b6d3] text-white text-sm font-normal px-4 py-1.5 rounded-[10px] cursor-pointer hover:bg-cyan-600 transition-colors whitespace-nowrap shrink-0"
                    >
                        Download Backup
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// System Preferences Card
// ---------------------------------------------------------------------------

// TODO (BAN-MIGR-06): Wire to a supabase/migrations/006_system_preferences.sql
// migration once the schema is approved. For now, preferences are local-state-only.
const DEFAULT_PREFERENCES = {
    businessName: "GlassFit",
    contactEmail: "glassfit@gmail.com",
    operatingHours: "Monday - Friday",
};

function SystemPreferencesCard({
    onToast,
}: {
    onToast: (msg: string, variant: "success" | "error") => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [saved, setSaved] = useState(DEFAULT_PREFERENCES);
    const [draft, setDraft] = useState(DEFAULT_PREFERENCES);

    const handleEdit = () => {
        setDraft(saved);
        setIsEditing(true);
    };

    const handleSave = () => {
        setSaved(draft);
        setIsEditing(false);
        onToast("System preferences updated.", "success");
        // TODO: Call a server action once migration 006 is in place
    };

    const updateDraft = (key: keyof typeof draft) => (value: string) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
    };

    return (
        <div className="bg-white rounded-[20px] p-6 sm:p-[30px] flex flex-col gap-5 w-full">
            <SectionHeading
                title="System Preferences"
                subtitle="Manage business information and system settings."
                action={
                    isEditing ? (
                        <SaveButton onClick={handleSave} loading={false} />
                    ) : (
                        <EditButton onClick={handleEdit} />
                    )
                }
            />

            <div className="flex flex-col gap-4 w-full">
                <FormRow label="Business Name">
                    <InputField
                        value={isEditing ? draft.businessName : saved.businessName}
                        onChange={updateDraft("businessName")}
                        placeholder="Business name"
                        disabled={!isEditing}
                    />
                </FormRow>

                <FormRow label="Contact Email">
                    <InputField
                        value={isEditing ? draft.contactEmail : saved.contactEmail}
                        onChange={updateDraft("contactEmail")}
                        placeholder="contact@example.com"
                        disabled={!isEditing}
                    />
                </FormRow>

                <FormRow label="Operating Hours">
                    <InputField
                        value={isEditing ? draft.operatingHours : saved.operatingHours}
                        onChange={updateDraft("operatingHours")}
                        placeholder="e.g. Monday - Friday, 8AM - 5PM"
                        disabled={!isEditing}
                    />
                </FormRow>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Toast Overlay
// ---------------------------------------------------------------------------

function FeedbackToast({ toast }: { toast: ToastState }) {
    if (!toast) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0f1422] text-white py-3 px-5 rounded-[12px] shadow-xl flex items-center gap-3 border border-neutral-800 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div
                className={cn(
                    "flex items-center justify-center w-5 h-5 rounded-full shrink-0",
                    toast.variant === "success" ? "bg-[#05b64b]" : "bg-[#c50000]"
                )}
            >
                {toast.variant === "success" ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                ) : (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M3 3L7 7M7 3L3 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                )}
            </div>
            <span className="text-sm font-normal tracking-tight">{toast.message}</span>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function SettingsContent() {
    const { profileId, fullName, email, role } = useAdminSession();
    const { toast, show: showToast } = useToast();

    return (
        <div className="flex flex-col items-start gap-6 sm:gap-8 w-full max-w-[1240px] pb-12 select-none">
            {/* Page heading */}
            <div className="flex flex-col gap-1.5 items-start">
                <h1 className="text-black text-2xl sm:text-3xl lg:text-[32px] font-medium leading-tight tracking-tight">
                    Settings
                </h1>
                <p className="text-neutral-700 text-sm sm:text-base lg:text-xl font-normal leading-snug">
                    Manage administrator account and system preferences
                </p>
            </div>

            {/* Two-column card grid */}
            <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                {/* Left column */}
                <div className="flex flex-col gap-6">
                    <AdminProfileCard
                        initialName={fullName}
                        email={email}
                        role={role.roleName}
                        profileId={profileId}
                        onToast={showToast}
                    />
                    <DataManagementCard onToast={showToast} />
                </div>

                {/* Right column */}
                <div className="flex flex-col gap-6">
                    <SecurityCard email={email} onToast={showToast} />
                    <SystemPreferencesCard onToast={showToast} />
                </div>
            </div>

            <FeedbackToast toast={toast} />
        </div>
    );
}
