"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { validateEmail } from "@/features/auth/utils/auth-utils";
import { inviteStaff, type StaffActionResult } from "@/app/admin/(protected)/staff/actions";

type InviteStaffDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    onResult: (result: StaffActionResult) => void;
};

export function InviteStaffDialog({ isOpen, onClose, onResult }: InviteStaffDialogProps) {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const isFormValid =
        firstName.trim().length > 0 &&
        lastName.trim().length > 0 &&
        validateEmail(email);

    const handleClose = () => {
        if (isSubmitting) return;
        setFirstName("");
        setLastName("");
        setEmail("");
        setError("");
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!isFormValid) return;

        setIsSubmitting(true);
        try {
            const result = await inviteStaff({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim().toLowerCase(),
            });

            if (!result.success) {
                setError(result.error);
                return;
            }

            handleClose();
            onResult(result);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                onClick={handleClose}
            >
                {/* Dialog */}
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
                            Invite Staff Member
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

                    <p className="text-sm text-[#c3c3c3] leading-relaxed -mt-2">
                        The Staff member will receive an email invitation to activate their account.
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
                        {/* Name Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="invite-first-name"
                                    className="text-green text-sm font-normal leading-[1.4]"
                                >
                                    First Name
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
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="invite-last-name"
                                    className="text-green text-sm font-normal leading-[1.4]"
                                >
                                    Last Name
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
                                    required
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="invite-email"
                                className="text-green text-sm font-normal leading-[1.4]"
                            >
                                Email Address
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

                        {/* Role — fixed to Staff in v1 */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-green text-sm font-normal leading-[1.4]">
                                Role
                            </label>
                            <div className="w-full bg-neutral-50 border border-[#c3c3c3] rounded-lg px-4 py-2.5 text-sm text-[#c3c3c3]">
                                Staff
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
                </div>
            </div>
        </>
    );
}
