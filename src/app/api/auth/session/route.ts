import { NextResponse } from "next/server";
import { getSession, unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();
  return NextResponse.json({ user });
}
