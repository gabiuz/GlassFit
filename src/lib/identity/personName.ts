// PRD-F12, PRD-F14: Canonical person-name normalization for every identity surface.

export interface PersonNameInput {
    firstName: string;
    lastName?: string;
}

export interface NormalizedPersonName {
    firstName: string;
    lastName: string;
    fullName: string;
}

export type PersonNameResult =
    | { ok: true; value: NormalizedPersonName }
    | { ok: false; field: "firstName" | "lastName"; error: string };

const SUPPORTED_NAME_CHARACTERS = /^[\p{L}\p{M}\p{Zs}.\p{Pd}'\u2018\u2019\u02BC]*$/u;
const HAS_LETTER = /\p{L}/u;
const HAS_CONTROL = /[\p{Cc}\p{Cf}]/u;

function normalizeField(value: string): string {
    return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

function validateField(
    field: "firstName" | "lastName",
    value: string,
    required: boolean,
): PersonNameResult | null {
    const label = field === "firstName" ? "First name" : "Last name";
    if (!value) {
        return required ? { ok: false, field, error: `${label} is required.` } : null;
    }
    if (Array.from(value).length > 50) {
        return { ok: false, field, error: `${label} must be 50 characters or fewer.` };
    }
    if (!HAS_LETTER.test(value)) {
        return { ok: false, field, error: `${label} must contain at least one letter.` };
    }
    if (!SUPPORTED_NAME_CHARACTERS.test(value)) {
        return { ok: false, field, error: `${label} contains unsupported characters.` };
    }
    return null;
}

export function normalizePersonName(input: PersonNameInput): PersonNameResult {
    if (HAS_CONTROL.test(input.firstName)) {
        return { ok: false, field: "firstName", error: "First name contains unsupported characters." };
    }
    if (HAS_CONTROL.test(input.lastName ?? "")) {
        return { ok: false, field: "lastName", error: "Last name contains unsupported characters." };
    }
    const firstName = normalizeField(input.firstName);
    const lastName = normalizeField(input.lastName ?? "");
    const firstError = validateField("firstName", firstName, true);
    if (firstError) return firstError;
    const lastError = validateField("lastName", lastName, false);
    if (lastError) return lastError;
    return {
        ok: true,
        value: {
            firstName,
            lastName,
            fullName: [firstName, lastName].filter(Boolean).join(" "),
        },
    };
}
