/**
 * GlassFit Base URL Resolver for Signed Consultation Reference Links (IMP-MS13)
 *
 * Provides deterministic base URL resolution across server-side request headers,
 * environment variables, and client-side browser origins.
 *
 * Traceability Codes: PRD-F13, SDD-C8, DSD-UI8, QAD-TC13, BAN-TYPE-05
 */

import { headers } from "next/headers";

export interface BookingUrls {
  shareableUrl: string;
  displayBadge: string;
  tokenUrl: string;
}

export type ResolvedBookingUrls = BookingUrls;

/**
 * Resolves the application base URL in a server context (Server Actions, Route Handlers, Server Components).
 * Checks explicit environment variables, inspects incoming request headers, or falls back to standard ports.
 */
export async function getServerBaseUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.replace(/\/+$/, "");
  }

  try {
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host");
    const proto = headerList.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");

    if (host) {
      return `${proto}://${host}`;
    }
  } catch {
    // Fallback when headers() is called outside an active HTTP request context (e.g. background job/test)
  }

  return process.env.NODE_ENV === "production" ? "https://glassfit.ph" : "http://localhost:3000";
}

/**
 * Resolves the application base URL in a client-side browser context.
 */
export function getClientBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.replace(/\/+$/, "");
  }
  return process.env.NODE_ENV === "production" ? "https://glassfit.ph" : "http://localhost:3000";
}

/**
 * Assembles fully qualified shareable URLs, cosmetic display badges, and cryptographic token URLs.
 */
export function generateBookingUrls(
  referenceCode: string,
  tokenHash: string,
  baseUrl: string
): BookingUrls {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const hostOnly = cleanBase.replace(/^https?:\/\//, "");
  const cleanRef = referenceCode.toUpperCase();

  return {
    shareableUrl: `${cleanBase}/q/${cleanRef}`,
    displayBadge: `${hostOnly}/q/${cleanRef.toLowerCase()}`,
    tokenUrl: `${cleanBase}/q/${tokenHash}`,
  };
}

/**
 * Alias for generateBookingUrls per specification contract.
 */
export const buildBookingUrls = generateBookingUrls;
