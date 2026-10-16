"use client";

import { useEffect, useState } from "react";
import type { RatingValue, SupervisorFeedback } from "@/lib/types";
import { RATING_CRITERIA, RATING_OPTIONS } from "@/lib/types";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

type FormData = {
  from_date: string;
  to_date: string;
  student_name: string;
  remarks: string;
  supervisor_name: string;
  designation: string;
  signature_date: string;
} & Record<(typeof RATING_CRITERIA)[number]["key"], RatingValue>;

const EMPTY_FORM = {
  from_date: "",
  to_date: "",
  student_name: "",
  remarks: "",
  supervisor_name: "",
  designation: "",
  signature_date: "",
  ...Object.fromEntries(RATING_CRITERIA.map((c) => [c.key, ""])),
} as FormData;

const RATING_POINTS: Record<string, number> = { good: 3, acceptable: 2, needs_improvement: 1 };

function fromSaved(saved: SupervisorFeedback): FormData {
  const form = { ...EMPTY_FORM };
  for (const key of Object.keys(EMPTY_FORM) as (keyof FormData)[]) {
    const value = saved[key as keyof SupervisorFeedback];
    if (typeof value === "string") (form as Record<string, string>)[key] = value;
  }
  return form;
}

export default function FeedbackPage() {
  const [form, setForm] = useState<FormData | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/feedback", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const { feedback } = (await res.json()) as { feedback: (SupervisorFeedback & { updated_at?: string }) | null };
        if (cancelled) return;
        setForm(feedback ? fromSaved(feedback) : EMPTY_FORM);
        setSavedAt(feedback ? feedback.updated_at || feedback.created_at : null);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Couldn't load your saved feedback. You can still fill the form.");
        setForm(EMPTY_FORM);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16 animate-fade-in">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-surface-950">Supervisor feedback</h1>
        <p className="mt-1 text-sm text-surface-600">
          {savedAt
            ? `Last saved ${new Date(savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. Saving again replaces it.`
            : "Your supervisor's assessment. Saving again replaces the previous one."}
        </p>
      </div>

      {loadError && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger/10 px-3.5 py-3 text-sm font-medium text-[oklch(0.45_0.16_25)]">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {loadError}
        </p>
      )}

      {form ? (
        <FeedbackForm initial={form} onSaved={(at) => setSavedAt(at)} />
      ) : (
        <div className="flex justify-center py-16" role="status" aria-label="Loading">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" aria-hidden />
        </div>
      )}
    </div>
  );
}

function FeedbackForm({ initial, onSaved }: { initial: FormData; onSaved: (savedAt: string) => void }) {
  const [form, setForm] = useState<FormData>(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setStatus(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    const total = RATING_CRITERIA.reduce((sum, c) => sum + (RATING_POINTS[form[c.key]] || 0), 0);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, total_score: total }),
      });
      if (!res.ok) throw new Error();
      setStatus({ tone: "success", text: "Feedback saved." });
      onSaved(new Date().toISOString());
    } catch {
      setStatus({ tone: "error", text: "Couldn't save the feedback. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-surface-300 bg-white px-3 py-2.5 text-sm text-surface-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";
  const labelClass = "mb-1.5 block text-[13px] font-medium text-surface-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl bg-white p-6 ring-1 ring-surface-200 sm:p-7">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="fb-from" className={labelClass}>From date</label>
          <input id="fb-from" type="date" required value={form.from_date} onChange={(e) => update("from_date", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="fb-to" className={labelClass}>To date</label>
          <input id="fb-to" type="date" required value={form.to_date} onChange={(e) => update("to_date", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="fb-student" className={labelClass}>Student name</label>
          <input id="fb-student" type="text" required value={form.student_name} onChange={(e) => update("student_name", e.target.value)} className={inputClass} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold text-surface-900">Performance ratings</legend>
        {RATING_CRITERIA.map((criteria) => (
          <div key={criteria.key} className="flex flex-col gap-2 rounded-xl bg-surface-50 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-surface-800">{criteria.label}</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={criteria.label}>
              {RATING_OPTIONS.map((opt) => {
                const checked = form[criteria.key] === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition-colors",
                      checked ? "bg-primary-700 text-white ring-primary-700" : "bg-white text-surface-700 ring-surface-300 hover:bg-surface-100"
                    )}
                  >
                    <input
                      type="radio"
                      name={criteria.key}
                      value={opt.value}
                      checked={checked}
                      onChange={() => update(criteria.key, opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </fieldset>

      <div>
        <label htmlFor="fb-remarks" className={labelClass}>Supervisor&apos;s remarks</label>
        <textarea id="fb-remarks" rows={3} value={form.remarks} onChange={(e) => update("remarks", e.target.value)} className={cn(inputClass, "resize-y")} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="fb-supervisor" className={labelClass}>Supervisor&apos;s name</label>
          <input id="fb-supervisor" type="text" value={form.supervisor_name} onChange={(e) => update("supervisor_name", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="fb-designation" className={labelClass}>Designation</label>
          <input id="fb-designation" type="text" value={form.designation} onChange={(e) => update("designation", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="fb-date" className={labelClass}>Date</label>
          <input id="fb-date" type="date" value={form.signature_date} onChange={(e) => update("signature_date", e.target.value)} className={inputClass} />
        </div>
      </div>

      {status && (
        <p
          role={status.tone === "error" ? "alert" : "status"}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3.5 py-3 text-sm font-medium",
            status.tone === "error" ? "bg-danger/10 text-[oklch(0.45_0.16_25)]" : "bg-success/10 text-[oklch(0.42_0.11_155)]"
          )}
        >
          {status.tone === "error" ? <AlertCircle className="h-4 w-4 shrink-0" aria-hidden /> : <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />}
          {status.text}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-primary-700 px-5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
        {saving ? "Saving..." : "Save feedback"}
      </button>
    </form>
  );
}
