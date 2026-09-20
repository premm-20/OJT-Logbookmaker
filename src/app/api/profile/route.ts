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
        learner_name,
        enrollment_no,
        batch_year,
        program_name,
        industry_partner,
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

    return NextResponse.json({ profile: rows[0] });
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
      learner_name,
      enrollment_no,
      batch_year,
      program_name,
      industry_partner,
      supervisor_name,
      supervisor_contact,
      phone_number,
      email_id,
      ojt_start_date,
      ojt_end_date,
    } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const sql = getDb();
    await sql`
      INSERT INTO user_profiles (
        user_id, learner_name, enrollment_no, batch_year, program_name,
        industry_partner, supervisor_name, supervisor_contact,
        phone_number, email_id, ojt_start_date, ojt_end_date, updated_at
      ) VALUES (
        ${user_id}, ${learner_name || ""}, ${enrollment_no || ""}, ${batch_year || ""}, ${program_name || ""},
        ${industry_partner || ""}, ${supervisor_name || ""}, ${supervisor_contact || ""},
        ${phone_number || ""}, ${email_id || ""}, ${ojt_start_date || ""}, ${ojt_end_date || ""}, NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        learner_name = EXCLUDED.learner_name,
        enrollment_no = EXCLUDED.enrollment_no,
        batch_year = EXCLUDED.batch_year,
        program_name = EXCLUDED.program_name,
        industry_partner = EXCLUDED.industry_partner,
        supervisor_name = EXCLUDED.supervisor_name,
        supervisor_contact = EXCLUDED.supervisor_contact,
        phone_number = EXCLUDED.phone_number,
        email_id = EXCLUDED.email_id,
        ojt_start_date = EXCLUDED.ojt_start_date,
        ojt_end_date = EXCLUDED.ojt_end_date,
        updated_at = NOW();
    `;

    return NextResponse.json({ success: true, message: "Profile saved to Neon" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save profile";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
