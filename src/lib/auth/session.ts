import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./config";
import { createSessionToken, readSessionToken, type SessionUser } from "./tokens";

export type { SessionUser };

/** Reads and verifies the signed session cookie (route handlers, server components). */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export function setSessionCookie(response: NextResponse, user: SessionUser): void {
  response.cookies.set(SESSION_COOKIE, createSessionToken(user, SESSION_MAX_AGE_SECONDS), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

/** Standard JSON reply for a successful sign in / sign up. */
export function authSuccess(user: SessionUser, redirect = "/dashboard"): NextResponse {
  const response = NextResponse.json({ success: true, user, redirect });
  setSessionCookie(response, user);
  return response;
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
