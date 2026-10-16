"use client";

export interface SingleDayData {
  dayNumber?: number;
  date: string;
  startTime: string;
  endTime: string;
  department: string;
  designation: string;
  mySpace: string;
  tasksCarriedOut: string;
  keyLearningObservations: string;
  toolsTechnologyUsed: string;
  specialAchievements: string;
  totalHours?: string;
}

export interface ProfileData {
  learner_name?: string;
  registration_number?: string;
  program_name?: string;
  semester?: string;
  location?: string;
  industry_partner_name?: string;
  ojt_start_date?: string;
  ojt_end_date?: string;
  department?: string;
  designation?: string;
  supervisor_name?: string;
  phone_number?: string;
  email_id?: string;
}

// The logbook is built in the browser: the filled PDF is ~8 MB, more than a
// Vercel function may return (4.5 MB). The template is cached after one load.
let templatePromise: Promise<ArrayBuffer> | null = null;

function loadTemplate(): Promise<ArrayBuffer> {
  if (!templatePromise) {
    templatePromise = fetch("/templates/OJT_Logbook.pdf")
      .then((res) => {
        if (!res.ok) throw new Error("Couldn't load the logbook template. Please try again.");
        return res.arrayBuffer();
      })
      .catch((err) => {
        templatePromise = null;
        throw err;
      });
  }
  return templatePromise;
}

/** The complete 90-page logbook with the profile and entries stamped in. */
export async function buildLogbookPdf(profile: ProfileData | undefined, entries: SingleDayData[]): Promise<Uint8Array> {
  const [{ stampLogbook }, template] = await Promise.all([import("./logbook-stamp"), loadTemplate()]);
  return stampLogbook(new Uint8Array(template), { mode: "complete", profile, entries });
}

function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  const url = window.URL.createObjectURL(pdfBlob(bytes));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ============================================================
// Generate official logbook PDF with entries stamped (all 90 pages preserved)
// ============================================================
export async function generateSingleDayPDF(data: SingleDayData, profile?: ProfileData) {
  downloadBytes(await buildLogbookPdf(profile, [data]), "OJT_Complete_Logbook.pdf");
}

// ============================================================
// Generate a complete 90-page logbook PDF with all entries stamped
// ============================================================
export async function generateCompleteLogbookPDF(
  profile: ProfileData,
  entries: SingleDayData[]
) {
  downloadBytes(await buildLogbookPdf(profile, entries), "OJT_Complete_Logbook.pdf");
}

// ============================================================
// Generate a preview Blob URL for iframe viewing (always full 90 pages)
// ============================================================
export async function generatePDFPreviewBlob(
  entry: SingleDayData,
  profile?: ProfileData,
  // Kept for callers; the preview is always the complete logbook.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mode: "single" | "complete" = "complete"
): Promise<string> {
  return window.URL.createObjectURL(pdfBlob(await buildLogbookPdf(profile, [entry])));
}

export async function generateCompleteLogbookPreviewBlob(
  profile: ProfileData,
  entries: SingleDayData[]
): Promise<string> {
  return window.URL.createObjectURL(pdfBlob(await buildLogbookPdf(profile, entries)));
}
