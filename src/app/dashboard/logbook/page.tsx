"use client";

import { useEffect, useState } from "react";
import type { DailyEntry, Profile } from "@/lib/types";
import { calculateHours } from "@/lib/utils";
import {
  generateCompleteLogbookPDF,
  SingleDayData,
} from "@/lib/pdf-generator";
import LogbookPreview from "@/components/logbook-preview";
import {
  FileText,
  Download,
  Loader2,
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  PlusCircle,
} from "lucide-react";
import Link from "next/link";

export default function LogbookPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);

  // Active day selected for editing in preview
  const [activeDayNumber, setActiveDayNumber] = useState<number>(1);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    setLoading(true);
    const userId = (typeof window !== "undefined" && localStorage.getItem("ojt_user_id")) || "";

    let prof: Profile | null = null;
    let ents: DailyEntry[] = [];

    if (userId) {
      try {
        const [profileRes, entriesRes] = await Promise.all([
          fetch(`/api/profile?userId=${encodeURIComponent(userId)}`),
          fetch(`/api/entries?userId=${encodeURIComponent(userId)}`),
        ]);

        if (profileRes.ok) {
          const pData = await profileRes.json();
          prof = pData.profile || null;
        }

        if (entriesRes.ok) {
          const eData = await entriesRes.json();
          ents = eData.entries || [];
        }
      } catch (err) {
        console.error("Error fetching from Neon database:", err);
      }
    }

    if (ents.length === 0 && typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("ojt_saved_entries");
        if (local) {
          ents = JSON.parse(local);
        }
      } catch (e) {
        console.error("Error reading saved entries from localStorage:", e);
      }
    }

    setProfile(prof);
    setEntries(ents);
    if (ents.length > 0) {
      const match = (ents[0].original_text || ents[0].my_space || "").match(
        /(?:day\s*([0-9]+)|day-([0-9]+))/i
      );
      if (match) {
        const d = parseInt(match[1] || match[2], 10);
        if (d >= 1 && d <= 76) setActiveDayNumber(d);
      }
    }
    setLoading(false);
  }

  function getEntryForDay(dayNum: number): DailyEntry | undefined {
    return entries.find((e, idx) => {
      const match = (e.original_text || e.my_space || "").match(
        /(?:day\s*([0-9]+)|day-([0-9]+))/i
      );
      if (match) {
        const d = parseInt(match[1] || match[2], 10);
        return d === dayNum;
      }
      return idx + 1 === dayNum;
    });
  }

  const activeEntry = getEntryForDay(activeDayNumber) || entries[0];

  // In-preview editable fields for active entry
  const [activeDate, setActiveDate] = useState("");
  const [activeStartTime, setActiveStartTime] = useState("09:00 AM");
  const [activeEndTime, setActiveEndTime] = useState("05:00 PM");
  const [activeDept, setActiveDept] = useState("");
  const [activeDesig, setActiveDesig] = useState("");
  const [activeMySpace, setActiveMySpace] = useState("");
  const [activeTasks, setActiveTasks] = useState("");
  const [activeKeyLearning, setActiveKeyLearning] = useState("");
  const [activeTools, setActiveTools] = useState("");
  const [activeSpecial, setActiveSpecial] = useState("");

  useEffect(() => {
    if (activeEntry) {
      setActiveDate(activeEntry.date || "");
      setActiveStartTime(activeEntry.start_time || "09:00 AM");
      setActiveEndTime(activeEntry.end_time || "05:00 PM");
      setActiveDept(activeEntry.department || "");
      setActiveDesig(activeEntry.designation || "");
      setActiveMySpace(activeEntry.my_space || "");
      setActiveTasks(activeEntry.tasks_carried_out || "");
      setActiveKeyLearning(activeEntry.key_learning_observations || "");
      setActiveTools(activeEntry.tools_technology_used || "");
      setActiveSpecial(activeEntry.special_achievements || "");
    }
  }, [activeEntry, activeDayNumber]);

  const handleFieldChange = (field: string, value: string) => {
    switch (field) {
      case "date":
        setActiveDate(value);
        break;
      case "startTime":
      case "start_time":
        setActiveStartTime(value);
        break;
      case "endTime":
      case "end_time":
        setActiveEndTime(value);
        break;
      case "department":
        setActiveDept(value);
        break;
      case "designation":
        setActiveDesig(value);
        break;
      case "mySpace":
      case "my_space":
        setActiveMySpace(value);
        break;
      case "tasksCarriedOut":
      case "tasks_carried_out":
        setActiveTasks(value);
        break;
      case "keyLearningObservations":
      case "key_learning_observations":
        setActiveKeyLearning(value);
        break;
      case "toolsTechnologyUsed":
      case "tools_technology_used":
        setActiveTools(value);
        break;
      case "specialAchievements":
      case "special_achievements":
        setActiveSpecial(value);
        break;
    }
  };

  async function handleSaveInPreview() {
    setSavingEntry(true);
    const userId = (typeof window !== "undefined" && localStorage.getItem("ojt_user_id")) || "";
    if (!userId) {
      alert("Please log in to save changes.");
      setSavingEntry(false);
      return;
    }

    const entryId = activeEntry?.id || `entry_${userId}_${Date.now()}`;
    const payload = {
      id: entryId,
      user_id: userId,
      date: activeDate || new Date().toISOString().split("T")[0],
      start_time: activeStartTime,
      end_time: activeEndTime,
      department: activeDept,
      designation: activeDesig,
      original_text: `Day ${activeDayNumber}`,
      my_space: activeMySpace,
      tasks_carried_out: activeTasks,
      key_learning_observations: activeKeyLearning,
      tools_technology_used: activeTools,
      special_achievements: activeSpecial,
    };

    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, entries: [payload] }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert("Failed to save: " + (data.error || "Server error"));
      } else {
        if (activeEntry?.id) {
          setEntries((prev) =>
            prev.map((e) =>
              e.id === activeEntry.id
                ? {
                    ...e,
                    date: activeDate,
                    start_time: activeStartTime,
                    end_time: activeEndTime,
                    department: activeDept,
                    designation: activeDesig,
                    my_space: activeMySpace,
                    tasks_carried_out: activeTasks,
                    key_learning_observations: activeKeyLearning,
                    tools_technology_used: activeTools,
                    special_achievements: activeSpecial,
                  }
                : e
            )
          );
        } else {
          setEntries((prev) => [...prev, payload as DailyEntry]);
        }
      }
    } catch (err: unknown) {
      alert("Failed to save entry: " + (err instanceof Error ? err.message : "Network error"));
    } finally {
      setSavingEntry(false);
    }
  }

  function formatEntriesForPdf(entriesList: DailyEntry[]): SingleDayData[] {
    return entriesList.map((e, index) => {
      let dayNumber = index + 1;
      const match = (e.original_text || e.my_space || "").match(
        /(?:day\s*([0-9]+)|day-([0-9]+))/i
      );
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
  }

  async function handleGenerateLogbook() {
    setGenerating(true);
    try {
      const entryData = formatEntriesForPdf(entries);
      await generateCompleteLogbookPDF(profile || {}, entryData);
    } catch (err: any) {
      alert(err.message || "Failed to generate complete logbook PDF");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  const totalHours = entries
    .reduce((acc, e) => acc + parseFloat(calculateHours(e.start_time, e.end_time)), 0)
    .toFixed(1);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-700 shadow-sm">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900">Your Complete Logbook</h1>
            <p className="text-sm text-surface-800/60">
              Preview the whole 90-page logbook and edit your entries directly in the preview
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/new-entry"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-surface-200 text-surface-800 text-sm font-semibold hover:bg-surface-100 transition-all"
          >
            <PlusCircle className="w-4 h-4 text-primary-600" />
            Add Day Entry
          </Link>

          <button
            onClick={handleGenerateLogbook}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold text-sm hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 cursor-pointer shadow-lg shadow-primary-600/20 transition-all"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing 90-Page PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download Complete Logbook (90 Pages)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Warnings / Tips */}
      {!profile && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Student Profile Not Set</p>
            <p className="text-xs text-amber-800 mt-1">
              Add your registration number, program name, and supervisor info in your{" "}
              <Link href="/dashboard/profile" className="underline font-semibold">
                Student Profile
              </Link>
              . It will be stamped directly onto Page 3 of your logbook.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-sm">
          <p className="text-xs text-surface-800/60 font-medium">Days Recorded</p>
          <p className="text-2xl font-bold text-surface-900 mt-1">{entries.length} / 76</p>
          <p className="text-[11px] text-primary-600 font-medium mt-1">
            Stamped on Pages 8–{Math.max(8, 7 + entries.length)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-sm">
          <p className="text-xs text-surface-800/60 font-medium">Total Working Hours</p>
          <p className="text-2xl font-bold text-surface-900 mt-1">{totalHours} hrs</p>
          <p className="text-[11px] text-surface-800/40 mt-1">Calculated with AM/PM</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-sm">
          <p className="text-xs text-surface-800/60 font-medium">Student Name</p>
          <p className="text-sm font-semibold text-surface-900 mt-1 truncate">
            {profile?.learner_name || "Not set"}
          </p>
          <p className="text-[11px] text-surface-800/40 truncate">
            {profile?.registration_number || "No Reg No"}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-sm">
          <p className="text-xs text-surface-800/60 font-medium">Status</p>
          <div className="flex items-center gap-1.5 mt-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-surface-900">Saved & Active</span>
          </div>
          <p className="text-[11px] text-surface-800/40 mt-1">Preserved across logins</p>
        </div>
      </div>

      {/* ========================================================= */}
      {/* UNIFIED INTERACTIVE LOGBOOK PREVIEW & IN-PLACE EDITOR */}
      {/* ========================================================= */}
      <LogbookPreview
        dayNumber={activeDayNumber}
        date={activeDate}
        startTime={activeStartTime}
        endTime={activeEndTime}
        department={activeDept}
        designation={activeDesig}
        mySpace={activeMySpace}
        tasksCarriedOut={activeTasks}
        keyLearningObservations={activeKeyLearning}
        toolsTechnologyUsed={activeTools}
        specialAchievements={activeSpecial}
        editable={true}
        onFieldChange={handleFieldChange}
        onSave={handleSaveInPreview}
        isSaving={savingEntry}
        allEntries={entries}
        profile={profile}
        onSelectDay={(d) => setActiveDayNumber(d)}
      />
    </div>
  );
}
