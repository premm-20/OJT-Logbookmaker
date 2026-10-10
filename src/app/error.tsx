"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app]", error);
  }, [error]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-surface-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center ring-1 ring-surface-200">
        <h1 className="text-xl font-semibold tracking-tight text-surface-950">Something went wrong loading this page</h1>
        <p className="mt-2 text-sm leading-relaxed text-surface-600">
          The server hit a problem. Try again in a moment. If it keeps
          happening, let your coordinator know.
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs text-surface-500">Reference: {error.digest}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-primary-700 px-5 text-sm font-semibold text-white hover:bg-primary-800"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Try again
          </button>
          <Link href="/" className="flex h-11 items-center rounded-xl px-4 text-sm font-semibold text-primary-700 hover:bg-primary-50">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
