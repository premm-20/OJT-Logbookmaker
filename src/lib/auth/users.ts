import { getDb } from "@/lib/db";
import type { SessionUser } from "./tokens";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  mobile: string;
  password_hash: string | null;
  google_sub: string | null;
  avatar_url: string | null;
}

export class AuthError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

let tableReady: Promise<void> | null = null;

/** Creates the accounts table on first use, so no manual migration is needed. */
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
          password_hash TEXT,
          google_sub TEXT UNIQUE,
          avatar_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_login_at TIMESTAMPTZ
        );
      `;
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

/**
 * User IDs stay `usr_<mobile>` so students who used the old portal keep their
 * existing entries, profile and feedback rows.
 */
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

async function findOne(rows: Promise<Record<string, unknown>[]>): Promise<UserRecord | null> {
  const result = await rows;
  return (result[0] as unknown as UserRecord) ?? null;
}

const COLUMNS = "id, name, email, mobile, password_hash, google_sub, avatar_url";

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  await ensureUsersTable();
  const sql = getDb();
  return findOne(sql.query(`SELECT ${COLUMNS} FROM app_users WHERE email = $1 LIMIT 1`, [email]));
}

export async function findUserByMobile(mobile: string): Promise<UserRecord | null> {
  await ensureUsersTable();
  const sql = getDb();
  return findOne(sql.query(`SELECT ${COLUMNS} FROM app_users WHERE mobile = $1 LIMIT 1`, [mobile]));
}

export async function findUserByGoogleSub(sub: string): Promise<UserRecord | null> {
  await ensureUsersTable();
  const sql = getDb();
  return findOne(sql.query(`SELECT ${COLUMNS} FROM app_users WHERE google_sub = $1 LIMIT 1`, [sub]));
}

/**
 * Before the account system existed, anyone could sign in as `usr_<mobile>`.
 * If that ID already holds a profile or login history under a different
 * email, refuse to hand it to a new account.
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

export async function assertAvailable(email: string, mobile: string): Promise<void> {
  if (await findUserByEmail(email)) {
    throw new AuthError("An account with this email already exists. Sign in instead.", 409);
  }
  if (await findUserByMobile(mobile)) {
    throw new AuthError("This mobile number is already registered to another account.", 409);
  }
  await assertLegacyDataBelongsTo(userIdForMobile(mobile), email);
}

export async function createUser(input: {
  name: string;
  email: string;
  mobile: string;
  passwordHash?: string | null;
  googleSub?: string | null;
  avatarUrl?: string | null;
}): Promise<UserRecord> {
  await assertAvailable(input.email, input.mobile);
  const sql = getDb();
  const id = userIdForMobile(input.mobile);
  try {
    const rows = await sql`
      INSERT INTO app_users (id, name, email, mobile, password_hash, google_sub, avatar_url, last_login_at)
      VALUES (${id}, ${input.name}, ${input.email}, ${input.mobile}, ${input.passwordHash ?? null},
              ${input.googleSub ?? null}, ${input.avatarUrl ?? null}, NOW())
      RETURNING id, name, email, mobile, password_hash, google_sub, avatar_url
    `;
    return rows[0] as unknown as UserRecord;
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      throw new AuthError("An account with these details already exists. Sign in instead.", 409);
    }
    throw err;
  }
}

export async function linkGoogleAccount(userId: string, sub: string, avatarUrl: string | null): Promise<UserRecord> {
  const sql = getDb();
  const rows = await sql`
    UPDATE app_users
    SET google_sub = ${sub}, avatar_url = COALESCE(avatar_url, ${avatarUrl}), last_login_at = NOW()
    WHERE id = ${userId}
    RETURNING id, name, email, mobile, password_hash, google_sub, avatar_url
  `;
  return rows[0] as unknown as UserRecord;
}

export async function setPassword(userId: string, passwordHash: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE app_users SET password_hash = ${passwordHash} WHERE id = ${userId}`;
}

export async function touchLastLogin(userId: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE app_users SET last_login_at = NOW() WHERE id = ${userId}`;
}
