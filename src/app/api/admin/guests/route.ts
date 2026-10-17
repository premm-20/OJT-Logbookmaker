import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ADMIN_COOKIE, readAdminToken } from "@/lib/auth/admin";
import { purgeExpiredGuests } from "@/lib/guest-db";

export const dynamic = "force-dynamic";

export interface AdminGuest {
  email: string;
  name: string;
  details: Record<string, string>;
  createdAt: string | null;
  lastActiveAt: string | null;
  expiresAt: string | null;
  prd: { id: string; fileName: string; sizeBytes: number; hasFile: boolean; uploadedAt: string | null } | null;
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

/** Guest profiles (no login) that haven't expired yet, newest first. */
export async function GET(request: NextRequest) {
  if (!readAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized: Administrator credentials required." }, { status: 401 });
  }
  try {
    await purgeExpiredGuests(true);
    const rows = await getDb()`
      SELECT g.*,
        (SELECT to_jsonb(p) FROM (
          SELECT id, file_name, size_bytes, file_data IS NOT NULL AS has_file, updated_at
          FROM prd_uploads WHERE owner_type = 'guest' AND guest_id = g.email
        ) p) AS prd
      FROM guest_profiles g
      ORDER BY g.updated_at DESC
      LIMIT 1000
    `;
    const guests: AdminGuest[] = rows.map((r) => ({
      email: String(r.email),
      name: String(r.name),
      details: (r.details as Record<string, string>) || {},
      createdAt: iso(r.created_at),
      lastActiveAt: iso(r.updated_at),
      expiresAt: iso(r.expires_at),
      prd: r.prd
        ? {
            id: String(r.prd.id),
            fileName: String(r.prd.file_name),
            sizeBytes: Number(r.prd.size_bytes) || 0,
            hasFile: Boolean(r.prd.has_file),
            uploadedAt: iso(r.prd.updated_at),
          }
        : null,
    }));
    return NextResponse.json({ guests });
  } catch (err) {
    console.error("[admin/guests]", err);
    return NextResponse.json({ error: "Couldn't load guest users." }, { status: 500 });
  }
}
