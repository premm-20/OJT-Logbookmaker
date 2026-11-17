import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE_SECONDS,
  checkAdminPassword,
  createAdminToken,
  getAdminPassword,
  readAdminToken,
} from "@/lib/auth/admin";
import { rateLimit, resetRateLimit, tooManyAttemptsMessage } from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/auth/client-ip";

const WINDOW_MS = 15 * 60 * 1000;

export const dynamic = "force-dynamic";

/** 200 when the admin password session is valid, 401 otherwise. */
export async function GET(request: NextRequest) {
  return readAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    if (!getAdminPassword()) {
      return NextResponse.json(
        { error: "Admin password is not set. Add ADMIN_PASSWORD in your Vercel environment variables." },
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
    const password = typeof body?.password === "string" ? body.password.trim() : "";

    if (checkAdminPassword(password)) {
      resetRateLimit(ipKey);
      const response = NextResponse.json({
        success: true,
        message: "Admin authenticated successfully",
      });

      response.cookies.set(ADMIN_COOKIE, createAdminToken("admin"), {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ADMIN_MAX_AGE_SECONDS,
      });

      return response;
    }

    return NextResponse.json(
      { error: "Wrong password." },
      { status: 401 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
