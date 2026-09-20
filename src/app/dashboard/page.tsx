"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DailyEntry } from "@/lib/types";
import { getMonthYear } from "@/lib/utils";
import EntryCard from "@/components/entry-card";
import {
  PlusCircle,
  Loader2,
  BookOpen,
  Calendar,
  FileText,
} from "lucide-react";
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

    // Sync updated list to Neon PostgreSQL
    if (currentUserId) {
      try {
        await fetch("/api/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUserId, entries: updated }),
        });
      } catch {}
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">
            {userName ? `Welcome, ${userName}` : "Student Dashboard"}
          </h1>
          <p className="text-sm text-surface-600 mt-1 flex flex-wrap items-center gap-2">
            <span>{entries.length} {entries.length === 1 ? "entry" : "entries"} recorded</span>
            {userEmail && (
              <>
                <span>•</span>
                <span className="font-mono text-xs text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md border border-primary-100">
                  {userEmail}
                </span>
              </>
            )}
          </p>
        </div>
        <Link
          href="/dashboard/new-entry"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-medium hover:from-primary-600 hover:to-primary-700 shadow-lg shadow-primary-500/20"
        >
          <PlusCircle className="w-4 h-4" />
          New Entry
        </Link>
      </div>


      {/* Saved Logbook Banner for Returning Users */}
      {!loading && entries.length > 0 && (
        <div className="bg-gradient-to-r from-primary-900 to-surface-900 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-500/30 text-primary-200 border border-primary-400/20">
              Official Logbook Saved & Active
            </span>
            <h2 className="text-lg font-bold">Your Saved 90-Page OJT Logbook</h2>
            <p className="text-xs text-surface-300">
              {entries.length} day{entries.length > 1 ? "s" : ""} recorded • Stamped directly onto your official template
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/dashboard/logbook"
              className="px-4 py-2.5 rounded-xl bg-white text-surface-900 text-sm font-semibold hover:bg-surface-100 transition-colors flex items-center gap-2 shadow-sm"
            >
              <FileText className="w-4 h-4 text-primary-600" />
              Preview & Download 90-Page PDF
            </Link>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-10 h-10 text-primary-300" />
          </div>
          <h2 className="text-lg font-semibold text-surface-900 mb-2">No entries yet</h2>
          <p className="text-sm text-surface-800/50 mb-6">
            Start by creating your first daily OJT logbook entry.
          </p>
          <Link
            href="/dashboard/new-entry"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600"
          >
            <PlusCircle className="w-4 h-4" />
            Create First Entry
          </Link>
        </div>
      )}

      {/* Entries grouped by month */}
      {!loading &&
        Object.entries(grouped).map(([month, monthEntries]) => (
          <div key={month}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-primary-500" />
              <h2 className="text-sm font-semibold text-surface-800 uppercase tracking-wider">
                {month}
              </h2>
              <span className="text-xs text-surface-800/40">
                ({monthEntries.length} {monthEntries.length === 1 ? "entry" : "entries"})
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
