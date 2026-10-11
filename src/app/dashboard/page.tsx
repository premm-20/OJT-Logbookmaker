"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DailyEntry } from "@/lib/types";
import { getMonthYear } from "@/lib/utils";
import EntryCard from "@/components/entry-card";
import { PlusCircle, NotebookPen, Calendar, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchEntries() {
    // 1. Check user identification
    const storedName = localStorage.getItem("ojt_user_name") || "";
    const storedEmail = localStorage.getItem("ojt_user_login_email") || "";
    const currentUserId = localStorage.getItem("ojt_user_id") || "";
    setUserName(storedName);
    setUserEmail(storedEmail);

    let localEntries: DailyEntry[] = [];
    try {
      const userScopedKey = currentUserId ? `ojt_saved_entries_${currentUserId}` : "";
      const scopedData = userScopedKey ? localStorage.getItem(userScopedKey) : null;
      if (scopedData) {
        localEntries = JSON.parse(scopedData);
      } else {
        const generalData = localStorage.getItem("ojt_saved_entries");
        if (generalData) {
          localEntries = JSON.parse(generalData);
        }
      }
    } catch {}

    // 2. Fetch from Neon PostgreSQL
    if (currentUserId) {
      try {
        const res = await fetch(`/api/entries?userId=${encodeURIComponent(currentUserId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.entries && Array.isArray(data.entries) && data.entries.length > 0) {
            setEntries(data.entries as DailyEntry[]);
            setLoading(false);
            return;
          }
        }
      } catch {}
    }

    setEntries(localEntries);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    const currentUserId = localStorage.getItem("ojt_user_id") || "";
    const userScopedKey = currentUserId ? `ojt_saved_entries_${currentUserId}` : "";

    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);

    try {
      if (userScopedKey) localStorage.setItem(userScopedKey, JSON.stringify(updated));
      localStorage.setItem("ojt_saved_entries", JSON.stringify(updated));
    } catch {}

    // Remove it from the database too, otherwise it reappears on reload.
    try {
      await fetch(`/api/entries?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {}
  }

  function handleDuplicate(entry: DailyEntry) {
    // Navigate to new-entry with pre-filled data via sessionStorage
    const data = {
      department: entry.department,
      designation: entry.designation,
      original_text: entry.original_text,
      my_space: entry.my_space,
      tasks_carried_out: entry.tasks_carried_out,
      key_learning_observations: entry.key_learning_observations,
      tools_technology_used: entry.tools_technology_used,
      special_achievements: entry.special_achievements,
    };
    sessionStorage.setItem("duplicate_entry", JSON.stringify(data));
    router.push("/dashboard/new-entry");
  }

  // Group entries by month
  const grouped = entries.reduce<Record<string, DailyEntry[]>>((acc, entry) => {
    const month = getMonthYear(entry.date);
    if (!acc[month]) acc[month] = [];
    acc[month].push(entry);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold tracking-tight text-surface-950">
            {userName ? `Hi, ${userName.split(" ")[0]}` : "Your logbook"}
          </h1>
          <p className="mt-1 text-sm text-surface-600">
            {loading ? (
              "Loading your entries"
            ) : (
              <>
                <span className="font-mono tabular-nums text-surface-900">{entries.length}</span>{" "}
                {entries.length === 1 ? "day" : "days"} logged
                {userEmail && <span className="hidden sm:inline"> as {userEmail}</span>}
              </>
            )}
          </p>
        </div>
        <Link
          href="/dashboard/new-entry"
          className="flex h-11 items-center gap-2 rounded-xl bg-primary-700 px-4 text-sm font-semibold text-white shadow-[0_1px_2px_oklch(0.3_0.058_236/0.35),inset_0_1px_0_oklch(1_0_0/0.12)] hover:bg-primary-800"
        >
          <PlusCircle className="h-4 w-4" />
          Fill logbook
        </Link>
      </div>


      {/* Saved Logbook Banner for Returning Users */}
      {!loading && entries.length > 0 && (
        <div className="grain relative overflow-hidden rounded-2xl bg-primary-950 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="absolute inset-0 bg-[radial-gradient(70%_120%_at_100%_0%,oklch(0.42_0.09_236)_0%,transparent_70%)]" aria-hidden />
          <div className="relative space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Your logbook is ready to export</h2>
            <p className="text-sm text-primary-100/75">
              {entries.length} {entries.length === 1 ? "day is" : "days are"} printed onto the official university template.
            </p>
          </div>
          <Link
            href="/dashboard/edit-pdf?source=saved"
            className="relative flex h-11 shrink-0 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-primary-900 hover:bg-primary-50"
          >
            <FileText className="h-4 w-4" />
            Preview and download PDF
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading entries">
          <div className="skeleton h-24 w-full rounded-2xl" />
          <div className="skeleton mt-6 h-4 w-32" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-surface-300 bg-white px-6 py-14 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <NotebookPen className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold text-surface-950">Log your first day</h2>
          <p className="mx-auto mt-2 max-w-[44ch] text-sm leading-relaxed text-surface-600">
            Paste what you did today, the way you&apos;d tell a friend. It gets sorted into tasks, learnings,
            tools and achievements.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard/new-entry"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-700 px-5 text-sm font-semibold text-white hover:bg-primary-800"
            >
              <PlusCircle className="h-4 w-4" />
              Write today&apos;s entry
            </Link>
            <Link
              href="/dashboard/profile"
              className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50"
            >
              Fill in your profile first
            </Link>
          </div>
        </div>
      )}

      {/* Entries grouped by month */}
      {!loading &&
        Object.entries(grouped).map(([month, monthEntries]) => (
          <div key={month}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-primary-600" />
              <h2 className="text-sm font-semibold text-surface-900">{month}</h2>
              <span className="font-mono text-xs tabular-nums text-surface-600">
                {monthEntries.length} {monthEntries.length === 1 ? "entry" : "entries"}
              </span>
            </div>
            <div className="space-y-3">
              {monthEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
