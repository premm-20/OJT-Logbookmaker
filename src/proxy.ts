import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { readSessionToken } from "@/lib/auth/tokens";

// API routes that must stay reachable without a student session.
// Admin routes check their own admin cookie.
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/admin/"];
const GUEST_ONLY_PAGES = new Set(["/login", "/signup", "/forgot-password"]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const user = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/api/")) {
    if (user || PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  if (pathname.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (user && GUEST_ONLY_PAGES.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup", "/forgot-password", "/api/:path*"],
};
