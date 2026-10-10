import { NextResponse } from "next/server";
import { normalizeMobile } from "@/lib/auth/config";
import { getAuthState } from "@/lib/auth/session";
import { AuthError, createUserForNeonUser, toSessionUser } from "@/lib/auth/users";

/**
 * One-time step after a student's first Neon sign in (email or Google):
 * attach a mobile number and create their logbook account.
 */
export async function POST(request: Request) {
  try {
    const state = await getAuthState();
    if (state.status === "signed-out") {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }
    if (state.status === "ready") {
      return NextResponse.json({ user: state.user });
    }
    if (state.status === "wrong-domain") {
      return NextResponse.json({ error: "Only university accounts can use the logbook." }, { status: 403 });
    }
    if (state.status === "unverified") {
      return NextResponse.json({ error: "Verify your email first." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const mobile = normalizeMobile(body.mobile);
    if (mobile.length !== 10) {
      return NextResponse.json({ error: "Mobile number must be 10 digits." }, { status: 400 });
    }
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 80) : "";

    const account = await createUserForNeonUser(state.neonUser, mobile, name || undefined);
    return NextResponse.json({ user: toSessionUser(account) });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[account/onboard]", err);
    return NextResponse.json({ error: "Couldn't finish setting up your account." }, { status: 500 });
  }
}
