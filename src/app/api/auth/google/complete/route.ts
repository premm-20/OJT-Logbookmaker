import { NextResponse } from "next/server";
import { normalizeMobile } from "@/lib/auth/config";
import { readPendingGoogleToken } from "@/lib/auth/google";
import { authSuccess } from "@/lib/auth/session";
import { auditLogin } from "@/lib/auth/audit";
import { AuthError, createUser, toSessionUser } from "@/lib/auth/users";

/** Second step of Google sign up: attach a mobile number and create the account. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const profile = readPendingGoogleToken(body.pendingToken);
    if (!profile) {
      return NextResponse.json(
        { error: "This step timed out. Continue with Google again." },
        { status: 401 }
      );
    }

    const mobile = normalizeMobile(body.mobile);
    if (mobile.length !== 10) {
      return NextResponse.json({ error: "Mobile number must be 10 digits." }, { status: 400 });
    }

    const user = await createUser({
      name: profile.name,
      email: profile.email,
      mobile,
      googleSub: profile.sub,
      avatarUrl: profile.picture,
    });

    const sessionUser = toSessionUser(user);
    await auditLogin(request, sessionUser, "google-signup");
    return authSuccess(sessionUser);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[auth/google/complete]", err);
    return NextResponse.json({ error: "Couldn't finish sign up. Please try again." }, { status: 500 });
  }
}
