import { NextResponse } from "next/server";
import { isUniversityEmail, normalizeEmail, normalizeMobile } from "@/lib/auth/config";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { authSuccess } from "@/lib/auth/session";
import { auditLogin } from "@/lib/auth/audit";
import { AuthError, createUser, toSessionUser } from "@/lib/auth/users";
import { checkOtpChallenge, otpErrorMessage } from "@/lib/otp-store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    const email = normalizeEmail(body.email);
    const mobile = normalizeMobile(body.mobile);
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
    }
    if (!isUniversityEmail(email)) {
      return NextResponse.json({ error: "Use your university email address." }, { status: 400 });
    }
    if (mobile.length !== 10) {
      return NextResponse.json({ error: "Mobile number must be 10 digits." }, { status: 400 });
    }
    const pwError = passwordProblem(body.password);
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

    const otpResult = checkOtpChallenge(email, "signup", otp, body.challengeToken);
    if (otpResult !== "ok") {
      return NextResponse.json({ error: otpErrorMessage(otpResult), field: "otp" }, { status: 401 });
    }

    const user = await createUser({
      name,
      email,
      mobile,
      passwordHash: await hashPassword(body.password),
    });

    const sessionUser = toSessionUser(user);
    await auditLogin(request, sessionUser, "signup");
    return authSuccess(sessionUser);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[signup]", err);
    return NextResponse.json({ error: "Couldn't create your account. Please try again." }, { status: 500 });
  }
}
