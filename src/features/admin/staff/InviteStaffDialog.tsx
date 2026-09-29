"use client";

import { useState } from "react";
import { X, CheckCircle2, Copy, Check } from "lucide-react";
import { validateEmail } from "@/features/auth/utils/auth-utils";
import { inviteStaff, type InviteStaffResult } from "@/app/admin/(protected)/staff/actions";

type InviteStaffDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    onResult: (result: InviteStaffResult) => void;
};

export function InviteStaffDialog({ isOpen, onClose, onResult }: InviteStaffDialogProps) {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Phase 2 state
    const [createdCode, setCreatedCode] = useState<string | null>(null);
    const [targetEmail, setTargetEmail] = useState("");
    const [copied, setCopied] = useState(false);

    const isFormValid = validateEmail(email.trim().toLowerCase());

    const handleClose = () => {
        if (isSubmitting) return;
        setFirstName("");
        setLastName("");
        setEmail("");
        setError("");
        setCreatedCode(null);
        setTargetEmail("");
        setCopied(false);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!isFormValid) return;

        setIsSubmitting(true);
        try {
            const result = await inviteStaff({
                email: email.trim().toLowerCase(),
                firstName: firstName.trim() || undefined,
                lastName: lastName.trim() || undefined,
            });

            if (!result.success) {
                setError(result.error);
                return;
            }

            setCreatedCode(result.verificationCode);
            setTargetEmail(result.email);
            onResult(result);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopy = async () => {
        if (!createdCode) return;
        try {
            await navigator.clipboard.writeText(createdCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (err) {
            console.error("Failed to copy code:", err);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={handleClose}
        >
            <div
                className="bg-white rounded-[20px] w-full max-w-[520px] shadow-[0px_4px_30px_0px_rgba(0,0,0,0.15)] p-8 flex flex-col gap-6"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="invite-dialog-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2
                        id="invite-dialog-title"
                        className="text-[#0f1422] text-xl font-medium leading-tight tracking-tight"
                    >
                        {createdCode ? "Staff Invitation Sent" : "Invite Staff Member"}
                    </h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="p-1.5 rounded-lg text-[#c3c3c3] hover:text-[#0f1422] hover:bg-neutral-100 transition-colors disabled:opacity-50"
                        aria-label="Close dialog"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Phase 2: Verification Code Confirmation */}
                {createdCode ? (
                    <div className="flex flex-col gap-5">
                        <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            <span>
                                An activation email has been dispatched to <strong>{targetEmail}</strong>.
                            </span>
                        </div>

                        <div className="flex flex-col items-center gap-2 p-5 bg-neutral-50 border border-[#e2e8f0] rounded-2xl">
                            <span className="text-xs uppercase tracking-wider text-[#64748b] font-medium">
                                6-Digit Admin Verification Code
                            </span>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="font-mono text-3xl font-bold tracking-[0.25em] text-[#045e6d]">
                                    {createdCode}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="p-2 rounded-lg bg-white border border-[#cbd5e1] hover:bg-neutral-100 text-[#0f1422] transition-colors flex items-center gap-1.5 text-xs font-medium"
                                    title="Copy verification code"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-4 h-4 text-emerald-600" />
                                            <span className="text-emerald-600">Copied</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4 text-[#64748b]" />
                                            <span>Copy</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <p className="text-xs text-[#64748b] leading-relaxed bg-[#f0fdfa] p-3.5 rounded-xl border border-[#ccfbf1]">
                            <strong>Important:</strong> Provide this 6-digit verification code to the invited staff member via an out-of-band channel (in person, SMS, phone call, or secure chat). They will need this code alongside their activation email link to complete account setup.
                        </p>

                        <div className="flex justify-end mt-2">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-6 py-2.5 rounded-[10px] bg-[#07b6d3] text-white text-sm font-normal hover:bg-[#06a4be] transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Phase 1: Input Form */
                    <>
                        <p className="text-sm text-[#64748b] leading-relaxed -mt-2">
                            The staff member will receive an email invitation link. You will be provided a 6-digit verification code to share with them out-of-band.
                        </p>

                        {error && (
                            <div
                                role="alert"
                                className="bg-red-50 border border-red-300 text-red-700 text-sm rounded-lg p-3 text-center"
                            >
                                {error}
                            </div>
                        )}

                        <form
                            id="invite-staff-form"
                            onSubmit={handleSubmit}
                            noValidate
                            className="flex flex-col gap-5"
                        >
                            {/* Email */}
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="invite-email"
                                    className="text-green text-sm font-normal leading-[1.4]"
                                >
                                    Staff Email Address *
                                </label>
                                <input
                                    id="invite-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (error) setError("");
                                    }}
                                    placeholder="staff@example.com"
                                    autoComplete="email"
                                    inputMode="email"
                                    spellCheck={false}
                                    className="w-full bg-white border border-[#c3c3c3] rounded-lg px-4 py-2.5 text-sm text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                                    required
                                />
                            </div>

                            {/* Name Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="invite-first-name"
                                        className="text-green text-sm font-normal leading-[1.4]"
                                    >
                                        First Name (Optional)
                                    </label>
                                    <input
                                        id="invite-first-name"
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => {
                                            setFirstName(e.target.value);
                                            if (error) setError("");
                                        }}
                                        placeholder="First name"
                                        className="w-full bg-white border border-[#c3c3c3] rounded-lg px-4 py-2.5 text-sm text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="invite-last-name"
                                        className="text-green text-sm font-normal leading-[1.4]"
                                    >
                                        Last Name (Optional)
                                    </label>
                                    <input
                                        id="invite-last-name"
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => {
                                            setLastName(e.target.value);
                                            if (error) setError("");
                                        }}
                                        placeholder="Last name"
                                        className="w-full bg-white border border-[#c3c3c3] rounded-lg px-4 py-2.5 text-sm text-black outline-none placeholder:text-[#c3c3c3] focus:border-green focus:ring-1 focus:ring-green transition-all"
                                    />
                                </div>
                            </div>

                            {/* Role - fixed to Staff in v1 */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-green text-sm font-normal leading-[1.4]">
                                    Role
                                </label>
                                <div className="w-full bg-neutral-50 border border-[#c3c3c3] rounded-lg px-4 py-2.5 text-sm text-[#64748b]">
                                    Staff (Administrative Operations &amp; Bookings)
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 justify-end mt-2">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 rounded-[10px] border border-[#c3c3c3] text-sm text-[#0f1422] font-normal hover:bg-neutral-50 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    id="invite-staff-submit"
                                    type="submit"
                                    disabled={!isFormValid || isSubmitting}
                                    className={`px-6 py-2.5 rounded-[10px] text-sm text-white font-normal transition-all flex items-center gap-2 ${
                                        isFormValid && !isSubmitting
                                            ? "bg-[#07b6d3] hover:bg-[#06a4be] cursor-pointer"
                                            : "bg-[#c3c3c3] pointer-events-none"
                                    }`}
                                >
                                    {isSubmitting && (
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    )}
                                    {isSubmitting ? "Sending..." : "Send Invitation"}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
