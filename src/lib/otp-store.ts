import crypto from "crypto";
import { getAuthSecret } from "@/lib/auth/tokens";
import { rateLimit } from "@/lib/auth/rate-limit";

export type OtpPurpose = "signup" | "reset";

const OTP_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_CHALLENGE = 5;

function otpSignature(purpose: OtpPurpose, email: string, otp: string, expires: string): string {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(`${purpose}:${email}:${otp}:${expires}`)
    .digest("hex");
}

/**
 * Generates a 6-digit code plus a stateless challenge token. The token holds
 * an HMAC of the code, so verification works across serverless instances
 * without storing anything.
 */
export function createOtpChallenge(
  email: string,
  purpose: OtpPurpose
): { otp: string; challengeToken: string } {
  const otp = crypto.randomInt(100000, 1000000).toString();
  const expires = String(Date.now() + OTP_TTL_MS);
  return { otp, challengeToken: `${expires}.${otpSignature(purpose, email, otp, expires)}` };
}

export type OtpCheck = "ok" | "invalid" | "expired" | "locked";

export function checkOtpChallenge(
  email: string,
  purpose: OtpPurpose,
  otp: string,
  challengeToken: unknown
): OtpCheck {
  if (typeof challengeToken !== "string" || !challengeToken.includes(".")) return "invalid";
  if (!/^\d{6}$/.test(otp)) return "invalid";

  const [expires, signature] = challengeToken.split(".");
  if (!expires || !signature) return "invalid";
  if (Date.now() > Number(expires)) return "expired";

  // Cap guesses per challenge so a 6-digit code cannot be brute forced.
  const attempts = rateLimit(`otp-attempt:${challengeToken}`, MAX_ATTEMPTS_PER_CHALLENGE, OTP_TTL_MS);
  if (!attempts.ok) return "locked";

  const expected = otpSignature(purpose, email, otp, expires);
  const matches =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  return matches ? "ok" : "invalid";
}

export function otpErrorMessage(result: Exclude<OtpCheck, "ok">): string {
  switch (result) {
    case "expired":
      return "That code has expired. Request a new one.";
    case "locked":
      return "Too many wrong codes. Request a new one.";
    default:
      return "That code doesn't match. Check the latest email and try again.";
  }
}
