/**
 * Admin permission keys — must match the keys stored in admin_roles.permissions JSONB.
 */
export const ADMIN_PERMISSIONS = {
    manageProducts: "manage_products",
    managePricing: "manage_pricing",
    manageRoles: "manage_roles",
    manageBookings: "manage_bookings",
} as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

/**
 * Parsed permission flags used throughout the Admin UI and server helpers.
 */
export type AdminPermissions = {
    manageProducts: boolean;
    managePricing: boolean;
    manageRoles: boolean;
    manageBookings: boolean;
};

/**
 * Client-safe utility for conditional rendering / navigation.
 * Do NOT use this as the only authorization check — always back it with
 * server-side requirePermission() on mutations.
 */
export function canPermission(
    permissions: AdminPermissions,
    key: AdminPermissionKey
): boolean {
    switch (key) {
        case "manage_products":
            return permissions.manageProducts;
        case "manage_pricing":
            return permissions.managePricing;
        case "manage_roles":
            return permissions.manageRoles;
        case "manage_bookings":
            return permissions.manageBookings;
        default:
            return false;
    }
}

/**
 * Converts a raw JSONB permissions record from the database into the
 * typed AdminPermissions object used by the application.
 */
export function parsePermissions(
    raw: Record<string, boolean> | null | undefined
): AdminPermissions {
    return {
        manageProducts: raw?.manage_products ?? false,
        managePricing: raw?.manage_pricing ?? false,
        manageRoles: raw?.manage_roles ?? false,
        manageBookings: raw?.manage_bookings ?? false,
    };
}
