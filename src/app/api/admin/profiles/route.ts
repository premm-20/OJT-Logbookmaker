import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ADMIN_COOKIE, readAdminToken } from "@/lib/auth/admin";
import { ensureUsersTable } from "@/lib/auth/users";
import { ensureEditedPdfTables } from "@/lib/edited-pdf-store";
import { ensurePrdTable } from "@/lib/prd-db";

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
  /** When the supervisor feedback form was last saved, or null. */
  feedbackSavedAt: string | null;
  /** The student's latest uploaded PRD, or null. */
  prd: { id: string; fileName: string; sizeBytes: number; hasFile: boolean; uploadedAt: string | null } | null;
  /** The student's latest saved edited PDF, or null. */
  editedPdf: { fileName: string; sizeBytes: number; pageCount: number; chunkCount: number; updatedAt: string | null } | null;
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
    await Promise.all([ensureUsersTable(), ensureEditedPdfTables(), ensurePrdTable()]);
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
        (SELECT COALESCE(to_jsonb(f)->>'updated_at', f.created_at::text) FROM supervisor_feedback f
          WHERE f.user_id = s.user_id LIMIT 1) AS feedback_saved_at,
        (SELECT to_jsonb(x) FROM (
          SELECT file_name, size_bytes, page_count, chunk_count, updated_at
          FROM edited_pdfs WHERE user_id = s.user_id
        ) x) AS edited_pdf,
        (SELECT to_jsonb(y) FROM (
          SELECT id, file_name, size_bytes, file_data IS NOT NULL AS has_file, updated_at
          FROM prd_uploads WHERE owner_type = 'student' AND user_id = s.user_id
        ) y) AS prd
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
        feedbackSavedAt: iso(r.feedback_saved_at),
        prd: r.prd
          ? {
              id: text(r.prd.id),
              fileName: text(r.prd.file_name),
              sizeBytes: Number(r.prd.size_bytes) || 0,
              hasFile: Boolean(r.prd.has_file),
              uploadedAt: iso(r.prd.updated_at),
            }
          : null,
        editedPdf: r.edited_pdf
          ? {
              fileName: text(r.edited_pdf.file_name),
              sizeBytes: Number(r.edited_pdf.size_bytes) || 0,
              pageCount: Number(r.edited_pdf.page_count) || 0,
              chunkCount: Number(r.edited_pdf.chunk_count) || 0,
              updatedAt: iso(r.edited_pdf.updated_at),
            }
          : null,
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
