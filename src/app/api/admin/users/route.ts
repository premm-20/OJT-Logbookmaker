import { NextResponse, type NextRequest } from "next/server";
import { getAllUserLogins } from "@/lib/login-tracker";
import { ADMIN_COOKIE, readAdminToken } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    if (!readAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
      return NextResponse.json(
        { error: "Unauthorized: Administrator credentials required." },
        { status: 401 }
      );
    }

    const { sessions, users } = await getAllUserLogins();

    const todayStr = new Date().toDateString();
    const todayLogins = sessions.filter(
      (s) => new Date(s.loginAt).toDateString() === todayStr
    ).length;

    const stats = {
      totalUsers: users.length,
      totalLogins: sessions.length,
      todayLogins,
      lastLoginAt: sessions[0]?.loginAt || null,
    };

    return NextResponse.json({
      success: true,
      stats,
      users,
      sessions,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to load admin user login logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
