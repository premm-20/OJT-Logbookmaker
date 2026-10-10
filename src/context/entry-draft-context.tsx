"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Keeps logbook generation and the unsaved draft alive while the student
 * moves between dashboard sections. The provider lives in the dashboard
 * shell, which stays mounted across client-side navigation, so a request
 * started on the "Fill logbook" page keeps running (and its result is kept)
 * after the page itself unmounts.
 */

export type JobKind = "file" | "paste";
export type JobPhase = "reading" | "generating" | "success" | "error";

export interface GenerationJob {
  id: number;
  kind: JobKind;
  /** File name or a short description, shown in the status card. */
  label: string;
  phase: JobPhase;
  message: string;
  /** Raw result for the page to apply (shape depends on `kind`). */
  payload?: unknown;
  /** Number of days produced, for the status card. */
  dayCount?: number;
  /** Set once the Fill logbook page has loaded the result into its form. */
  applied: boolean;
}

export type JobOutcome =
  | { ok: true; payload: unknown; message: string; dayCount?: number }
  | { ok: false; error: string };

export type JobRunner = (report: (phase: "reading" | "generating", message: string) => void) => Promise<JobOutcome>;

interface EntryDraftContextValue {
  job: GenerationJob | null;
  isRunning: boolean;
  /** Starts a job unless one is already running. Returns false if busy. */
  startJob: (kind: JobKind, label: string, run: JobRunner) => boolean;
  markApplied: (jobId: number) => void;
  dismissJob: () => void;
  /** The Fill logbook page's unsaved form state (not reactive). */
  readDraft: () => Record<string, unknown> | null;
  writeDraft: (draft: Record<string, unknown>) => void;
  /** Changes when the draft is discarded, so the page can remount fresh. */
  draftVersion: number;
  /** Clears the draft. `remount: false` when leaving the page anyway (after saving). */
  discardDraft: (options?: { remount?: boolean }) => void;
}

const EntryDraftContext = createContext<EntryDraftContextValue | undefined>(undefined);

export function EntryDraftProvider({ children }: { children: React.ReactNode }) {
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const draftRef = useRef<Record<string, unknown> | null>(null);
  const nextId = useRef(1);
  const runningRef = useRef(false);

  const isRunning = job?.phase === "reading" || job?.phase === "generating";

  const startJob = useCallback((kind: JobKind, label: string, run: JobRunner) => {
    if (runningRef.current) return false;
    runningRef.current = true;
    const id = nextId.current++;
    setJob({ id, kind, label, phase: "reading", message: "Starting...", applied: false });

    const report = (phase: "reading" | "generating", message: string) =>
      setJob((prev) => (prev && prev.id === id ? { ...prev, phase, message } : prev));

    run(report)
      .then((outcome) => {
        setJob((prev) =>
          prev && prev.id === id
            ? outcome.ok
              ? { ...prev, phase: "success", message: outcome.message, payload: outcome.payload, dayCount: outcome.dayCount }
              : { ...prev, phase: "error", message: outcome.error }
            : prev
        );
      })
      .catch(() => {
        setJob((prev) =>
          prev && prev.id === id
            ? { ...prev, phase: "error", message: "Network error. Please check your connection and try again." }
            : prev
        );
      })
      .finally(() => {
        runningRef.current = false;
      });
    return true;
  }, []);

  const markApplied = useCallback((jobId: number) => {
    setJob((prev) => (prev && prev.id === jobId && !prev.applied ? { ...prev, applied: true } : prev));
  }, []);

  const dismissJob = useCallback(() => {
    setJob((prev) => (prev && (prev.phase === "reading" || prev.phase === "generating") ? prev : null));
  }, []);

  const readDraft = useCallback(() => draftRef.current, []);
  const writeDraft = useCallback((draft: Record<string, unknown>) => {
    draftRef.current = draft;
  }, []);

  const discardDraft = useCallback((options?: { remount?: boolean }) => {
    draftRef.current = null;
    setJob((prev) => (prev && (prev.phase === "reading" || prev.phase === "generating") ? prev : null));
    if (options?.remount !== false) setDraftVersion((v) => v + 1);
  }, []);

  // A full page reload would cancel a running request, so ask first.
  useEffect(() => {
    if (!isRunning) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isRunning]);

  const value = useMemo(
    () => ({ job, isRunning, startJob, markApplied, dismissJob, readDraft, writeDraft, draftVersion, discardDraft }),
    [job, isRunning, startJob, markApplied, dismissJob, readDraft, writeDraft, draftVersion, discardDraft]
  );

  return <EntryDraftContext.Provider value={value}>{children}</EntryDraftContext.Provider>;
}

export function useEntryDraft() {
  const context = useContext(EntryDraftContext);
  if (!context) throw new Error("useEntryDraft must be used within EntryDraftProvider");
  return context;
}
