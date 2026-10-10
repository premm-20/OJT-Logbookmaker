import { getDb } from "@/lib/db";
import type { NeonUser, SessionUser } from "./session";

/**
 * `app_users` links a Neon Auth user to the logbook account its data lives
 * under. IDs stay `usr_<mobile>` so students who used the earlier portal keep
 * their existing entries, profile and feedback rows.
 */
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  mobile: string;
  avatar_url: string | null;
  neon_user_id: string | null;
}

export class AuthError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

let tableReady: Promise<void> | null = null;

/** Creates / upgrades the accounts table on first use. */
export function ensureUsersTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      const sql = getDb();
      await sql`
        CREATE TABLE IF NOT EXISTS app_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          mobile TEXT NOT NULL UNIQUE,
          avatar_url TEXT,
          neon_user_id TEXT UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_login_at TIMESTAMPTZ
        );
      `;
      // Tables created by the earlier self-hosted auth lack this column.
      await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS neon_user_id TEXT UNIQUE`;
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

export function userIdForMobile(mobile: string): string {
  return `usr_${mobile}`;
}

export function toSessionUser(user: UserRecord): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    avatarUrl: user.avatar_url,
  };
}

const COLUMNS = "id, name, email, mobile, avatar_url, neon_user_id";

async function selectOne(where: string, value: string): Promise<UserRecord | null> {
  await ensureUsersTable();
  const rows = await getDb().query(`SELECT ${COLUMNS} FROM app_users WHERE ${where} = $1 LIMIT 1`, [value]);
  return (rows[0] as unknown as UserRecord) ?? null;
}

/**
 * Finds the account for a verified Neon user. An account created before
 * Neon Auth (same university email) is linked on first sign in; Neon has
 * already verified the email, so the link is safe.
 */
export async function findUserForNeonUser(neonUser: NeonUser): Promise<UserRecord | null> {
  const linked = await selectOne("neon_user_id", neonUser.id);
  if (linked) return linked;

  const byEmail = await selectOne("email", neonUser.email);
  if (!byEmail || byEmail.neon_user_id) return null;

  const rows = await getDb()`
    UPDATE app_users
    SET neon_user_id = ${neonUser.id}, avatar_url = COALESCE(avatar_url, ${neonUser.image})
    WHERE id = ${byEmail.id} AND neon_user_id IS NULL
    RETURNING id, name, email, mobile, avatar_url, neon_user_id
  `;
  return (rows[0] as unknown as UserRecord) ?? null;
}

/**
 * Before accounts existed, anyone could sign in as `usr_<mobile>`. If that ID
 * already holds a profile or login history under a different email, refuse
 * to hand it to a new account.
 */
async function assertLegacyDataBelongsTo(userId: string, email: string): Promise<void> {
  const sql = getDb();
  let ownerEmail = "";
  try {
    const profile = await sql`SELECT email_id FROM user_profiles WHERE user_id = ${userId} LIMIT 1`;
    ownerEmail = String(profile[0]?.email_id || "").trim().toLowerCase();
    if (!ownerEmail) {
      const firstLogin = await sql`
        SELECT email FROM user_logins WHERE user_id = ${userId} ORDER BY login_at ASC LIMIT 1
      `;
      ownerEmail = String(firstLogin[0]?.email || "").trim().toLowerCase();
    }
  } catch (err) {
    console.warn("[auth] Legacy ownership lookup skipped:", err);
    return;
  }
  if (ownerEmail && ownerEmail !== email) {
    throw new AuthError(
      "This mobile number is already linked to another student's logbook. Use your own number, or contact your coordinator.",
      409
    );
  }
}

/** Checks a mobile number can be used for this email. Throws AuthError if not. */
export async function assertMobileAvailable(email: string, mobile: string): Promise<void> {
  const existing = await selectOne("mobile", mobile);
  if (existing && existing.email !== email) {
    throw new AuthError("This mobile number is already registered to another account.", 409);
  }
  await assertLegacyDataBelongsTo(userIdForMobile(mobile), email);
}

/** Creates the logbook account for a verified Neon user (one-time onboarding). */
export async function createUserForNeonUser(neonUser: NeonUser, mobile: string, name?: string): Promise<UserRecord> {
  const existing = await findUserForNeonUser(neonUser);
  if (existing) return existing;

  if (await selectOne("email", neonUser.email)) {
    throw new AuthError("This email is already linked to another sign-in. Contact your coordinator.", 409);
  }
  await assertMobileAvailable(neonUser.email, mobile);

  try {
    const rows = await getDb()`
      INSERT INTO app_users (id, name, email, mobile, avatar_url, neon_user_id, last_login_at)
      VALUES (${userIdForMobile(mobile)}, ${name || neonUser.name}, ${neonUser.email}, ${mobile},
              ${neonUser.image}, ${neonUser.id}, NOW())
      RETURNING id, name, email, mobile, avatar_url, neon_user_id
    `;
    return rows[0] as unknown as UserRecord;
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      throw new AuthError("This mobile number is already registered to another account.", 409);
    }
    throw err;
  }
}

export async function touchLastLogin(userId: string): Promise<void> {
  await getDb()`UPDATE app_users SET last_login_at = NOW() WHERE id = ${userId}`;
}
