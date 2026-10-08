/**
 * Auth configuration shared by client and server code.
 * Nothing secret lives here.
 */

export const SESSION_COOKIE = "ojt_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const UNIVERSITY_DOMAIN_LABEL = "@medhaviskillsuniversity.edu.in";

// Accepts @medhaviskillsuniversity.edu.in and @medhaviskills.university.edu.in
export const UNIVERSITY_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@medhaviskills(?:\.university|university)\.edu\.in$/i;

export const PASSWORD_MIN_LENGTH = 8;

// The OAuth client ID is public by design (it is embedded in the GSI button).
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "516759701042-1j43chkqtgl8hf49j0cql8gf34sun3e9.apps.googleusercontent.com";

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
