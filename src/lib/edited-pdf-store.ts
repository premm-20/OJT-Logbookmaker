import { getDb } from "@/lib/db";

/** Tables for each student's latest edited PDF (see /api/edited-pdf). */
let tablesReady: Promise<void> | null = null;
export function ensureEditedPdfTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      const sql = getDb();
      await sql`
        CREATE TABLE IF NOT EXISTS edited_pdfs (
          user_id VARCHAR PRIMARY KEY,
          upload_id VARCHAR NOT NULL,
          file_name VARCHAR NOT NULL,
          size_bytes INTEGER NOT NULL,
          page_count INTEGER NOT NULL,
          chunk_count INTEGER NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS edited_pdf_chunks (
          user_id VARCHAR NOT NULL,
          upload_id VARCHAR NOT NULL,
          idx INTEGER NOT NULL,
          data BYTEA NOT NULL,
          PRIMARY KEY (user_id, upload_id, idx)
        )
      `;
    })().catch((err) => {
      tablesReady = null;
      throw err;
    });
  }
  return tablesReady;
}

/** One chunk of the student's current edited PDF, or null. */
export async function readEditedPdfChunk(userId: string, part: number): Promise<Buffer | null> {
  await ensureEditedPdfTables();
  const rows = await getDb()`
    SELECT encode(c.data, 'base64') AS b64
    FROM edited_pdfs p
    JOIN edited_pdf_chunks c ON c.user_id = p.user_id AND c.upload_id = p.upload_id
    WHERE p.user_id = ${userId} AND c.idx = ${part}
  `;
  return rows.length ? Buffer.from(rows[0].b64 as string, "base64") : null;
}
