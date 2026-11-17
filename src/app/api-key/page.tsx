"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import BrandMark from "@/components/brand-mark";
import ApiKeyCard, { useAiKey } from "@/components/api-key-card";

/** Direct page for pasting the user's own AI key. */
export default function ApiKeyPage() {
  const saved = useAiKey();
  return (
    <div className="min-h-[100dvh] bg-surface-50">
      <header className="sticky top-0 z-30 border-b border-surface-200/70 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="rounded-xl" aria-label="OJT Logbook home">
            <BrandMark className="max-[400px]:[&>span:last-child]:hidden" />
          </Link>
          <Link href="/" className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-surface-700 hover:bg-surface-100">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Logbook
          </Link>
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 pb-24 pt-10 sm:px-6">
        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-surface-950">API key</h1>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-surface-600">
            The site uses its own key by default. When that key hits its limit, paste a new Google Gemini or OpenRouter key here and it takes over.
          </p>
        </div>
        <ApiKeyCard />
        {saved && (
          <Link
            href="/"
            className="group inline-flex h-12 items-center gap-2 rounded-xl bg-primary-700 px-6 text-[15px] font-semibold text-white hover:bg-primary-800"
          >
            Make my logbook
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        )}
      </main>
    </div>
  );
}
