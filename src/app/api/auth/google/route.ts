import { NextResponse } from "next/server";
import { isUniversityEmail, UNIVERSITY_DOMAIN_LABEL } from "@/lib/auth/config";
import { createPendingGoogleToken, verifyGoogleCredential } from "@/lib/auth/google";
import { authSuccess } from "@/lib/auth/session";
import { auditLogin } from "@/lib/auth/audit";
import { findUserByEmail, findUserByGoogleSub, linkGoogleAccount, toSessionUser } from "@/lib/auth/users";

/**
 * Handles both "Sign in with Google" and "Sign up with Google".
 * Existing accounts are signed in (and linked to Google on first use).
 * New students get a short-lived token to finish sign up with a mobile number.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.credential !== "string" || !body.credential) {
      return NextResponse.json({ error: "Google didn't return a sign-in. Please try again." }, { status: 400 });
    }

    let profile;
    try {
      profile = await verifyGoogleCredential(body.credential);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Google sign-in failed." },
        { status: 401 }
      );
    }

    if (!isUniversityEmail(profile.email)) {
      return NextResponse.json(
        {
          error: `${profile.email} isn't a university account. Choose your ${UNIVERSITY_DOMAIN_LABEL} Google account.`,
        },
        { status: 403 }
      );
    }

    let user = await findUserByGoogleSub(profile.sub);
    if (!user) {
      const byEmail = await findUserByEmail(profile.email);
      if (byEmail) user = await linkGoogleAccount(byEmail.id, profile.sub, profile.picture);
    }

    if (user) {
      const sessionUser = toSessionUser(user);
      await auditLogin(request, sessionUser, "google");
      return authSuccess(sessionUser);
    }

    return NextResponse.json({
      needsMobile: true,
      pendingToken: createPendingGoogleToken(profile),
      profile: { name: profile.name, email: profile.email, picture: profile.picture },
    });
  } catch (err) {
    console.error("[auth/google]", err);
    return NextResponse.json({ error: "Google sign-in failed. Please try again." }, { status: 500 });
  }
}
