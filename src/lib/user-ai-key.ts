"use client";

/**
 * The user's own AI key. It stays in this browser (localStorage) and is sent
 * with each AI request in a header; the server never stores it.
 */
export type AiProvider = "gemini" | "openrouter";
export interface StoredAiKey {
  provider: AiProvider;
  key: string;
}

const STORAGE_KEY = "ojt_user_ai_key";
const EVENT = "ojt-ai-key-change";

export function guessProvider(key: string): AiProvider {
  return key.trim().startsWith("sk-or-") ? "openrouter" : "gemini";
}

export function loadAiKey(): StoredAiKey | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as StoredAiKey | null;
    return saved && typeof saved.key === "string" && saved.key.trim() ? saved : null;
  } catch {
    return null;
  }
}

export function saveAiKey(value: StoredAiKey | null): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the key lasts until the page is closed.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function onAiKeyChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

/** Headers that carry the key to our API routes. */
export function aiKeyHeaders(value: StoredAiKey | null): Record<string, string> {
  return value ? { "x-user-ai-key": value.key.trim(), "x-user-ai-provider": value.provider } : {};
}

export function maskKey(key: string): string {
  const k = key.trim();
  return k.length <= 10 ? "••••" : `${k.slice(0, 4)}••••${k.slice(-4)}`;
}
