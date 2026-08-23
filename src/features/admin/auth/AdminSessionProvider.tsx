"use client";

import React, { createContext, useContext } from "react";
import type { AdminContext } from "@/lib/auth/admin";

/**
 * Client-side Admin session context.
 * Populated by the protected server layout and distributed to all
 * client components inside the Admin area.
 *
 * Do NOT refetch from every component — rely on this context.
 */
const AdminSessionContext = createContext<AdminContext | null>(null);

export function useAdminSession(): AdminContext {
    const ctx = useContext(AdminSessionContext);
    if (!ctx) {
        throw new Error(
            "useAdminSession must be used inside AdminSessionProvider. " +
            "Ensure the component is rendered within a protected Admin layout."
        );
    }
    return ctx;
}

/**
 * Provides the server-loaded AdminContext to all client components.
 * Rendered by the protected layout after requireAdmin() succeeds.
 */
export function AdminSessionProvider({
    context,
    children,
}: {
    context: AdminContext;
    children: React.ReactNode;
}) {
    return (
        <AdminSessionContext.Provider value={context}>
            {children}
        </AdminSessionContext.Provider>
    );
}
