"use client";

import { PRD_MAX_FILE_BYTES } from "@/lib/prd-limits";

// The uploaded PRD is kept in sessionStorage: it survives navigation and
// reloads, and the browser clears it when the tab is closed.
const CACHE_KEY = "ojt_prd_cache";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Keeps the PRD for this tab. Files too big for sessionStorage are skipped. */
export async function cachePrd(file: File | null): Promise<void> {
  try {
    if (!file) {
      sessionStorage.removeItem(CACHE_KEY);
      return;
    }
    const dataUrl = await readAsDataUrl(file);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ name: file.name, type: file.type, dataUrl }));
  } catch {
    // Quota exceeded or storage blocked: the file just won't survive a reload.
  }
}

/** The PRD cached for this tab, or null. */
export async function restoreCachedPrd(): Promise<File | null> {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { name, type, dataUrl } = JSON.parse(raw) as { name: string; type: string; dataUrl: string };
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], name, { type: type || blob.type });
  } catch {
    return null;
  }
}

/**
 * Stores a copy of the PRD (file and extracted text) in the database: for the
 * signed-in student, or for the guest profile with `guestEmail`. Never throws
 * and never blocks generation.
 */
export async function savePrdCopy(file: File, text: string, guestEmail?: string): Promise<void> {
  try {
    const form = new FormData();
    form.set("text", text);
    form.set("fileName", file.name);
    if (guestEmail) form.set("guestEmail", guestEmail);
    // Vercel accepts at most 4.5 MB per request; bigger files keep the text only.
    if (file.size <= PRD_MAX_FILE_BYTES) form.set("file", file);
    await fetch("/api/prd", { method: "POST", body: form });
  } catch {
    // A missing copy must never get in the student's way.
  }
}
