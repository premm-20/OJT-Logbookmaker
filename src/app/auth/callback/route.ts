import { NextResponse } from "next/server";
import { recordUserLogin } from "@/lib/login-tracker";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const verifier = url.searchParams.get("neon_auth_session_verifier");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
  }

  const neonAuthUrl =
    process.env.NEXT_PUBLIC_NEON_AUTH_URL ||
    "https://ep-long-feather-b59jje5f.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth";

  const cookieHeader = request.headers.get("cookie") || "";

  try {
    const sessionUrl = verifier
      ? `${neonAuthUrl}/get-session?neon_auth_session_verifier=${encodeURIComponent(verifier)}`
      : `${neonAuthUrl}/get-session`;

    const sessionRes = await fetch(sessionUrl, {
      headers: {
        Cookie: cookieHeader,
      },
    });

    if (sessionRes.ok) {
      const data = await sessionRes.json().catch(() => null);
      if (data?.user) {
        const email = (data.user.email || "").toLowerCase();
        const name = data.user.name || email.split("@")[0];

        const isUniEmail =
          email.endsWith("@medhaviskillsuniversity.edu.in") ||
          email.endsWith("@medhaviskills.university.edu.in");

        if (!isUniEmail) {
          return NextResponse.redirect(
            `${origin}/login?error=unauthorized_domain&email=${encodeURIComponent(email)}`
          );
        }

        const session = await recordUserLogin({
          name,
          email,
          mobile: "Google-Auth",
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

        const html = `<!DOCTYPE html>
<html>
<head>
  <title>Redirecting to Dashboard... | MSU</title>
  <meta charset="utf-8">
  <script>
    try {
      document.cookie = "ojt_session=${sessionCookieVal}; path=/; max-age=2592000; SameSite=Lax";
      localStorage.setItem("ojt_user_id", ${JSON.stringify(session.userId)});
      localStorage.setItem("ojt_user_name", ${JSON.stringify(name)});
      localStorage.setItem("ojt_user_login_email", ${JSON.stringify(email)});
    } catch (e) {}
    window.location.href = "/dashboard";
  </script>
</head>
<body style="font-family:sans-serif; text-align:center; padding: 60px;">
  <h2>Authenticated with Google Successfully!</h2>
  <p>Redirecting to your OJT dashboard...</p>
</body>
</html>`;

        const response = new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html",
            "Set-Cookie": `ojt_session=${sessionCookieVal}; Path=/; Max-Age=2592000; SameSite=Lax`,
          },
        });

        return response;
      }
    }
  } catch (err) {
    console.error("[Auth Callback] Error verifying Neon session:", err);
  }

  // Fallback: If verifier failed or session is unavailable, redirect to login with informative message
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "google_neon_failed");
  loginUrl.searchParams.set("msg", "Google authentication could not be completed via Neon Auth. Please use your university email OTP below to log in.");
  return NextResponse.redirect(loginUrl);
}
