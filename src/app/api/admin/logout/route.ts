import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Admin logged out",
  });

  response.cookies.set("ojt_admin_token", "", {
    path: "/",
    httpOnly: true,
    maxAge: 0,
  });

  return response;
}
