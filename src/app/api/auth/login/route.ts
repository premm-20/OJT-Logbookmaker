import { NextResponse } from "next/server";
import { recordUserLogin } from "@/lib/login-tracker";

// Allow @medhaviskillsuniversity.edu.in and @medhaviskills.university.edu.in (case-insensitive)
const UNIVERSITY_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@medhaviskills(?:\.university|university)\.edu\.in$/i;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, mobile } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Please enter your name" },
        { status: 400 }
      );
    }

    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) {
      return NextResponse.json(
        { error: "Please enter your university email address" },
        { status: 400 }
      );
    }

    if (!UNIVERSITY_EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json(
        {
          error:
            "Access restricted: Only official university email IDs (@medhaviskillsuniversity.edu.in) are permitted.",
        },
        { status: 403 }
      );
    }

    const cleanMobile = (mobile || "").replace(/\D/g, "");
    if (cleanMobile.length !== 10) {
      return NextResponse.json(
        { error: "Mobile number must be exactly 10 digits" },
        { status: 400 }
      );
    }

    // Extract client IP and User-Agent
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded
      ? forwarded.split(",")[0].trim()
      : request.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "";

    // Record login in persistent store (local file + Neon PostgreSQL)
    const session = await recordUserLogin({
      name: name.trim(),
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

    const sessionCookieVal = encodeURIComponent(JSON.stringify(sessionData));

    const response = NextResponse.json({
      success: true,
      user: sessionData,
      redirect: "/dashboard",
    });

    // Set cookie valid for 30 days
    response.cookies.set("ojt_session", sessionCookieVal, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
      httpOnly: false, // accessible to client for fast hydration
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to sign in";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

