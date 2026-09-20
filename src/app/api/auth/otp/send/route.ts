import { NextResponse } from "next/server";
import { verifyUniversityEmail } from "@/lib/email-verifier";
import { generateAndStoreOtp } from "@/lib/otp-store";
import { sendVerificationEmail } from "@/lib/email-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, mobile } = body;

    const trimmedName = (name || "").trim();
    if (!trimmedName || trimmedName.length < 2) {
      return NextResponse.json(
        { error: "Please enter your full name (at least 2 characters)" },
        { status: 400 }
      );
    }

    const cleanEmail = (email || "").trim().toLowerCase();
    const emailCheck = await verifyUniversityEmail(cleanEmail);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.error || "Please enter a valid university email address." },
        { status: 400 }
      );
    }

    const cleanMobile = (mobile || "").replace(/\D/g, "");
    if (cleanMobile.length !== 10) {
      return NextResponse.json(
        { error: "Mobile number must be exactly 10 digits" },
        { status: 400 }
      );
    }

    // 1. Generate 6-digit OTP & secure magic link token
    const { otp, token, challengeToken } = generateAndStoreOtp(cleanEmail, trimmedName, cleanMobile);

    // Compute request base URL
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const magicLinkUrl = `${protocol}://${host}/api/auth/otp/verify-link?email=${encodeURIComponent(cleanEmail)}&token=${token}`;

    // 2. Dispatch real email via SMTP / Resend
    const sendResult = await sendVerificationEmail({
      to: cleanEmail,
      name: trimmedName,
      otp,
      magicLinkUrl,
    });

    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.message || "Failed to dispatch verification email to your Gmail." },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      email: cleanEmail,
      deliveryMode: sendResult.deliveryMode,
      configured: sendResult.configured,
      challengeToken,
      message: sendResult.configured
        ? `A 6-digit verification code and login link have been dispatched to your Gmail (${cleanEmail}). Please check your inbox and spam folder.`
        : `Verification code generated for ${cleanEmail}. In development mode without SMTP configured, code is logged to your terminal console.`,
      debugCode: !sendResult.configured ? otp : undefined,
    });

    response.cookies.set("ojt_otp_challenge", challengeToken, {
      path: "/",
      maxAge: 15 * 60,
      sameSite: "lax",
      httpOnly: false,
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send verification code";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
