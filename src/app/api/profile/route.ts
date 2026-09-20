import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "";

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const sql = getDb();
    const rows = await sql`
      SELECT
        user_id,
        user_id AS id,
        learner_name,
        registration_number,
        enrollment_no,
        batch_year,
        program_name,
        semester,
        location,
        industry_partner,
        industry_partner_name,
        department,
        designation,
        supervisor_name,
        supervisor_contact,
        phone_number,
        email_id,
        ojt_start_date,
        ojt_end_date,
        updated_at
      FROM user_profiles
      WHERE user_id = ${userId}
      LIMIT 1;
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ profile: null });
    }

    const row = rows[0];
    const profile = {
      ...row,
      id: row.user_id,
      registration_number: row.registration_number || row.enrollment_no || "",
      industry_partner_name: row.industry_partner_name || row.industry_partner || "",
    };

    return NextResponse.json({ profile });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load profile";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      user_id,
      id,
      learner_name,
      registration_number,
      enrollment_no,
      batch_year,
      program_name,
      semester,
      location,
      industry_partner,
      industry_partner_name,
      department,
      designation,
      supervisor_name,
      supervisor_contact,
      phone_number,
      email_id,
      ojt_start_date,
      ojt_end_date,
    } = body;

    const targetUserId = user_id || id;
    if (!targetUserId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const regNo = registration_number || enrollment_no || "";
    const indPartner = industry_partner_name || industry_partner || "";

    const sql = getDb();
    await sql`
      INSERT INTO user_profiles (
        user_id, learner_name, enrollment_no, registration_number, batch_year,
        program_name, semester, location, industry_partner, industry_partner_name,
        department, designation, supervisor_name, supervisor_contact,
        phone_number, email_id, ojt_start_date, ojt_end_date, updated_at
      ) VALUES (
        ${targetUserId}, ${learner_name || ""}, ${regNo}, ${regNo}, ${batch_year || ""},
        ${program_name || ""}, ${semester || ""}, ${location || ""}, ${indPartner}, ${indPartner},
        ${department || ""}, ${designation || ""}, ${supervisor_name || ""}, ${supervisor_contact || ""},
        ${phone_number || ""}, ${email_id || ""}, ${ojt_start_date || ""}, ${ojt_end_date || ""}, NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        learner_name = EXCLUDED.learner_name,
        enrollment_no = EXCLUDED.enrollment_no,
        registration_number = EXCLUDED.registration_number,
        batch_year = EXCLUDED.batch_year,
        program_name = EXCLUDED.program_name,
        semester = EXCLUDED.semester,
        location = EXCLUDED.location,
        industry_partner = EXCLUDED.industry_partner,
        industry_partner_name = EXCLUDED.industry_partner_name,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation,
        supervisor_name = EXCLUDED.supervisor_name,
        supervisor_contact = EXCLUDED.supervisor_contact,
        phone_number = EXCLUDED.phone_number,
        email_id = EXCLUDED.email_id,
        ojt_start_date = EXCLUDED.ojt_start_date,
        ojt_end_date = EXCLUDED.ojt_end_date,
        updated_at = NOW();
    `;

    return NextResponse.json({ success: true, message: "Profile saved to Neon PostgreSQL" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save profile";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
