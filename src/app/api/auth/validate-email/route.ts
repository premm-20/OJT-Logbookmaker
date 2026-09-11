import { NextResponse } from "next/server";
import { verifyUniversityEmail } from "@/lib/email-verifier";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") || "";

  const result = await verifyUniversityEmail(email);

  if (!result.valid) {
    return NextResponse.json({
      valid: false,
      error: result.error || "Invalid email address",
    });
  }

  return NextResponse.json({
    valid: true,
    isGoogleWorkspace: result.isGoogleWorkspace,
    message: "Verified Google Workspace University Email",
  });
}
