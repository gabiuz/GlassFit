"use client";

// ---------------------------------------------------------------------------
// PRD-F14 (Settings): Admin self-management UI and Owner-governed preferences
// SDD-C9 (AdminWorkbench): Client state backed by server actions; uses AdminSessionProvider
// DSD-UI11 (AdminSettings): Matches Figma node 1354-7041 styling and tokens
// BAN-UI-09: Strictly reuses existing design tokens and color palette
// BAN-PUNCT-01: Zero em-dashes across all code and comments
// ---------------------------------------------------------------------------

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, User, Plus, Trash2, ShieldAlert, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminSession } from "@/features/admin/auth/AdminSessionProvider";
import {
    updateAdminProfile,
    changeAdminEmail,
    getOwnStaffEmailChangeRequest,
    listStaffEmailChangeRequests,
    cancelOwnStaffEmailChange,
    retryStaffEmailChangeApprovalDelivery,
    type AdminEmailChangeEventView,
    updateAdminPassword,
    getSystemPreferences,
    updateSystemPreferences,
} from "./settingsActions";
import {
    DAYS_OF_WEEK,
    type OperatingScheduleRange,
    type SystemPreferencesInput,
} from "@/lib/settings/types";
import {
    formatTime12h,
    formatScheduleSummary,
} from "@/lib/settings/formatters";

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
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 w-full">
            <span className="text-[#0f1422] text-sm sm:text-base font-medium leading-snug tracking-[-0.304px] whitespace-nowrap sm:w-[130px] shrink-0 sm:text-right">
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
    maxLength,
}: {
    value: string;
    onChange?: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    type?: string;
    rightElement?: React.ReactNode;
    hint?: string;
    maxLength?: number;
}) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
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
                    maxLength={maxLength}
                    className={cn(
                        "flex-1 min-w-0 bg-transparent outline-none text-sm font-normal leading-snug tracking-[-0.266px]",
                        disabled ? "text-[#737373] cursor-default" : "text-[#0f1422] placeholder:text-[#c3c3c3]"
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

function EyeToggle({
    show,
    onToggle,
}: {
    show: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-label={show ? "Hide password" : "Show password"}
            className="text-[#c3c3c3] hover:text-[#0f1422] transition-colors shrink-0"
        >
            {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
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
    initialFirstName,
    initialLastName,
    initialEmail,
    role,
    onToast,
}: {
    initialFirstName: string;
    initialLastName: string;
    initialEmail: string;
    role: string;
    onToast: (msg: string, variant: "success" | "error") => void;
}) {
    const router = useRouter();
    const [firstName, setFirstName] = useState(initialFirstName);
    const [lastName, setLastName] = useState(initialLastName);
    const [email, setEmail] = useState(initialEmail);
    const [nameLoading, setNameLoading] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);
    const [request, setRequest] = useState<AdminEmailChangeEventView | null>(null);
    const [reviewRequests, setReviewRequests] = useState<AdminEmailChangeEventView[]>([]);
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const privileged = role === "Owner" || role === "Manager";

    const reloadRequests = async () => {
        if (role === "Staff") {
            const result = await getOwnStaffEmailChangeRequest();
            if (result.ok) setRequest(result.data ?? null);
        } else if (privileged) {
            const result = await listStaffEmailChangeRequests();
            if (result.ok) setReviewRequests(result.data ?? []);
        }
    };

    useEffect(() => {
        let active = true;
        const load = async () => {
            if (role === "Staff") {
                const result = await getOwnStaffEmailChangeRequest();
                if (active && result.ok) setRequest(result.data ?? null);
            } else if (privileged) {
                const result = await listStaffEmailChangeRequests();
                if (active && result.ok) setReviewRequests(result.data ?? []);
            }
        };
        void load();
        return () => { active = false; };
    }, [role, privileged]);

    const handleSaveName = async () => {
        setNameLoading(true);
        const result = await updateAdminProfile({ firstName, lastName });
        setNameLoading(false);
        if (result.ok && result.data) {
            setFirstName(result.data.firstName);
            setLastName(result.data.lastName);
            onToast(result.message, "success");
        } else if (!result.ok) onToast(result.error, "error");
    };

    const handleEmailChange = async () => {
        setEmailLoading(true);
        const result = await changeAdminEmail(email);
        setEmailLoading(false);
        onToast(result.ok ? result.message : result.error, result.ok ? "success" : "error");
        if (result.ok) {
            if (result.data?.mode === "staff_approval_required") setEmail(initialEmail);
            else router.refresh();
            void reloadRequests();
        }
    };

    return (
        <div className="bg-white rounded-[20px] p-6 sm:p-[30px] flex flex-col gap-5 w-full">
            <SectionHeading
                title="Admin Profile"
                subtitle="Update your administrator information"
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
                <FormRow label="First Name">
                    <InputField
                        value={firstName}
                        onChange={setFirstName}
                        placeholder="First name"
                        maxLength={50}
                    />
                </FormRow>

                <FormRow label="Last Name (Optional)">
                    <InputField value={lastName} onChange={setLastName} placeholder="Last name" maxLength={50} />
                </FormRow>

                <div className="flex justify-end"><SaveButton onClick={handleSaveName} loading={nameLoading} /></div>

                <FormRow label="Email Address">
                    <InputField
                        value={email}
                        onChange={setEmail}
                        placeholder="Email address"
                        type="email"
                        maxLength={254}
                    />
                </FormRow>

                <p className="text-xs text-neutral-500">
                    {role === "Staff"
                        ? "Changing your email creates a request. Your current email remains active until an Owner or Manager approves it."
                        : "Your email change applies immediately without approval or email delivery."}
                </p>
                <div className="flex justify-end">
                    <button type="button" onClick={handleEmailChange} disabled={emailLoading}
                        className="rounded-[10px] bg-[#07b6d3] px-4 py-1.5 text-sm text-white disabled:opacity-60">
                        {emailLoading ? "Submitting..." : "Change Email"}
                    </button>
                </div>

                <FormRow label="Role">
                    <InputField
                        value={role}
                        placeholder="Role"
                        disabled
                    />
                </FormRow>

                {role === "Staff" && request && (
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
                        <p className="font-medium">Latest request: {request.status}</p>
                        <p>{request.previousEmail} to {request.proposedEmail}</p>
                        {request.status === "PendingApproval" && (
                            <button type="button" className="mt-2 text-red-700 underline" onClick={async () => {
                                const result = await cancelOwnStaffEmailChange(request.eventId);
                                onToast(result.ok ? result.message : result.error, result.ok ? "success" : "error");
                                void reloadRequests();
                            }}>Cancel request</button>
                        )}
                    </div>
                )}
                {privileged && reviewRequests && reviewRequests.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
                        <p className="text-sm font-medium">Staff email requests</p>
                        {reviewRequests.map((item) => (
                            <div key={item.eventId} className="rounded-lg border border-neutral-200 p-3 text-xs">
                                <p className="font-medium">{item.staffName}: {item.status}</p>
                                <p>{item.previousEmail} to {item.proposedEmail}</p>
                                {(item.deliveryStatus === "Partial" || item.deliveryStatus === "Failed") && (
                                    <button type="button" className="mt-2 text-[#078ba1] underline" onClick={async () => {
                                        const result = await retryStaffEmailChangeApprovalDelivery(item.eventId);
                                        onToast(result.ok ? result.message : result.error, result.ok ? "success" : "error");
                                        void reloadRequests();
                                    }}>Retry delivery</button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
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
        // Wire to route handler /api/admin/export/bookings when implemented
        onToast("Booking CSV export coming soon.", "success");
    };

    const handleExportProducts = () => {
        // Wire to route handler /api/admin/export/products when implemented
        onToast("Product CSV export coming soon.", "success");
    };

    const handleDownloadBackup = () => {
        // Wire to route handler /api/admin/export/backup when implemented
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
// Operating Schedule Range Helpers
// ---------------------------------------------------------------------------

const TIME_OPTIONS = [
    "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
    "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00",
];

const DEFAULT_SCHEDULES: OperatingScheduleRange[] = [
    {
        id: "default-schedule-1",
        startDay: "Monday",
        endDay: "Saturday",
        startTime: "08:00",
        endTime: "17:00",
    },
];

const DEFAULT_PREFERENCES: SystemPreferencesInput = {
    businessName: "GlassFit",
    contactEmail: "glassfit@gmail.com",
    contactPhone: "+63 917 123 4567",
    schedules: DEFAULT_SCHEDULES,
};

// ---------------------------------------------------------------------------
// System Preferences Card
// ---------------------------------------------------------------------------

function SystemPreferencesCard({
    roleName,
    onToast,
}: {
    roleName: string;
    onToast: (msg: string, variant: "success" | "error") => void;
}) {
    const isOwner = roleName.trim().toLowerCase() === "owner";
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    const [saved, setSaved] = useState<SystemPreferencesInput>(DEFAULT_PREFERENCES);
    const [draft, setDraft] = useState<SystemPreferencesInput>(DEFAULT_PREFERENCES);

    useEffect(() => {
        async function loadPreferences() {
            setFetching(true);
            const res = await getSystemPreferences();
            if (res.ok && res.data) {
                const loaded: SystemPreferencesInput = {
                    businessName: res.data.businessName || DEFAULT_PREFERENCES.businessName,
                    contactEmail: res.data.contactEmail || DEFAULT_PREFERENCES.contactEmail,
                    contactPhone: res.data.contactPhone || DEFAULT_PREFERENCES.contactPhone,
                    schedules: res.data.operatingSchedules && res.data.operatingSchedules.length > 0
                        ? res.data.operatingSchedules
                        : DEFAULT_SCHEDULES,
                };
                setSaved(loaded);
                setDraft(loaded);
            }
            setFetching(false);
        }
        loadPreferences();
    }, []);

    const handleEdit = () => {
        setDraft(saved);
        setIsEditing(true);
    };

    const handleCancel = () => {
        setDraft(saved);
        setIsEditing(false);
    };

    const handleSave = async () => {
        if (!draft.businessName.trim()) {
            onToast("Business name cannot be empty.", "error");
            return;
        }
        if (!draft.contactEmail.trim() || !draft.contactEmail.includes("@")) {
            onToast("Please enter a valid contact email.", "error");
            return;
        }
        if (!draft.contactPhone.trim()) {
            onToast("Contact phone number is required.", "error");
            return;
        }
        if (!draft.schedules || draft.schedules.length === 0) {
            onToast("At least one operating schedule is required.", "error");
            return;
        }
        for (let i = 0; i < draft.schedules.length; i++) {
            const sch = draft.schedules[i];
            if (sch.startTime >= sch.endTime) {
                onToast(`Schedule window #${i + 1}: Closing time must be after opening time.`, "error");
                return;
            }
        }

        setLoading(true);
        const res = await updateSystemPreferences(draft);
        setLoading(false);

        if (res.ok) {
            if (res.data) {
                const updated: SystemPreferencesInput = {
                    businessName: res.data.businessName,
                    contactEmail: res.data.contactEmail,
                    contactPhone: res.data.contactPhone,
                    schedules: res.data.operatingSchedules,
                };
                setSaved(updated);
                setDraft(updated);
            }
            setIsEditing(false);
            onToast(res.message, "success");
        } else {
            onToast(res.error, "error");
        }
    };

    const updateDraftField = (key: keyof Omit<SystemPreferencesInput, "schedules">) => (value: string) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
    };

    const handleScheduleChange = (
        index: number,
        field: keyof OperatingScheduleRange,
        value: string
    ) => {
        setDraft((prev) => {
            const newSchedules = [...prev.schedules];
            newSchedules[index] = {
                ...newSchedules[index],
                [field]: value,
            };
            return { ...prev, schedules: newSchedules };
        });
    };

    const handleAddSchedule = () => {
        const newSchedule: OperatingScheduleRange = {
            id: `sch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            startDay: "Saturday",
            endDay: "Saturday",
            startTime: "08:00",
            endTime: "12:00",
        };
        setDraft((prev) => ({
            ...prev,
            schedules: [...prev.schedules, newSchedule],
        }));
    };

    const handleRemoveSchedule = (index: number) => {
        if (draft.schedules.length <= 1) return;
        setDraft((prev) => ({
            ...prev,
            schedules: prev.schedules.filter((_, i) => i !== index),
        }));
    };

    const currentData = isEditing ? draft : saved;

    return (
        <div className="bg-white rounded-[20px] p-6 sm:p-[30px] flex flex-col gap-5 w-full">
            <SectionHeading
                title="System Preferences"
                subtitle="Manage business information and shop operating schedules."
                action={
                    !isOwner ? (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200 whitespace-nowrap">
                            Owner Only
                        </span>
                    ) : isEditing ? (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={loading}
                                className="bg-white border border-[#c3c3c3] text-[#0f1422] text-sm font-normal px-3.5 py-1.5 rounded-[10px] cursor-pointer hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <SaveButton onClick={handleSave} loading={loading} />
                        </div>
                    ) : (
                        <EditButton onClick={handleEdit} />
                    )
                }
            />

            {!isOwner && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-600">
                    <ShieldAlert className="w-4 h-4 text-neutral-400 shrink-0" />
                    <span>
                        System preferences and operating schedules are managed exclusively by the business Owner.
                    </span>
                </div>
            )}

            <div className="flex flex-col gap-4 w-full">
                <FormRow label="Business Name">
                    <InputField
                        value={currentData.businessName}
                        onChange={updateDraftField("businessName")}
                        placeholder="Business name"
                        disabled={!isEditing || !isOwner}
                    />
                </FormRow>

                <FormRow label="Contact Email">
                    <InputField
                        value={currentData.contactEmail}
                        onChange={updateDraftField("contactEmail")}
                        placeholder="contact@example.com"
                        type="email"
                        disabled={!isEditing || !isOwner}
                    />
                </FormRow>

                <FormRow label="Contact Phone">
                    <InputField
                        value={currentData.contactPhone}
                        onChange={updateDraftField("contactPhone")}
                        placeholder="+63 917 123 4567"
                        disabled={!isEditing || !isOwner}
                    />
                </FormRow>
            </div>

            {/* Operating Schedule Section */}
            <div className="flex flex-col gap-3 pt-2 border-t border-[#f0f0f0] w-full">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#0f1422]">
                        <Clock className="w-4 h-4 text-[#07b6d3]" />
                        <span>Operating Schedules &amp; Consultation Hours</span>
                    </div>
                </div>

                {fetching ? (
                    <div className="py-6 text-center text-xs text-neutral-400">Loading operating schedule...</div>
                ) : (
                    <div className="flex flex-col gap-3 w-full">
                        {currentData.schedules.map((schedule, idx) => {
                            const summary = formatScheduleSummary(schedule);
                            return (
                                <div
                                    key={schedule.id || `schedule-${idx}`}
                                    className={cn(
                                        "p-4 rounded-xl border flex flex-col gap-3 transition-colors",
                                        isEditing
                                            ? "bg-[#fafafa] border-[#e2e8f0]"
                                            : "bg-[#f8fafc] border-[#e2e8f0]"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                                            <span className="text-xs font-semibold text-neutral-700">
                                                Schedule Window #{idx + 1}
                                            </span>
                                        </div>
                                        {isEditing && isOwner && currentData.schedules.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSchedule(idx)}
                                                className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                                                title="Remove this schedule window"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span>Remove</span>
                                            </button>
                                        )}
                                    </div>

                                    {isEditing && isOwner ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                                            {/* Days Range Selectors */}
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-xs font-medium text-neutral-600">Operating Days Range</span>
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={schedule.startDay}
                                                        onChange={(e) => handleScheduleChange(idx, "startDay", e.target.value)}
                                                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#c3c3c3] bg-white text-[#0f1422] outline-none focus:border-[#07b6d3]"
                                                    >
                                                        {DAYS_OF_WEEK.map((d) => (
                                                            <option key={d} value={d}>{d}</option>
                                                        ))}
                                                    </select>
                                                    <span className="text-xs text-neutral-400 font-medium">to</span>
                                                    <select
                                                        value={schedule.endDay}
                                                        onChange={(e) => handleScheduleChange(idx, "endDay", e.target.value)}
                                                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#c3c3c3] bg-white text-[#0f1422] outline-none focus:border-[#07b6d3]"
                                                    >
                                                        {DAYS_OF_WEEK.map((d) => (
                                                            <option key={d} value={d}>{d}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Hours Range Selectors */}
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-xs font-medium text-neutral-600">Operating Hours Range</span>
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={schedule.startTime}
                                                        onChange={(e) => handleScheduleChange(idx, "startTime", e.target.value)}
                                                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#c3c3c3] bg-white text-[#0f1422] outline-none focus:border-[#07b6d3]"
                                                    >
                                                        {!TIME_OPTIONS.includes(schedule.startTime) && (
                                                            <option value={schedule.startTime}>{formatTime12h(schedule.startTime)}</option>
                                                        )}
                                                        {TIME_OPTIONS.map((t) => (
                                                            <option key={t} value={t}>{formatTime12h(t)}</option>
                                                        ))}
                                                    </select>
                                                    <span className="text-xs text-neutral-400 font-medium">to</span>
                                                    <select
                                                        value={schedule.endTime}
                                                        onChange={(e) => handleScheduleChange(idx, "endTime", e.target.value)}
                                                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#c3c3c3] bg-white text-[#0f1422] outline-none focus:border-[#07b6d3]"
                                                    >
                                                        {!TIME_OPTIONS.includes(schedule.endTime) && (
                                                            <option value={schedule.endTime}>{formatTime12h(schedule.endTime)}</option>
                                                        )}
                                                        {TIME_OPTIONS.map((t) => (
                                                            <option key={t} value={t}>{formatTime12h(t)}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Summary preview pill */}
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-neutral-500 font-normal">Active window:</span>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#07b6d3]/10 text-[#0f1422] border border-[#07b6d3]/20">
                                            {summary}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                        {isEditing && isOwner && (
                            <button
                                type="button"
                                onClick={handleAddSchedule}
                                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-[10px] border border-[#07b6d3] text-[#07b6d3] text-xs sm:text-sm font-medium hover:bg-[#07b6d3]/5 transition-colors cursor-pointer w-full"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add Operating Schedule Range</span>
                            </button>
                        )}
                    </div>
                )}
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
    const { firstName, lastName, email, role } = useAdminSession();
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
                        initialFirstName={firstName}
                        initialLastName={lastName}
                        initialEmail={email}
                        role={role.roleName}
                        onToast={showToast}
                    />
                    <DataManagementCard onToast={showToast} />
                </div>

                {/* Right column */}
                <div className="flex flex-col gap-6">
                    <SecurityCard email={email} onToast={showToast} />
                    <SystemPreferencesCard
                        roleName={role.roleName}
                        onToast={showToast}
                    />
                </div>
            </div>

            <FeedbackToast toast={toast} />
        </div>
    );
}
