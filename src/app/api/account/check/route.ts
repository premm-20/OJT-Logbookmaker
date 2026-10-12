import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth/config";
import { verifyUniversityEmail } from "@/lib/email-verifier";
import { rateLimit, tooManyAttemptsMessage } from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/auth/session";

/**
 * Checks a sign-up email before a code is sent: only Medhavi Skills
 * University addresses with a working mail domain are accepted.
 */
export async function POST(request: Request) {
  try {
    const limit = rateLimit(`account-check:${clientIp(request)}`, 30, 15 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: tooManyAttemptsMessage(limit.retryAfterSeconds) }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const emailCheck = await verifyUniversityEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.error || "Use your university email address.", field: "email" },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[account/check]", err);
    return NextResponse.json({ error: "Couldn't check your email. Please try again." }, { status: 500 });
  }
}
