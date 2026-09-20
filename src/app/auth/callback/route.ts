import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordUserLogin } from "@/lib/login-tracker";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const next = searchParams.get("next") ?? "/dashboard";

  console.log("[Auth Callback] Request received with params:", {
    hasCode: !!code,
    errorParam,
    errorDescription,
  });

  // 1. Handle error returned directly from OAuth provider
  if (errorParam) {
    console.error("[Auth Callback] OAuth provider error:", errorParam, errorDescription);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorParam)}&msg=${encodeURIComponent(errorDescription || "")}`
    );
  }

  // 2. Exchange code for Supabase session
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[Auth Callback] exchangeCodeForSession failed:", error.message);
      return NextResponse.redirect(
        `${origin}/login?error=exchange_failed&msg=${encodeURIComponent(error.message)}`
      );
    }

    if (data?.user) {
      const email = (data.user.email || "").toLowerCase();

      // Enforce university domain policy strictly
      if (
        !email.endsWith("@medhaviskillsuniversity.edu.in") &&
        !email.endsWith("@medhaviskills.university.edu.in")
      ) {
        console.warn(`[Auth Callback] Blocked unauthorized non-university email: ${email}`);
        await supabase.auth.signOut();
        return NextResponse.redirect(
          `${origin}/login?error=unauthorized_domain&email=${encodeURIComponent(email)}`
        );
      }

      const name =
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.name ||
        email.split("@")[0];
      const mobile = data.user.user_metadata?.mobile || "0000000000";

      const session = await recordUserLogin({
        name,
        email,
        mobile,
        ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
        userAgent: request.headers.get("user-agent") || "Google Sign-In",
      });

      // Hydrate client-side localStorage and forward to dashboard
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Authenticating... | Medhavi Skills University</title>
  <meta charset="utf-8">
  <script>
    try {
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
    window.location.href = "${next}";
  </script>
</head>
<body style="font-family:sans-serif; text-align:center; padding: 60px;">
  <h2>Authenticated Successfully!</h2>
  <p>Redirecting you to your official logbook dashboard...</p>
</body>
</html>`;

      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }
  }

  // Return the user to login with general auth error
  console.warn("[Auth Callback] No code provided in URL query.");
  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
