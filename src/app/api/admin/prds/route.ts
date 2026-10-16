import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ADMIN_COOKIE, readAdminToken } from "@/lib/auth/admin";
import { ensurePrdTable } from "@/lib/prd-db";

export const dynamic = "force-dynamic";

export interface AdminPrdUpload {
  id: string;
  ownerType: "student" | "guest";
  userId: string | null;
  fileName: string;
  sizeBytes: number;
  hasFile: boolean;
  textChars: number;
  textPreview: string;
  uploadedAt: string | null;
}

/**
 * GET                         guest PRD uploads, newest first
 * GET ?id=<id>&as=file|text   download one upload (original file or its text)
 */
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

    const rows = await sql`
      SELECT id, owner_type, user_id, file_name, size_bytes, file_data IS NOT NULL AS has_file,
             length(text_content) AS text_chars, left(text_content, 160) AS text_preview, updated_at
      FROM prd_uploads
      WHERE owner_type = 'guest'
      ORDER BY updated_at DESC
      LIMIT 500
    `;
    const uploads: AdminPrdUpload[] = rows.map((r) => ({
      id: String(r.id),
      ownerType: r.owner_type === "student" ? "student" : "guest",
      userId: r.user_id ? String(r.user_id) : null,
      fileName: String(r.file_name),
      sizeBytes: Number(r.size_bytes) || 0,
      hasFile: Boolean(r.has_file),
      textChars: Number(r.text_chars) || 0,
      textPreview: String(r.text_preview || ""),
      uploadedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
    }));
    return NextResponse.json({ uploads });
  } catch (err) {
    console.error("[admin/prds]", err);
    return NextResponse.json({ error: "Couldn't load PRD uploads." }, { status: 500 });
  }
}
