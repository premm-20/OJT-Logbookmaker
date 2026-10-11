"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

/** Loads a PDF for on-screen rendering (thumbnails and the page preview). */
export async function loadPdfForRendering(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const pdfjsLib = await import("pdfjs-dist");
  // Same CDN worker as the file extractor, so nothing needs copying into /public.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  // pdf.js takes ownership of the buffer it is given, so pass a copy.
  return pdfjsLib.getDocument({ data: bytes.slice() }).promise;
}

/** Renders one page (1-based) to a JPEG data URL `width` CSS pixels wide. */
export async function renderPageToDataUrl(doc: PDFDocumentProxy, pageNumber: number, width: number): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: (width / base.width) * pixelRatio });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;
  // No page.cleanup() here: the preview and a thumbnail can render the same
  // page at once, and cleaning up mid-render stalls the other one.
  return canvas.toDataURL("image/jpeg", 0.82);
}

/**
 * Re-encodes any browser-readable image (PNG, JPEG, WebP, GIF...) through a
 * canvas into PNG or JPEG, which pdf-lib can embed. Large photos are scaled
 * down so the PDF doesn't balloon. Phone photos come out the right way up
 * because browsers apply EXIF orientation when decoding.
 */
export async function normalizeImageForPdf(
  file: File,
  maxSide = 2000
): Promise<{ bytes: Uint8Array; kind: "png" | "jpg"; width: number; height: number }> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("This image format can't be read. Use a PNG or JPG image.");
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process the image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Keep transparency for formats that may have it (signatures, logos).
  const keepAlpha = /png|webp|gif/i.test(file.type) || /\.(png|webp|gif)$/i.test(file.name);
  const kind = keepAlpha ? "png" : "jpg";
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't convert the image."))), keepAlpha ? "image/png" : "image/jpeg", 0.9)
  );
  return { bytes: new Uint8Array(await blob.arrayBuffer()), kind, width, height };
}
