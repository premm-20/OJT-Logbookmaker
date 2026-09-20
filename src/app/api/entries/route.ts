import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "";
    const entryId = searchParams.get("entryId") || "";

    const sql = getDb();

    if (entryId) {
      const rows = await sql`
        SELECT *
        FROM daily_entries
        WHERE id = ${entryId}
        LIMIT 1;
      `;
      return NextResponse.json({ entry: rows[0] || null });
    }

    if (!userId) {
      return NextResponse.json({ entries: [] });
    }

    const rows = await sql`
      SELECT *
      FROM daily_entries
      WHERE user_id = ${userId}
      ORDER BY date ASC, created_at ASC;
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
    const sql = getDb();

    // Support both single entry save or array of entries
    const userId = body.userId || body.user_id;
    let entries = body.entries;

    if (!entries && (body.date || body.tasks_carried_out || body.id)) {
      entries = [body];
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: "Valid entry or entries array required" },
        { status: 400 }
      );
    }

    for (const entry of entries) {
      const targetUserId = entry.user_id || userId;
      if (!targetUserId) continue;

      const entryId = entry.id || `entry_${targetUserId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const date = entry.date || new Date().toISOString().split("T")[0];
      const startTime = entry.start_time || "09:00 AM";
      const endTime = entry.end_time || "05:00 PM";
      const department = entry.department || "";
      const designation = entry.designation || "";
      const originalText = entry.original_text || "";
      const mySpace = entry.my_space || "";
      const tasksCarriedOut = entry.tasks_carried_out || entry.tasks_performed || "";
      const keyLearningObservations = entry.key_learning_observations || entry.key_learnings || "";
      const toolsTechnologyUsed = entry.tools_technology_used || entry.tools_used || "";
      const specialAchievements = entry.special_achievements || "";

      await sql`
        INSERT INTO daily_entries (
          id, user_id, date, start_time, end_time, department, designation,
          original_text, my_space, tasks_carried_out, key_learning_observations,
          tools_technology_used, special_achievements, updated_at
        ) VALUES (
          ${entryId}, ${targetUserId}, ${date}, ${startTime}, ${endTime},
          ${department}, ${designation}, ${originalText}, ${mySpace},
          ${tasksCarriedOut}, ${keyLearningObservations}, ${toolsTechnologyUsed},
          ${specialAchievements}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          date = EXCLUDED.date,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          department = EXCLUDED.department,
          designation = EXCLUDED.designation,
          original_text = EXCLUDED.original_text,
          my_space = EXCLUDED.my_space,
          tasks_carried_out = EXCLUDED.tasks_carried_out,
          key_learning_observations = EXCLUDED.key_learning_observations,
          tools_technology_used = EXCLUDED.tools_technology_used,
          special_achievements = EXCLUDED.special_achievements,
          updated_at = NOW();
      `;
    }

    return NextResponse.json({
      success: true,
      savedCount: entries.length,
      message: `Successfully synchronized ${entries.length} logbook entries to Neon PostgreSQL`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save logbook entries";
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
    await sql`DELETE FROM daily_entries WHERE id = ${id};`;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete entry";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
