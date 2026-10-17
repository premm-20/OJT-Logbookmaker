import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ADMIN_COOKIE, readAdminToken } from "@/lib/auth/admin";
import { ensurePrdTable } from "@/lib/prd-db";

export const dynamic = "force-dynamic";

/** GET ?id=<id>&as=file|text: download one stored PRD (original file or its text). */
export async function GET(request: NextRequest) {
  if (!readAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized: Administrator credentials required." }, { status: 401 });
  }
  try {
    await ensurePrdTable();
    const sql = getDb();
    const params = request.nextUrl.searchParams;
    const id = params.get("id");

    if (id) {
      const rows = await sql`
        SELECT file_name, mime_type, text_content, encode(file_data, 'base64') AS b64
        FROM prd_uploads WHERE id = ${id}
      `;
      const row = rows[0];
      if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
      const name = String(row.file_name).replace(/["\\\r\n]/g, "_");
      if (params.get("as") === "file" && row.b64) {
        return new Response(new Uint8Array(Buffer.from(row.b64 as string, "base64")), {
          headers: {
            "Content-Type": (row.mime_type as string) || "application/octet-stream",
            "Content-Disposition": `attachment; filename="${name}"`,
            "Cache-Control": "no-store",
          },
        });
      }
      return new Response(String(row.text_content), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${name.replace(/\.[^.]+$/, "")}.txt"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  } catch (err) {
    console.error("[admin/prds]", err);
    return NextResponse.json({ error: "Couldn't load PRD uploads." }, { status: 500 });
  }
}
