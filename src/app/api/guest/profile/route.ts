import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { clientIp } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import { isUniversityEmail, normalizeEmail, UNIVERSITY_DOMAIN_LABEL } from "@/lib/auth/config";
import { ensureGuestTables, GUEST_TTL_DAYS, purgeExpiredGuests } from "@/lib/guest-db";

const DETAIL_KEYS = [
  "registration_number",
  "program_name",
  "semester",
  "location",
  "industry_partner_name",
  "phone_number",
  "department",
  "designation",
  "ojt_start_date",
  "ojt_end_date",
] as const;

/** Saves a guest's profile (name, university email, cover details). */
export async function POST(request: Request) {
  try {
    const limit = rateLimit(`guest-profile:${clientIp(request)}`, 30, 60 * 60 * 1000);
    if (!limit.ok) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, 120);
    const email = normalizeEmail(body.email);
    if (name.length < 2) return NextResponse.json({ error: "Enter your full name.", field: "name" }, { status: 400 });
    if (!isUniversityEmail(email)) {
      return NextResponse.json({ error: `Use your ${UNIVERSITY_DOMAIN_LABEL} email.`, field: "email" }, { status: 400 });
    }

    const raw = (body.details && typeof body.details === "object" ? body.details : {}) as Record<string, unknown>;
    const details = Object.fromEntries(
      DETAIL_KEYS.map((k) => [k, typeof raw[k] === "string" ? (raw[k] as string).trim().slice(0, 200) : ""])
    );

    await ensureGuestTables();
    await purgeExpiredGuests();
    const rows = await getDb()`
      INSERT INTO guest_profiles (email, name, details, expires_at)
      VALUES (${email}, ${name}, ${JSON.stringify(details)}::jsonb, NOW() + make_interval(days => ${GUEST_TTL_DAYS}))
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        details = EXCLUDED.details,
        updated_at = NOW(),
        expires_at = EXCLUDED.expires_at
      RETURNING expires_at
    `;
    return NextResponse.json({ ok: true, expiresAt: rows[0].expires_at });
  } catch (err) {
    console.error("[guest/profile]", err);
    return NextResponse.json({ error: "Couldn't save your details." }, { status: 500 });
  }
}
