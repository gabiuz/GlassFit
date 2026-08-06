/**
 * Validates email format.
 */
export function validateEmail(email: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || normalizedEmail.length > 254) {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  return emailRegex.test(normalizedEmail);
}

/**
 * Password validation states.
 */
export interface PasswordRequirements {
  minLength: boolean;
  hasNumber: boolean;
  hasLetter: boolean;
}

/**
 * Checks password against criteria:
 * - At least 8 characters
 * - Include 1 number
 * - Include 1 letter
 */
export function checkPasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    hasNumber: /\d/.test(password),
    hasLetter: /[a-zA-Z]/.test(password),
  };
}

/**
 * Validates if the phone number fits the Ph prefix format (10 digits starting with 9).
 * E.g., 917 123 4567.
 */
export function validatePhoneNumber(phone: string): boolean {
  const cleanPhone = phone.replace(/\D/g, "");

  return /^9\d{9}$/.test(cleanPhone);
}


/**
 * Formats user input as 9XX XXX XXXX.
 */
export function formatPhoneNumber(value: string): string {
  const clean = value.replace(/\D/g, "").slice(0, 10);

  if (clean.length <= 3) {
    return clean;
  }

  if (clean.length <= 6) {
    return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  }

  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 10)}`;
}


/**
 * Converts the displayed phone number into E.164 format for storage in Supabase (example: 639171234567).
 */
export function normalizePhoneNumber(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, "");

  return `+63${cleanPhone}`;
}
