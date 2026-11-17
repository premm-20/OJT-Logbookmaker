import { NextResponse, type NextRequest } from "next/server";

// Login is turned off: sign-in, sign-up and account pages all go straight to
// the logbook generator on the home page, so no auth setup is needed.
// (To bring accounts back, restore the Neon Auth middleware from git history.)
export default function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding", "/login", "/signup", "/try"],
};
