"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
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
import { buildLogbookPdf, type ProfileData, type SingleDayData } from "@/lib/pdf-generator";
import type { ExtractedDayEntry } from "@/lib/types";
import { cn, ensureSpecialAchievements } from "@/lib/utils";

/**
 * Guest mode: generate a logbook from a PRD without an account. Nothing is
 * stored anywhere; everything lives in this page until it is closed.
 */

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
  { key: "learner_name", label: "Learner name", placeholder: "Your full name" },
  { key: "registration_number", label: "Registration no.", placeholder: "e.g. REG-2026-001" },
  { key: "program_name", label: "Program", placeholder: "e.g. B.Tech Computer Science" },
  { key: "semester", label: "Semester", placeholder: "e.g. 6th Semester" },
  { key: "location", label: "Location", placeholder: "e.g. Bengaluru" },
  { key: "industry_partner_name", label: "Industry partner", placeholder: "Company name" },
  { key: "phone_number", label: "Phone", placeholder: "e.g. +91 98765 43210", type: "tel" },
  { key: "email_id", label: "Email", placeholder: "you@example.com", type: "email" },
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

  const [status, setStatus] = useState<"idle" | "reading" | "writing" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [days, setDays] = useState<GuestDay[]>([]);
  const [pdfBusy, setPdfBusy] = useState<"download" | "preview" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);

  const running = status === "reading" || status === "writing";

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
  }

  async function generate() {
    if (!file) return setError("Upload your PRD or project description first.");
    if (!startDate || !endDate) return setError("Choose your internship start and end dates.");
    if (endDate < startDate) return setError("The end date is before the start date.");

    setError("");
    setElapsed(0);
    setStatus("reading");
    try {
      const prdText = await extractTextFromFile(file);
      if (!prdText.trim()) throw new Error("That file looks empty. Try a different file.");

      setStatus("writing");
      const res = await fetch("/api/generate-from-prd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prdText,
          startDate,
          endDate,
          startTime: to12h(startTime),
          endTime: to12h(endTime),
          department,
          designation,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) throw new Error(result.error || "Couldn't write the logbook. Please try again.");

      const generated: GuestDay[] = (result.days as ExtractedDayEntry[]).map((d) => {
        const tasks = join(d.tasksCarriedOutToday);
        return {
          date: d.date || "",
          mySpace: join(d.mySpace, " "),
          tasks,
          learnings: join(d.keyLearningObservations),
          tools: join(d.toolsTechnologyUsed, ", "),
          achievement: ensureSpecialAchievements(join(d.specialAchievements), tasks),
        };
      });
      if (generated.length === 0) throw new Error("No working days in that range. Try different dates.");
      setDays(generated);
      setStatus("done");
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  function updateDay(index: number, field: keyof GuestDay, value: string) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  }

  async function buildPdf(): Promise<Uint8Array> {
    const profile: ProfileData = {
      ...details,
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
          <div className="flex items-center gap-1 whitespace-nowrap sm:gap-2">
            <Link href="/login" className="flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-surface-700 hover:bg-surface-100 sm:px-4">
              Sign in
            </Link>
            <Link href="/signup" className="flex h-10 items-center rounded-xl bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800">
              Create account
            </Link>
          </div>
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 pb-24 pt-10 sm:px-6">
        <div className="animate-fade-in">
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-surface-950">Logbook from your PRD</h1>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-surface-600">
            Upload your project document, pick your internship dates, and get every working day written and printed onto
            the official logbook. No account needed.
          </p>
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-primary-50 px-3.5 py-3 text-sm text-primary-900 ring-1 ring-inset ring-primary-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden />
            <span>
              You&apos;re using guest mode, so nothing is saved. Download your PDF before closing this page.{" "}
              <Link href="/signup" className="font-semibold underline underline-offset-2 hover:text-primary-700">
                Create an account
              </Link>{" "}
              to keep your logbook, edit the PDF and add supervisor feedback.
            </span>
          </p>
        </div>

        {/* 1. PRD */}
        <section className="rounded-3xl bg-white p-6 ring-1 ring-surface-200 sm:p-7" aria-labelledby="step-prd">
          <StepTitle n={1} id="step-prd">Your PRD or project description</StepTitle>
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
              "mt-4 flex w-full cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-5 text-left transition-colors disabled:cursor-not-allowed",
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
        </section>

        {/* 2. Dates */}
        <section className="rounded-3xl bg-white p-6 ring-1 ring-surface-200 sm:p-7" aria-labelledby="step-dates">
          <StepTitle n={2} id="step-dates">Internship dates</StepTitle>
          <p className="mt-1 text-sm text-surface-600">One entry is written for every day except Sundays, up to 76 days.</p>
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
              <input id="g-desig" value={designation} placeholder="e.g. Software Development Intern" onChange={(e) => setDesignation(e.target.value)} className={inputClass} />
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
              <StepTitle n={3} id="step-details">Learner details</StepTitle>
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
              {status === "reading" ? "Reading your file..." : `Writing every working day. Usually under a minute. ${elapsed}s`}
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
