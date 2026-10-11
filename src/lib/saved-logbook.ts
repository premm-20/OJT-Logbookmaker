"use client";

import type { DailyEntry } from "@/lib/types";
import type { ProfileData, SingleDayData } from "@/lib/pdf-generator";
import { calculateHours } from "@/lib/utils";

/** Loads the signed-in student's profile and saved entries. */
export async function loadSavedLogbookData(): Promise<{ profile: ProfileData; entries: SingleDayData[] }> {
  const [profileRes, entriesRes] = await Promise.all([fetch("/api/profile"), fetch("/api/entries")]);
  if (!entriesRes.ok) throw new Error("Couldn't load your saved entries. Please try again.");

  const profile: ProfileData = profileRes.ok ? (await profileRes.json()).profile || {} : {};
  const rows: DailyEntry[] = (await entriesRes.json()).entries || [];

  const entries = rows.map((e, index): SingleDayData => {
    let dayNumber = index + 1;
    const match = (e.original_text || e.my_space || "").match(/(?:day\s*([0-9]+)|day-([0-9]+))/i);
    if (match) {
      const d = parseInt(match[1] || match[2], 10);
      if (d >= 1 && d <= 76) dayNumber = d;
    }
    return {
      dayNumber,
      date: e.date,
      startTime: e.start_time,
      endTime: e.end_time,
      department: e.department,
      designation: e.designation,
      mySpace: e.my_space,
      tasksCarriedOut: e.tasks_carried_out,
      keyLearningObservations: e.key_learning_observations,
      toolsTechnologyUsed: e.tools_technology_used,
      specialAchievements: e.special_achievements,
      totalHours: calculateHours(e.start_time, e.end_time),
    };
  });
  return { profile, entries };
}

/** Builds the official logbook with the saved entries stamped in, as PDF bytes. */
export async function buildSavedLogbookPdf(profile: ProfileData, entries: SingleDayData[]): Promise<Uint8Array> {
  const res = await fetch("/api/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "complete", profile, entries, preview: true }),
  });
  if (!res.ok) throw new Error("Couldn't build your saved logbook. Please try again.");
  return new Uint8Array(await res.arrayBuffer());
}
