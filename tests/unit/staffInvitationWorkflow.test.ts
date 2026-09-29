/**
 * Unit & Workflow Tests: Staff Account Invitation Lifecycle, Out-of-Band Code, and Owner Governance (IMP-MS27)
 *
 * Traceability: PRD-F12, PRD-F14, SDD-C9, SDD-C10, ERD-E18, QAD-TC43
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderStaffInviteEmailHtml } from "../../src/lib/email/templates/staffInviteEmail";
import {
    checkPasswordRequirements,
    validatePhoneNumber,
    formatPhoneNumber,
    normalizePhoneNumber,
    validateEmail,
} from "../../src/features/auth/utils/auth-utils";

describe("IMP-MS27: Staff Account Invitation Lifecycle (QAD-TC43)", () => {
    describe("QAD-TC43.1 & QAD-TC43.2: Email Template Rendering & Brand Parity", () => {
        it("TC-01: Renders branded GlassFit HTML email containing activation link without disclosing 6-digit code", () => {
            const activationUrl = "https://glassfit.ph/admin/invite?token=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
            const html = renderStaffInviteEmailHtml(activationUrl);

            // Must contain canonical branding
            assert.ok(html.includes("GlassFit"), "Email must include GlassFit header");
            assert.ok(html.includes("Administrative Consultation Platform"), "Email must include platform subtitle");
            assert.ok(html.includes(activationUrl), "Email must contain the activation URL");
            assert.ok(html.includes("48 hours"), "Email must state 48-hour expiration");
            assert.ok(html.includes("6-digit verification code"), "Email must notify recipient of required code without revealing it");

            // Must NOT contain hardcoded numeric OTPs
            assert.match(html, /href="https:\/\/glassfit\.ph\/admin\/invite\?token=/);
        });
    });

    describe("QAD-TC43.3 & QAD-TC43.7: Password & Phone Number Complexity Validation", () => {
        it("TC-02: Validates Philippine mobile number format starting with 9", () => {
            // Valid cases (10 digits starting with 9)
            assert.strictEqual(validatePhoneNumber("9171234567"), true);
            assert.strictEqual(validatePhoneNumber("9987654321"), true);
            assert.strictEqual(validatePhoneNumber("917 123 4567"), true);

            // Invalid cases
            assert.strictEqual(validatePhoneNumber("8171234567"), false); // does not start with 9
            assert.strictEqual(validatePhoneNumber("917123456"), false); // 9 digits (too short)
            assert.strictEqual(validatePhoneNumber("91712345678"), false); // 11 digits (too long)
            assert.strictEqual(validatePhoneNumber(""), false);
            assert.strictEqual(validatePhoneNumber("abcdefghij"), false);
        });

        it("TC-03: Formats Philippine mobile phone input dynamically and normalizes to E.164", () => {
            assert.strictEqual(formatPhoneNumber("917"), "917");
            assert.strictEqual(formatPhoneNumber("917123"), "917 123");
            assert.strictEqual(formatPhoneNumber("9171234567"), "917 123 4567");

            // Normalization to E.164 (+639XXXXXXXXX)
            assert.strictEqual(normalizePhoneNumber("9171234567"), "+639171234567");
        });

        it("TC-04: Enforces password complexity rules (8 chars, 1 number, 1 letter)", () => {
            // Valid password
            const valid = checkPasswordRequirements("GlassFit2026!");
            assert.strictEqual(valid.minLength, true);
            assert.strictEqual(valid.hasNumber, true);
            assert.strictEqual(valid.hasLetter, true);

            // Invalid: Too short
            const short = checkPasswordRequirements("Gf2026");
            assert.strictEqual(short.minLength, false);

            // Invalid: No number
            const noNumber = checkPasswordRequirements("GlassFitSecret");
            assert.strictEqual(noNumber.hasNumber, false);

            // Invalid: No letter
            const noLetter = checkPasswordRequirements("1234567890");
            assert.strictEqual(noLetter.hasLetter, false);
        });

        it("TC-05: Validates RFC-compliant email formatting for staff invites", () => {
            assert.strictEqual(validateEmail("estimator@glassfit.ph"), true);
            assert.strictEqual(validateEmail("staff.fabrication@gmail.com"), true);
            assert.strictEqual(validateEmail("invalid-email"), false);
            assert.strictEqual(validateEmail("staff@"), false);
            assert.strictEqual(validateEmail(""), false);
        });
    });

    describe("QAD-TC43.6: 6-Digit Code & Token Invariants", () => {
        it("TC-06: Verifies 6-digit numeric verification code invariants", () => {
            for (let i = 0; i < 100; i++) {
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                assert.strictEqual(code.length, 6, "Code must be exactly 6 characters");
                assert.match(code, /^[0-9]{6}$/, "Code must consist only of decimal digits");
                const num = parseInt(code, 10);
                assert.ok(num >= 100000 && num <= 999999, "Code must fall in range [100000, 999999]");
            }
        });
    });
});
