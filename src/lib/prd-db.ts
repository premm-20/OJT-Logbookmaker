import { getDb } from "@/lib/db";

/**
 * Uploaded PRDs. A signed-in student has one row (their latest upload); each
 * guest browser tab has its own row, replaced by that tab's next upload.
 */
let tableReady: Promise<void> | null = null;
export function ensurePrdTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      const sql = getDb();
      await sql`
        CREATE TABLE IF NOT EXISTS prd_uploads (
          id VARCHAR PRIMARY KEY,
          owner_type VARCHAR NOT NULL,
          user_id VARCHAR,
          guest_id VARCHAR,
          file_name VARCHAR NOT NULL,
          mime_type VARCHAR NOT NULL DEFAULT '',
          size_bytes INTEGER NOT NULL DEFAULT 0,
          text_content TEXT NOT NULL DEFAULT '',
          file_data BYTEA,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS prd_uploads_owner ON prd_uploads (owner_type, updated_at DESC)`;
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}
