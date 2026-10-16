import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { clientIp, getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import { ensurePrdTable } from "@/lib/prd-db";
import { PRD_MAX_FILE_BYTES, PRD_MAX_TEXT_CHARS } from "@/lib/prd-limits";

const GUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Stores a copy of an uploaded PRD (multipart: file?, text, fileName,
 * guestId). Students keep their latest upload; guests one per browser tab.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      const limit = rateLimit(`prd-upload:${clientIp(request)}`, 30, 60 * 60 * 1000);
      if (!limit.ok) return NextResponse.json({ error: "Too many uploads." }, { status: 429 });
    }

    const form = await request.formData();
    const text = String(form.get("text") || "").slice(0, PRD_MAX_TEXT_CHARS);
    const file = form.get("file");
    const fileName = String(form.get("fileName") || (file instanceof File ? file.name : "") || "prd").slice(0, 200);
    const guestId = String(form.get("guestId") || "");
    if (!text.trim() && !(file instanceof File)) return NextResponse.json({ error: "Nothing to store." }, { status: 400 });
    if (!session && !GUEST_ID.test(guestId)) return NextResponse.json({ error: "Invalid upload." }, { status: 400 });

    let bytes: Buffer | null = null;
    let mimeType = "";
    let sizeBytes = 0;
    if (file instanceof File) {
      if (file.size > PRD_MAX_FILE_BYTES) return NextResponse.json({ error: "File too large." }, { status: 413 });
      bytes = Buffer.from(await file.arrayBuffer());
      mimeType = file.type || "";
      sizeBytes = file.size;
    }

    await ensurePrdTable();
    const sql = getDb();
    const id = session ? `prd_${session.id}` : `prd_guest_${guestId}`;
    const b64 = bytes ? bytes.toString("base64") : null;
    await sql`
      INSERT INTO prd_uploads (id, owner_type, user_id, guest_id, file_name, mime_type, size_bytes, text_content, file_data)
      VALUES (
        ${id}, ${session ? "student" : "guest"}, ${session?.id ?? null}, ${session ? null : guestId},
        ${fileName}, ${mimeType}, ${sizeBytes}, ${text},
        decode(${b64}::text, 'base64')
      )
      ON CONFLICT (id) DO UPDATE SET
        file_name = EXCLUDED.file_name,
        mime_type = EXCLUDED.mime_type,
        size_bytes = EXCLUDED.size_bytes,
        text_content = EXCLUDED.text_content,
        file_data = EXCLUDED.file_data,
        updated_at = NOW()
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[prd]", err);
    return NextResponse.json({ error: "Couldn't store the PRD." }, { status: 500 });
  }
}
