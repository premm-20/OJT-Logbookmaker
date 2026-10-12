import { cache } from "react";
import { NextResponse } from "next/server";
import { auth } from "./server";
import { isUniversityEmail } from "./config";
import { getOrCreateUserForNeonUser, toSessionUser } from "./users";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  avatarUrl: string | null;
}

export interface NeonUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
}

export type AuthState =
  | { status: "signed-out" }
  | { status: "wrong-domain"; neonUser: NeonUser }
  | { status: "unverified"; neonUser: NeonUser }
  | { status: "ready"; user: SessionUser; neonUser: NeonUser; sessionId: string };

/**
 * Resolves the Neon Auth session into this app's student account.
 * Cached per request, so layouts and pages can call it freely.
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user) return { status: "signed-out" };

  const neonUser: NeonUser = {
    id: user.id,
    name: user.name || user.email.split("@")[0],
    email: user.email.trim().toLowerCase(),
    image: user.image ?? null,
    emailVerified: Boolean(user.emailVerified),
  };

  if (!isUniversityEmail(neonUser.email)) return { status: "wrong-domain", neonUser };
  if (!neonUser.emailVerified) return { status: "unverified", neonUser };

  // First sign in (Google or email code) creates the logbook account.
  const account = await getOrCreateUserForNeonUser(neonUser);
  return { status: "ready", user: toSessionUser(account), neonUser, sessionId: data.session.id };
});

/** The signed-in student with a complete account, or null. Used by API routes. */
export async function getSession(): Promise<SessionUser | null> {
  const state = await getAuthState();
  return state.status === "ready" ? state.user : null;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded
    ? forwarded.split(",")[0].trim()
    : request.headers.get("x-real-ip") || "127.0.0.1";
}
