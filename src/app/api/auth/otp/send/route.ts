import { NextResponse } from "next/server";
import { verifyUniversityEmail } from "@/lib/email-verifier";
import { createOtpChallenge, type OtpPurpose } from "@/lib/otp-store";
import { sendVerificationEmail } from "@/lib/email-service";
import { normalizeEmail, normalizeMobile } from "@/lib/auth/config";
import { rateLimit, tooManyAttemptsMessage } from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/auth/session";
import { AuthError, assertAvailable, findUserByEmail } from "@/lib/auth/users";

const PURPOSES: OtpPurpose[] = ["signup", "reset"];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const purpose = body.purpose as OtpPurpose;
    if (!PURPOSES.includes(purpose)) {
      return NextResponse.json({ error: "Unknown request." }, { status: 400 });
    }

    const email = normalizeEmail(body.email);
    const emailCheck = await verifyUniversityEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.error || "Use your university email address." },
        { status: 400 }
      );
    }

    const limit = rateLimit(`otp-send:${email}`, 5, 15 * 60 * 1000);
    const ipLimit = rateLimit(`otp-send-ip:${clientIp(request)}`, 20, 15 * 60 * 1000);
    if (!limit.ok || !ipLimit.ok) {
      return NextResponse.json(
        { error: tooManyAttemptsMessage(Math.max(limit.retryAfterSeconds, ipLimit.retryAfterSeconds)) },
        { status: 429 }
      );
    }

    let name = typeof body.name === "string" ? body.name.trim() : "";

    if (purpose === "signup") {
      const mobile = normalizeMobile(body.mobile);
      if (mobile.length !== 10) {
        return NextResponse.json({ error: "Mobile number must be 10 digits." }, { status: 400 });
      }
      await assertAvailable(email, mobile);
    } else {
      const user = await findUserByEmail(email);
      if (!user) {
        return NextResponse.json(
          { error: "No account uses this email yet. Create one instead." },
          { status: 404 }
        );
      }
      name = user.name;
    }

    const { otp, challengeToken } = createOtpChallenge(email, purpose);
    const sent = await sendVerificationEmail({ to: email, name, otp, purpose });
    if (!sent.success) {
      return NextResponse.json({ error: sent.message }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      challengeToken,
      message: sent.message,
      // Only present in local development when no email provider is configured.
      debugCode: sent.configured ? undefined : otp,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[otp/send]", err);
    return NextResponse.json({ error: "Couldn't send the code. Please try again." }, { status: 500 });
  }
}
