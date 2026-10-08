import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth/admin";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Admin logged out",
  });

  response.cookies.set(ADMIN_COOKIE, "", {
    path: "/",
    httpOnly: true,
    maxAge: 0,
  });

  return response;
}
