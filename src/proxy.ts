import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";

// Neon's middleware validates/refreshes the session and completes the Google
// sign-in handshake (it exchanges the `neon_auth_session_verifier` param that
// Google sign-in lands with). Every page Google can return to must be matched.
const neonAuth = auth.middleware({ loginUrl: "/login" });

export default async function proxy(request: NextRequest) {
  const response = await neonAuth(request);

  // Remember where the student was going so sign in can send them back.
  const location = response.headers.get("location");
  if (location) {
    const target = new URL(location, request.url);
    if (target.pathname === "/login" && !target.searchParams.has("next")) {
      target.searchParams.set("next", request.nextUrl.pathname);
      const redirect = NextResponse.redirect(target);
      response.headers.getSetCookie().forEach((cookie) => redirect.headers.append("Set-Cookie", cookie));
      return redirect;
    }
  }
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding"],
};
