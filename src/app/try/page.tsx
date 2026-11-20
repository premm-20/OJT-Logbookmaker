"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  KeyRound,
  Download,
  Eye,
  FileText,
  FileUp,
  Info,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import BrandMark from "@/components/brand-mark";
import { extractTextFromFile } from "@/lib/file-extractor";
import { cachePrd, restoreCachedPrd } from "@/lib/prd-store";
import { PRD_MAX_FILE_BYTES } from "@/lib/prd-limits";
import ApiKeyCard, { useAiKey } from "@/components/api-key-card";
import { aiKeyHeaders } from "@/lib/user-ai-key";
import { buildLogbookPdf, type ProfileData, type SingleDayData } from "@/lib/pdf-generator";
import type { ExtractedDayEntry } from "@/lib/types";
import { cn, ensureSpecialAchievements, formatDateLong } from "@/lib/utils";
import { normalizeEmail } from "@/lib/auth/config";

/**
 * No-login logbook maker: write every day from a PRD, or sort pasted daily
 * notes into the logbook sections. Runs on the user's own AI key. Each request
 * (details, instructions, PRD or notes) is saved to the database; the logbook
 * itself lives only in this page.
 */

/** `count` working dates (Mon-Sat) from `start` (YYYY-MM-DD), as DD-MM-YYYY. */
function workingDates(start: string, count: number): string[] {
  const [y, m, d] = start.split("-").map(Number);
  const cur = new Date(y, (m || 1) - 1, d || 1);
  const out: string[] = [];
  while (out.length < count && Number.isFinite(cur.getTime())) {
    if (cur.getDay() !== 0) {
      out.push(`${String(cur.getDate()).padStart(2, "0")}-${String(cur.getMonth() + 1).padStart(2, "0")}-${cur.getFullYear()}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Number of working days (Mon-Sat) from start to end, both YYYY-MM-DD. */
function countWorkingDays(start: string, end: string): number {
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  const cur = new Date(y1, m1 - 1, d1);
  const last = new Date(y2, m2 - 1, d2);
  let n = 0;
  while (cur <= last && n < 1000) {
    if (cur.getDay() !== 0) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

// Days per request and requests at a time. Small requests each finish well
// inside the server's time limit, so a long logbook can't time out.
const DAYS_PER_REQUEST = 8;
const PARALLEL_REQUESTS = 3;
const RETRIES_PER_PART = 2;

interface GuestDay {
  date: string;
  mySpace: string;
  tasks: string;
  learnings: string;
  tools: string;
  achievement: string;
}

type Details = Required<
  Pick<
    ProfileData,
    | "learner_name"
    | "registration_number"
    | "program_name"
    | "semester"
    | "location"
    | "industry_partner_name"
    | "phone_number"
    | "email_id"
  >
>;

const DETAIL_FIELDS: { key: keyof Details; label: string; placeholder: string; type?: string }[] = [
  { key: "registration_number", label: "Registration no.", placeholder: "e.g. REG-2026-001" },
  { key: "program_name", label: "Program", placeholder: "e.g. B.Tech Computer Science" },
  { key: "semester", label: "Semester", placeholder: "e.g. 6th Semester" },
  { key: "location", label: "Location", placeholder: "e.g. Bengaluru" },
  { key: "industry_partner_name", label: "Industry partner", placeholder: "Company name" },
  { key: "phone_number", label: "Phone", placeholder: "e.g. +91 98765 43210", type: "tel" },
];

const EMPTY_DETAILS: Details = {
  learner_name: "",
  registration_number: "",
  program_name: "",
  semester: "",
  location: "",
  industry_partner_name: "",
  phone_number: "",
  email_id: "",
};

// Name and email are remembered for this tab only.
const IDENTITY_KEY = "ojt_guest_identity";

const join = (v: string[] | string | undefined, sep = "\n") => (Array.isArray(v) ? v.filter(Boolean).join(sep) : v || "");

/** "14:30" -> "02:30 PM" */
function to12h(value: string): string {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const inputClass =
  "w-full rounded-xl border border-surface-300 bg-white px-3 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";
const labelClass = "mb-1.5 block text-[13px] font-medium text-surface-700";

export default function TryPage() {
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [identityErrors, setIdentityErrors] = useState<{ name?: string; email?: string }>({});
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [showDetails, setShowDetails] = useState(true);
  const [customPrompt, setCustomPrompt] = useState("");
  const [mode, setMode] = useState<"prd" | "paste">("prd");
  const [pastedText, setPastedText] = useState("");
  const aiKey = useAiKey();

  const [status, setStatus] = useState<"idle" | "reading" | "writing" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [days, setDays] = useState<GuestDay[]>([]);
  const [pdfBusy, setPdfBusy] = useState<"download" | "preview" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);

  const running = status === "reading" || status === "writing";

  // Bring back the PRD, name and email from earlier in this tab.
  useEffect(() => {
    let cancelled = false;
    restoreCachedPrd().then((cached) => {
      if (cached && !cancelled) setFile((current) => current ?? cached);
    });
    Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(IDENTITY_KEY) || "null") as { name?: string; email?: string } | null;
        if (saved && !cancelled) {
          setGuestName((v) => v || saved.name || "");
          setGuestEmail((v) => v || saved.email || "");
        }
      } catch {
        // Storage blocked: start empty.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Elapsed seconds while generating, so a long wait never looks stuck.
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  // Nothing is saved, so warn before the page is closed with a logbook on it.
  useEffect(() => {
    if (days.length === 0 && !running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [days.length, running]);

  function pickFile(picked: File | undefined | null) {
    if (!picked) return;
    if (!/\.(pdf|docx|txt)$/i.test(picked.name)) {
      setError("Upload a PDF, DOCX or TXT file.");
      return;
    }
    setError("");
    setFile(picked);
    void cachePrd(picked);
  }

  async function generate() {
    const name = guestName.trim().replace(/\s+/g, " ");
    const email = normalizeEmail(guestEmail);
    const idErrors: typeof identityErrors = {};
    if (name.length < 2) idErrors.name = "Enter your full name.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) idErrors.email = "Enter a valid email, or leave it empty.";
    setIdentityErrors(idErrors);
    if (Object.keys(idErrors).length) {
      document.getElementById("step-you")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return setError("Add your name first.");
    }
    if (mode === "prd") {
      if (!file) return setError("Upload your PRD or project description first.");
      if (!startDate || !endDate) return setError("Choose your project start and end dates.");
    } else if (!pastedText.trim()) {
      return setError("Paste your daily notes first.");
    }
    if (startDate && endDate && endDate < startDate) return setError("The end date is before the start date.");

    setError("");
    setElapsed(0);
    setStatus("reading");
    try {
      sessionStorage.setItem(IDENTITY_KEY, JSON.stringify({ name, email }));
    } catch {
      // Storage blocked: fine.
    }
    try {
      const prdText = mode === "prd" && file ? await extractTextFromFile(file) : "";
      if (mode === "prd" && !prdText.trim()) throw new Error("That file looks empty. Try a different file.");

      // Every request is saved (details, instructions, PRD or notes); saving
      // never blocks or slows the logbook.
      void saveSubmission({ name, email, prdText });

      setStatus("writing");
      let resultDays: ExtractedDayEntry[];
      if (mode === "prd") {
        const total = countWorkingDays(startDate, endDate);
        if (total === 0) throw new Error("No working days in that range. Try different dates.");
        if (total > 76) throw new Error(`Too many days (${total}). Maximum is 76 working days.`);
        resultDays = await writeInParts(prdText, total);
      } else {
        const res = await fetch("/api/extract-logbook", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...aiKeyHeaders(aiKey) },
          body: JSON.stringify({ text: pastedText }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.success) throw new Error(result.error || "Couldn't sort your notes. Please try again.");
        resultDays = result.days as ExtractedDayEntry[];
      }

      const fallbackDates = mode === "paste" && startDate ? workingDates(startDate, resultDays.length) : [];
      const generated: GuestDay[] = resultDays.map((d, i) => {
        const tasks = join(d.tasksCarriedOutToday);
        return {
          date: formatDateLong(d.date || fallbackDates[i] || ""),
          mySpace: join(d.mySpace, " "),
          tasks,
          learnings: join(d.keyLearningObservations),
          tools: join(d.toolsTechnologyUsed, ", "),
          achievement: ensureSpecialAchievements(join(d.specialAchievements), tasks),
        };
      });
      if (generated.length === 0) {
        throw new Error(mode === "prd" ? "No working days in that range. Try different dates." : "Couldn't find any entries in your notes.");
      }
      setDays(generated);
      setStatus("done");
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  /** Writes the logbook a few days per request, retrying any part that fails. */
  async function writeInParts(prdText: string, total: number): Promise<ExtractedDayEntry[]> {
    const parts: number[] = [];
    for (let i = 0; i < total; i += DAYS_PER_REQUEST) parts.push(i);
    const results: ExtractedDayEntry[][] = new Array(parts.length);
    let doneDays = 0;
    setProgress({ done: 0, total });

    async function writePart(chunkStart: number): Promise<ExtractedDayEntry[]> {
      let lastError = "Couldn't write the logbook. Please try again.";
      for (let attempt = 0; attempt <= RETRIES_PER_PART; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * attempt));
        try {
          const res = await fetch("/api/generate-from-prd", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...aiKeyHeaders(aiKey) },
            body: JSON.stringify({
              prdText,
              startDate,
              endDate,
              startTime: to12h(startTime),
              endTime: to12h(endTime),
              department,
              designation,
              customPrompt: customPrompt.trim(),
              chunkStart,
              chunkSize: DAYS_PER_REQUEST,
            }),
          });
          const result = await res.json().catch(() => ({}));
          if (res.ok && result.success) return result.days as ExtractedDayEntry[];
          lastError = result.error || lastError;
          // Bad input or no key won't get better by retrying.
          if (res.status === 400 || res.status === 429) break;
        } catch {
          lastError = "Lost the connection while writing. Please try again.";
        }
      }
      throw new Error(lastError);
    }

    let next = 0;
    async function worker() {
      while (next < parts.length) {
        const i = next++;
        results[i] = await writePart(parts[i]);
        doneDays += results[i].length;
        setProgress({ done: doneDays, total });
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL_REQUESTS, parts.length) }, worker));
    return results.flat();
  }

  async function saveSubmission({ name, email, prdText }: { name: string; email: string; prdText: string }) {
    try {
      const form = new FormData();
      form.set("mode", mode);
      form.set("name", name);
      form.set("email", email);
      form.set(
        "details",
        JSON.stringify({
          ...details,
          department,
          designation,
          ojt_start_date: startDate,
          ojt_end_date: endDate,
          start_time: to12h(startTime),
          end_time: to12h(endTime),
        })
      );
      if (mode === "prd") {
        form.set("customPrompt", customPrompt.trim());
        form.set("prdText", prdText);
        if (file) {
          form.set("fileName", file.name);
          // Vercel accepts at most 4.5 MB per request; bigger files keep the text only.
          if (file.size <= PRD_MAX_FILE_BYTES) form.set("file", file);
        }
      } else {
        form.set("pastedText", pastedText);
      }
      await fetch("/api/submissions", { method: "POST", body: form });
    } catch {
      // A missing copy must never get in the user's way.
    }
  }

  function updateDay(index: number, field: keyof GuestDay, value: string) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  }

  async function buildPdf(): Promise<Uint8Array> {
    const profile: ProfileData = {
      ...details,
      learner_name: guestName.trim(),
      email_id: normalizeEmail(guestEmail),
      ojt_start_date: startDate,
      ojt_end_date: endDate,
      department,
      designation,
    };
    const entries: SingleDayData[] = days.map((d, i) => ({
      dayNumber: i + 1,
      date: d.date,
      startTime: to12h(startTime),
      endTime: to12h(endTime),
      department,
      designation,
      mySpace: d.mySpace,
      tasksCarriedOut: d.tasks,
      keyLearningObservations: d.learnings,
      toolsTechnologyUsed: d.tools,
      specialAchievements: d.achievement,
    }));
    return buildLogbookPdf(profile, entries);
  }

  async function openPdf(mode: "download" | "preview") {
    setPdfBusy(mode);
    setError("");
    try {
      const url = URL.createObjectURL(new Blob([(await buildPdf()) as BlobPart], { type: "application/pdf" }));
      if (mode === "preview") {
        window.open(url, "_blank", "noopener");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(details.learner_name || "OJT").replace(/[^\w-]+/g, "_")}_Logbook.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("Couldn't build the PDF. Please try again.");
    } finally {
      setPdfBusy(null);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-surface-50">
      <header className="sticky top-0 z-30 border-b border-surface-200/70 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="rounded-xl" aria-label="OJT Logbook home">
            <BrandMark className="max-[400px]:[&>span:last-child]:hidden" />
          </Link>
          <Link
            href="/api-key"
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold sm:px-4",
              aiKey ? "bg-primary-50 text-primary-800 hover:bg-primary-100" : "text-surface-700 hover:bg-surface-100"
            )}
          >
            <KeyRound className="h-4 w-4" aria-hidden />
            {aiKey ? "Own key in use" : "API key"}
          </Link>
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 pb-24 pt-10 sm:px-6">
        <div className="animate-fade-in">
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-surface-950">OJT logbook maker</h1>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-surface-600">
            Upload your PRD to get every working day written, or paste your own daily notes to have them sorted into the
            logbook sections. Everything is printed onto the official logbook.
          </p>
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-primary-50 px-3.5 py-3 text-sm text-primary-900 ring-1 ring-inset ring-primary-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden />
            <span>
              No sign-in needed. Logbooks aren&apos;t kept, so download your PDF before closing this page.
            </span>
          </p>
        </div>

        {/* API key: the user's own, at the top */}
        <ApiKeyCard id="api-key" />

        {/* 1. About you */}
        <section className="rounded-3xl bg-white p-6 ring-1 ring-surface-200 sm:p-7" aria-labelledby="step-you">
          <StepTitle n={1} id="step-you">About you</StepTitle>
          <p className="mt-1 text-sm text-surface-600">Printed on the logbook&apos;s cover page.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="g-name" className={labelClass}>Full name</label>
              <input
                id="g-name"
                autoComplete="name"
                value={guestName}
                placeholder="As printed on your ID card"
                aria-invalid={!!identityErrors.name}
                onChange={(e) => {
                  setGuestName(e.target.value);
                  setIdentityErrors((prev) => ({ ...prev, name: undefined }));
                }}
                className={cn(inputClass, identityErrors.name && "border-danger")}
              />
              {identityErrors.name && <p className="mt-1.5 text-[13px] font-medium text-[oklch(0.45_0.16_25)]">{identityErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="g-email" className={labelClass}>Email <span className="font-normal text-surface-500">(optional)</span></label>
              <input
                id="g-email"
                type="email"
                autoComplete="email"
                value={guestEmail}
                placeholder="name@medhaviskillsuniversity.edu.in"
                aria-invalid={!!identityErrors.email}
                onChange={(e) => {
                  setGuestEmail(e.target.value);
                  setIdentityErrors((prev) => ({ ...prev, email: undefined }));
                }}
                className={cn(inputClass, identityErrors.email && "border-danger")}
              />
              {identityErrors.email && <p className="mt-1.5 text-[13px] font-medium text-[oklch(0.45_0.16_25)]">{identityErrors.email}</p>}
            </div>
          </div>
        </section>

        {/* 2. Source: PRD + instructions, or pasted notes */}
        <section className="rounded-3xl bg-white p-6 ring-1 ring-surface-200 sm:p-7" aria-labelledby="step-prd">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StepTitle n={2} id="step-prd">{mode === "prd" ? "Your PRD and instructions" : "Paste your daily notes"}</StepTitle>
            <div className="flex rounded-xl bg-surface-100 p-1" role="tablist" aria-label="How to make the logbook">
              {(
                [
                  ["prd", "Upload PRD", FileUp],
                  ["paste", "Paste content", ClipboardPaste],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={mode === id}
                  disabled={running}
                  onClick={() => {
                    setMode(id);
                    setError("");
                  }}
                  className={cn(
                    "flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed",
                    mode === id ? "bg-white text-primary-800 shadow-sm" : "text-surface-600 hover:text-surface-900"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {mode === "paste" ? (
            <div className="mt-4">
              <p className="text-sm text-surface-600">
                Paste what you did, one day or many (start each with &quot;Day 1&quot;, &quot;Day 2&quot;...). Your sentences are
                sorted into the logbook sections exactly as you wrote them.
              </p>
              <label htmlFor="g-paste" className="sr-only">Daily notes</label>
              <textarea
                id="g-paste"
                rows={10}
                value={pastedText}
                disabled={running}
                placeholder={"Day 1\nReached the office at 9 and joined the team stand-up. Set up the project on my laptop with Node.js and Git. Learned how the codebase is organised. Got the app running locally on day one.\n\nDay 2\n..."}
                onChange={(e) => setPastedText(e.target.value)}
                className={cn(inputClass, "mt-3 resize-y leading-relaxed")}
              />
            </div>
          ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
          <p className={labelClass}>PRD or project description</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            disabled={running}
            className={cn(
              "flex min-h-[132px] w-full cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-5 text-left transition-colors disabled:cursor-not-allowed",
              dragOver ? "border-primary-500 bg-primary-50" : file ? "border-primary-300 bg-primary-50/40" : "border-surface-300 hover:border-primary-400"
            )}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              {file ? <FileText className="h-6 w-6" aria-hidden /> : <FileUp className="h-6 w-6" aria-hidden />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-surface-900">{file ? file.name : "Choose a file or drop it here"}</span>
              <span className="block text-[13px] text-surface-600">
                {file ? `${(file.size / 1024).toFixed(0)} KB. Click to change.` : "PDF, DOCX or TXT"}
              </span>
            </span>
          </button>
          </div>
          <div className="flex flex-col">
            <label htmlFor="g-prompt" className={labelClass}>
              Your instructions <span className="font-normal text-surface-500">(optional)</span>
            </label>
            <textarea
              id="g-prompt"
              rows={5}
              maxLength={2000}
              value={customPrompt}
              disabled={running}
              placeholder={"Tell the AI what you want in the logbook, e.g.\nMention React, Node.js and MongoDB.\nDays 10 to 15: payment module with Razorpay.\nKeep it in simple English."}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className={cn(inputClass, "min-h-[132px] flex-1 resize-y leading-relaxed")}
            />
            <p className="mt-1 text-right font-mono text-xs text-surface-500">{customPrompt.length}/2000</p>
          </div>
          </div>
          )}
        </section>

        {/* 3. Dates */}
        <section className="rounded-3xl bg-white p-6 ring-1 ring-surface-200 sm:p-7" aria-labelledby="step-dates">
          <StepTitle n={3} id="step-dates">Project dates</StepTitle>
          <p className="mt-1 text-sm text-surface-600">
            {mode === "prd"
              ? "One entry is written for every day except Sundays, up to 76 days."
              : "Optional. Used for the cover page, and to date any day your notes don't give a date for."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="g-start" className={labelClass}>Start date</label>
              <input id="g-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="g-end" className={labelClass}>End date</label>
              <input id="g-end" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="g-in" className={labelClass}>Daily start</label>
              <input id="g-in" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="g-out" className={labelClass}>Daily end</label>
              <input id="g-out" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label htmlFor="g-dept" className={labelClass}>Department</label>
              <input id="g-dept" value={department} placeholder="e.g. Software Development" onChange={(e) => setDepartment(e.target.value)} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label htmlFor="g-desig" className={labelClass}>Designation</label>
              <input id="g-desig" value={designation} placeholder="e.g. Project Developer" onChange={(e) => setDesignation(e.target.value)} className={inputClass} />
            </div>
          </div>
        </section>

        {/* 3. Learner details */}
        <section className="rounded-3xl bg-white p-6 ring-1 ring-surface-200 sm:p-7" aria-labelledby="step-details">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className="flex w-full cursor-pointer items-start justify-between gap-4 text-left"
          >
            <span>
              <StepTitle n={4} id="step-details">More cover-page details</StepTitle>
              <span className="mt-1 block text-sm text-surface-600">Printed on the logbook&apos;s cover page. Optional.</span>
            </span>
            <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-surface-500 transition-transform", showDetails && "rotate-180")} aria-hidden />
          </button>
          {showDetails && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-in">
              {DETAIL_FIELDS.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`g-${f.key}`} className={labelClass}>{f.label}</label>
                  <input
                    id={`g-${f.key}`}
                    type={f.type || "text"}
                    value={details[f.key]}
                    placeholder={f.placeholder}
                    onChange={(e) => setDetails((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Generate */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={generate}
            disabled={running}
            className="flex h-12 cursor-pointer items-center gap-2 rounded-xl bg-primary-700 px-6 text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_oklch(0.43_0.095_236/0.6)] hover:bg-primary-800 disabled:cursor-wait disabled:opacity-70"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {running ? "Writing your logbook..." : days.length ? "Write it again" : "Write my logbook"}
          </button>
          {running && (
            <p className="text-sm text-surface-600" role="status">
              {status === "reading"
                ? "Reading your file..."
                : mode === "prd" && progress
                ? `Writing your project journey: ${progress.done} of ${progress.total} days done. ${elapsed}s`
                : `Sorting your notes. ${elapsed}s`}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 px-3.5 py-3 text-sm font-medium text-[oklch(0.45_0.16_25)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {/* Result */}
        {days.length > 0 && (
          <section ref={resultRef} className="scroll-mt-24 space-y-4 animate-fade-in" aria-labelledby="result-title">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-primary-950 p-6 text-white">
              <div>
                <h2 id="result-title" className="flex items-center gap-2 text-lg font-semibold">
                  <CheckCircle2 className="h-5 w-5 text-[oklch(0.8_0.12_155)]" aria-hidden />
                  {days.length} days written
                </h2>
                <p className="mt-1 text-sm text-primary-100/80">Read through and edit any day below, then download.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openPdf("preview")}
                  disabled={!!pdfBusy}
                  className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-inset ring-white/20 hover:bg-white/15 disabled:opacity-60"
                >
                  {pdfBusy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => openPdf("download")}
                  disabled={!!pdfBusy}
                  className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-primary-900 hover:bg-primary-50 disabled:opacity-60"
                >
                  {pdfBusy === "download" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
                  Download PDF
                </button>
              </div>
            </div>

            <ol className="space-y-2">
              {days.map((d, i) => (
                <li key={i}>
                  <details className="group rounded-2xl bg-white ring-1 ring-surface-200 open:ring-primary-300">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                      <span className="w-14 shrink-0 font-mono text-xs font-semibold text-primary-700">Day {i + 1}</span>
                      <span className="w-24 shrink-0 font-mono text-xs text-surface-500">{d.date}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-surface-800">{d.mySpace}</span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-surface-500 transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="grid gap-3 border-t border-surface-100 px-4 pb-4 pt-3">
                      {(
                        [
                          ["mySpace", "My space", 3],
                          ["tasks", "Tasks carried out today", 4],
                          ["learnings", "Key learnings / observations", 3],
                          ["tools", "Tools, equipment or techniques used", 1],
                          ["achievement", "Special achievements", 2],
                        ] as const
                      ).map(([field, label, rows]) => (
                        <div key={field}>
                          <label htmlFor={`d${i}-${field}`} className={labelClass}>{label}</label>
                          <textarea
                            id={`d${i}-${field}`}
                            rows={rows}
                            value={d[field]}
                            onChange={(e) => updateDay(i, field, e.target.value)}
                            className={cn(inputClass, "resize-y leading-relaxed")}
                          />
                        </div>
                      ))}
                    </div>
                  </details>
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={() => {
                if (window.confirm("Clear these days and start again?")) {
                  setDays([]);
                  setStatus("idle");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold text-surface-600 hover:bg-surface-100 hover:text-surface-900"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Start over
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function StepTitle({ n, id, children }: { n: number; id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-3 text-lg font-semibold tracking-tight text-surface-950">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-700 font-mono text-[13px] font-semibold text-white">{n}</span>
      {children}
    </h2>
  );
}
