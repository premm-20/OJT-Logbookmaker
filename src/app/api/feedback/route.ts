import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession, unauthorized } from "@/lib/auth/session";

// Each student has one supervisor feedback form (from the session cookie).
// Saving again overwrites it.

let tableReady: Promise<void> | null = null;
function ensureOnePerStudent(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      const sql = getDb();
      await sql`ALTER TABLE supervisor_feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;
      // Older versions kept several forms per student: keep only the newest.
      await sql`
        DELETE FROM supervisor_feedback a
        USING supervisor_feedback b
        WHERE a.user_id = b.user_id
          AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id))
      `;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS supervisor_feedback_one_per_user ON supervisor_feedback (user_id)`;
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await ensureOnePerStudent();

    const sql = getDb();
    const rows = await sql`SELECT * FROM supervisor_feedback WHERE user_id = ${session.id} LIMIT 1`;
    const feedback = rows[0] || null;
    return NextResponse.json({ feedback, feedbacks: feedback ? [feedback] : [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const user_id = session.id;
    await ensureOnePerStudent();

    const body = await request.json();
    const text = (key: string) => (typeof body[key] === "string" ? body[key].trim() : "");
    const totalScore = Number.isFinite(Number(body.total_score)) ? Number(body.total_score) : 0;

    const sql = getDb();
    await sql`
      INSERT INTO supervisor_feedback (
        id, user_id, from_date, to_date, student_name, punctuality,
        professional_appearance, ability_to_communicate, interest_shown_for_learning,
        productivity_at_work, error_free_work, working_as_team, initiative_and_commitment,
        flexibility_and_adaptability, adherence_to_safety_ethics, total_score, remarks,
        supervisor_name, designation, signature_date, created_at, updated_at
      ) VALUES (
        ${`fb_${user_id}`}, ${user_id}, ${text("from_date")}, ${text("to_date")}, ${text("student_name")},
        ${text("punctuality")}, ${text("professional_appearance")}, ${text("ability_to_communicate")},
        ${text("interest_shown_for_learning")}, ${text("productivity_at_work")}, ${text("error_free_work")},
        ${text("working_as_team")}, ${text("initiative_and_commitment")}, ${text("flexibility_and_adaptability")},
        ${text("adherence_to_safety_ethics")}, ${totalScore}, ${text("remarks")},
        ${text("supervisor_name")}, ${text("designation")}, ${text("signature_date")}, NOW(), NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        from_date = EXCLUDED.from_date,
        to_date = EXCLUDED.to_date,
        student_name = EXCLUDED.student_name,
        punctuality = EXCLUDED.punctuality,
        professional_appearance = EXCLUDED.professional_appearance,
        ability_to_communicate = EXCLUDED.ability_to_communicate,
        interest_shown_for_learning = EXCLUDED.interest_shown_for_learning,
        productivity_at_work = EXCLUDED.productivity_at_work,
        error_free_work = EXCLUDED.error_free_work,
        working_as_team = EXCLUDED.working_as_team,
        initiative_and_commitment = EXCLUDED.initiative_and_commitment,
        flexibility_and_adaptability = EXCLUDED.flexibility_and_adaptability,
        adherence_to_safety_ethics = EXCLUDED.adherence_to_safety_ethics,
        total_score = EXCLUDED.total_score,
        remarks = EXCLUDED.remarks,
        supervisor_name = EXCLUDED.supervisor_name,
        designation = EXCLUDED.designation,
        signature_date = EXCLUDED.signature_date,
        updated_at = NOW()
    `;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const sql = getDb();
    await sql`DELETE FROM supervisor_feedback WHERE user_id = ${session.id}`;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
