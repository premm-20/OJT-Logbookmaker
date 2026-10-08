import crypto from "crypto";

/**
 * HMAC-signed tokens: base64url(JSON payload) + "." + base64url(signature).
 * Used for the session cookie and short-lived Google sign-up tokens.
 * Pure Node crypto, so it is safe to import from proxy.ts.
 */

const DEV_FALLBACK_SECRET = "dev-only-insecure-secret-set-AUTH_SECRET-in-env-local";

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters. Generate one with `openssl rand -base64 48` and add it to your environment."
    );
  }
  return DEV_FALLBACK_SECRET;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", getAuthSecret()).update(data).digest("base64url");
}

export function signToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Returns the payload when the signature is valid, `typ` matches and it has
 * not expired (`exp` is in seconds). Returns null otherwise.
 */
export function verifyToken<T extends { typ: string; exp: number }>(
  token: string | undefined | null,
  typ: T["typ"]
): T | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(body);
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
    if (payload.typ !== typ) return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  avatarUrl: string | null;
}

interface SessionPayload extends SessionUser {
  typ: "session";
  iat: number;
  exp: number;
}

export function createSessionToken(user: SessionUser, maxAgeSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    typ: "session",
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    avatarUrl: user.avatarUrl,
    iat: now,
    exp: now + maxAgeSeconds,
  };
  return signToken({ ...payload });
}

export function readSessionToken(token: string | undefined | null): SessionUser | null {
  const payload = verifyToken<SessionPayload>(token, "session");
  if (!payload) return null;
  return {
    id: payload.id,
    name: payload.name,
    email: payload.email,
    mobile: payload.mobile,
    avatarUrl: payload.avatarUrl ?? null,
  };
}
