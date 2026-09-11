import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { formatTime, ensureSpecialAchievements } from "@/lib/utils";
import type { ExtractedDayEntry, ExtractedLogbook } from "@/lib/types";

const SYSTEM_PROMPT = `You are an information extraction and classification system for an OJT logbook.

Your ONLY task is to classify the user's supplied text into the following categories:

- mySpace: General overview or summary of what the student did/experienced that day
- tasksCarriedOutToday: Specific tasks, work items, assignments completed
- keyLearningObservations: Things learned, skills gained, knowledge acquired, observations
- toolsTechnologyUsed: Software, tools, technologies, platforms, languages mentioned
- specialAchievements: Notable accomplishments, completed milestones, successes

CRITICAL RULES:

1. Do not generate any new text.
2. Do not rewrite any text.
3. Do not paraphrase.
4. Do not summarize.
5. Do not correct grammar.
6. Do not add words.
7. Do not remove words.
8. Do not invent information.
9. Preserve the user's original wording exactly, character-for-character.
10. Preserve the original sentences.
11. Preserve bullet points where possible.
12. If the user provides headings, use those headings to determine classification.
13. Every returned text fragment must originate directly from the user's input.
14. Do not fabricate achievements, technologies, tasks, learning or observations.
15. If a category has no matching information, return an empty array.
16. Return valid JSON only.
17. Each array element should be a string containing one or more sentences/bullet points from the original text.
18. If a sentence clearly belongs to one category, place it there. If ambiguous, place it in the most appropriate category.

Return JSON in this exact format:
{
  "mySpace": [],
  "tasksCarriedOutToday": [],
  "keyLearningObservations": [],
  "toolsTechnologyUsed": [],
  "specialAchievements": []
}`;

interface MarkerInfo {
  type: "day_header" | "date" | "myspace" | "tasks" | "learnings" | "tools" | "achievements";
  text: string;
}

function detectPageMarker(line: string): MarkerInfo | null {
  const s = line.trim();
  if (!s) return null;

  // 1. Explicit Day / Journal header (handles Unicode dashes: –, —, -, or :)
  // e.g. "DAILY ACTIVITY JOURNAL – Day 2", "Day 2", "Day-2", "Day: 2", "DAY 02"
  if (
    /^(?:daily\s+activity\s+journal|day\s*[-–—:]?\s*\d+)\b/i.test(s) ||
    /daily\s+activity\s+journal\s*[-–—:]?\s*(?:day\s*\d+)?/i.test(s)
  ) {
    return { type: "day_header", text: s };
  }

  // 2. Date line (e.g. "Date: 2 September 2026", "Date: 2026-09-02")
  if (/^date\s*:/i.test(s)) {
    return { type: "date", text: s };
  }

  // 3. My Space
  if (/^(?:my\s*space|my\s+thoughts)/i.test(s)) {
    return { type: "myspace", text: s };
  }

  // 4. Tasks Carried Out Today
  if (/^(?:tasks?\s*carried\s*out|tasks?\s*today|tasks?\s*:)/i.test(s)) {
    return { type: "tasks", text: s };
  }

  // 5. Key Learnings / Observations
  if (/^(?:key\s*learnings?|learnings?\s*[\/&]?\s*observations?)/i.test(s)) {
    return { type: "learnings", text: s };
  }

  // 6. Tools / Tech Used
  if (/^(?:tools?\s*[\/&,]?\s*(?:equipment|technology|tech)?\s*(?:used)?|technology\s+used)/i.test(s)) {
    return { type: "tools", text: s };
  }

  // 7. Special Achievements
  if (/^(?:special\s*achievements?|achievements?\s*:)/i.test(s)) {
    return { type: "achievements", text: s };
  }

  return null;
}

/**
 * Intelligent line-by-line page segmenter.
 * Detects when a new logbook page/day starts based on:
 * - Day / Journal headers (e.g. "DAILY ACTIVITY JOURNAL – Day 2", "Day 2")
 * - Repeated section headers (e.g., after one "MY SPACE" there is another "MY SPACE")
 * - Next Date line when preceded by previous journal content
 */
function splitIntoDayPages(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const pages: string[] = [];
  let currentLines: string[] = [];
  let seen = new Set<string>();

  for (const line of lines) {
    const marker = detectPageMarker(line);
    let isNewPage = false;

    if (marker && currentLines.length > 0) {
      const currentText = currentLines.join("\n").trim();
      const hasMeaningfulContent =
        currentText.length > 25 ||
        currentLines.some(
          (l) => /[a-zA-Z]{4,}/.test(l) && !detectPageMarker(l)
        );

      if (hasMeaningfulContent) {
        if (marker.type === "day_header") {
          // Explicit Day/Journal header always signals the next page
          isNewPage = true;
        } else if (seen.has(marker.type)) {
          // Repetition of a section (e.g., after one "MY SPACE" there is another "MY SPACE"!)
          isNewPage = true;
        } else if (
          marker.type === "date" &&
          (seen.has("myspace") || seen.has("tasks") || seen.has("achievements") || seen.has("learnings"))
        ) {
          // Date line appearing after journal body content of a previous day
          isNewPage = true;
        } else if (
          marker.type === "myspace" &&
          (seen.has("tasks") || seen.has("learnings") || seen.has("tools") || seen.has("achievements"))
        ) {
          // My Space appearing after later sections of a previous day
          isNewPage = true;
        }
      }
    }

    if (isNewPage) {
      const chunk = currentLines.join("\n").trim();
      if (chunk.length > 10) {
        pages.push(chunk);
      }
      currentLines = [line];
      seen = new Set(marker ? [marker.type] : []);
    } else {
      currentLines.push(line);
      if (marker) {
        seen.add(marker.type);
      }
    }
  }

  if (currentLines.length > 0) {
    const chunk = currentLines.join("\n").trim();
    if (chunk.length > 10) {
      pages.push(chunk);
    }
  }

  return pages.length > 0 ? pages : [text.trim()];
}

/**
 * Resolves day numbers across pages sequentially, even when the first page
 * didn't explicitly have "Day 1" but a subsequent page has "Day 2".
 */
function resolveDayNumbers(dayChunks: string[]): number[] {
  const detectedNums: (number | null)[] = dayChunks.map((chunk) => {
    const match = chunk.match(/(?:day\s*([0-9]+)|day-([0-9]+))/i);
    if (match) {
      const n = parseInt(match[1] || match[2], 10);
      if (n >= 1 && n <= 76) return n;
    }
    return null;
  });

  // Back-fill previous days: e.g. [null, 2] -> [1, 2]
  for (let i = detectedNums.length - 1; i >= 0; i--) {
    if (detectedNums[i] !== null && i > 0 && detectedNums[i - 1] === null) {
      detectedNums[i - 1] = Math.max(1, (detectedNums[i] as number) - 1);
    }
  }

  // Forward-fill remaining nulls
  let current = 1;
  return detectedNums.map((num, idx) => {
    if (num !== null) {
      current = num + 1;
      return num;
    }
    const resolved = idx === 0 ? 1 : current;
    current = resolved + 1;
    return resolved;
  });
}

function parseDateToISO(dateStr: string): string {
  if (!dateStr) return "";
  const cleaned = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmy = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  // Check standard textual dates like "2 September 2026", "September 2, 2026"
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return cleaned;
}

function extractMetadataFromChunk(chunk: string, defaultDayNum: number) {
  // Day Number
  let dayNum = defaultDayNum;
  const dayMatch = chunk.match(/(?:day\s*([0-9]+)|day-([0-9]+))/i);
  if (dayMatch) {
    const parsed = parseInt(dayMatch[1] || dayMatch[2], 10);
    if (parsed >= 1 && parsed <= 76) dayNum = parsed;
  }

  // Date (supports "Date: 2 September 2026", "2026-09-02", "02/09/2026", etc.)
  let date = "";
  const dateMatch =
    chunk.match(/date\s*:\s*([^\n\r,]+)/i) ||
    chunk.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/) ||
    chunk.match(/\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|October|Nov|Dec)[a-z]*\s+\d{4})\b/i);
  if (dateMatch) {
    date = parseDateToISO(dateMatch[1]);
  }

  // Timings with AM/PM
  let startTime = "09:00 AM";
  let endTime = "05:00 PM";
  const timeMatch = chunk.match(
    /(?:timing[s]?|hours?|time)\s*:\s*(\d{1,2}:\d{2}(?:\s*[ap]m)?)\s*(?:to|-)\s*(\d{1,2}:\d{2}(?:\s*[ap]m)?)/i
  );
  if (timeMatch) {
    startTime = formatTime(timeMatch[1]);
    endTime = formatTime(timeMatch[2]);
  }

  // Department
  let department = "";
  const deptMatch = chunk.match(/department\s*:\s*([^\n\r]+)/i);
  if (deptMatch) {
    department = deptMatch[1].trim();
  }

  // Designation
  let designation = "";
  const desigMatch = chunk.match(/designation\s*:\s*([^\n\r]+)/i);
  if (desigMatch) {
    designation = desigMatch[1].trim();
  }

  return { dayNum, date, startTime, endTime, department, designation };
}

const SECTION_PATTERNS = {
  mySpace: /^(?:my\s*space(?:\s*\(.*?\))?|my\s+thoughts|my\s+notes|my\s+sketch)(?:\b|:)/i,
  tasksCarriedOutToday: /^(?:tasks?\s*carried\s*out(?:\s*today)?|tasks?\s*today|tasks?|activities\s*(?:done|carried\s*out|today))(?:\b|:)/i,
  keyLearningObservations: /^(?:key\s*learnings?(?:\s*[\/&]?\s*observations?)?|learnings?\s*[\/&]?\s*observations?|observations?|what\s+i\s+learned)(?:\b|:)/i,
  toolsTechnologyUsed: /^(?:tools?(?:\s*,\s*equipment)?\s*[\/&,]?\s*(?:technology|tech)?\s*(?:or\s*techniques)?\s*(?:used)?|technology\s+used|technologies\s+used|tools?\s+used|tools?\s*&?\s*tech(?:nologies)?)(?:\b|:)/i,
  specialAchievements: /^(?:special\s*achievements?|achievements?|key\s*achievements?|milestones?|accomplishments?)(?:\b|:)/i,
};

function parseStructuredSections(chunk: string): ExtractedLogbook | null {
  const lines = chunk.split(/\r?\n/);
  const sections: ExtractedLogbook = {
    mySpace: [],
    tasksCarriedOutToday: [],
    keyLearningObservations: [],
    toolsTechnologyUsed: [],
    specialAchievements: [],
  };

  let currentKey: keyof ExtractedLogbook | null = null;
  let detectedSectionsCount = 0;

  for (const rawLine of lines) {
    const s = rawLine.trim();
    if (!s) continue;

    // Ignore preamble headers that belong in the top logbook header
    if (/^(?:daily\s+activity\s+journal|day\s*[-–—:]?\s*\d+)\b/i.test(s)) continue;
    if (/^(?:date|timing|ojl\s*timing|hours?|department|designation)\s*:/i.test(s)) continue;

    let matchedKey: keyof ExtractedLogbook | null = null;
    let inlineContent: string | null = null;

    for (const [key, pattern] of Object.entries(SECTION_PATTERNS) as [keyof ExtractedLogbook, RegExp][]) {
      const match = s.match(pattern);
      if (match && match.index === 0) {
        matchedKey = key;
        const remainder = s.slice(match[0].length).replace(/^[:\s\-–—]+/, "").trim();
        if (remainder) {
          inlineContent = remainder;
        }
        break;
      }
    }

    if (matchedKey) {
      currentKey = matchedKey;
      detectedSectionsCount++;
      if (inlineContent) {
        sections[currentKey].push(inlineContent);
      }
    } else if (currentKey) {
      sections[currentKey].push(s);
    }
  }

  // If at least 2 distinct sections were identified, return this structured extraction directly
  if (detectedSectionsCount >= 2) {
    return sections;
  }

  return null;
}

function fallbackHeuristicClassification(chunk: string): ExtractedLogbook {
  // Check if even 1 section was matched by headers
  const partial = parseStructuredSections(chunk);
  if (partial && Object.values(partial).some((arr) => arr.length > 0)) {
    return partial;
  }

  const rawLines = chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lines = rawLines.filter(
    (l) =>
      !/^(?:daily\s+activity\s+journal|day\s*[-–—:]?\s*\d+)\b/i.test(l) &&
      !/^(?:date|timing|ojl\s*timing|hours?|department|designation)\s*:/i.test(l)
  );

  const mySpace: string[] = [];
  const tasks: string[] = [];
  const learnings: string[] = [];
  const tools: string[] = [];
  const achievements: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Tools / Tech: short item or line with tool names
    if (
      /\b(python|javascript|typescript|react|next\.?js|html|css|sql|git|github|docker|linux|figma|pandas|numpy|scikit|tensorflow|pytorch|keras|vscode|api|mongodb|postgresql|machine learning|data science)\b/i.test(line) &&
      line.split(/\s+/).length <= 10
    ) {
      tools.push(line);
      continue;
    }

    // Learnings / Observations
    if (
      /\b(learn|learned|learning|understand|understood|observed|observation|studied|discovered|realized|gained knowledge|insight)\b/i.test(lower)
    ) {
      learnings.push(line);
      continue;
    }

    // Achievements
    if (
      /\b(achieve|achieved|achievement|milestone|completed ahead|awarded|recognized|successfully resolved|success|delivered)\b/i.test(lower)
    ) {
      achievements.push(line);
      continue;
    }

    // Tasks
    if (
      /\b(develop|developed|implement|implemented|built|build|created|configured|fixed|debugged|tested|attended|researched|worked on|designed|prepared|planned|discussed)\b/i.test(lower) ||
      /^[-*•]\s+/.test(line)
    ) {
      tasks.push(line);
      continue;
    }

    // Default to My Space reflections
    mySpace.push(line);
  }

  return {
    mySpace: mySpace.length > 0 ? mySpace : lines.length > 0 ? [lines[0]] : [],
    tasksCarriedOutToday: tasks.length > 0 ? tasks : lines.length > 1 ? [lines[1]] : [],
    keyLearningObservations: learnings,
    toolsTechnologyUsed: tools,
    specialAchievements: achievements,
  };
}

async function callAI(text: string, geminiKey?: string, openrouterKey?: string): Promise<ExtractedLogbook> {
  // First check if structured headers exist!
  const structured = parseStructuredSections(text);
  if (structured) {
    return structured;
  }

  // 1. Try Gemini
  if (geminiKey) {
    try {
      const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
        systemInstruction: SYSTEM_PROMPT,
      });

      const result = await model.generateContent(
        `Classify the following OJT log text into the appropriate categories. Extract and classify ONLY — do not rewrite, paraphrase, or generate new text.\n\n---\n${text}\n---`
      );
      const responseText = result.response.text();
      const cleaned = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(cleaned);

      return {
        mySpace: ensureStringArray(parsed.mySpace),
        tasksCarriedOutToday: ensureStringArray(parsed.tasksCarriedOutToday),
        keyLearningObservations: ensureStringArray(parsed.keyLearningObservations),
        toolsTechnologyUsed: ensureStringArray(parsed.toolsTechnologyUsed),
        specialAchievements: ensureStringArray(parsed.specialAchievements),
      };
    } catch (err: any) {
      console.warn("Gemini API call failed, falling back to OpenRouter/heuristics:", err.message);
    }
  }

  // 2. Try OpenRouter
  if (openrouterKey) {
    try {
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
          temperature: 0.1,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Classify the following OJT log text into the appropriate categories. Extract and classify ONLY — do not rewrite, paraphrase, or generate new text.\n\n---\n${text}\n---`,
            },
          ],
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const responseText = json.choices?.[0]?.message?.content || "";
        const cleaned = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        const parsed = JSON.parse(cleaned);

        return {
          mySpace: ensureStringArray(parsed.mySpace),
          tasksCarriedOutToday: ensureStringArray(parsed.tasksCarriedOutToday),
          keyLearningObservations: ensureStringArray(parsed.keyLearningObservations),
          toolsTechnologyUsed: ensureStringArray(parsed.toolsTechnologyUsed),
          specialAchievements: ensureStringArray(parsed.specialAchievements),
        };
      }
    } catch (err: any) {
      console.warn("OpenRouter API call failed:", err.message);
    }
  }

  // 3. Resilient heuristic fallback
  return fallbackHeuristicClassification(text);
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "No text provided", data: null, validationWarnings: [] },
        { status: 400 }
      );
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // Split text into distinct pages using the multi-page section boundary detector
    const dayChunks = splitIntoDayPages(text);
    const resolvedDayNumbers = resolveDayNumbers(dayChunks);
    const isMultiDay = dayChunks.length > 1;

    const extractedDays: ExtractedDayEntry[] = [];
    const allWarnings: string[] = [];

    // Process each page chunk
    for (let i = 0; i < dayChunks.length; i++) {
      const chunk = dayChunks[i];
      const defaultDayNum = resolvedDayNumbers[i] || i + 1;
      const meta = extractMetadataFromChunk(chunk, defaultDayNum);

      try {
        const classified = await callAI(chunk, geminiKey, openrouterKey);

        // Validate text fragments exist in chunk
        const normalizedChunk = chunk.replace(/\s+/g, " ").trim().toLowerCase();
        for (const [category, fragments] of Object.entries(classified)) {
          for (const fragment of fragments as string[]) {
            const normalizedFragment = fragment.replace(/\s+/g, " ").trim().toLowerCase();
            if (!normalizedChunk.includes(normalizedFragment)) {
              allWarnings.push(
                `Day ${meta.dayNum}: "${truncate(fragment, 60)}" in "${formatCategoryName(
                  category
                )}" could not be found in your original text.`
              );
            }
          }
        }

        const rawAch = ensureStringArray(classified.specialAchievements);
        const resolvedAch =
          rawAch.length > 0
            ? rawAch
            : [ensureSpecialAchievements("", classified.tasksCarriedOutToday)];

        extractedDays.push({
          dayNumber: meta.dayNum,
          date: meta.date,
          startTime: meta.startTime,
          endTime: meta.endTime,
          department: meta.department,
          designation: meta.designation,
          originalText: chunk,
          mySpace: classified.mySpace,
          tasksCarriedOutToday: classified.tasksCarriedOutToday,
          keyLearningObservations: classified.keyLearningObservations,
          toolsTechnologyUsed: classified.toolsTechnologyUsed,
          specialAchievements: resolvedAch,
        });
      } catch (err: any) {
        console.error(`Error processing day chunk ${i + 1}:`, err);
        const fallbackClassified = fallbackHeuristicClassification(chunk);
        const rawFallbackAch = ensureStringArray(fallbackClassified.specialAchievements);
        const resolvedFallbackAch =
          rawFallbackAch.length > 0
            ? rawFallbackAch
            : [ensureSpecialAchievements("", fallbackClassified.tasksCarriedOutToday)];

        extractedDays.push({
          dayNumber: meta.dayNum,
          date: meta.date,
          startTime: meta.startTime,
          endTime: meta.endTime,
          department: meta.department,
          designation: meta.designation,
          originalText: chunk,
          mySpace: fallbackClassified.mySpace,
          tasksCarriedOutToday: fallbackClassified.tasksCarriedOutToday,
          keyLearningObservations: fallbackClassified.keyLearningObservations,
          toolsTechnologyUsed: fallbackClassified.toolsTechnologyUsed,
          specialAchievements: resolvedFallbackAch,
        });
      }
    }

    return NextResponse.json({
      success: true,
      isMultiDay,
      days: extractedDays,
      data: extractedDays[0] || null,
      detectedDayNumber: extractedDays[0]?.dayNumber || 1,
      validationWarnings: allWarnings,
    });
  } catch (error: any) {
    console.error("Extract logbook error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to analyze text. Please try again.",
        data: null,
        validationWarnings: [],
      },
      { status: 500 }
    );
  }
}

function ensureStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function formatCategoryName(key: string): string {
  const map: Record<string, string> = {
    mySpace: "My Space",
    tasksCarriedOutToday: "Tasks Carried Out Today",
    keyLearningObservations: "Key Learning / Observations",
    toolsTechnologyUsed: "Tools / Technology Used",
    specialAchievements: "Special Achievements",
  };
  return map[key] || key;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}
