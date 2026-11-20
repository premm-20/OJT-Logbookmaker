import { AiBusyError, generateWithPool, hasAiKeys, NO_USER_KEY_ERROR, userAiKeyFrom } from "@/lib/ai";
import { NextResponse } from "next/server";
import { clientIp } from "@/lib/auth/client-ip";
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "01 Sep 2026" */
function formatDateLong(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
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
// The logbook tells one project journey: the student builds the project in
// the PRD from the first idea to the final demo. Each chunk of days is written
// separately (in parallel), so every chunk is told where it sits in the journey.
const PHASES: { until: number; focus: string }[] = [
  { until: 0.08, focus: "studying the PRD, defining the problem, goals and scope, choosing the tech stack, setting up the repository" },
  { until: 0.2, focus: "requirements breakdown, user flows, system architecture and database design, project scaffolding" },
  { until: 0.65, focus: "building the core features from the PRD one by one, in a sensible order, each day finishing a concrete piece" },
  { until: 0.8, focus: "connecting the modules end to end, testing, and fixing the bugs found" },
  { until: 0.92, focus: "improving performance, security and the user interface, then deploying the project" },
  { until: 1.01, focus: "documentation, final review, project demo and wrap-up" },
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
  designation: string,
  customPrompt = ""
): string {
  const dateList = days
    .map((d, i) => {
      const n = firstIndex + i;
      return `Day ${n + 1} of ${totalDays} — ${formatDateReadable(d)} — stage: ${phaseFor(n, totalDays)}`;
    })
    .join("\n");

  return `You write the daily project journal of a student who is building the project described in the PRD below, from the first idea to the finished product.

This is a PROJECT JOURNEY, not a job. The student is the one designing and building this project. Never write about joining a company, an office, a team induction, a manager assigning work, HR, or "my internship". Write about the project itself: what was planned, built, tested and improved each day.
Area: ${department || "Software Development"}
Role: ${designation || "Project Developer"}

PRD / Project Description:
---
${prdText.slice(0, 10000)}
---

The project journey has ${totalDays} working days in total. Write entries ONLY for these ${days.length} days (Day ${firstIndex + 1} to Day ${firstIndex + days.length}), matching each day's stage:
${dateList}

Return exactly ${days.length} entries, one per day above, in the same order.
${
  customPrompt
    ? `
THE STUDENT'S OWN INSTRUCTIONS (HIGHEST PRIORITY: follow these exactly; they override the guidelines below wherever they conflict, but the JSON format must stay the same. Day numbers refer to the whole journey, so apply day-specific instructions only to the matching days listed above):
---
${customPrompt}
---
`
    : ""
}
WRITING GUIDELINES:
1. Write in the first person ("I"), in clear, simple, professional English. Every sentence is complete and ends with a period. Never use "...", never cut a sentence short.
2. Be specific to THIS project: name the real features, screens, modules, APIs, database tables and tools from the PRD. Avoid generic filler such as "worked on the project" or "learned a lot".
3. The journey moves forward every day. Each day continues from the previous one and finishes something new. Never repeat the same task, wording or learning on two days.
4. "mySpace": 2 to 3 sentences (about 200 to 300 characters) on what I focused on today, why it mattered for the project, and how far the project moved.
5. "tasksCarriedOutToday": 3 to 4 bullet points, each one sentence naming exactly what I built, designed, tested or fixed.
6. "keyLearningObservations": 2 bullet points, each one sentence with a real technical lesson from today's work.
7. "toolsTechnologyUsed": 3 to 5 specific tools, languages, libraries or services used today, matching the PRD.
8. "specialAchievements": exactly 1 sentence naming the concrete result reached today.

Return ONLY a valid JSON array — no markdown fences, no explanatory text:
[
  {
    "dayNumber": 1,
    "date": "YYYY-MM-DD",
    "mySpace": "I started the project by studying the PRD and writing down the problem it solves, the main users and the features for the first version. Fixing the scope early gave me a clear plan for the coming weeks.",
    "tasksCarriedOutToday": [
      "Read the PRD in detail and listed the core features, user roles and main screens.",
      "Compared React with Next.js for the frontend and chose Next.js for routing and server rendering.",
      "Created the Git repository with a clean folder structure and a README describing the project goal."
    ],
    "keyLearningObservations": [
      "Writing the scope down first makes it much easier to plan features in the right order.",
      "Choosing the stack based on the PRD needs avoids rewriting parts of the project later."
    ],
    "toolsTechnologyUsed": ["Next.js", "Git", "GitHub", "VS Code"],
    "specialAchievements": ["Finalised the project scope and set up the repository that the whole project is built on."]
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

const GENERATIONS_PER_HOUR = 20;
const CHUNK_DAYS = 8;
// 76 days is 10 chunks, all written at once.
const PARALLEL_CHUNKS = 10;
// Stay inside the 60 s function limit, with room to send the answer.
const TIME_BUDGET_MS = 50_000;
// One model attempt may not use the whole budget: a stuck model is dropped
// and the next one gets a fair chance.
const ATTEMPT_TIMEOUT_MS = 22_000;
// The page asks for a few days per request (chunkStart / chunkSize), so no
// single request has to fit the whole logbook into one function run.
const MAX_CHUNK_REQUEST_DAYS = 10;
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
    // Server keys by default; a key pasted in the API key box takes over.
    const userKey = userAiKeyFrom(req);
    if (!hasAiKeys(userKey)) return NextResponse.json({ success: false, error: NO_USER_KEY_ERROR }, { status: 400 });

    // One logbook counts once, however many chunk requests it takes.
    const peek = (await req.clone().json().catch(() => ({}))) as { chunkStart?: unknown };
    const countsTowardLimit = !(typeof peek.chunkStart === "number" && peek.chunkStart > 0);
    const limit = !countsTowardLimit ? { ok: true as const, retryAfterSeconds: 0 } : rateLimit(`generate:${clientIp(req)}`, GENERATIONS_PER_HOUR, 60 * 60 * 1000);
    if (!limit.ok) {
      const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
      return NextResponse.json(
        { success: false, error: `Too many logbooks this hour. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
        { status: 429 }
      );
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
      customPrompt: rawCustomPrompt = "",
      chunkStart,
      chunkSize,
    } = body as {
      prdText: string;
      startDate: string;
      endDate: string;
      startTime?: string;
      endTime?: string;
      department?: string;
      designation?: string;
      customPrompt?: string;
      chunkStart?: number;
      chunkSize?: number;
    };
    const customPrompt = typeof rawCustomPrompt === "string" ? rawCustomPrompt.trim().slice(0, 2000) : "";

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

    // Short chunks written at the same time: a 76-day logbook takes about
    // as long as one chunk instead of one very long answer.
    const isChunk = Number.isInteger(chunkStart) && Number.isInteger(chunkSize) && chunkSize! > 0;
    const from = isChunk ? Math.max(0, chunkStart!) : 0;
    const to = isChunk ? Math.min(workingDays.length, from + Math.min(chunkSize!, MAX_CHUNK_REQUEST_DAYS)) : workingDays.length;
    if (from >= to) {
      return NextResponse.json({ success: false, error: "That part of the logbook is out of range." }, { status: 400 });
    }
    const chunks: { first: number; days: Date[] }[] = [];
    for (let i = from; i < to; i += CHUNK_DAYS) {
      chunks.push({ first: i, days: workingDays.slice(i, Math.min(i + CHUNK_DAYS, to)) });
    }
    const deadline = Date.now() + TIME_BUDGET_MS;
    const results = await mapWithConcurrency(chunks, PARALLEL_CHUNKS, (chunk) =>
      generateWithPool(
        {
          prompt: buildGenerationPrompt(prdText, chunk.days, chunk.first, workingDays.length, department, designation, customPrompt),
          temperature: 0.7,
          json: true,
          fast: true,
          deadline,
          attemptTimeoutMs: ATTEMPT_TIMEOUT_MS,
          label: "generate-from-prd",
          userKey,
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
      dayNumber: from + i + 1,
      date: formatDateLong(workingDays[from + i]),
      startTime,
      endTime,
      department: department || d.department || "",
      designation: designation || d.designation || "",
    }));

    return NextResponse.json({
      success: true,
      days,
      totalDays: workingDays.length,
      isMultiDay: days.length > 1,
      data: days[0] || null,
      detectedDayNumber: 1,
      validationWarnings: [],
    });
  } catch (error: unknown) {
    if (error instanceof AiBusyError) {
      return NextResponse.json(
        {
          success: false,
          // The server keys are spent: say how to keep going right now.
          error: userAiKeyFrom(req) ? error.message : `${error.message} If your key's limit is reached, paste a new API key in the box at the top.`,
          retryAfterSeconds: error.retryAfterSeconds,
        },
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
