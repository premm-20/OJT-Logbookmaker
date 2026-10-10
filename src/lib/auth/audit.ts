import { recordUserLogin } from "@/lib/login-tracker";
import { touchLastLogin } from "./users";
import type { SessionUser } from "./session";

// Neon sessions recorded by this server instance, so a login is logged once
// per session rather than on every dashboard render.
const recorded = new Set<string>();

/** Records a sign in for the admin login log, once per Neon session. Never throws. */
export async function auditLogin(user: SessionUser, sessionId: string, headers: Headers): Promise<void> {
  if (recorded.has(sessionId)) return;
  recorded.add(sessionId);
  if (recorded.size > 10000) recorded.clear();

  try {
    const forwarded = headers.get("x-forwarded-for");
    await Promise.all([
      touchLastLogin(user.id),
      recordUserLogin({
        sessionId: `sess_neon_${sessionId}`,
        userId: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        ipAddress: forwarded ? forwarded.split(",")[0].trim() : headers.get("x-real-ip") || "127.0.0.1",
        userAgent: headers.get("user-agent") || "",
      }),
    ]);
  } catch (err) {
    console.warn("[auth] Could not record login:", err);
  }
}
