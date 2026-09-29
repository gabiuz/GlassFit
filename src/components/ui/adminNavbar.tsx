"use client";

import Image from "next/image";
import { Menu, LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AdminContext } from "@/lib/auth/admin";

type AdminNavbarProps = {
    onToggleSidebar?: () => void;
    context: AdminContext;
};

export default function AdminNavbar({ onToggleSidebar, context }: AdminNavbarProps) {
    return (
        <header className="w-full bg-white border-b border-white shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] px-4 sm:px-8 lg:px-[87px] py-3 sm:py-4 lg:py-[19px] z-30 sticky top-0">
            <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        type="button"
                        onClick={onToggleSidebar}
                        className="lg:hidden p-2 rounded-lg text-[#0F1422] hover:bg-neutral-100 transition-colors -ml-1"
                        aria-label="Toggle navigation menu"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="flex items-center">
                        <Image
                            src="/Logo.svg"
                            alt="Glassfit Logo"
                            width={160}
                            height={68}
                            priority
                            className="h-10 sm:h-12 lg:h-[68px] w-auto object-contain"
                        />
                    </div>
                </div>
                <AdminProfileMenu context={context} />
            </div>
        </header>
    );
}

function AdminProfileMenu({ context }: { context: AdminContext }) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleLogout = async () => {
        setIsSigningOut(true);
        setIsOpen(false);
        try {
            const supabase = createSupabaseBrowserClient();
            await supabase.auth.signOut();
            router.push("/admin/login");
            router.refresh();
        } catch {
            setIsSigningOut(false);
        }
    };

    const initials = context.fullName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    return (
        <div className="relative">
            <button
                type="button"
                id="admin-profile-menu-btn"
                onClick={() => setIsOpen((prev) => !prev)}
                className="px-3 sm:px-5 py-2 sm:py-2.5 bg-neutral-100 rounded-[10px] flex justify-start items-center gap-2 sm:gap-2.5 hover:bg-neutral-200 transition-colors"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <div className="size-8 bg-gradient-to-r from-[#097283] to-[#45c9e3] rounded-full flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-medium">{initials}</span>
                </div>
                <div className="hidden sm:flex flex-col justify-center items-start">
                    <p className="text-[#0F1422] text-[15px] lg:text-[16px] font-normal leading-[1.4] tracking-[-0.304px] whitespace-nowrap pointer-events-none">
                        {context.fullName}
                    </p>
                    <p className="text-[#0F1422] text-[11px] lg:text-[12px] font-normal leading-[1.4] tracking-[-0.228px] pointer-events-none">
                        {context.role.roleName}
                    </p>
                </div>
                <ChevronDown
                    className={`w-4 h-4 text-[#0f1422] transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-[10px] shadow-[0px_4px_20px_0px_rgba(0,0,0,0.12)] border border-neutral-100 z-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-neutral-100">
                            <p className="text-xs text-[#c3c3c3] truncate">{context.email}</p>
                        </div>
                        <button
                            id="admin-logout-btn"
                            type="button"
                            onClick={handleLogout}
                            disabled={isSigningOut}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[#e74242] hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                            {isSigningOut ? (
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            ) : (
                                <LogOut className="w-4 h-4" />
                            )}
                            {isSigningOut ? "Signing out..." : "Sign Out"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
