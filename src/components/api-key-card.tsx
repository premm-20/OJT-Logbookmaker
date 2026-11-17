"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  aiKeyHeaders,
  guessProvider,
  loadAiKey,
  maskKey,
  onAiKeyChange,
  saveAiKey,
  type AiProvider,
  type StoredAiKey,
} from "@/lib/user-ai-key";

const PROVIDERS: { id: AiProvider; label: string; getUrl: string; hint: string }[] = [
  { id: "gemini", label: "Google Gemini", getUrl: "https://aistudio.google.com/app/apikey", hint: "Free key from Google AI Studio, starts with AIza" },
  { id: "openrouter", label: "OpenRouter", getUrl: "https://openrouter.ai/settings/keys", hint: "Free models only, starts with sk-or-" },
];

/** Live copy of the saved key, updated whenever it changes in any tab. */
export function useAiKey(): StoredAiKey | null {
  const [value, setValue] = useState<StoredAiKey | null>(null);
  useEffect(() => {
    const sync = () => setValue(loadAiKey());
    sync();
    return onAiKeyChange(sync);
  }, []);
  return value;
}

/** Paste, test and save the user's own AI key. */
export default function ApiKeyCard({ className, id }: { className?: string; id?: string }) {
  const saved = useAiKey();
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<{ kind: "idle" | "testing" | "ok" | "error"; message?: string }>({ kind: "idle" });

  const showForm = !saved || editing;
  const current = PROVIDERS.find((p) => p.id === provider)!;

  async function save() {
    const key = draft.trim();
    if (key.length < 10 || /\s/.test(key)) return setState({ kind: "error", message: "That doesn't look like an API key." });
    const value = { provider, key };
    setState({ kind: "testing" });
    try {
      const res = await fetch("/api/ai-key/test", { method: "POST", headers: aiKeyHeaders(value) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return setState({ kind: "error", message: data.error || "The key didn't work." });
    } catch {
      return setState({ kind: "error", message: "Couldn't check the key. Check your connection." });
    }
    saveAiKey(value);
    setDraft("");
    setEditing(false);
    setState({ kind: "ok", message: "Key works and is saved in this browser." });
  }

  return (
    <section id={id} className={cn("scroll-mt-24 rounded-3xl bg-white p-6 ring-1 ring-surface-200 sm:p-7", className)} aria-labelledby="api-key-title">
      <h2 id="api-key-title" className="flex items-center gap-3 text-lg font-semibold tracking-tight text-surface-950">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-700 text-white">
          <KeyRound className="h-3.5 w-3.5" aria-hidden />
        </span>
        AI API key <span className="text-sm font-normal text-surface-500">(optional)</span>
      </h2>
      <p className="mt-1 text-sm text-surface-600">
        Optional. The site&apos;s own key is used by default. When its limit is reached, paste a new key here and it is used instead. It stays in this browser and is never saved on the server.
      </p>

      {!showForm && saved && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-primary-50 px-4 py-3 ring-1 ring-inset ring-primary-200">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[oklch(0.55_0.13_155)]" aria-hidden />
          <span className="min-w-0 flex-1 text-sm text-primary-900">
            <span className="font-semibold">{PROVIDERS.find((p) => p.id === saved.provider)?.label}</span>{" "}
            <span className="font-mono">{maskKey(saved.key)}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setProvider(saved.provider);
              setEditing(true);
              setState({ kind: "idle" });
            }}
            className="h-9 cursor-pointer rounded-xl px-3 text-sm font-semibold text-primary-800 hover:bg-primary-100"
          >
            Change
          </button>
          <button
            type="button"
            onClick={() => {
              saveAiKey(null);
              setState({ kind: "idle" });
            }}
            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-surface-600 hover:bg-white"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Remove
          </button>
        </div>
      )}

      {showForm && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="AI provider">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={provider === p.id}
                onClick={() => setProvider(p.id)}
                className={cn(
                  "h-9 cursor-pointer rounded-xl px-3.5 text-sm font-semibold ring-1 ring-inset",
                  provider === p.id ? "bg-primary-700 text-white ring-primary-700" : "bg-white text-surface-700 ring-surface-300 hover:bg-surface-50"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="ai-key-input" className="sr-only">API key</label>
            <input
              id="ai-key-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              placeholder="Paste your API key here"
              onChange={(e) => {
                const v = e.target.value;
                setDraft(v);
                if (v.trim().length > 6) setProvider(guessProvider(v));
                setState({ kind: "idle" });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
              }}
              className="min-w-0 flex-1 rounded-xl border border-surface-300 bg-white px-3 py-2.5 font-mono text-sm text-surface-900 placeholder:font-sans placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <button
              type="button"
              onClick={save}
              disabled={state.kind === "testing" || !draft.trim()}
              className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-700 px-5 text-sm font-semibold text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state.kind === "testing" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {state.kind === "testing" ? "Checking..." : "Save key"}
            </button>
            {saved && (
              <button type="button" onClick={() => setEditing(false)} className="h-11 cursor-pointer rounded-xl px-3 text-sm font-semibold text-surface-600 hover:bg-surface-100">
                Cancel
              </button>
            )}
          </div>
          <p className="text-[13px] text-surface-500">
            {current.hint}.{" "}
            <a href={current.getUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-900">
              Get a {current.label} key
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </p>
        </div>
      )}

      {state.message && (
        <p
          role={state.kind === "error" ? "alert" : "status"}
          className={cn("mt-3 text-[13px] font-medium", state.kind === "error" ? "text-[oklch(0.45_0.16_25)]" : "text-[oklch(0.45_0.12_155)]")}
        >
          {state.message}
        </p>
      )}
    </section>
  );
}
