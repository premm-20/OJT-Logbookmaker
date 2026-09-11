import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
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
function buildGenerationPrompt(
  prdText: string,
  days: Date[],
  department: string,
  designation: string
): string {
  const dateList = days
    .map((d, i) => `Day ${i + 1} — ${formatDateReadable(d)} (${formatDateDDMMYYYY(d)})`)
    .join("\n");

  return `You are an expert OJT (On-the-Job Training) logbook writer.

Given the following PRD / project description, write realistic, detailed, and professional OJT logbook entries for an engineering intern.
Department: ${department || "Software Development"}
Designation: ${designation || "Software Development Intern"}

PRD / Project Description:
---
${prdText.slice(0, 10000)}
---

Generate one complete logbook entry for EACH of the following working days:
${dateList}

CORE CONTENT GUIDELINES (COMPLETE MEDIUM-BASE LOGBOOK ENTRIES):
1. ALWAYS write complete, coherent, and grammatical sentences. NEVER truncate sentences, NEVER use trailing ellipses ("..."), and NEVER leave a word or thought unfinished. Every sentence must end with a period.
2. Provide a balanced "medium base" amount of content: provide full technical context, professional and descriptive, neither too brief nor an overly long essay.
3. Activities must PROGRESSIVELY build day by day: start with orientation and architecture review → environment setup → design & schema → core feature implementation → testing & debugging → integration → deployment.
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

// ─────────────────────────────────────────────────────────────
// Call Gemini
// ─────────────────────────────────────────────────────────────
async function generateWithGemini(
  prompt: string,
  geminiKey: string
): Promise<ExtractedDayEntry[]> {
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return parseAIResponse(cleaned);
}

// ─────────────────────────────────────────────────────────────
// Call OpenRouter as fallback
// ─────────────────────────────────────────────────────────────
async function generateWithOpenRouter(
  prompt: string,
  openrouterKey: string
): Promise<ExtractedDayEntry[]> {
  const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openrouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "OJT Logbook Maker",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`OpenRouter error: ${response.statusText}`);
  const json = await response.json();
  const text = json.choices?.[0]?.message?.content || "";
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return parseAIResponse(cleaned);
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

// ─────────────────────────────────────────────────────────────
// POST — accepts JSON only (text already extracted client-side)
// ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
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

    const geminiKey = process.env.GEMINI_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const prompt = buildGenerationPrompt(prdText, workingDays, department, designation);

    let days: ExtractedDayEntry[] = [];

    if (geminiKey) {
      try {
        days = await generateWithGemini(prompt, geminiKey);
      } catch (err) {
        console.warn("Gemini failed, trying OpenRouter:", err);
        if (openrouterKey) {
          days = await generateWithOpenRouter(prompt, openrouterKey);
        } else {
          throw err;
        }
      }
    } else if (openrouterKey) {
      days = await generateWithOpenRouter(prompt, openrouterKey);
    } else {
      return NextResponse.json(
        { success: false, error: "No AI API key configured." },
        { status: 500 }
      );
    }

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
