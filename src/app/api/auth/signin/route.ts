import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth/config";
import { verifyPassword } from "@/lib/auth/password";
import { rateLimit, resetRateLimit, tooManyAttemptsMessage } from "@/lib/auth/rate-limit";
import { authSuccess, clientIp } from "@/lib/auth/session";
import { auditLogin } from "@/lib/auth/audit";
import { findUserByEmail, toSessionUser } from "@/lib/auth/users";

const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    }

    const emailKey = `signin:${email}`;
    const emailLimit = rateLimit(emailKey, 8, WINDOW_MS);
    const ipLimit = rateLimit(`signin-ip:${clientIp(request)}`, 40, WINDOW_MS);
    if (!emailLimit.ok || !ipLimit.ok) {
      return NextResponse.json(
        { error: tooManyAttemptsMessage(Math.max(emailLimit.retryAfterSeconds, ipLimit.retryAfterSeconds)) },
        { status: 429 }
      );
    }

    const user = await findUserByEmail(email);
    if (user && !user.password_hash && user.google_sub) {
      return NextResponse.json(
        {
          error:
            "This account signs in with Google. Use the Google button, or reset your password to add one.",
        },
        { status: 400 }
      );
    }
    if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    resetRateLimit(emailKey);
    const sessionUser = toSessionUser(user);
    await auditLogin(request, sessionUser, "password");
    return authSuccess(sessionUser);
  } catch (err) {
    console.error("[signin]", err);
    return NextResponse.json({ error: "Couldn't sign you in. Please try again." }, { status: 500 });
  }
}
