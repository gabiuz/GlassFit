/**
 * GlassFit Safe Redirect Path Resolution Utility (IMP-MS41)
 *
 * Traceability: BRD-M4, PRD-F10, PRD-F12, PRD-F13, SDD-C5, SDD-C7, QAD-TC12, QAD-TC13
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

export interface SearchParamsGetter {
  get: (key: string) => string | null;
}

/**
 * Validates and extracts a safe internal relative path for post-auth navigation.
 * Prevents open-redirect vulnerabilities by rejecting external schemes,
 * protocol-relative URLs, backslashes, and control characters.
 *
 * Precedence: checks "next", then "redirect", then falls back to `fallback`.
 */
export function resolveSafeRedirectPath(
  searchParams?: SearchParamsGetter | null,
  fallback = "/"
): string {
  if (!searchParams) {
    return fallback;
  }

  const candidate = searchParams.get("next") || searchParams.get("redirect");
  if (!candidate) {
    return fallback;
  }

  const trimmed = candidate.trim();

  // Must start with a single forward slash and not a protocol-relative slash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  // Must not contain backslashes or null bytes
  if (trimmed.includes("\\") || trimmed.includes("\0")) {
    return fallback;
  }

  return trimmed;
}
