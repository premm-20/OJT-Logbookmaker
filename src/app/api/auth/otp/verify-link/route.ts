import { NextResponse } from "next/server";
import { verifyMagicToken } from "@/lib/otp-store";
import { recordUserLogin } from "@/lib/login-tracker";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const token = (url.searchParams.get("token") || "").trim();

  if (!email || !token) {
    return new Response(
      "<h1>Invalid verification link</h1><p>Missing email or token parameter.</p>",
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  const result = verifyMagicToken(email, token);
  if (!result.valid) {
    return new Response(
      `<!DOCTYPE html>
<html>
<head><title>Link Expired - Medhavi Skills University</title></head>
<body style="font-family:sans-serif; text-align:center; padding: 50px;">
  <h2>⚠️ Verification Link Expired or Invalid</h2>
  <p>The link has expired or has already been used. Please return to the login page and request a new code.</p>
  <a href="/login" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#2563eb; color:#fff; text-decoration:none; border-radius:8px;">Go to Login</a>
</body>
</html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  const name = result.name || "Student";
  const mobile = result.mobile || "0000000000";

  // Record verified session in Neon PostgreSQL
  const session = await recordUserLogin({
    name,
    email,
    mobile,
    ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    userAgent: request.headers.get("user-agent") || "Magic Link",
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

  // Return HTML that hydrates client localStorage, sets document.cookie, and forwards to dashboard
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Verifying... | Medhavi Skills University</title>
  <meta charset="utf-8">
  <script>
    try {
      document.cookie = "ojt_session=${sessionCookieVal}; path=/; max-age=2592000; SameSite=Lax";
      localStorage.setItem("ojt_user_id", ${JSON.stringify(session.userId)});
      localStorage.setItem("ojt_user_name", ${JSON.stringify(name)});
      localStorage.setItem("ojt_user_mobile", ${JSON.stringify(mobile)});
      localStorage.setItem("ojt_user_login_email", ${JSON.stringify(email)});

      const userProfileKey = "ojt_user_profile_" + ${JSON.stringify(session.userId)};
      const existingProfile = localStorage.getItem(userProfileKey) || localStorage.getItem("ojt_user_profile");
      const parsed = existingProfile ? JSON.parse(existingProfile) : {};
      const updated = {
        ...parsed,
        learner_name: ${JSON.stringify(name)},
        phone_number: ${JSON.stringify(mobile)},
        email_id: ${JSON.stringify(email)}
      };
      localStorage.setItem("ojt_user_profile", JSON.stringify(updated));
      localStorage.setItem(userProfileKey, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    window.location.href = "/dashboard";
  </script>
</head>
<body style="font-family:sans-serif; text-align:center; padding: 60px;">
  <h2>Authenticating your session...</h2>
  <p>Please wait while we redirect you to your dashboard.</p>
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
