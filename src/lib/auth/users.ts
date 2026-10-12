import { getDb } from "@/lib/db";
import type { NeonUser, SessionUser } from "./session";

/**
 * `app_users` links a Neon Auth user to the logbook account its data lives
 * under. Students are matched by their verified university email, so data
 * saved under an older account ID (e.g. `usr_<mobile>`) stays attached.
 */
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
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
          mobile TEXT UNIQUE,
          avatar_url TEXT,
          neon_user_id TEXT UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_login_at TIMESTAMPTZ
        );
      `;
      // Upgrades for tables created by earlier versions of the app.
      await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS neon_user_id TEXT UNIQUE`;
      await sql`ALTER TABLE app_users ALTER COLUMN mobile DROP NOT NULL`;
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

export function toSessionUser(user: UserRecord): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile ?? "",
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
 * Finds the account for a verified Neon user: by Neon ID, otherwise by email.
 * The same student may reach Neon through Google and through an email code
 * (two Neon identities); both resolve to one logbook account by email.
 */
export async function findUserForNeonUser(neonUser: NeonUser): Promise<UserRecord | null> {
  const linked = await selectOne("neon_user_id", neonUser.id);
  if (linked) return linked;

  const byEmail = await selectOne("email", neonUser.email);
  if (!byEmail) return null;
  if (!byEmail.neon_user_id) {
    await getDb()`
      UPDATE app_users
      SET neon_user_id = ${neonUser.id}, avatar_url = COALESCE(avatar_url, ${neonUser.image})
      WHERE id = ${byEmail.id} AND neon_user_id IS NULL
    `;
  }
  return byEmail;
}

/**
 * The account ID to use for a new student. If the old portal already saved a
 * profile or logins under this email, reuse that ID so the data stays theirs.
 */
async function idForNewStudent(neonUser: NeonUser): Promise<string> {
  const sql = getDb();
  try {
    const profile = await sql`
      SELECT user_id FROM user_profiles WHERE lower(email_id) = ${neonUser.email} LIMIT 1
    `;
    const fromProfile = String(profile[0]?.user_id || "");
    if (fromProfile && !(await selectOne("id", fromProfile))) return fromProfile;

    const login = await sql`
      SELECT user_id FROM user_logins WHERE lower(email) = ${neonUser.email} ORDER BY login_at ASC LIMIT 1
    `;
    const fromLogin = String(login[0]?.user_id || "");
    if (fromLogin && !(await selectOne("id", fromLogin))) return fromLogin;
  } catch (err) {
    console.warn("[auth] Legacy account lookup skipped:", err);
  }
  return `usr_${neonUser.id}`;
}

/**
 * Returns the student's account, creating it on first sign in. Safe to call
 * repeatedly and concurrently.
 */
export async function getOrCreateUserForNeonUser(neonUser: NeonUser, name?: string): Promise<UserRecord> {
  const existing = await findUserForNeonUser(neonUser);
  if (existing) {
    const cleanName = name?.trim();
    if (cleanName && cleanName !== existing.name) {
      await getDb()`UPDATE app_users SET name = ${cleanName} WHERE id = ${existing.id}`;
      return { ...existing, name: cleanName };
    }
    return existing;
  }

  const id = await idForNewStudent(neonUser);
  const displayName = name?.trim() || neonUser.name || neonUser.email.split("@")[0];
  try {
    const rows = await getDb()`
      INSERT INTO app_users (id, name, email, avatar_url, neon_user_id, last_login_at)
      VALUES (${id}, ${displayName}, ${neonUser.email}, ${neonUser.image}, ${neonUser.id}, NOW())
      RETURNING id, name, email, mobile, avatar_url, neon_user_id
    `;
    return rows[0] as unknown as UserRecord;
  } catch (err) {
    // Another request created it at the same moment.
    if ((err as { code?: string })?.code === "23505") {
      const raced = await findUserForNeonUser(neonUser);
      if (raced) return raced;
    }
    throw err;
  }
}

export async function touchLastLogin(userId: string): Promise<void> {
  await getDb()`UPDATE app_users SET last_login_at = NOW() WHERE id = ${userId}`;
}
