"use client";

import { Fragment, useState } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import type { AdminStudentProfile } from "@/app/api/admin/profiles/route";
import { cn } from "@/lib/utils";

const PROFILE_FIELDS: { key: keyof NonNullable<AdminStudentProfile["profile"]>; label: string }[] = [
  { key: "learnerName", label: "Learner name" },
  { key: "registrationNumber", label: "Registration no." },
  { key: "programName", label: "Program" },
  { key: "semester", label: "Semester" },
  { key: "batchYear", label: "Batch year" },
  { key: "location", label: "Location" },
  { key: "industryPartner", label: "Industry partner" },
  { key: "department", label: "Department" },
  { key: "designation", label: "Designation" },
  { key: "supervisorName", label: "Supervisor" },
  { key: "supervisorContact", label: "Supervisor contact" },
  { key: "phoneNumber", label: "Phone" },
  { key: "emailId", label: "Email on logbook" },
  { key: "ojtStartDate", label: "OJT start" },
  { key: "ojtEndDate", label: "OJT end" },
];

/** How many of the cover-page fields the student has filled in. */
export function profileCompleteness(s: AdminStudentProfile): number {
  if (!s.profile) return 0;
  const filled = PROFILE_FIELDS.filter((f) => s.profile![f.key].trim()).length;
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
}

export function studentProfilesToCsv(students: AdminStudentProfile[]): string {
  const headers = [
    "User ID",
    "Name",
    "Email",
    "Mobile",
    ...PROFILE_FIELDS.map((f) => f.label),
    "Entries saved",
    "Last entry date",
    "Feedback saved",
    "Edited PDF saved",
    "Account created",
    "Last login",
    "Profile updated",
  ];
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = students.map((s) => [
    s.userId,
    s.name,
    s.email,
    s.mobile,
    ...PROFILE_FIELDS.map((f) => s.profile?.[f.key] ?? ""),
    s.entryCount,
    s.lastEntryDate ?? "",
    s.feedbackSavedAt ?? "",
    s.editedPdf?.updatedAt ?? "",
    s.accountCreatedAt ?? "",
    s.lastLoginAt ?? "",
    s.profileUpdatedAt ?? "",
  ]);
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\n");
}

/** Fetches a student's saved PDF in chunks and starts a download. */
async function downloadStudentPdf(s: AdminStudentProfile) {
  const pdf = s.editedPdf;
  if (!pdf) return;
  const parts = await Promise.all(
    Array.from({ length: pdf.chunkCount }, async (_, part) => {
      const res = await fetch(`/api/admin/edited-pdf?userId=${encodeURIComponent(s.userId)}&part=${part}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Couldn't download this PDF.");
      return res.blob();
    })
  );
  const url = URL.createObjectURL(new Blob(parts, { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(s.name || s.userId).replace(/[^\w.-]+/g, "_")}_${pdf.fileName}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function StudentPdf({ s, formatDateTime }: { s: AdminStudentProfile; formatDateTime: (iso: string | null | undefined) => string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pdf = s.editedPdf;
  if (!pdf) return <p className="text-sm text-surface-600">No edited PDF saved yet.</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-surface-900">{pdf.fileName}</p>
        <p className="text-[11px] text-surface-500">
          {pdf.pageCount} pages · {(pdf.sizeBytes / 1048576).toFixed(1)} MB · saved {formatDateTime(pdf.updatedAt)}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async (e) => {
          e.stopPropagation();
          setBusy(true);
          setError("");
          try {
            await downloadStudentPdf(s);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't download this PDF.");
          } finally {
            setBusy(false);
          }
        }}
        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-primary-700 px-3 text-xs font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
        Download
      </button>
      {error && <p className="w-full text-xs font-medium text-[oklch(0.45_0.16_25)]">{error}</p>}
    </div>
  );
}

export default function AdminStudentProfiles({
  students,
  formatDateTime,
}: {
  students: AdminStudentProfile[];
  formatDateTime: (iso: string | null | undefined) => string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-surface-200 bg-surface-50/60 text-[11px] font-bold uppercase tracking-wider text-surface-500">
            <th className="px-4 py-3">Student</th>
            <th className="px-4 py-3">Registration no.</th>
            <th className="px-4 py-3">Program / semester</th>
            <th className="px-4 py-3">Industry partner</th>
            <th className="px-4 py-3">OJT period</th>
            <th className="px-4 py-3">Entries</th>
            <th className="px-4 py-3">Profile</th>
            <th className="px-4 py-3" aria-label="Details" />
          </tr>
        </thead>
        <tbody className="text-xs text-surface-800">
          {students.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-sm text-surface-500">
                No student profiles found.
              </td>
            </tr>
          ) : (
            students.map((s) => {
              const p = s.profile;
              const pct = profileCompleteness(s);
              const open = expanded === s.userId;
              return (
                <Fragment key={s.userId}>
                  <tr
                    onClick={() => setExpanded(open ? null : s.userId)}
                    className={cn(
                      "cursor-pointer border-b border-surface-100 hover:bg-surface-50",
                      open && "bg-primary-50/40"
                    )}
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-surface-900">{p?.learnerName || s.name || "Unnamed student"}</div>
                      <div className="font-mono text-[11px] text-primary-700">{s.email || "No email"}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px]">{p?.registrationNumber || "-"}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium">{p?.programName || "-"}</div>
                      {p?.semester && <div className="text-[11px] text-surface-500">{p.semester}</div>}
                    </td>
                    <td className="px-4 py-3.5">{p?.industryPartner || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-surface-600">
                      {p?.ojtStartDate || p?.ojtEndDate ? `${p.ojtStartDate || "?"} to ${p.ojtEndDate || "?"}` : "-"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono font-bold tabular-nums">{s.entryCount}</span>
                      {s.lastEntryDate && <div className="text-[11px] text-surface-500">last {s.lastEntryDate}</div>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                          !p
                            ? "bg-surface-100 text-surface-600"
                            : pct >= 80
                              ? "bg-success/10 text-[oklch(0.42_0.11_155)]"
                              : "bg-warning/15 text-[oklch(0.45_0.1_70)]"
                        )}
                      >
                        {p ? `${pct}% filled` : "Not started"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <ChevronDown className={cn("ml-auto h-4 w-4 text-surface-500 transition-transform", open && "rotate-180")} aria-hidden />
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-surface-200 bg-surface-50/70">
                      <td colSpan={8} className="px-4 py-5">
                        {p ? (
                          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                            {PROFILE_FIELDS.map((f) => (
                              <div key={f.key}>
                                <dt className="text-[11px] font-semibold text-surface-500">{f.label}</dt>
                                <dd className="text-sm font-medium text-surface-900">{p[f.key] || "-"}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="text-sm text-surface-600">This student hasn&apos;t saved their profile yet.</p>
                        )}
                        <div className="mt-4 border-t border-surface-200 pt-3">
                          <p className="mb-2 text-[11px] font-semibold text-surface-500">Edited PDF</p>
                          <StudentPdf s={s} formatDateTime={formatDateTime} />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-surface-200 pt-3 text-[11px] text-surface-500">
                          <span>User ID: <span className="font-mono">{s.userId}</span></span>
                          {s.mobile && <span>Mobile: {s.mobile}</span>}
                          <span>Supervisor feedback: {s.feedbackSavedAt ? `saved ${formatDateTime(s.feedbackSavedAt)}` : "not saved"}</span>
                          <span>Account created: {formatDateTime(s.accountCreatedAt)}</span>
                          <span>Last login: {formatDateTime(s.lastLoginAt)}</span>
                          <span>Profile updated: {formatDateTime(s.profileUpdatedAt)}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
