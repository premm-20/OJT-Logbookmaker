"use client";

import { EDITED_PDF_CHUNK_BYTES, EDITED_PDF_MAX_CHUNKS } from "@/lib/edited-pdf-limits";

export interface EditedPdfInfo {
  fileName: string;
  sizeBytes: number;
  pageCount: number;
  chunkCount: number;
  updatedAt: string;
}

/** The student's saved edited PDF, or null if they haven't saved one. */
export async function getEditedPdfInfo(): Promise<EditedPdfInfo | null> {
  const res = await fetch("/api/edited-pdf", { cache: "no-store" });
  if (!res.ok) throw new Error("Couldn't check your saved PDF.");
  return (await res.json()).pdf ?? null;
}

/** Saves the PDF to the student's account, replacing the previous one. */
export async function saveEditedPdf(bytes: Uint8Array, fileName: string, pageCount: number): Promise<void> {
  const parts = Math.max(1, Math.ceil(bytes.length / EDITED_PDF_CHUNK_BYTES));
  if (parts > EDITED_PDF_MAX_CHUNKS) {
    throw new Error(`This PDF is too large to save (limit ${(EDITED_PDF_CHUNK_BYTES * EDITED_PDF_MAX_CHUNKS) / 1048576} MB).`);
  }
  const upload = crypto.randomUUID();

  // Two chunks in flight keeps it quick without flooding a slow connection.
  let next = 0;
  async function worker() {
    while (next < parts) {
      const part = next++;
      const chunk = bytes.subarray(part * EDITED_PDF_CHUNK_BYTES, (part + 1) * EDITED_PDF_CHUNK_BYTES);
      const res = await fetch(`/api/edited-pdf?upload=${upload}&part=${part}`, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: chunk as BlobPart,
      });
      if (!res.ok) throw new Error("Couldn't save your PDF. Please try again.");
    }
  }
  await Promise.all([worker(), worker()]);

  const res = await fetch("/api/edited-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upload, parts, fileName, sizeBytes: bytes.length, pageCount }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Couldn't save your PDF. Please try again.");
  }
}

/** Downloads the saved edited PDF from the student's account. */
export async function loadEditedPdf(info: EditedPdfInfo): Promise<Uint8Array> {
  const chunks = await Promise.all(
    Array.from({ length: info.chunkCount }, async (_, part) => {
      const res = await fetch(`/api/edited-pdf?part=${part}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Couldn't open your saved PDF. Please try again.");
      return new Uint8Array(await res.arrayBuffer());
    })
  );
  const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  if (bytes.length !== info.sizeBytes) throw new Error("Your saved PDF changed while loading. Please try again.");
  return bytes;
}
