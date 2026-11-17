import crypto from "crypto";
import { signToken, verifyToken } from "./tokens";

/**
 * Admin portal auth: password only (the ADMIN_PASSWORD setting), no username;
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

// The password lives only in the hosting settings (ADMIN_PASSWORD), never in
// the code, so reading the repository can't get anyone into the admin panel.
export function getAdminPassword(): string | null {
  return process.env.ADMIN_PASSWORD?.trim() || null;
}

// Hash first so timingSafeEqual gets equal-length buffers and the length
// of the configured value is not leaked.
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkAdminPassword(password: string): boolean {
  const expected = getAdminPassword();
  return expected !== null && safeEqual(password, expected);
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
