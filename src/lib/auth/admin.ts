import crypto from "crypto";
import { signToken, verifyToken } from "./tokens";

/**
 * Admin portal auth. Credentials come from ADMIN_USERNAME / ADMIN_PASSWORD;
 * the cookie holds a signed, expiring token with `typ: "admin"`, so a
 * student session token can never be replayed as an admin token.
 */

export const ADMIN_COOKIE = "ojt_admin_token";
export const ADMIN_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

interface AdminPayload {
  typ: "admin";
  sub: string;
  iat: number;
  exp: number;
}

/** Null when admin login is not configured, so callers can refuse it. */
export function getAdminCredentials(): { username: string; password: string } | null {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}

// Hash first so timingSafeEqual gets equal-length buffers and the length
// of the configured value is not leaked.
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkAdminCredentials(
  expected: { username: string; password: string },
  username: string,
  password: string
): boolean {
  // Evaluate both so a wrong username takes as long as a wrong password.
  const userOk = safeEqual(username, expected.username);
  const passOk = safeEqual(password, expected.password);
  return userOk && passOk;
}

export function createAdminToken(username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminPayload = {
    typ: "admin",
    sub: username,
    iat: now,
    exp: now + ADMIN_MAX_AGE_SECONDS,
  };
  return signToken({ ...payload });
}

export function readAdminToken(token: string | undefined | null): { username: string } | null {
  const payload = verifyToken<AdminPayload>(token, "admin");
  return payload ? { username: payload.sub } : null;
}
