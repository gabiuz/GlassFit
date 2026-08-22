"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, UserX, UserCheck, Mail } from "lucide-react";
import { suspendStaff, reactivateStaff, resendInvite, type StaffActionResult } from "@/app/admin/(protected)/staff/actions";
import { useAdminSession } from "@/features/admin/auth/AdminSessionProvider";

type StaffActionsMenuProps = {
    profileId: string;
    email: string;
    status: string;
    onResult: (result: StaffActionResult) => void;
};

export function StaffActionsMenu({ profileId, email, status, onResult }: StaffActionsMenuProps) {
    const { profileId: currentProfileId } = useAdminSession();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ top: number; right: number; openUpwards: boolean } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const isSelf = profileId === currentProfileId;

    const handleToggle = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpwards = spaceBelow < 180;

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

    return (
        <div className="relative inline-flex items-center justify-end">
            <button
                ref={buttonRef}
                type="button"
                id={`staff-actions-${profileId}`}
                onClick={handleToggle}
                disabled={isLoading}
                className="p-1.5 rounded-lg text-[#c3c3c3] hover:text-[#0f1422] hover:bg-neutral-100 transition-colors disabled:opacity-50"
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
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[9999]"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />

                    {/* Dropdown */}
                    <div
                        style={{
                            position: "fixed",
                            top: menuPosition.openUpwards ? undefined : `${menuPosition.top}px`,
                            bottom: menuPosition.openUpwards ? `${window.innerHeight - menuPosition.top}px` : undefined,
                            right: `${menuPosition.right}px`,
                        }}
                        className="w-48 bg-white rounded-[10px] shadow-[0px_4px_20px_0px_rgba(0,0,0,0.12)] border border-neutral-100 z-[10000] overflow-hidden"
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
                            icon={<Mail className="w-4 h-4" />}
                            label="Resend Invite"
                            onClick={() =>
                                handleAction(() => resendInvite(email))
                            }
                        />
                    </div>
                </>,
                document.body
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
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-normal text-[#0f1422] hover:bg-neutral-50 transition-colors text-left ${className}`}
        >
            {icon}
            {label}
        </button>
    );
}
