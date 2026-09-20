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
        id,
        user_id,
        day_number,
        date,
        day_of_week,
        start_time,
        end_time,
        total_hours,
        learning_objectives,
        tasks_performed,
        tools_used,
        key_learnings,
        challenges_faced,
        created_at,
        updated_at
      FROM logbook_entries
      WHERE user_id = ${userId}
      ORDER BY day_number ASC;
    `;

    return NextResponse.json({ entries: rows || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load logbook entries";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, entries } = body;

    if (!userId || !Array.isArray(entries)) {
      return NextResponse.json(
        { error: "userId and entries array required" },
        { status: 400 }
      );
    }

    const sql = getDb();

    for (const entry of entries) {
      const entryId = entry.id || `entry_${userId}_${entry.day_number || Date.now()}`;
      await sql`
        INSERT INTO logbook_entries (
          id, user_id, day_number, date, day_of_week, start_time, end_time,
          total_hours, learning_objectives, tasks_performed, tools_used,
          key_learnings, challenges_faced, updated_at
        ) VALUES (
          ${entryId}, ${userId}, ${entry.day_number || 1}, ${entry.date || ""},
          ${entry.day_of_week || ""}, ${entry.start_time || ""}, ${entry.end_time || ""},
          ${entry.total_hours || ""}, ${entry.learning_objectives || ""},
          ${entry.tasks_performed || ""}, ${entry.tools_used || ""},
          ${entry.key_learnings || ""}, ${entry.challenges_faced || ""}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          day_number = EXCLUDED.day_number,
          date = EXCLUDED.date,
          day_of_week = EXCLUDED.day_of_week,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          total_hours = EXCLUDED.total_hours,
          learning_objectives = EXCLUDED.learning_objectives,
          tasks_performed = EXCLUDED.tasks_performed,
          tools_used = EXCLUDED.tools_used,
          key_learnings = EXCLUDED.key_learnings,
          challenges_faced = EXCLUDED.challenges_faced,
          updated_at = NOW();
      `;
    }

    return NextResponse.json({
      success: true,
      savedCount: entries.length,
      message: `Successfully synchronized ${entries.length} logbook entries to Neon`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save logbook entries";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
