import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp-store";
import { recordUserLogin } from "@/lib/login-tracker";

const UNIVERSITY_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@medhaviskills(?:\.university|university)\.edu\.in$/i;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, mobile, otp, challengeToken: bodyToken } = body;

    const cookieHeader = request.headers.get("cookie") || "";
    const cookieMatch = cookieHeader.match(/ojt_otp_challenge=([^;]+)/);
    const cookieToken = cookieMatch ? decodeURIComponent(cookieMatch[1]) : undefined;
    const challengeToken = bodyToken || cookieToken;

    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanOtp = (otp || "").trim();

    if (!cleanEmail || !UNIVERSITY_EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json(
        { error: "Invalid university email address." },
        { status: 400 }
      );
    }

    if (!cleanOtp || cleanOtp.length < 6) {
      return NextResponse.json(
        { error: "Please enter the complete 6-digit OTP code." },
        { status: 400 }
      );
    }

    // Verify using cryptographic stateless HMAC challenge token (Vercel & Railway compatible)
    const isVerified = verifyOtp(cleanEmail, cleanOtp, challengeToken);


    if (!isVerified) {
      return NextResponse.json(
        {
          error:
            "Invalid or expired verification code. Please check the latest code sent to your Gmail.",
        },
        { status: 401 }
      );
    }

    const cleanMobile = (mobile || "").replace(/\D/g, "");
    const trimmedName = (name || "Student").trim();

    // Extract client IP and User-Agent
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded
      ? forwarded.split(",")[0].trim()
      : request.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "";

    // Record login for admin audit logs
    const session = await recordUserLogin({
      name: trimmedName,
      email: cleanEmail,
      mobile: cleanMobile,
      ipAddress,
      userAgent,
    });

    const sessionData = {
      id: session.userId,
      sessionId: session.id,
      name: session.name,
      email: session.email,
      mobile: session.mobile,
      phone_number: session.mobile,
      learner_name: session.name,
      loginTime: session.loginAt,
      verifiedWithOtp: true,
    };

    const response = NextResponse.json({
      success: true,
      verified: true,
      user: sessionData,
    });

    // Set secure session cookie valid for 30 days
    response.cookies.set("ojt_session", JSON.stringify(sessionData), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
      httpOnly: false,
    });

    // Clear temporary OTP challenge cookie
    response.cookies.set("ojt_otp_challenge", "", {
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to verify OTP";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
