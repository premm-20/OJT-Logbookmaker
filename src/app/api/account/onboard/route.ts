import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { isUniversityEmail } from "@/lib/auth/config";
import { getOrCreateUserForNeonUser, toSessionUser } from "@/lib/auth/users";

/**
 * Called right after creating an account with an email code: saves the
 * student's full name on their logbook account (creating it if needed).
 */
export async function POST(request: Request) {
  try {
    const { data } = await auth.getSession();
    const user = data?.user;
    if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });

    const email = user.email.trim().toLowerCase();
    if (!isUniversityEmail(email)) {
      return NextResponse.json({ error: "Only university accounts can use the logbook." }, { status: 403 });
    }
    if (!user.emailVerified) {
      return NextResponse.json({ error: "Verify your email first." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 80) : "";

    const account = await getOrCreateUserForNeonUser(
      { id: user.id, name: user.name || "", email, image: user.image ?? null, emailVerified: true },
      name || undefined
    );
    return NextResponse.json({ user: toSessionUser(account) });
  } catch (err) {
    console.error("[account/onboard]", err);
    return NextResponse.json({ error: "Couldn't finish setting up your account." }, { status: 500 });
  }
}
