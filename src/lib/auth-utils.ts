/**
 * Validates email format.
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
  return cleanPhone.length === 10 && cleanPhone.startsWith("9");
}

/**
 * Formats user input as 9XX XXX XXXX.
 */
export function formatPhoneNumber(value: string): string {
  const clean = value.replace(/\D/g, "");
  if (clean.length === 0) return "";
  
  let formatted = "";
  if (clean.length <= 3) {
    formatted = clean;
  } else if (clean.length <= 6) {
    formatted = `${clean.slice(0, 3)} ${clean.slice(3)}`;
  } else {
    formatted = `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 10)}`;
  }
  return formatted;
}
