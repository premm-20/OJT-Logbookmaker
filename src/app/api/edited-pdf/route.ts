import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession, unauthorized } from "@/lib/auth/session";
import { EDITED_PDF_CHUNK_BYTES, EDITED_PDF_MAX_CHUNKS } from "@/lib/edited-pdf-limits";
import { ensureEditedPdfTables as ensureTables, readEditedPdfChunk } from "@/lib/edited-pdf-store";

/**
 * Each student's latest edited PDF, stored in Neon. There is one per student:
 * saving again replaces it.
 *
 * Vercel caps request and response bodies at 4.5 MB, so the file travels in
 * chunks of up to 3 MB:
 *   PUT  ?upload=<id>&part=<i>   body: raw bytes of one chunk
 *   POST { upload, parts, fileName, sizeBytes, pageCount }   makes it current
 *   GET                          info about the saved PDF (or null)
 *   GET  ?part=<i>               one chunk of the saved PDF
 *   DELETE                       removes it
 * Chunks of an upload that never finishes are cleared by the next save.
 */

const UPLOAD_ID = /^[A-Za-z0-9-]{8,64}$/;

function partNumber(value: string | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n < EDITED_PDF_MAX_CHUNKS ? n : null;
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await ensureTables();
    const sql = getDb();

    const partParam = new URL(request.url).searchParams.get("part");
    if (partParam !== null) {
      const part = partNumber(partParam);
      if (part === null) return fail("Invalid part.");
      const chunk = await readEditedPdfChunk(session.id, part);
      if (!chunk) return fail("Not found.", 404);
      return new Response(new Uint8Array(chunk), {
        headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
      });
    }

    const rows = await sql`
      SELECT file_name, size_bytes, page_count, chunk_count, updated_at
      FROM edited_pdfs WHERE user_id = ${session.id}
    `;
    const row = rows[0];
    return NextResponse.json({
      pdf: row
        ? {
            fileName: row.file_name,
            sizeBytes: row.size_bytes,
            pageCount: row.page_count,
            chunkCount: row.chunk_count,
            updatedAt: row.updated_at,
          }
        : null,
    });
  } catch (err) {
    console.error("[edited-pdf] GET", err);
    return fail("Couldn't load your edited PDF.", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const params = new URL(request.url).searchParams;
    const upload = params.get("upload") || "";
    const part = partNumber(params.get("part"));
    if (!UPLOAD_ID.test(upload) || part === null) return fail("Invalid upload.");

    const bytes = Buffer.from(await request.arrayBuffer());
    if (!bytes.length || bytes.length > EDITED_PDF_CHUNK_BYTES) return fail("Invalid chunk size.");

    await ensureTables();
    const sql = getDb();
    await sql`
      INSERT INTO edited_pdf_chunks (user_id, upload_id, idx, data)
      VALUES (${session.id}, ${upload}, ${part}, decode(${bytes.toString("base64")}, 'base64'))
      ON CONFLICT (user_id, upload_id, idx) DO UPDATE SET data = EXCLUDED.data
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[edited-pdf] PUT", err);
    return fail("Couldn't save this part of the PDF.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await request.json().catch(() => ({}));
    const upload = String(body.upload || "");
    const parts = Number(body.parts);
    const sizeBytes = Number(body.sizeBytes);
    const pageCount = Number(body.pageCount);
    const fileName = String(body.fileName || "document.pdf").slice(0, 200);
    if (
      !UPLOAD_ID.test(upload) ||
      !Number.isInteger(parts) || parts < 1 || parts > EDITED_PDF_MAX_CHUNKS ||
      !Number.isInteger(sizeBytes) || sizeBytes < 1 ||
      !Number.isInteger(pageCount) || pageCount < 1
    ) {
      return fail("Invalid upload.");
    }

    await ensureTables();
    const sql = getDb();
    const check = await sql`
      SELECT count(*)::int AS n, coalesce(sum(length(data)), 0)::int AS bytes
      FROM edited_pdf_chunks
      WHERE user_id = ${session.id} AND upload_id = ${upload} AND idx < ${parts}
    `;
    if (check[0].n !== parts || check[0].bytes !== sizeBytes) {
      return fail("The upload is incomplete. Please save again.", 409);
    }

    // Make this upload current, then drop every other chunk for this student.
    await sql.transaction([
      sql`
        INSERT INTO edited_pdfs (user_id, upload_id, file_name, size_bytes, page_count, chunk_count, updated_at)
        VALUES (${session.id}, ${upload}, ${fileName}, ${sizeBytes}, ${pageCount}, ${parts}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          upload_id = EXCLUDED.upload_id,
          file_name = EXCLUDED.file_name,
          size_bytes = EXCLUDED.size_bytes,
          page_count = EXCLUDED.page_count,
          chunk_count = EXCLUDED.chunk_count,
          updated_at = NOW()
      `,
      sql`
        DELETE FROM edited_pdf_chunks
        WHERE user_id = ${session.id} AND (upload_id <> ${upload} OR idx >= ${parts})
      `,
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[edited-pdf] POST", err);
    return fail("Couldn't save your edited PDF.", 500);
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await ensureTables();
    const sql = getDb();
    await sql.transaction([
      sql`DELETE FROM edited_pdfs WHERE user_id = ${session.id}`,
      sql`DELETE FROM edited_pdf_chunks WHERE user_id = ${session.id}`,
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[edited-pdf] DELETE", err);
    return fail("Couldn't remove your edited PDF.", 500);
  }
}
