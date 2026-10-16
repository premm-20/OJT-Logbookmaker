import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, readAdminToken } from "@/lib/auth/admin";
import { EDITED_PDF_MAX_CHUNKS } from "@/lib/edited-pdf-limits";
import { readEditedPdfChunk } from "@/lib/edited-pdf-store";

export const dynamic = "force-dynamic";

/** One chunk of a student's saved edited PDF: GET ?userId=<id>&part=<i>. */
export async function GET(request: NextRequest) {
  if (!readAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized: Administrator credentials required." }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const userId = params.get("userId") || "";
  const part = Number(params.get("part"));
  if (!userId || !Number.isInteger(part) || part < 0 || part >= EDITED_PDF_MAX_CHUNKS) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const chunk = await readEditedPdfChunk(userId, part);
    if (!chunk) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return new Response(new Uint8Array(chunk), {
      headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[admin/edited-pdf]", err);
    return NextResponse.json({ error: "Couldn't load the PDF." }, { status: 500 });
  }
}
