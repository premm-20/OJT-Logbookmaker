import { getDb } from "@/lib/db";
import { ensurePrdTable } from "@/lib/prd-db";

/**
 * Guests (no login) on /try give their name and university email. Their
 * profile and one PRD are kept for GUEST_TTL_DAYS after their last use, then
 * deleted automatically.
 */
export const GUEST_TTL_DAYS = 7;

let tableReady: Promise<void> | null = null;
export function ensureGuestTables(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await ensurePrdTable();
      await getDb()`
        CREATE TABLE IF NOT EXISTS guest_profiles (
          email VARCHAR PRIMARY KEY,
          name VARCHAR NOT NULL,
          details JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL
        )
      `;
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

// Purging runs at most every few minutes per server instance.
let lastPurge = 0;

/** Deletes expired guest profiles and every guest PRD without a live profile. */
export async function purgeExpiredGuests(force = false): Promise<void> {
  if (!force && Date.now() - lastPurge < 5 * 60 * 1000) return;
  lastPurge = Date.now();
  await ensureGuestTables();
  const sql = getDb();
  await sql.transaction([
    sql`DELETE FROM guest_profiles WHERE expires_at < NOW()`,
    sql`
      DELETE FROM prd_uploads
      WHERE owner_type = 'guest'
        AND (guest_id IS NULL OR guest_id NOT IN (SELECT email FROM guest_profiles))
    `,
  ]);
}

/** Pushes a guest's expiry back to GUEST_TTL_DAYS from now. */
export async function touchGuest(email: string): Promise<boolean> {
  const rows = await getDb()`
    UPDATE guest_profiles
    SET updated_at = NOW(), expires_at = NOW() + make_interval(days => ${GUEST_TTL_DAYS})
    WHERE email = ${email}
    RETURNING email
  `;
  return rows.length > 0;
}
