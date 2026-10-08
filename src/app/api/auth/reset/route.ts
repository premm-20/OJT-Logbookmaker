import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth/config";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { authSuccess } from "@/lib/auth/session";
import { auditLogin } from "@/lib/auth/audit";
import { findUserByEmail, setPassword, toSessionUser } from "@/lib/auth/users";
import { checkOtpChallenge, otpErrorMessage } from "@/lib/otp-store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";

    const pwError = passwordProblem(body.password);
    if (pwError) return NextResponse.json({ error: pwError, field: "password" }, { status: 400 });

    const otpResult = checkOtpChallenge(email, "reset", otp, body.challengeToken);
    if (otpResult !== "ok") {
      return NextResponse.json({ error: otpErrorMessage(otpResult), field: "otp" }, { status: 401 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "No account uses this email." }, { status: 404 });
    }

    await setPassword(user.id, await hashPassword(body.password));
    const sessionUser = toSessionUser(user);
    await auditLogin(request, sessionUser, "password-reset");
    return authSuccess(sessionUser);
  } catch (err) {
    console.error("[reset]", err);
    return NextResponse.json({ error: "Couldn't reset your password. Please try again." }, { status: 500 });
  }
}
