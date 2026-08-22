"use client";

import { useState, type ReactNode } from "react";
import AdminNavbar from "@/components/ui/adminNavbar";
import AdminSidePanel from "@/components/ui/adminSidePanel";
import type { AdminContext } from "@/lib/auth/admin";

type AdminLayoutProps = {
    children: ReactNode;
    context: AdminContext;
};

export default function AdminLayout({ children, context }: AdminLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <main className="flex flex-col min-h-screen bg-[#F6F6F6]">
            <AdminNavbar
                context={context}
                onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            />
            <div className="flex flex-1 w-full relative items-stretch">
                <AdminSidePanel
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    permissions={context.role.permissions}
                />
                <div className="flex-1 min-w-0 w-full px-4 sm:px-6 lg:px-10 py-6 overflow-x-hidden">
                    {children}
                </div>
            </div>
        </main>
    );
}
