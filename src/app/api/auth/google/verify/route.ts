import { NextResponse } from "next/server";
import { recordUserLogin } from "@/lib/login-tracker";

const UNIVERSITY_DOMAINS = ["@medhaviskillsuniversity.edu.in", "@medhaviskills.university.edu.in"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { credential } = body;

    if (!credential) {
      return NextResponse.json({ error: "Missing Google credential token." }, { status: 400 });
    }

    // Verify token with Google's official tokeninfo API
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );

    if (!verifyRes.ok) {
      const errText = await verifyRes.text().catch(() => "");
      console.error("[Google Auth Verify] Token verification failed:", verifyRes.status, errText);
      return NextResponse.json(
        { error: "Invalid or expired Google token. Please try again." },
        { status: 401 }
      );
    }

    const payload = await verifyRes.json();
    const email = (payload.email || "").toLowerCase().trim();
    const name = payload.name || payload.given_name || email.split("@")[0];
    const emailVerified = payload.email_verified === "true" || payload.email_verified === true;

    if (!email || !emailVerified) {
      return NextResponse.json(
        { error: "Google account email is not verified." },
        { status: 403 }
      );
    }

    // Validate university domain
    const isUniversityEmail = UNIVERSITY_DOMAINS.some((domain) => email.endsWith(domain));
    if (!isUniversityEmail) {
      return NextResponse.json(
        {
          error: `Access restricted: Only official university Google accounts (@medhaviskillsuniversity.edu.in) are permitted. You signed in with: ${email}`,
        },
        { status: 403 }
      );
    }

    // Record verified student login in Neon PostgreSQL
    const session = await recordUserLogin({
      name,
      email,
      mobile: "Google-SSO",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      userAgent: request.headers.get("user-agent") || "Google Sign-In",
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

    // Set 30-day session cookie for middleware
    response.cookies.set("ojt_session", sessionCookieVal, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
      httpOnly: false,
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to verify Google sign in.";
    console.error("[Google Auth Verify] Exception:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
