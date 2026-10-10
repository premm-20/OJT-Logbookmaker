/**
 * Auth configuration shared by client and server code.
 * Nothing secret lives here.
 */

export const UNIVERSITY_DOMAIN_LABEL = "@medhaviskillsuniversity.edu.in";

// Accepts @medhaviskillsuniversity.edu.in and @medhaviskills.university.edu.in
export const UNIVERSITY_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@medhaviskills(?:\.university|university)\.edu\.in$/i;

export const PASSWORD_MIN_LENGTH = 8;

export function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function normalizeMobile(mobile: unknown): string {
  return typeof mobile === "string" ? mobile.replace(/\D/g, "") : "";
}

export function isUniversityEmail(email: string): boolean {
  return UNIVERSITY_EMAIL_REGEX.test(email);
}

/** Only allow same-origin relative redirects after sign in. */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}
