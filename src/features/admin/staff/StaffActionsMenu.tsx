"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { MoreHorizontal, UserX, UserCheck, Mail, Trash2, CheckCircle2, Copy, Check, X } from "lucide-react";
import {
    suspendStaff,
    reactivateStaff,
    resendStaffInvite,
    type StaffActionResult,
    type InviteStaffResult,
} from "@/app/admin/(protected)/staff/actions";
import { useAdminSession } from "@/features/admin/auth/AdminSessionProvider";
import { RemoveStaffDialog } from "./RemoveStaffDialog";

type StaffActionsMenuProps = {
    profileId: string;
    email: string;
    status: string;
    roleName?: string;
    fullName?: string | null;
    onResult: (result: StaffActionResult) => void;
};

export function StaffActionsMenu({
    profileId,
    email,
    status,
    roleName = "Staff",
    fullName,
    onResult,
}: StaffActionsMenuProps) {
    const { profileId: currentProfileId, role } = useAdminSession();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRemoveOpen, setIsRemoveOpen] = useState(false);
    const [resendResult, setResendResult] = useState<InviteStaffResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ top: number; right: number; openUpwards: boolean } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const isSelf = profileId === currentProfileId;
    const isOwner = role.roleName.toLowerCase() === "owner";
    const isTargetOwner = roleName.toLowerCase() === "owner";
    const canRemove = isOwner && !isSelf && !isTargetOwner;

    const handleToggle = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpwards = spaceBelow < 220;

            setMenuPosition({
                top: openUpwards ? rect.top - 6 : rect.bottom + 6,
                right: Math.max(16, window.innerWidth - rect.right),
                openUpwards,
            });
        }
        setIsOpen((prev) => !prev);
    };

    useEffect(() => {
        if (!isOpen) return;

        const handleScrollOrResize = () => setIsOpen(false);
        window.addEventListener("scroll", handleScrollOrResize, true);
        window.addEventListener("resize", handleScrollOrResize);

        return () => {
            window.removeEventListener("scroll", handleScrollOrResize, true);
            window.removeEventListener("resize", handleScrollOrResize);
        };
    }, [isOpen]);

    const handleAction = async (action: () => Promise<StaffActionResult>) => {
        setIsOpen(false);
        setIsLoading(true);
        try {
            const result = await action();
            onResult(result);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        setIsOpen(false);
        setIsLoading(true);
        try {
            const result = await resendStaffInvite(email);
            if (result.success) {
                setResendResult(result);
                onResult({ success: true, message: result.message });
            } else {
                onResult({ success: false, error: result.error });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyCode = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (err) {
            console.error("Failed to copy code:", err);
        }
    };

    return (
        <div className="relative inline-flex items-center justify-end">
            <button
                ref={buttonRef}
                type="button"
                id={`staff-actions-${profileId}`}
                onClick={handleToggle}
                disabled={isLoading}
                className="p-1.5 rounded-lg text-[#c3c3c3] hover:text-[#0f1422] hover:bg-neutral-100 transition-colors disabled:opacity-50 cursor-pointer"
                aria-label="Staff actions"
            >
                {isLoading ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                ) : (
                    <MoreHorizontal className="w-4 h-4" />
                )}
            </button>

            {isOpen && menuPosition && typeof document !== "undefined" && createPortal(
                <AnimatePresence>
                  {isOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                          className="fixed inset-0 z-[9999]"
                          onClick={() => setIsOpen(false)}
                          aria-hidden="true"
                      />

                      {/* Dropdown */}
                      <motion.div
                          initial={{ opacity: 0, transform: "scale(0.95) translateY(-4px)" }}
                          animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
                          exit={{ opacity: 0, transform: "scale(0.95) translateY(-4px)" }}
                          transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                          style={{
                              position: "fixed",
                              top: menuPosition.openUpwards ? undefined : `${menuPosition.top}px`,
                              bottom: menuPosition.openUpwards ? `${window.innerHeight - menuPosition.top}px` : undefined,
                              right: `${menuPosition.right}px`,
                              transformOrigin: menuPosition.openUpwards ? "bottom right" : "top right",
                          }}
                          className="w-52 bg-white rounded-[10px] shadow-[0px_4px_20px_0px_rgba(0,0,0,0.12)] border border-neutral-100 z-[10000] overflow-hidden py-1"
                      >
                          {status === "Active" && !isSelf && (
                              <MenuButton
                                  icon={<UserX className="w-4 h-4" />}
                                  label="Suspend"
                                  className="text-[#e74242]"
                                  onClick={() =>
                                      handleAction(() => suspendStaff(profileId))
                                  }
                              />
                          )}

                          {status === "Suspended" && (
                              <MenuButton
                                  icon={<UserCheck className="w-4 h-4" />}
                                  label="Reactivate"
                                  className="text-[#05b64b]"
                                  onClick={() =>
                                      handleAction(() => reactivateStaff(profileId))
                                  }
                              />
                          )}

                          <MenuButton
                              icon={<Mail className="w-4 h-4 text-[#07b6d3]" />}
                              label="Resend Invite"
                              onClick={handleResend}
                          />

                          {canRemove && (
                              <>
                                  <div className="h-px bg-neutral-100 my-1" />
                                  <MenuButton
                                      icon={<Trash2 className="w-4 h-4" />}
                                      label="Remove Staff"
                                      className="text-[#e74242] hover:bg-red-50"
                                      onClick={() => {
                                          setIsOpen(false);
                                          setIsRemoveOpen(true);
                                      }}
                                  />
                              </>
                          )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>,
                document.body
            )}

            {/* Remove Staff Dialog */}
            <RemoveStaffDialog
                isOpen={isRemoveOpen}
                profileId={profileId}
                staffName={fullName || email}
                staffEmail={email}
                onClose={() => setIsRemoveOpen(false)}
                onResult={onResult}
            />

            {/* Resend Code Confirmation Modal */}
            {resendResult && resendResult.success && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => setResendResult(null)}
                >
                    <div
                        className="bg-white rounded-[20px] w-full max-w-[500px] shadow-[0px_4px_30px_0px_rgba(0,0,0,0.15)] p-8 flex flex-col gap-6"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-[#0f1422] text-xl font-medium leading-tight">
                                New Verification Code
                            </h2>
                            <button
                                type="button"
                                onClick={() => setResendResult(null)}
                                className="p-1.5 rounded-lg text-[#c3c3c3] hover:text-[#0f1422] hover:bg-neutral-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            <span>
                                Refreshed invitation dispatched to <strong>{resendResult.email}</strong>.
                            </span>
                        </div>

                        <div className="flex flex-col items-center gap-2 p-5 bg-neutral-50 border border-[#e2e8f0] rounded-2xl">
                            <span className="text-xs uppercase tracking-wider text-[#64748b] font-medium">
                                Refreshed 6-Digit Code
                            </span>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="font-mono text-3xl font-bold tracking-[0.25em] text-[#045e6d]">
                                    {resendResult.verificationCode}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleCopyCode(resendResult.verificationCode)}
                                    className="p-2 rounded-lg bg-white border border-[#cbd5e1] hover:bg-neutral-100 text-[#0f1422] transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
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
                            Share this new 6-digit verification code with the staff member. Previous codes for this email have been revoked.
                        </p>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setResendResult(null)}
                                className="px-6 py-2.5 rounded-[10px] bg-[#07b6d3] text-white text-sm font-normal hover:bg-[#06a4be] transition-colors cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MenuButton({
    icon,
    label,
    onClick,
    className = "",
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-normal text-[#0f1422] hover:bg-neutral-50 transition-colors text-left cursor-pointer ${className}`}
        >
            {icon}
            {label}
        </button>
    );
}
