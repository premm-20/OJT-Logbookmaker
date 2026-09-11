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

async function downloadPDFFromAPI(body: any, defaultFilename: string) {
  const response = await fetch("/api/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to generate PDF");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const contentDisposition = response.headers.get("content-disposition");
  let filename = defaultFilename;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) filename = match[1];
  }

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
  await downloadPDFFromAPI(
    {
      mode: "complete",
      entries: [data],
      profile,
    },
    "OJT_Complete_Logbook.pdf"
  );
}

// ============================================================
// Generate a complete 90-page logbook PDF with all entries stamped
// ============================================================
export async function generateCompleteLogbookPDF(
  profile: ProfileData,
  entries: SingleDayData[]
) {
  await downloadPDFFromAPI(
    {
      mode: "complete",
      profile,
      entries,
    },
    "OJT_Complete_Logbook.pdf"
  );
}

// ============================================================
// Generate a preview Blob URL for iframe viewing (always full 90 pages)
// ============================================================
export async function generatePDFPreviewBlob(
  entry: SingleDayData,
  profile?: ProfileData,
  mode: "single" | "complete" = "complete"
): Promise<string> {
  const response = await fetch("/api/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "complete",
      entry,
      entries: [entry],
      profile,
      preview: true,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate PDF preview");
  }

  const blob = await response.blob();
  return window.URL.createObjectURL(blob);
}

export async function generateCompleteLogbookPreviewBlob(
  profile: ProfileData,
  entries: SingleDayData[]
): Promise<string> {
  const response = await fetch("/api/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "complete",
      profile,
      entries,
      preview: true,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate complete logbook preview");
  }

  const blob = await response.blob();
  return window.URL.createObjectURL(blob);
}
