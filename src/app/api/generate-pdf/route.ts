import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatDateDDMMYYYY } from "@/lib/utils";

interface SingleDayEntry {
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
}

interface ProfileData {
  learner_name?: string;
  registration_number?: string;
  program_name?: string;
  semester?: string;
  location?: string;
  industry_partner_name?: string;
  ojt_start_date?: string;
  phone_number?: string;
  email_id?: string;
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? currentLine + " " + word : word;
    const width = font.widthOfTextAtSize(testLine, size);
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawParagraph(
  page: any,
  text: string,
  font: any,
  defaultSize: number,
  x: number,
  startY: number,
  maxWidth: number,
  defaultLineHeight: number,
  maxHeight: number
) {
  if (!text) return;
  const rawLines = text.split("\n");

  let size = defaultSize;
  let lineHeight = defaultLineHeight;
  let allLines: string[] = [];

  // Auto-shrink font size if text exceeds maxHeight so all user content fits
  while (size >= 7.5) {
    allLines = [];
    for (const rawLine of rawLines) {
      const wrapped = wrapText(rawLine, font, size, maxWidth);
      allLines.push(...wrapped);
    }
    const totalH = allLines.length * lineHeight;
    if (totalH <= maxHeight || size <= 7.5) {
      break;
    }
    size = +(size - 0.5).toFixed(1);
    lineHeight = +(size * (defaultLineHeight / defaultSize)).toFixed(1);
  }

  let currentY = startY;
  for (const line of allLines) {
    if (startY - currentY + lineHeight > maxHeight) break;
    page.drawText(line, {
      x,
      y: currentY,
      size,
      font,
      color: rgb(0.12, 0.15, 0.2),
    });
    currentY -= lineHeight;
  }
}

function formatTimeAMPM(timeStr: string): string {
  if (!timeStr) return "";
  const cleaned = timeStr.trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return timeStr;

  let hours = parseInt(match[1], 10);
  const minutes = match[2].padStart(2, "0");
  const period = match[3]?.toUpperCase();

  if (period) {
    return `${String(hours).padStart(2, "0")}:${minutes} ${period}`;
  }

  const derivedPeriod = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${String(displayHours).padStart(2, "0")}:${minutes} ${derivedPeriod}`;
}

function getTemplatePath(): string {
  const primaryPath = path.join(process.cwd(), "public", "templates", "OJT_Logbook.pdf");
  if (fs.existsSync(primaryPath)) return primaryPath;
  const fallbackPath = path.join(process.cwd(), "..", "OJT Logbook.pdf");
  if (fs.existsSync(fallbackPath)) return fallbackPath;
  return primaryPath;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode: "single" | "complete" = body.mode || "single";
    const entries: SingleDayEntry[] = body.entries || (body.entry ? [body.entry] : []);
    const profile: ProfileData | undefined = body.profile;

    if (entries.length === 0 && !profile) {
      return NextResponse.json({ error: "No entry or profile data provided" }, { status: 400 });
    }

    const templatePath = getTemplatePath();
    const templateBytes = fs.readFileSync(templatePath);
    const srcDoc = await PDFDocument.load(templateBytes);
    const font = await srcDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await srcDoc.embedFont(StandardFonts.HelveticaBold);

    // Track which pages to include in the output PDF
    const pagesToExport: number[] = [];

    // Stamp Profile on Page 3 (index 2) if profile data provided
    if (profile && (profile.learner_name || profile.registration_number || mode === "complete")) {
      const page3 = srcDoc.getPage(2);
      const { height } = page3.getSize();

      if (profile.learner_name) {
        const nameSize = profile.learner_name.length > 28 ? 10 : 11.5;
        page3.drawText(profile.learner_name, { x: 175, y: height - 553, size: nameSize, font: fontBold, color: rgb(0.05, 0.05, 0.15) });
      }
      if (profile.registration_number) {
        page3.drawText(profile.registration_number, { x: 175, y: height - 583, size: 11, font: fontBold, color: rgb(0.05, 0.05, 0.15) });
      }
      if (profile.ojt_start_date) {
        const dateStr = formatDateDDMMYYYY(profile.ojt_start_date) || profile.ojt_start_date;
        const dateSize = dateStr.length > 13 ? 9.5 : 10.5;
        page3.drawText(dateStr, { x: 375, y: height - 583, size: dateSize, font: fontBold, color: rgb(0.05, 0.05, 0.15) });
      }
      if (profile.program_name) {
        const progSize = profile.program_name.length > 34 ? 9.5 : 11;
        page3.drawText(profile.program_name, { x: 175, y: height - 613, size: progSize, font: fontBold, color: rgb(0.05, 0.05, 0.15) });
      }
      if (profile.semester) {
        page3.drawText(profile.semester, { x: 140, y: height - 643, size: 11, font: fontBold, color: rgb(0.05, 0.05, 0.15) });
      }
      if (profile.location) {
        const locSize = profile.location.length > 32 ? 9 : profile.location.length > 22 ? 10 : 11;
        page3.drawText(profile.location, { x: 247, y: height - 643, size: locSize, font: fontBold, color: rgb(0.05, 0.05, 0.15) });
      }
      if (profile.industry_partner_name) {
        const indSize = profile.industry_partner_name.length > 30 ? 9.5 : 11;
        page3.drawText(profile.industry_partner_name, { x: 202, y: height - 673, size: indSize, font: fontBold, color: rgb(0.05, 0.05, 0.15) });
      }
      if (profile.phone_number) {
        page3.drawText(profile.phone_number, { x: 140, y: height - 755, size: 11.5, font: fontBold, color: rgb(0.05, 0.05, 0.15) });
      }
      if (profile.email_id) {
        const mailSize = profile.email_id.length > 25 ? 10 : 11.5;
        page3.drawText(profile.email_id, { x: 325, y: height - 755, size: mailSize, font: fontBold, color: rgb(0.05, 0.05, 0.15) });
      }

      if (mode === "complete") {
        pagesToExport.push(2);
      }
    }

    // Stamp each entry onto its corresponding Day page
    for (const entry of entries) {
      // Day 1 starts on page index 7 (Page 8 in document)
      let dayNum = entry.dayNumber || 1;
      if (dayNum < 1) dayNum = 1;
      if (dayNum > 76) dayNum = 76;

      const pageIndex = 7 + (dayNum - 1);
      if (pageIndex >= srcDoc.getPageCount()) continue;

      const page = srcDoc.getPage(pageIndex);
      const { height } = page.getSize();

      // Top metadata (Bold 11.5pt, clearly elevated above dashed lines, AM/PM formatted)
      // Top metadata (Bold 10.5pt, resting cleanly above dashed lines, AM/PM formatted)
      const yTop = height - 95;
      const yDept = height - 121;

      if (entry.date) {
        const displayDate = formatDateDDMMYYYY(entry.date);
        page.drawText(displayDate, { x: 86, y: yTop, size: 10.5, font: fontBold, color: rgb(0.05, 0.05, 0.15) });
      }
      if (entry.startTime) {
        const formattedStart = formatTimeAMPM(entry.startTime);
        page.drawText(formattedStart, { x: 372, y: yTop, size: 10.5, font: fontBold, color: rgb(0.05, 0.05, 0.15) });
      }
      if (entry.endTime) {
        const formattedEnd = formatTimeAMPM(entry.endTime);
        page.drawText(formattedEnd, { x: 474, y: yTop, size: 10.5, font: fontBold, color: rgb(0.05, 0.05, 0.15) });
      }
      if (entry.department) {
        page.drawText(entry.department, { x: 128, y: yDept, size: 10, font: fontBold, color: rgb(0.05, 0.05, 0.15) });
      }
      if (entry.designation) {
        page.drawText(entry.designation, { x: 382, y: yDept, size: 10, font: fontBold, color: rgb(0.05, 0.05, 0.15) });
      }

      // Box 1: My Space (Clean readable 10.5pt, line-height 14.5, fits comfortably inside vector bounds)
      drawParagraph(page, entry.mySpace, font, 10.5, 52, height - 186, 485, 14.5, 142);

      // Box 2: Tasks Carried Out Today
      drawParagraph(page, entry.tasksCarriedOut, font, 10.5, 52, height - 378, 485, 14.5, 108);

      // Box 3: Key Learnings / Observations
      drawParagraph(page, entry.keyLearningObservations, font, 10.5, 52, height - 534, 485, 14.5, 60);

      // Box 4: Tools, Equipment, Technology or Techniques Used
      drawParagraph(page, entry.toolsTechnologyUsed, font, 10.5, 52, height - 662, 255, 14.5, 115);

      // Box 5: Special Achievements
      drawParagraph(page, entry.specialAchievements, font, 10.5, 323, height - 662, 218, 14.5, 115);

      if (!pagesToExport.includes(pageIndex)) {
        pagesToExport.push(pageIndex);
      }
    }

    // Always return the COMPLETE 90-page original logbook with filled text stamped on respective pages
    // All other pages (cover, guidelines, other days, feedback) are kept as original empty pages
    const pdfBytes = await srcDoc.save();

    const isPreview = body.preview === true;
    const filename = "OJT_Complete_Logbook.pdf";

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${isPreview ? "inline" : "attachment"}; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate PDF" }, { status: 500 });
  }
}
