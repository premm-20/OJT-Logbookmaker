import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession, unauthorized } from "@/lib/auth/session";
import { toIsoDate } from "@/lib/utils";

// The signed-in student is always taken from the session cookie. Any userId
// sent by the browser is ignored, so one student can't read another's logbook.

// Older saves stored dates as DD-MM-YYYY or DD/MM/YYYY. Store everything as
// YYYY-MM-DD so days sort, display and match correctly. Runs once per server.
let datesReady: Promise<void> | null = null;
function normaliseStoredDates(): Promise<void> {
  if (!datesReady) {
    datesReady = (async () => {
      await getDb()`
        UPDATE daily_entries
        SET date = to_char(to_date(replace(date, '/', '-'), 'DD-MM-YYYY'), 'YYYY-MM-DD')
        WHERE date ~ '^[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4}$'
      `;
    })().catch((err) => {
      datesReady = null;
      throw err;
    });
  }
  return datesReady;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const userId = session.id;

    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get("entryId") || "";

    await normaliseStoredDates();
    const sql = getDb();

    if (entryId) {
      const rows = await sql`
        SELECT *
        FROM daily_entries
        WHERE id = ${entryId} AND user_id = ${userId}
        LIMIT 1;
      `;
      return NextResponse.json({ entry: rows[0] || null });
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
    const session = await getSession();
    if (!session) return unauthorized();
    const userId = session.id;

    const body = await request.json();
    const sql = getDb();

    // Support both single entry save or array of entries
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

    // "all": a Fill logbook save replaces every previously saved day.
    // "date": saving one day replaces any saved entry for the same date.
    const replace: "all" | "date" | undefined = body.replace === "all" || body.replace === "date" ? body.replace : undefined;
    await normaliseStoredDates();

    const rows = entries.map((entry: Record<string, string>) => ({
      id: entry.id || `entry_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: toIsoDate(entry.date || "") || new Date().toISOString().split("T")[0],
      startTime: entry.start_time || "09:00 AM",
      endTime: entry.end_time || "05:00 PM",
      department: entry.department || "",
      designation: entry.designation || "",
      originalText: entry.original_text || "",
      mySpace: entry.my_space || "",
      tasksCarriedOut: entry.tasks_carried_out || entry.tasks_performed || "",
      keyLearningObservations: entry.key_learning_observations || entry.key_learnings || "",
      toolsTechnologyUsed: entry.tools_technology_used || entry.tools_used || "",
      specialAchievements: entry.special_achievements || "",
    }));

    const queries = [];
    if (replace === "all") {
      queries.push(sql`DELETE FROM daily_entries WHERE user_id = ${userId}`);
    } else if (replace === "date") {
      const dates = [...new Set(rows.map((r: { date: string }) => r.date))];
      const ids = rows.map((r: { id: string }) => r.id);
      queries.push(sql`
        DELETE FROM daily_entries
        WHERE user_id = ${userId} AND date = ANY(${dates}) AND NOT (id = ANY(${ids}))
      `);
    }
    for (const r of rows) {
      queries.push(sql`
        INSERT INTO daily_entries (
          id, user_id, date, start_time, end_time, department, designation,
          original_text, my_space, tasks_carried_out, key_learning_observations,
          tools_technology_used, special_achievements, updated_at
        ) VALUES (
          ${r.id}, ${userId}, ${r.date}, ${r.startTime}, ${r.endTime},
          ${r.department}, ${r.designation}, ${r.originalText}, ${r.mySpace},
          ${r.tasksCarriedOut}, ${r.keyLearningObservations}, ${r.toolsTechnologyUsed},
          ${r.specialAchievements}, NOW()
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
          updated_at = NOW()
        WHERE daily_entries.user_id = EXCLUDED.user_id
      `);
    }
    // All or nothing: a failed save never leaves the old days deleted.
    await sql.transaction(queries);

    return NextResponse.json({
      success: true,
      savedCount: entries.length,
      message: `Saved ${entries.length} logbook ${entries.length === 1 ? "entry" : "entries"}.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save logbook entries";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") || "";

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const sql = getDb();
    await sql`DELETE FROM daily_entries WHERE id = ${id} AND user_id = ${session.id};`;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete entry";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
