import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE_SECONDS,
  checkAdminCredentials,
  createAdminToken,
  getAdminCredentials,
} from "@/lib/auth/admin";
import { rateLimit, resetRateLimit, tooManyAttemptsMessage } from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/auth/session";

const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const credentials = getAdminCredentials();
    if (!credentials) {
      return NextResponse.json(
        { error: "Admin login is not configured on this server." },
        { status: 503 }
      );
    }

    const ipKey = `admin-login-ip:${clientIp(request)}`;
    const limit = rateLimit(ipKey, 5, WINDOW_MS);
    if (!limit.ok) {
      return NextResponse.json(
        { error: tooManyAttemptsMessage(limit.retryAfterSeconds) },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (checkAdminCredentials(credentials, username, password)) {
      resetRateLimit(ipKey);
      const response = NextResponse.json({
        success: true,
        message: "Admin authenticated successfully",
      });

      response.cookies.set(ADMIN_COOKIE, createAdminToken(credentials.username), {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ADMIN_MAX_AGE_SECONDS,
      });

      return response;
    }

    return NextResponse.json(
      { error: "Invalid Admin ID or Password." },
      { status: 401 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
