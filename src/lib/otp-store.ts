import crypto from "crypto";

// Fallback secret for HMAC token signing (can be overridden by environment variable)
const HMAC_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  process.env.GEMINI_API_KEY ||
  "msu-ojt-logbook-secret-hmac-salt-key-2026";

interface OtpRecord {
  otp: string;
  token: string;
  name?: string;
  mobile?: string;
  expires: number;
}

// In-memory cache for single-instance development fallback
const otpCache = new Map<string, OtpRecord>();

/**
 * Generates an OTP, a stateless signed challengeToken, and a magic link token.
 * This guarantees verification works across all serverless Vercel function instances!
 */
export function generateAndStoreOtp(
  email: string,
  name?: string,
  mobile?: string
): { otp: string; token: string; challengeToken: string } {
  const cleanEmail = email.trim().toLowerCase();
  // 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 15 * 60 * 1000; // 15 minutes

  // 1. In-memory storage (local dev fallback)
  const tokenPayload = Buffer.from(
    JSON.stringify({ n: name || "", m: mobile || "" })
  ).toString("base64url");

  // 2. Stateless HMAC for OTP verification (works across all serverless workers!)
  const otpHmac = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(`${cleanEmail}:${otp}:${expires}`)
    .digest("hex");
  const challengeToken = `${expires}.${otpHmac}`;

  // 3. Stateless Magic Link verification token
  const magicHmac = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(`${cleanEmail}:magic:${expires}:${tokenPayload}`)
    .digest("hex");
  const token = `${expires}.${tokenPayload}.${magicHmac}`;

  otpCache.set(cleanEmail, { otp, token, name, mobile, expires });

  return { otp, token, challengeToken };
}

export function getPendingOtpRecord(email: string): OtpRecord | null {
  const cleanEmail = email.trim().toLowerCase();
  const record = otpCache.get(cleanEmail);
  if (!record) return null;
  if (Date.now() > record.expires) {
    otpCache.delete(cleanEmail);
    return null;
  }
  return record;
}

/**
 * Verifies OTP using:
 * 1. Stateless HMAC challengeToken (Serverless proof, works on Vercel across instances)
 * 2. In-memory cache (Local dev fallback)
 */
export function verifyOtp(
  email: string,
  submittedOtp: string,
  challengeToken?: string
): boolean {
  const cleanEmail = email.trim().toLowerCase();
  const cleanSubmittedOtp = submittedOtp.trim();

  if (!cleanSubmittedOtp || cleanSubmittedOtp.length !== 6) {
    return false;
  }

  // ── Strategy A: Stateless HMAC token verification (Vercel Serverless) ──
  if (challengeToken && challengeToken.includes(".")) {
    try {
      const [expiresStr, signature] = challengeToken.split(".");
      const expires = parseInt(expiresStr, 10);

      // Check expiration (15 minutes)
      if (Date.now() <= expires) {
        const expectedHmac = crypto
          .createHmac("sha256", HMAC_SECRET)
          .update(`${cleanEmail}:${cleanSubmittedOtp}:${expiresStr}`)
          .digest("hex");

        if (
          signature.length === expectedHmac.length &&
          crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac))
        ) {
          otpCache.delete(cleanEmail);
          return true;
        }
      }
    } catch (err) {
      console.warn("HMAC verification error:", err);
    }
  }

  // ── Strategy B: In-memory cache fallback (Single-process dev) ──
  const record = otpCache.get(cleanEmail);
  if (record) {
    if (Date.now() > record.expires) {
      otpCache.delete(cleanEmail);
      return false;
    }

    if (record.otp === cleanSubmittedOtp) {
      otpCache.delete(cleanEmail);
      return true;
    }
  }

  return false;
}

/**
 * Verifies Magic Link token across serverless instances using HMAC signature
 */
export function verifyMagicToken(
  email: string,
  submittedToken: string
): { valid: boolean; name?: string; mobile?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = submittedToken.trim();

  // ── Strategy A: Stateless HMAC verification ──
  if (cleanToken.includes(".")) {
    const parts = cleanToken.split(".");
    if (parts.length === 3) {
      const [expiresStr, payloadBase64, signature] = parts;
      const expires = parseInt(expiresStr, 10);

      if (Date.now() <= expires) {
        const expectedHmac = crypto
          .createHmac("sha256", HMAC_SECRET)
          .update(`${cleanEmail}:magic:${expiresStr}:${payloadBase64}`)
          .digest("hex");

        if (
          signature.length === expectedHmac.length &&
          crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac))
        ) {
          otpCache.delete(cleanEmail);
          try {
            const parsed = JSON.parse(
              Buffer.from(payloadBase64, "base64url").toString("utf8")
            );
            return {
              valid: true,
              name: parsed.n || undefined,
              mobile: parsed.m || undefined,
            };
          } catch {
            return { valid: true };
          }
        }
      }
    }
  }

  // ── Strategy B: In-memory cache fallback ──
  const record = otpCache.get(cleanEmail);
  if (!record) {
    return { valid: false };
  }

  if (Date.now() > record.expires) {
    otpCache.delete(cleanEmail);
    return { valid: false };
  }

  if (record.token === cleanToken) {
    const info = { valid: true, name: record.name, mobile: record.mobile };
    otpCache.delete(cleanEmail);
    return info;
  }

  return { valid: false };
}
