import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string to "DD Month YYYY" format.
 * e.g., "2026-09-09" → "09 September 2026"
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format a date string to "DD-MM-YYYY" format.
 * e.g., "2026-09-03" → "03-09-2026"
 */
export function formatDateDDMMYYYY(dateStr: string): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  // Already in DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  // Convert DD/MM/YYYY to DD-MM-YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed.replace(/\//g, "-");
  }
  // Convert YYYY-MM-DD or YYYY/MM/DD
  const match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, "0");
    const d = match[3].padStart(2, "0");
    return `${d}-${m}-${y}`;
  }
  try {
    let parsed = new Date(trimmed);
    if (isNaN(parsed.getTime()) && !trimmed.includes("T")) {
      parsed = new Date(trimmed + "T00:00:00");
    }
    if (!isNaN(parsed.getTime())) {
      const d = String(parsed.getDate()).padStart(2, "0");
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const y = parsed.getFullYear();
      return `${d}-${m}-${y}`;
    }
  } catch {}
  return dateStr;
}

/**
 * Format a date string to HTML5 date input format "YYYY-MM-DD".
 * e.g., "03-09-2026" → "2026-09-03", "2026-09-03" → "2026-09-03"
 */
export function formatDateYYYYMMDD(dateStr: string): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch {}
  return "";
}

/**
 * Format time string to 12-hour format with AM/PM.
 * e.g., "09:00" → "09:00 AM", "17:00" → "05:00 PM", "9:00 AM" → "09:00 AM"
 */
export function formatTime(timeStr: string): string {
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

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) {
    const [h, m] = cleaned.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

/**
 * Calculate the total hours between two time strings (supports AM/PM and 24-hour).
 */
export function calculateHours(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return "0.0";
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const diff = endMinutes - startMinutes;
  if (diff <= 0) return "0.0";
  return (diff / 60).toFixed(1);
}

/**
 * Get today's date in YYYY-MM-DD format.
 */
export function getTodayDate(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

/**
 * Generate a short month-year label.
 * e.g., "September 2026"
 */
export function getMonthYear(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Ensures special achievements text is never empty.
 * If empty, derives a realistic accomplishment from the day's tasks or defaults to a professional milestone.
 */
export function ensureSpecialAchievements(
  val: unknown,
  tasks?: unknown
): string {
  let str = "";
  if (Array.isArray(val)) {
    str = val.filter(Boolean).map(String).join("\n").trim();
  } else if (typeof val === "string") {
    str = val.trim();
  }
  if (str) return str;

  // Fallback: derive from tasks
  let taskList: string[] = [];
  if (Array.isArray(tasks)) {
    taskList = tasks.map(String).map((s) => s.trim()).filter(Boolean);
  } else if (typeof tasks === "string") {
    taskList = tasks.split("\n").map((s) => s.trim()).filter(Boolean);
  }

  if (taskList.length > 0) {
    const first = taskList[0].replace(/^[•\-\*\d\.\s]+/, "").trim();
    if (first) {
      return `Successfully completed: ${first}`;
    }
  }

  return "Successfully met all scheduled training objectives and project milestones for the day.";
}
