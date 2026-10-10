"use client";

export interface ApiResponse {
  error?: string;
  field?: string;
  user?: { id: string; name: string; email: string; mobile: string; avatarUrl: string | null };
}

/** POSTs JSON to one of this app's own API routes. */
export async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: ApiResponse }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as ApiResponse;
    if (!res.ok && !data.error) data.error = "Something went wrong. Please try again.";
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "You appear to be offline. Check your connection and try again." } };
  }
}

export interface NeonAuthError {
  code?: string;
  message?: string;
  status?: number;
}

/**
 * The Neon Auth client throws on failure (AuthApiError) rather than returning
 * `{ error }`. This normalises both styles to `{ data, error }`.
 */
export async function neonCall<T>(
  fn: () => Promise<{ data?: T | null; error?: unknown } | null | undefined>
): Promise<{ data: T | null; error: NeonAuthError | null }> {
  try {
    const result = await fn();
    return { data: result?.data ?? null, error: (result?.error as NeonAuthError | null | undefined) ?? null };
  } catch (err) {
    const e = (err ?? {}) as NeonAuthError;
    return { data: null, error: { code: e.code, message: e.message || "Something went wrong.", status: e.status } };
  }
}

function errorText(error: NeonAuthError): { code: string; message: string } {
  return { code: (error.code || "").toLowerCase(), message: (error.message || "").toLowerCase() };
}

export function isEmailNotVerified(error: NeonAuthError | null | undefined): boolean {
  if (!error) return false;
  const { code, message } = errorText(error);
  return code.includes("email_not_confirmed") || code.includes("email_not_verified") || message.includes("not verified");
}

/** Turns a Neon Auth error into a plain sentence for students. */
export function neonErrorMessage(error: NeonAuthError | null | undefined, fallback: string): string {
  if (!error) return fallback;
  const { code, message } = errorText(error);
  if (code.startsWith("network_")) return "Couldn't reach the sign-in service. Please try again.";
  if (code.includes("user_already_exists")) return "An account with this email already exists. Sign in instead.";
  if (code.includes("invalid_credentials") || code.includes("invalid_email_or_password")) {
    return "Email or password is incorrect.";
  }
  if (isEmailNotVerified(error)) return "Verify your email to continue.";
  if (code.includes("weak_password") || code.includes("password_too_short")) {
    return "Use 8 or more characters with a letter and a number.";
  }
  if (code.includes("user_not_found")) return "No account uses this email yet. Create one instead.";
  if (message.includes("too many") || code.includes("too_many_attempts")) return "Too many attempts. Request a new code.";
  if (code.includes("rate_limit") || error.status === 429) return "Too many attempts. Wait a minute and try again.";
  if (message.includes("expired")) return "That code has expired. Request a new one.";
  if (message.includes("otp") || message.includes("code")) {
    return "That code doesn't match. Check the latest email and try again.";
  }
  return error.message || fallback;
}

/** Absolute URL on this origin, as Neon Auth expects for redirects. */
export function absoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

/** Full navigation so server layouts re-read the new session. */
export function goTo(path: string): void {
  window.location.assign(path);
}

const PENDING_MOBILE_KEY = "ojt_pending_mobile";

/** Remembers the mobile typed at sign up in case onboarding has to finish later. */
export const pendingMobile = {
  set(mobile: string) {
    try {
      sessionStorage.setItem(PENDING_MOBILE_KEY, mobile);
    } catch {}
  },
  get(): string {
    try {
      return sessionStorage.getItem(PENDING_MOBILE_KEY) || "";
    } catch {
      return "";
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(PENDING_MOBILE_KEY);
    } catch {}
  },
};
