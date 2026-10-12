import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ADMIN_COOKIE, readAdminToken } from "@/lib/auth/admin";
import { ensureUsersTable } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

export interface AdminStudentProfile {
  userId: string;
  name: string;
  email: string;
  mobile: string;
  accountCreatedAt: string | null;
  lastLoginAt: string | null;
  profileUpdatedAt: string | null;
  entryCount: number;
  feedbackCount: number;
  lastEntryDate: string | null;
  profile: {
    learnerName: string;
    registrationNumber: string;
    programName: string;
    semester: string;
    batchYear: string;
    location: string;
    industryPartner: string;
    department: string;
    designation: string;
    supervisorName: string;
    supervisorContact: string;
    phoneNumber: string;
    emailId: string;
    ojtStartDate: string;
    ojtEndDate: string;
  } | null;
}

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

/** Every student account and saved profile, for the admin dashboard. */
export async function GET(request: NextRequest) {
  if (!readAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized: Administrator credentials required." }, { status: 401 });
  }

  try {
    await ensureUsersTable();
    const sql = getDb();
    // FULL JOIN: accounts without a profile yet, and profiles saved before
    // the account system existed, both show up. to_jsonb keeps this working
    // whichever optional profile columns the database has.
    const rows = await sql`
      WITH students AS (
        SELECT
          COALESCE(a.id, p.user_id) AS user_id,
          a.name, a.email, a.mobile, a.created_at, a.last_login_at,
          to_jsonb(p) AS profile
        FROM app_users a
        FULL OUTER JOIN user_profiles p ON p.user_id = a.id
      )
      SELECT
        s.*,
        (SELECT count(*)::int FROM daily_entries e WHERE e.user_id = s.user_id) AS entry_count,
        (SELECT max(e.date)::text FROM daily_entries e WHERE e.user_id = s.user_id) AS last_entry_date,
        (SELECT count(*)::int FROM supervisor_feedback f WHERE f.user_id = s.user_id) AS feedback_count
      FROM students s
      ORDER BY COALESCE(s.last_login_at, (s.profile->>'updated_at')::timestamptz) DESC NULLS LAST
    `;

    const students: AdminStudentProfile[] = rows.map((r) => {
      const p = r.profile as Record<string, unknown> | null;
      return {
        userId: text(r.user_id),
        name: text(r.name) || text(p?.learner_name),
        email: text(r.email) || text(p?.email_id),
        mobile: text(r.mobile) || text(p?.phone_number),
        accountCreatedAt: iso(r.created_at),
        lastLoginAt: iso(r.last_login_at),
        profileUpdatedAt: iso(p?.updated_at),
        entryCount: Number(r.entry_count) || 0,
        feedbackCount: Number(r.feedback_count) || 0,
        lastEntryDate: r.last_entry_date ? text(r.last_entry_date) : null,
        profile: p
          ? {
              learnerName: text(p.learner_name),
              registrationNumber: text(p.registration_number) || text(p.enrollment_no),
              programName: text(p.program_name),
              semester: text(p.semester),
              batchYear: text(p.batch_year),
              location: text(p.location),
              industryPartner: text(p.industry_partner_name) || text(p.industry_partner),
              department: text(p.department),
              designation: text(p.designation),
              supervisorName: text(p.supervisor_name),
              supervisorContact: text(p.supervisor_contact),
              phoneNumber: text(p.phone_number),
              emailId: text(p.email_id),
              ojtStartDate: text(p.ojt_start_date),
              ojtEndDate: text(p.ojt_end_date),
            }
          : null,
      };
    });

    return NextResponse.json({ students });
  } catch (err) {
    console.error("[admin/profiles]", err);
    return NextResponse.json({ error: "Couldn't load student profiles." }, { status: 500 });
  }
}
