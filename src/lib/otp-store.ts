import crypto from "crypto";

// In-memory OTP and verification token cache with 15-minute expiration
interface OtpRecord {
  otp: string;
  token: string;
  name?: string;
  mobile?: string;
  expires: number;
}

const otpCache = new Map<string, OtpRecord>();

export function generateAndStoreOtp(
  email: string,
  name?: string,
  mobile?: string
): { otp: string; token: string } {
  const cleanEmail = email.trim().toLowerCase();
  // 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  // Secure random hex token for one-click email verify link
  const token = crypto.randomBytes(24).toString("hex");
  const expires = Date.now() + 15 * 60 * 1000; // 15 minutes

  otpCache.set(cleanEmail, { otp, token, name, mobile, expires });
  return { otp, token };
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

export function verifyOtp(email: string, submittedOtp: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  const record = otpCache.get(cleanEmail);

  if (!record) {
    return false;
  }

  if (Date.now() > record.expires) {
    otpCache.delete(cleanEmail);
    return false;
  }

  const isValid = record.otp === submittedOtp.trim();
  if (isValid) {
    otpCache.delete(cleanEmail);
  }
  return isValid;
}

export function verifyMagicToken(
  email: string,
  submittedToken: string
): { valid: boolean; name?: string; mobile?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const record = otpCache.get(cleanEmail);

  if (!record) {
    return { valid: false };
  }

  if (Date.now() > record.expires) {
    otpCache.delete(cleanEmail);
    return { valid: false };
  }

  if (record.token === submittedToken.trim()) {
    const info = { valid: true, name: record.name, mobile: record.mobile };
    otpCache.delete(cleanEmail);
    return info;
  }

  return { valid: false };
}
