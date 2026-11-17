"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import type { AdminSubmission } from "@/app/api/admin/submissions/route";

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Every logbook made on the no-login page: PRDs, notes and user details. */
export default function AdminSubmissions({ searchQuery, formatDateTime }: { searchQuery: string; formatDateTime: (iso: string | null) => string }) {
  const [rows, setRows] = useState<AdminSubmission[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/submissions", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Couldn't load submissions.");
        setRows(data.submissions || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load submissions."));
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((s) =>
      [s.name, s.email, s.prdFileName, s.customPrompt, ...Object.values(s.details)].some((v) => v?.toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  function exportCsv() {
    const keys = ["registration_number", "program_name", "semester", "location", "industry_partner_name", "phone_number", "department", "designation", "ojt_start_date", "ojt_end_date"];
    const header = ["created_at", "mode", "name", "email", ...keys, "prd_file", "instructions"];
    const lines = filtered.map((s) =>
      [s.createdAt || "", s.mode, s.name, s.email, ...keys.map((k) => s.details[k] || ""), s.prdFileName, s.customPrompt].map(csvCell).join(",")
    );
    const url = URL.createObjectURL(new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "logbook_submissions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const link = (id: string, as: string) => `/api/admin/submissions?id=${encodeURIComponent(id)}&as=${as}`;

  return (
    <div className="overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-200 bg-surface-50/50 p-4 sm:p-5">
        <div>
          <h2 className="text-sm font-bold text-surface-900">All submissions ({filtered.length})</h2>
          <p className="mt-0.5 text-xs text-surface-500">Every logbook made without login: user details, instructions, and the PRD or pasted notes. Kept permanently.</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!filtered.length}
          className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-surface-700 ring-1 ring-surface-200 hover:bg-surface-50 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Export CSV
        </button>
      </div>
      {error && <p className="px-4 py-3 text-sm text-[oklch(0.45_0.16_25)]">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50/60 text-[11px] font-bold uppercase tracking-wider text-surface-500">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">OJT period</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Instructions</th>
            </tr>
          </thead>
          <tbody className="text-xs text-surface-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-surface-500">No submissions yet.</td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="border-b border-surface-100 align-top">
                  <td className="whitespace-nowrap px-4 py-3.5 text-surface-600">{formatDateTime(s.createdAt)}</td>
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-surface-900">{s.name || "-"}</div>
                    <div className="font-mono text-[11px] text-primary-700">{s.email || "no email"}</div>
                    {s.details.phone_number && <div className="text-[11px] text-surface-500">{s.details.phone_number}</div>}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-mono text-[11px]">{s.details.registration_number || "-"}</div>
                    <div className="font-medium">{s.details.program_name}</div>
                    <div className="text-[11px] text-surface-500">
                      {[s.details.industry_partner_name, s.details.department, s.details.designation].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-surface-600">
                    {s.details.ojt_start_date || s.details.ojt_end_date ? `${s.details.ojt_start_date || "?"} to ${s.details.ojt_end_date || "?"}` : "-"}
                  </td>
                  <td className="px-4 py-3.5">
                    {s.mode === "paste" ? (
                      <a href={link(s.id, "paste")} className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline">
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        Pasted notes
                      </a>
                    ) : (
                      <div className="space-y-1">
                        <div className="max-w-[16rem] truncate font-medium">{s.prdFileName || "PRD"}</div>
                        <div className="flex gap-3">
                          {s.hasFile && <a href={link(s.id, "file")} className="font-semibold text-primary-700 hover:underline">File</a>}
                          {s.hasText && <a href={link(s.id, "text")} className="font-semibold text-primary-700 hover:underline">Text</a>}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="max-w-[22rem] px-4 py-3.5 text-surface-600">
                    <p className="line-clamp-3 whitespace-pre-line">{s.customPrompt || "-"}</p>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
