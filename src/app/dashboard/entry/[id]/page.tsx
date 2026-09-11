"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import type { DailyEntry, Profile } from "@/lib/types";
import { calculateHours } from "@/lib/utils";
import LogbookPreview from "@/components/logbook-preview";
import {
  ArrowLeft,
  Loader2,
  Calendar,
  Building2,
  Briefcase,
  BookOpen,
} from "lucide-react";
import Link from "next/link";

export default function EntryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const entryId = params.id as string;

  const [entry, setEntry] = useState<DailyEntry | null>(null);
  const [allEntries, setAllEntries] = useState<DailyEntry[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dayNumber, setDayNumber] = useState(1);

  // Editable fields in preview
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00 AM");
  const [endTime, setEndTime] = useState("05:00 PM");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [mySpace, setMySpace] = useState("");
  const [tasksCarriedOut, setTasksCarriedOut] = useState("");
  const [keyLearningObservations, setKeyLearningObservations] = useState("");
  const [toolsTechnologyUsed, setToolsTechnologyUsed] = useState("");
  const [specialAchievements, setSpecialAchievements] = useState("");

  useEffect(() => {
    fetchEntryAndData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  async function fetchEntryAndData() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const [entryRes, allRes, profRes] = await Promise.all([
      supabase.from("daily_entries").select("*").eq("id", entryId).single(),
      supabase
        .from("daily_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true }),
      supabase.from("profiles").select("*").eq("id", user.id).single(),
    ]);

    if (entryRes.data) {
      const e = entryRes.data as DailyEntry;
      setEntry(e);
      setDate(e.date);
      setStartTime(e.start_time || "09:00 AM");
      setEndTime(e.end_time || "05:00 PM");
      setDepartment(e.department);
      setDesignation(e.designation);
      setMySpace(e.my_space);
      setTasksCarriedOut(e.tasks_carried_out);
      setKeyLearningObservations(e.key_learning_observations);
      setToolsTechnologyUsed(e.tools_technology_used);
      setSpecialAchievements(e.special_achievements);

      const match = (e.original_text || e.my_space || "").match(
        /(?:day\s*([0-9]+)|day-([0-9]+))/i
      );
      if (match) {
        const d = parseInt(match[1] || match[2], 10);
        if (d >= 1 && d <= 76) setDayNumber(d);
      }
    }

    if (allRes.data) {
      setAllEntries(allRes.data as DailyEntry[]);
    }
    if (profRes.data) {
      setProfile(profRes.data as Profile);
    }

    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from("daily_entries")
      .update({
        date,
        start_time: startTime,
        end_time: endTime,
        department,
        designation,
        my_space: mySpace,
        tasks_carried_out: tasksCarriedOut,
        key_learning_observations: keyLearningObservations,
        tools_technology_used: toolsTechnologyUsed,
        special_achievements: specialAchievements,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entryId);

    setSaving(false);
    if (!error) {
      router.refresh();
    } else {
      alert("Failed to save changes: " + error.message);
    }
  }

  function handleFieldUpdate(field: string, value: string) {
    switch (field) {
      case "date":
        setDate(value);
        break;
      case "startTime":
      case "start_time":
        setStartTime(value);
        break;
      case "endTime":
      case "end_time":
        setEndTime(value);
        break;
      case "department":
        setDepartment(value);
        break;
      case "designation":
        setDesignation(value);
        break;
      case "my_space":
      case "mySpace":
        setMySpace(value);
        break;
      case "tasks_carried_out":
      case "tasksCarriedOut":
        setTasksCarriedOut(value);
        break;
      case "key_learning_observations":
      case "keyLearningObservations":
        setKeyLearningObservations(value);
        break;
      case "tools_technology_used":
      case "toolsTechnologyUsed":
        setToolsTechnologyUsed(value);
        break;
      case "special_achievements":
      case "specialAchievements":
        setSpecialAchievements(value);
        break;
    }
  }

  const totalHours = calculateHours(startTime, endTime);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="text-center py-20">
        <p className="text-surface-800/50">Entry not found.</p>
        <Link href="/dashboard" className="text-primary-600 text-sm mt-2 inline-block">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl border border-surface-200 hover:bg-surface-100 text-surface-800/70 transition-all"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-surface-900">
              Logbook Preview & In-Place Editor — Day {dayNumber}
            </h1>
            <p className="text-xs text-surface-800/60">
              Edit text directly in the preview • Stamped with bold text and AM/PM format
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/logbook"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 text-surface-800 text-xs font-semibold border border-surface-300 transition-all"
        >
          <BookOpen className="w-3.5 h-3.5 text-primary-600" />
          View Whole Logbook (90 Pages)
        </Link>
      </div>

      {/* Unified Logbook Preview with In-Place Editor */}
      <LogbookPreview
        dayNumber={dayNumber}
        date={date}
        startTime={startTime}
        endTime={endTime}
        department={department}
        designation={designation}
        mySpace={mySpace}
        tasksCarriedOut={tasksCarriedOut}
        keyLearningObservations={keyLearningObservations}
        toolsTechnologyUsed={toolsTechnologyUsed}
        specialAchievements={specialAchievements}
        totalHours={totalHours}
        editable={true}
        onFieldChange={handleFieldUpdate}
        onSave={handleSave}
        isSaving={saving}
        allEntries={allEntries}
        profile={profile}
      />
    </div>
  );
}
