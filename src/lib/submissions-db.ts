import { getDb } from "@/lib/db";

/**
 * Every logbook made on the no-login page is kept as its own row: the user's
 * details (name, email, cover-page info), their instructions, and the PRD file
 * and text or the notes they pasted. Rows are never overwritten or expired.
 */
let tableReady: Promise<void> | null = null;
export function ensureSubmissionsTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      const sql = getDb();
      await sql`
        CREATE TABLE IF NOT EXISTS logbook_submissions (
          id VARCHAR PRIMARY KEY,
          mode VARCHAR NOT NULL,
          name VARCHAR NOT NULL DEFAULT '',
          email VARCHAR NOT NULL DEFAULT '',
          details JSONB NOT NULL DEFAULT '{}'::jsonb,
          custom_prompt TEXT NOT NULL DEFAULT '',
          pasted_text TEXT NOT NULL DEFAULT '',
          prd_file_name VARCHAR NOT NULL DEFAULT '',
          prd_mime_type VARCHAR NOT NULL DEFAULT '',
          prd_size_bytes INTEGER NOT NULL DEFAULT 0,
          prd_text TEXT NOT NULL DEFAULT '',
          prd_file BYTEA,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS logbook_submissions_created ON logbook_submissions (created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS logbook_submissions_email ON logbook_submissions (email)`;
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}
