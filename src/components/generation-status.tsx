"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, X } from "lucide-react";
import { useEntryDraft } from "@/context/entry-draft-context";
import { cn } from "@/lib/utils";

const FILL_PAGE = "/dashboard/new-entry";

/**
 * Floating card shown on other dashboard sections while logbook entries are
 * being generated, and once they're ready to review.
 */
export default function GenerationStatus() {
  const pathname = usePathname();
  const { job, isRunning } = useEntryDraft();
  // Hiding the card never discards results; they stay on the Fill logbook page.
  const [hiddenJobId, setHiddenJobId] = useState<number | null>(null);

  if (!job || pathname === FILL_PAGE) return null;
  if (!isRunning && (job.applied || hiddenJobId === job.id)) return null;

  const ready = job.phase === "success";
  const failed = job.phase === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-in fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-4 shadow-[0_18px_50px_-12px_oklch(0.3_0.058_236/0.35)] ring-1 ring-surface-200 sm:bottom-6 sm:right-6"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            failed ? "bg-danger/10 text-danger" : ready ? "bg-success/10 text-success" : "bg-primary-50 text-primary-700"
          )}
        >
          {failed ? (
            <AlertTriangle className="h-[18px] w-[18px]" aria-hidden />
          ) : ready ? (
            <CheckCircle2 className="h-[18px] w-[18px]" aria-hidden />
          ) : (
            <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-surface-950">
            {failed
              ? "Generation didn't finish"
              : ready
                ? `${job.dayCount ?? "Your"} ${job.dayCount === 1 ? "day is" : "days are"} ready to review`
                : "Writing your logbook entries"}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-surface-600" title={job.label}>
            {isRunning ? `${job.label}. You can keep working meanwhile.` : job.message}
          </p>
          <Link
            href={FILL_PAGE}
            className="mt-2 inline-flex items-center gap-1 rounded-lg text-[13px] font-semibold text-primary-700 hover:text-primary-900"
          >
            {failed ? "Open Fill logbook" : ready ? "Review entries" : "View progress"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {!isRunning && (
          <button
            type="button"
            onClick={() => setHiddenJobId(job.id)}
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100 hover:text-surface-800"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
