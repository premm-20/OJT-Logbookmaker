import { NextResponse } from "next/server";
import { normalizeEmail, normalizeMobile } from "@/lib/auth/config";
import { verifyUniversityEmail } from "@/lib/email-verifier";
import { rateLimit, tooManyAttemptsMessage } from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/auth/session";
import { AuthError, assertMobileAvailable } from "@/lib/auth/users";

/**
 * Pre-checks sign-up details before the account is created in Neon Auth, so
 * students learn about a wrong domain or a taken mobile number up front.
 */
export async function POST(request: Request) {
  try {
    const limit = rateLimit(`account-check:${clientIp(request)}`, 30, 15 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: tooManyAttemptsMessage(limit.retryAfterSeconds) }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const mobile = normalizeMobile(body.mobile);

    const emailCheck = await verifyUniversityEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.error || "Use your university email address.", field: "email" },
        { status: 400 }
      );
    }
    if (mobile.length !== 10) {
      return NextResponse.json({ error: "Mobile number must be 10 digits.", field: "mobile" }, { status: 400 });
    }

    await assertMobileAvailable(email, mobile);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message, field: "mobile" }, { status: err.status });
    }
    console.error("[account/check]", err);
    return NextResponse.json({ error: "Couldn't check your details. Please try again." }, { status: 500 });
  }
}
