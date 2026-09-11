/**
 * Client-side file text extraction.
 * Runs entirely in the browser — no server-side Node.js modules needed.
 *
 *  .txt  → FileReader.readAsText()
 *  .pdf  → pdfjs-dist (pure JS, works in browser)
 *  .docx → mammoth browser bundle (pure JS, works in browser)
 */

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt")) {
    return await readAsText(file);
  }

  if (name.endsWith(".pdf")) {
    return await extractPdfText(file);
  }

  if (name.endsWith(".docx")) {
    return await extractDocxText(file);
  }

  throw new Error(
    `Unsupported file type "${file.name}". Please upload a PDF, DOCX, or TXT file.`
  );
}

// ─── TXT ──────────────────────────────────────────────────────
function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read text file."));
    reader.readAsText(file);
  });
}

// ─── PDF (pdfjs-dist) ─────────────────────────────────────────
async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  // Lazy-load pdfjs-dist only when needed
  const pdfjsLib = await import("pdfjs-dist");

  // Point to the CDN worker so we don't need to copy it to /public
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const parts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    parts.push(pageText);
  }

  const text = parts.join("\n").trim();
  if (!text) throw new Error("Could not extract text from PDF. The file may be scanned/image-only.");
  return text;
}

// ─── DOCX (mammoth browser bundle) ───────────────────────────
async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  // mammoth ships a browser-compatible build
  // @ts-expect-error mammoth browser bundle lacks TS declaration file
  const mammoth = await import("mammoth/mammoth.browser.min.js");
  const extractRawText = mammoth.extractRawText || mammoth.default?.extractRawText;
  if (!extractRawText) throw new Error("Could not initialize DOCX reader.");
  const result = await extractRawText({ arrayBuffer });

  const text = result.value?.trim();
  if (!text) throw new Error("Could not extract text from DOCX file.");
  return text;
}
