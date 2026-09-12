import { describe, it } from "node:test";
import assert from "node:assert";
import {
  ADMIN_PERMISSIONS,
  canPermission,
  parsePermissions,
  type AdminPermissions,
  type AdminPermissionKey,
} from "../../src/lib/auth/permissions.js";

describe("Authentication & RBAC Domain: Admin Permissions", () => {
  // --------------------------------------------------------------------------
  // 1. ADMIN_PERMISSIONS Constants
  // --------------------------------------------------------------------------
  describe("ADMIN_PERMISSIONS Registry", () => {
    it("should define all four standard role permission keys", () => {
      assert.strictEqual(ADMIN_PERMISSIONS.manageProducts, "manage_products");
      assert.strictEqual(ADMIN_PERMISSIONS.managePricing, "manage_pricing");
      assert.strictEqual(ADMIN_PERMISSIONS.manageRoles, "manage_roles");
      assert.strictEqual(ADMIN_PERMISSIONS.manageBookings, "manage_bookings");
    });
  });

  // --------------------------------------------------------------------------
  // 2. parsePermissions Parsing Utility
  // --------------------------------------------------------------------------
  describe("parsePermissions Utility", () => {
    it("should return all false flags when raw permissions is null or undefined", () => {
      const fromNull = parsePermissions(null);
      assert.deepStrictEqual(fromNull, {
        manageProducts: false,
        managePricing: false,
        manageRoles: false,
        manageBookings: false,
      });

      const fromUndefined = parsePermissions(undefined);
      assert.deepStrictEqual(fromUndefined, {
        manageProducts: false,
        managePricing: false,
        manageRoles: false,
        manageBookings: false,
      });
    });

    it("should correctly parse raw JSONB record with complete permissions", () => {
      const raw = {
        manage_products: true,
        manage_pricing: true,
        manage_roles: false,
        manage_bookings: true,
      };

      const parsed = parsePermissions(raw);
      assert.strictEqual(parsed.manageProducts, true);
      assert.strictEqual(parsed.managePricing, true);
      assert.strictEqual(parsed.manageRoles, false);
      assert.strictEqual(parsed.manageBookings, true);
    });

    it("should default omitted keys to false in partial JSONB records", () => {
      const partial = {
        manage_products: true,
      };

      const parsed = parsePermissions(partial);
      assert.strictEqual(parsed.manageProducts, true);
      assert.strictEqual(parsed.managePricing, false);
      assert.strictEqual(parsed.manageRoles, false);
      assert.strictEqual(parsed.manageBookings, false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. canPermission Check Utility
  // --------------------------------------------------------------------------
  describe("canPermission Authorization Evaluation", () => {
    const ownerPermissions: AdminPermissions = {
      manageProducts: true,
      managePricing: true,
      manageRoles: true,
      manageBookings: true,
    };

    const staffPermissions: AdminPermissions = {
      manageProducts: true,
      managePricing: false,
      manageRoles: false,
      manageBookings: true,
    };

    it("should allow all operations for full owner permissions", () => {
      assert.strictEqual(canPermission(ownerPermissions, "manage_products"), true);
      assert.strictEqual(canPermission(ownerPermissions, "manage_pricing"), true);
      assert.strictEqual(canPermission(ownerPermissions, "manage_roles"), true);
      assert.strictEqual(canPermission(ownerPermissions, "manage_bookings"), true);
    });

    it("should correctly restrict unauthorized operations for staff", () => {
      assert.strictEqual(canPermission(staffPermissions, "manage_products"), true);
      assert.strictEqual(canPermission(staffPermissions, "manage_pricing"), false);
      assert.strictEqual(canPermission(staffPermissions, "manage_roles"), false);
      assert.strictEqual(canPermission(staffPermissions, "manage_bookings"), true);
    });

    it("should safely return false for unrecognized keys", () => {
      // Cast invalid key to test runtime fallback robustness
      const invalidKey = "manage_finance" as unknown as AdminPermissionKey;
      assert.strictEqual(canPermission(ownerPermissions, invalidKey), false);
    });
  });
});
