import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ADMIN_COOKIE, readAdminToken } from "@/lib/auth/admin";
import { ensureSubmissionsTable } from "@/lib/submissions-db";

export const dynamic = "force-dynamic";

export interface AdminSubmission {
  id: string;
  mode: "prd" | "paste";
  name: string;
  email: string;
  details: Record<string, string>;
  customPrompt: string;
  prdFileName: string;
  prdSizeBytes: number;
  hasFile: boolean;
  hasText: boolean;
  createdAt: string | null;
}

const safeName = (v: unknown) => String(v || "file").replace(/["\\\r\n]/g, "_");

/**
 * GET: every saved submission, newest first.
 * GET ?id=<id>&as=file|text|paste: download one submission's PRD file, PRD text or pasted notes.
 */
export async function GET(request: NextRequest) {
  if (!readAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized: Administrator credentials required." }, { status: 401 });
  }
  try {
    await ensureSubmissionsTable();
    const sql = getDb();
    const params = request.nextUrl.searchParams;
    const id = params.get("id");

    if (id) {
      const rows = await sql`
        SELECT name, prd_file_name, prd_mime_type, prd_text, pasted_text, encode(prd_file, 'base64') AS b64
        FROM logbook_submissions WHERE id = ${id}
      `;
      const row = rows[0];
      if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
      const as = params.get("as");
      if (as === "file" && row.b64) {
        return new Response(new Uint8Array(Buffer.from(row.b64 as string, "base64")), {
          headers: {
            "Content-Type": (row.prd_mime_type as string) || "application/octet-stream",
            "Content-Disposition": `attachment; filename="${safeName(row.prd_file_name)}"`,
            "Cache-Control": "no-store",
          },
        });
      }
      const text = as === "paste" ? String(row.pasted_text) : String(row.prd_text);
      const base = as === "paste" ? `${safeName(row.name) || "notes"}_notes` : safeName(row.prd_file_name).replace(/\.[^.]+$/, "");
      return new Response(text, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${base}.txt"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const rows = await sql`
      SELECT id, mode, name, email, details, custom_prompt, prd_file_name, prd_size_bytes,
        prd_file IS NOT NULL AS has_file, (length(prd_text) > 0 OR length(pasted_text) > 0) AS has_text, created_at
      FROM logbook_submissions
      ORDER BY created_at DESC
      LIMIT 2000
    `;
    const submissions: AdminSubmission[] = rows.map((r) => ({
      id: String(r.id),
      mode: r.mode === "paste" ? "paste" : "prd",
      name: String(r.name || ""),
      email: String(r.email || ""),
      details: (r.details as Record<string, string>) || {},
      customPrompt: String(r.custom_prompt || ""),
      prdFileName: String(r.prd_file_name || ""),
      prdSizeBytes: Number(r.prd_size_bytes) || 0,
      hasFile: Boolean(r.has_file),
      hasText: Boolean(r.has_text),
      createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : null,
    }));
    return NextResponse.json({ submissions });
  } catch (err) {
    console.error("[admin/submissions]", err);
    return NextResponse.json({ error: "Couldn't load submissions." }, { status: 500 });
  }
}
