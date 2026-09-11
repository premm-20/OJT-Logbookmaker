import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    const cleanUser = (username || "").trim();
    const cleanPass = (password || "").trim();

    // Check credentials strictly
    if (cleanUser === "Guru" && cleanPass === "Prem@guru99") {
      const response = NextResponse.json({
        success: true,
        message: "Admin authenticated successfully",
      });

      // Set secure admin session cookie
      response.cookies.set("ojt_admin_token", "authorized_guru_admin_session", {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
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
