import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "";

    if (!userId) {
      return NextResponse.json({ feedbacks: [] });
    }

    const sql = getDb();
    const rows = await sql`
      SELECT *
      FROM supervisor_feedback
      WHERE user_id = ${userId}
      ORDER BY from_date DESC;
    `;

    return NextResponse.json({ feedbacks: rows || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      user_id,
      from_date,
      to_date,
      student_name,
      punctuality,
      professional_appearance,
      ability_to_communicate,
      interest_shown_for_learning,
      productivity_at_work,
      error_free_work,
      working_as_team,
      initiative_and_commitment,
      flexibility_and_adaptability,
      adherence_to_safety_ethics,
      total_score,
      remarks,
      supervisor_name,
      designation,
      signature_date,
    } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const feedbackId = id || `fb_${user_id}_${Date.now()}`;
    const sql = getDb();

    await sql`
      INSERT INTO supervisor_feedback (
        id, user_id, from_date, to_date, student_name, punctuality,
        professional_appearance, ability_to_communicate, interest_shown_for_learning,
        productivity_at_work, error_free_work, working_as_team, initiative_and_commitment,
        flexibility_and_adaptability, adherence_to_safety_ethics, total_score, remarks,
        supervisor_name, designation, signature_date, created_at
      ) VALUES (
        ${feedbackId}, ${user_id}, ${from_date || ""}, ${to_date || ""}, ${student_name || ""},
        ${punctuality || ""}, ${professional_appearance || ""}, ${ability_to_communicate || ""},
        ${interest_shown_for_learning || ""}, ${productivity_at_work || ""}, ${error_free_work || ""},
        ${working_as_team || ""}, ${initiative_and_commitment || ""}, ${flexibility_and_adaptability || ""},
        ${adherence_to_safety_ethics || ""}, ${total_score || 0}, ${remarks || ""},
        ${supervisor_name || ""}, ${designation || ""}, ${signature_date || ""}, NOW()
      );
    `;

    return NextResponse.json({ success: true, id: feedbackId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") || "";

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const sql = getDb();
    await sql`DELETE FROM supervisor_feedback WHERE id = ${id};`;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
