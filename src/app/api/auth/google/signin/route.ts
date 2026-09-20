import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { origin } = new URL(request.url);
    const neonAuthUrl =
      process.env.NEXT_PUBLIC_NEON_AUTH_URL ||
      "https://ep-long-feather-b59jje5f.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth";

    const callbackURL = `${origin}/auth/callback`;

    const res = await fetch(`${neonAuthUrl}/sign-in/social`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({
        provider: "google",
        callbackURL,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[Neon Google Signin] Failed to init social sign-in:", res.status, errText);
      return NextResponse.redirect(`${origin}/login?error=google_init_failed`);
    }

    const data = await res.json();
    if (data?.url) {
      const redirectRes = NextResponse.redirect(data.url);
      const setCookies = res.headers.getSetCookie();
      for (const cookieStr of setCookies) {
        // If on localhost (HTTP), strip Secure flag and prefix so browser saves cookie
        const sanitizedCookie = origin.startsWith("http://localhost")
          ? cookieStr.replace(/;\s*Secure/gi, "").replace(/__Secure-/gi, "")
          : cookieStr;
        redirectRes.headers.append("Set-Cookie", sanitizedCookie);
      }
      return redirectRes;
    }

    return NextResponse.redirect(`${origin}/login?error=google_no_url`);
  } catch (err: unknown) {
    console.error("[Neon Google Signin] Error:", err);
    const { origin } = new URL(request.url);
    return NextResponse.redirect(`${origin}/login?error=google_exception`);
  }
}
