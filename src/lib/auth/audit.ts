import { recordUserLogin } from "@/lib/login-tracker";
import { clientIp } from "./session";
import { touchLastLogin } from "./users";
import type { SessionUser } from "./tokens";

/** Records a successful sign in for the admin login log. Never throws. */
export async function auditLogin(request: Request, user: SessionUser, method: string): Promise<void> {
  try {
    await Promise.all([
      touchLastLogin(user.id),
      recordUserLogin({
        userId: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        ipAddress: clientIp(request),
        userAgent: `${request.headers.get("user-agent") || ""} [${method}]`.trim(),
      }),
    ]);
  } catch (err) {
    console.warn("[auth] Could not record login:", err);
  }
}
