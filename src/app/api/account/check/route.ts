import { NextResponse } from "next/server";
import { isUniversityEmail, normalizeEmail, UNIVERSITY_DOMAIN_LABEL } from "@/lib/auth/config";
import { rateLimit, tooManyAttemptsMessage } from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/auth/session";

/**
 * Checks a sign-up email before a code is sent. Only the university's exact
 * domains are accepted, so a format check is enough (no slow DNS lookup).
 */
export async function POST(request: Request) {
  try {
    const limit = rateLimit(`account-check:${clientIp(request)}`, 30, 15 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: tooManyAttemptsMessage(limit.retryAfterSeconds) }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    if (!isUniversityEmail(email)) {
      return NextResponse.json(
        { error: `Use your ${UNIVERSITY_DOMAIN_LABEL} email.`, field: "email" },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[account/check]", err);
    return NextResponse.json({ error: "Couldn't check your email. Please try again." }, { status: 500 });
  }
}
