import { AiBusyError, generateWithPool, hasAiKeys } from "@/lib/ai";
import { NextResponse } from "next/server";
import { clientIp, getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import type { ExtractedDayEntry } from "@/lib/types";

// This route only does AI generation — file text is extracted client-side.
// No native Node.js file-parsing modules needed here.

// ─────────────────────────────────────────────────────────────
// Working-day helper: Monday–Saturday, skip Sundays
// ─────────────────────────────────────────────────────────────
function parseDateFlexible(dateStr: string): Date | null {
  if (!dateStr) return null;
  const str = dateStr.trim();
  const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  }
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function getWorkingDays(startDate: string, endDate: string): Date[] {
  const days: Date[] = [];
  const start = parseDateFlexible(startDate);
  const end = parseDateFlexible(endDate);
  if (!start || !end) return [];

  const current = new Date(start <= end ? start : end);
  const targetEnd = new Date(start <= end ? end : start);

  while (current <= targetEnd) {
    if (current.getDay() !== 0) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function formatDateDDMMYYYY(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  return `${day}-${m}-${y}`;
}

function formatDateReadable(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// AI generation prompt
// ─────────────────────────────────────────────────────────────
// The whole internship follows one arc. Each chunk of days is written
// separately (in parallel), so every chunk is told where it sits in the arc.
const PHASES: { until: number; focus: string }[] = [
  { until: 0.08, focus: "orientation, reading the PRD and architecture review, environment setup" },
  { until: 0.2, focus: "requirements breakdown, system and database design, project scaffolding" },
  { until: 0.65, focus: "implementing the core features from the PRD one by one, in a sensible order" },
  { until: 0.8, focus: "integration between components, testing and debugging" },
  { until: 0.92, focus: "performance improvements, security hardening and deployment" },
  { until: 1.01, focus: "documentation, final review, demo and handover" },
];

function phaseFor(dayIndex: number, totalDays: number): string {
  const progress = totalDays <= 1 ? 0 : dayIndex / (totalDays - 1);
  return (PHASES.find((p) => progress < p.until) || PHASES[PHASES.length - 1]).focus;
}

function buildGenerationPrompt(
  prdText: string,
  days: Date[],
  firstIndex: number,
  totalDays: number,
  department: string,
  designation: string
): string {
  const dateList = days
    .map((d, i) => {
      const n = firstIndex + i;
      return `Day ${n + 1} of ${totalDays} — ${formatDateReadable(d)} (${formatDateDDMMYYYY(d)}) — phase: ${phaseFor(n, totalDays)}`;
    })
    .join("\n");

  return `You are an expert OJT (On-the-Job Training) logbook writer.

Given the following PRD / project description, write realistic, detailed, and professional OJT logbook entries for an engineering intern.
Department: ${department || "Software Development"}
Designation: ${designation || "Software Development Intern"}

PRD / Project Description:
---
${prdText.slice(0, 10000)}
---

The internship has ${totalDays} working days in total. Write entries ONLY for these ${days.length} days (Day ${firstIndex + 1} to Day ${firstIndex + days.length}), matching each day's phase:
${dateList}

Return exactly ${days.length} entries, one per day above, in the same order.

CORE CONTENT GUIDELINES (COMPLETE MEDIUM-BASE LOGBOOK ENTRIES):
1. ALWAYS write complete, coherent, and grammatical sentences. NEVER truncate sentences, NEVER use trailing ellipses ("..."), and NEVER leave a word or thought unfinished. Every sentence must end with a period.
2. Provide a balanced "medium base" amount of content: provide full technical context, professional and descriptive, neither too brief nor an overly long essay.
3. Activities must PROGRESSIVELY build day by day and follow each day's phase. Do not repeat orientation or setup outside the first phase.
4. Each day must feel distinct, realistic, and directly grounded in the PRD content above.
5. "mySpace": 2 to 3 complete reflective sentences explaining the day's focus, technical insights, and progress (around 180–300 characters total).
6. "tasksCarriedOutToday": Exactly 3 to 4 complete, descriptive bullet points. Clearly state the exact work performed.
7. "keyLearningObservations": Exactly 2 to 3 complete bullet points explaining technical takeaways, architectural patterns, or practical lessons learned today.
8. "toolsTechnologyUsed": 3 to 5 specific tools, libraries, or frameworks used today (e.g. ["Python", "FastAPI", "Docker", "Git"]).
9. "specialAchievements": Exactly 1 complete sentence highlighting a concrete milestone or achievement completed today.

Return ONLY a valid JSON array — no markdown fences, no explanatory text:
[
  {
    "dayNumber": 1,
    "date": "YYYY-MM-DD",
    "mySpace": "Today marked the start of my internship on the project. I focused on understanding the core system requirements and setting up my local development environment with all required tools.",
    "tasksCarriedOutToday": [
      "Attended project orientation and thoroughly reviewed the system requirements document.",
      "Set up Python development environment including virtual environment and dependencies.",
      "Cloned the project repository and verified initial project build and test execution."
    ],
    "keyLearningObservations": [
      "Gained clear understanding of project milestones, architecture, and coding standards.",
      "Observed how modular folder structure helps maintain scalability across microservices."
    ],
    "toolsTechnologyUsed": ["Python", "Git", "VS Code", "Docker"],
    "specialAchievements": ["Successfully configured development environment and validated initial codebase build."]
  }
]`;
}

function parseAIResponse(cleaned: string): ExtractedDayEntry[] {
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("AI did not return an array.");

  return parsed.map((entry: Record<string, unknown>, idx: number) => {
    // Helper to clean trailing ellipses and ensure full complete sentences
    const cleanSentence = (str: string): string => {
      if (!str) return "";
      let s = str.trim().replace(/\.{2,}\s*$/, "").replace(/…\s*$/, "").trim();
      // If it doesn't end with sentence-ending punctuation, add a period
      if (s && !/[.!?]$/.test(s)) {
        s += ".";
      }
      return s;
    };

    const tasks = ensureStringArray(entry.tasksCarriedOutToday)
      .map(cleanSentence)
      .filter(Boolean)
      .slice(0, 4);

    const learnings = ensureStringArray(entry.keyLearningObservations)
      .map(cleanSentence)
      .filter(Boolean)
      .slice(0, 3);

    const tools = ensureStringArray(entry.toolsTechnologyUsed)
      .map((t) => t.trim().replace(/\.{2,}\s*$/, "").replace(/…\s*$/, "").trim())
      .filter(Boolean)
      .slice(0, 6);

    const rawAchievements = ensureStringArray(entry.specialAchievements)
      .map(cleanSentence)
      .filter(Boolean);

    const achievements =
      rawAchievements.length > 0
        ? [rawAchievements[0]]
        : tasks.length > 0
        ? [`Successfully completed: ${tasks[0].replace(/^[•\-\*\s]+/, "")}`]
        : ["Successfully completed all scheduled training objectives for the day."];

    const rawMySpace =
      typeof entry.mySpace === "string"
        ? [entry.mySpace]
        : ensureStringArray(entry.mySpace);

    const mySpace = rawMySpace
      .map(cleanSentence)
      .filter(Boolean)
      .slice(0, 3);

    return {
      dayNumber: Number(entry.dayNumber) || idx + 1,
      date: String(entry.date || ""),
      startTime: "09:00 AM",
      endTime: "05:00 PM",
      department: "",
      designation: "",
      originalText: "",
      mySpace,
      tasksCarriedOutToday: tasks,
      keyLearningObservations: learnings,
      toolsTechnologyUsed: tools,
      specialAchievements: achievements,
    };
  });
}

const GUEST_GENERATIONS_PER_HOUR = 5;
const CHUNK_DAYS = 8;
// 76 days is 10 chunks, all written at once.
const PARALLEL_CHUNKS = 10;
// Students should have their logbook within a minute.
const TIME_BUDGET_MS = 55_000;
export const maxDuration = 60;

/** Runs `fn` over `items`, at most `limit` at a time, keeping the order. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ─────────────────────────────────────────────────────────────
// POST — accepts JSON only (text already extracted client-side)
// ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    // Guests (no account) may generate too, but a few times per hour per IP,
    // so they can't use up the AI quota students depend on.
    if (!(await getSession())) {
      const limit = rateLimit(`guest-generate:${clientIp(req)}`, GUEST_GENERATIONS_PER_HOUR, 60 * 60 * 1000);
      if (!limit.ok) {
        const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
        return NextResponse.json(
          { success: false, error: `Guest limit reached. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or sign in to keep going.` },
          { status: 429 }
        );
      }
    }

    const body = await req.json();
    const {
      prdText,
      startDate,
      endDate,
      startTime = "09:00 AM",
      endTime = "05:00 PM",
      department = "",
      designation = "",
    } = body as {
      prdText: string;
      startDate: string;
      endDate: string;
      startTime?: string;
      endTime?: string;
      department?: string;
      designation?: string;
    };

    if (!prdText?.trim()) {
      return NextResponse.json(
        { success: false, error: "PRD text is empty. Please check the uploaded file." },
        { status: 400 }
      );
    }
    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: "Please provide both start date and end date." },
        { status: 400 }
      );
    }

    const workingDays = getWorkingDays(startDate, endDate);
    if (workingDays.length === 0) {
      return NextResponse.json(
        { success: false, error: "No working days found in the selected range." },
        { status: 400 }
      );
    }
    if (workingDays.length > 76) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many days (${workingDays.length}). Maximum is 76 working days.`,
        },
        { status: 400 }
      );
    }

    if (!hasAiKeys()) {
      return NextResponse.json(
        { success: false, error: "No AI API key configured." },
        { status: 500 }
      );
    }
    // Short chunks written at the same time: a 76-day logbook takes about
    // as long as one chunk instead of one very long answer.
    const chunks: { first: number; days: Date[] }[] = [];
    for (let i = 0; i < workingDays.length; i += CHUNK_DAYS) {
      chunks.push({ first: i, days: workingDays.slice(i, i + CHUNK_DAYS) });
    }
    const deadline = Date.now() + TIME_BUDGET_MS;
    const results = await mapWithConcurrency(chunks, PARALLEL_CHUNKS, (chunk) =>
      generateWithPool(
        {
          prompt: buildGenerationPrompt(prdText, chunk.days, chunk.first, workingDays.length, department, designation),
          temperature: 0.7,
          json: true,
          fast: true,
          deadline,
          label: "generate-from-prd",
        },
        (text) => {
          const entries = parseAIResponse(text);
          // A short answer counts as a failure, so the next key or model retries it.
          if (entries.length < chunk.days.length) throw new Error(`Expected ${chunk.days.length} entries, got ${entries.length}.`);
          return entries.slice(0, chunk.days.length);
        }
      )
    );
    let days = results.flat();

    // Normalise times and dept from request
    days = days.map((d, i) => ({
      ...d,
      dayNumber: i + 1,
      date: d.date ? formatDateDDMMYYYY(workingDays[i]) : formatDateDDMMYYYY(workingDays[i]),
      startTime,
      endTime,
      department: department || d.department || "",
      designation: designation || d.designation || "",
    }));

    return NextResponse.json({
      success: true,
      days,
      isMultiDay: days.length > 1,
      data: days[0] || null,
      detectedDayNumber: 1,
      validationWarnings: [],
    });
  } catch (error: unknown) {
    if (error instanceof AiBusyError) {
      return NextResponse.json(
        { success: false, error: error.message, retryAfterSeconds: error.retryAfterSeconds },
        { status: 503 }
      );
    }
    console.error("generate-from-prd error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate logbook entries.",
      },
      { status: 500 }
    );
  }
}

function ensureStringArray(val: unknown): string[] {
  if (!Array.isArray(val))
    return typeof val === "string" && val.trim() ? [val] : [];
  return val.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
}
