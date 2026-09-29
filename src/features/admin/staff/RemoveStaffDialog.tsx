"use client";

import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { removeStaff, type StaffActionResult } from "@/app/admin/(protected)/staff/actions";

type RemoveStaffDialogProps = {
    isOpen: boolean;
    profileId: string;
    staffName: string;
    staffEmail: string;
    onClose: () => void;
    onResult: (result: StaffActionResult) => void;
};

export function RemoveStaffDialog({
    isOpen,
    profileId,
    staffName,
    staffEmail,
    onClose,
    onResult,
}: RemoveStaffDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setError("");
        setIsSubmitting(true);
        try {
            const result = await removeStaff(profileId);
            if (!result.success) {
                setError(result.error);
                return;
            }
            onClose();
            onResult(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to remove staff member.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => !isSubmitting && onClose()}
        >
            <div
                className="bg-white rounded-[20px] w-full max-w-[480px] shadow-[0px_4px_30px_0px_rgba(0,0,0,0.15)] p-8 flex flex-col gap-6"
                onClick={(e) => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="remove-staff-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-red-100 text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h2
                            id="remove-staff-title"
                            className="text-[#0f1422] text-xl font-medium leading-tight tracking-tight"
                        >
                            Remove Staff Account
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-1.5 rounded-lg text-[#c3c3c3] hover:text-[#0f1422] hover:bg-neutral-100 transition-colors disabled:opacity-50"
                        aria-label="Close dialog"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-col gap-3">
                    <p className="text-sm text-[#475569] leading-relaxed">
                        Are you sure you want to remove <strong className="text-[#0f1422]">{staffName || staffEmail}</strong> from the administrative staff roster?
                    </p>
                    <p className="text-xs text-[#94a3b8] leading-relaxed">
                        This action will immediately terminate all active back-office sessions and revoke administrative access. Historical consultation and quotation records associated with this account will be preserved.
                    </p>
                </div>

                {error && (
                    <div
                        role="alert"
                        className="bg-red-50 border border-red-300 text-red-700 text-sm rounded-lg p-3 text-center"
                    >
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-end mt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 rounded-[10px] border border-[#c3c3c3] text-sm text-[#0f1422] font-normal hover:bg-neutral-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        id="confirm-remove-staff-btn"
                        type="button"
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 rounded-[10px] bg-[#e74242] text-white text-sm font-normal hover:bg-[#d43737] transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting && (
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        )}
                        {isSubmitting ? "Removing..." : "Remove Staff"}
                    </button>
                </div>
            </div>
        </div>
    );
}
