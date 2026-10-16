/**
 * Shared AI caller with a pool of API keys.
 *
 * Every Gemini key x model and OpenRouter key x model pair is a "slot". Each
 * request starts at a different slot (round robin), and when a slot hits its
 * rate limit it rests for a while and the request moves on to the next one.
 * Gemini slots are tried first, then OpenRouter.
 *
 * Env (comma or newline separated lists; the single-key names still work):
 *   GEMINI_API_KEYS      / GEMINI_API_KEY
 *   GEMINI_MODELS        / GEMINI_MODEL        default gemini-2.5-flash
 *   OPENROUTER_API_KEYS  / OPENROUTER_API_KEY
 *   OPENROUTER_MODELS    / OPENROUTER_MODEL    default: free models
 *
 * OpenRouter is free-only: models without the ":free" suffix are ignored and
 * every request carries a $0 max price, so the account is never charged.
 */

type Provider = "gemini" | "openrouter";

interface Slot {
  id: string;
  provider: Provider;
  key: string;
  model: string;
}

export interface AiRequest {
  prompt: string;
  system?: string;
  temperature: number;
  /** Ask Gemini for a JSON response. */
  json?: boolean;
  /** Short name for logs. */
  label: string;
}

/** Every slot is resting; the caller should ask the student to retry. */
export class AiBusyError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`The AI service is busy right now. Please try again in about ${retryAfterSeconds} seconds.`);
    this.name = "AiBusyError";
  }
}

const DEFAULT_GEMINI_MODELS = ["gemini-2.5-flash"];
// Checked 2026-10-16: these returned clean JSON logbook entries at $0.
const DEFAULT_OPENROUTER_MODELS = [
  "nvidia/nemotron-3.5-super-vl:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
];

function freeOnly(models: string[]): string[] {
  const free = models.filter((m) => m.endsWith(":free"));
  const paid = models.filter((m) => !m.endsWith(":free"));
  if (paid.length) console.warn(`[ai] Ignoring paid OpenRouter models: ${paid.join(", ")}`);
  return free;
}

const REQUEST_TIMEOUT_MS = 120_000;
// When every slot is resting, wait this long at most for one to free up.
const MAX_WAIT_FOR_SLOT_MS = 20_000;

const RATE_LIMIT_REST_MS = 60_000;
const NO_CREDIT_REST_MS = 10 * 60_000;
const BAD_KEY_REST_MS = 60 * 60_000;

// Per server instance. Good enough: each instance learns which keys are spent.
const restingUntil = new Map<string, number>();
let cursor = Math.floor(Math.random() * 1000);

function envList(...names: string[]): string[] {
  const values = names.flatMap((name) => (process.env[name] || "").split(/[,\n]/));
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function buildSlots(): Slot[] {
  const geminiKeys = envList("GEMINI_API_KEYS", "GEMINI_API_KEY");
  const geminiModels = envList("GEMINI_MODELS", "GEMINI_MODEL");
  const openrouterKeys = envList("OPENROUTER_API_KEYS", "OPENROUTER_API_KEY");
  const openrouterModels = freeOnly(envList("OPENROUTER_MODELS", "OPENROUTER_MODEL"));

  const pairs = (provider: Provider, keys: string[], models: string[]) =>
    models.flatMap((model) =>
      keys.map((key, i) => ({ id: `${provider}:${i}:${model}`, provider, key, model }))
    );

  return [
    ...pairs("gemini", geminiKeys, geminiModels.length ? geminiModels : DEFAULT_GEMINI_MODELS),
    ...pairs("openrouter", openrouterKeys, openrouterModels.length ? openrouterModels : DEFAULT_OPENROUTER_MODELS),
  ];
}

export function hasAiKeys(): boolean {
  return buildSlots().length > 0;
}

/** Gemini first, rotated so concurrent requests start on different keys. */
function orderedSlots(slots: Slot[]): Slot[] {
  const start = cursor++;
  const rotate = (list: Slot[]) =>
    list.length ? list.map((_, i) => list[(start + i) % list.length]) : [];
  return [
    ...rotate(slots.filter((s) => s.provider === "gemini")),
    ...rotate(slots.filter((s) => s.provider === "openrouter")),
  ];
}

class SlotError extends Error {
  constructor(message: string, public status: number, public retryAfterMs?: number) {
    super(message);
  }
}

function retryAfterMs(res: Response): number | undefined {
  const header = res.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

async function callGemini(slot: Slot, req: AiRequest): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(slot.model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": slot.key },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
        generationConfig: {
          temperature: req.temperature,
          ...(req.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Google puts the wait in the body, e.g. "retryDelay": "17s".
    const delay = detail.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
    const waitMs = delay ? Math.ceil(Number(delay[1]) * 1000) : retryAfterMs(res);
    throw new SlotError(`Gemini ${res.status}: ${detail.slice(0, 200)}`, res.status, waitMs);
  }
  const json = await res.json();
  const parts: { text?: string }[] = json.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join("");
  if (!text) throw new SlotError(`Gemini returned no text (${json.candidates?.[0]?.finishReason || "empty"})`, 502);
  return text;
}

async function callOpenRouter(slot: Slot, req: AiRequest): Promise<string> {
  const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${slot.key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": siteUrl,
      "X-Title": "OJT Logbook Maker",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model: slot.model,
      temperature: req.temperature,
      // Never route to a paid endpoint.
      provider: { max_price: { prompt: 0, completion: 0 } },
      messages: [
        ...(req.system ? [{ role: "system", content: req.system }] : []),
        { role: "user", content: req.prompt },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new SlotError(`OpenRouter ${res.status}: ${detail.slice(0, 200)}`, res.status, retryAfterMs(res));
  }
  const json = await res.json();
  // OpenRouter can report upstream failures inside a 200 response.
  if (json.error) {
    const status = Number(json.error.code) || 502;
    throw new SlotError(`OpenRouter ${status}: ${String(json.error.message).slice(0, 200)}`, status);
  }
  const text: string = json.choices?.[0]?.message?.content || "";
  if (!text) throw new SlotError("OpenRouter returned no text", 502);
  return text;
}

function restFor(err: unknown): number {
  if (!(err instanceof SlotError)) return 0;
  if (err.status === 429) return err.retryAfterMs ?? RATE_LIMIT_REST_MS;
  if (err.status === 402) return NO_CREDIT_REST_MS;
  if (err.status === 401 || err.status === 403) return BAD_KEY_REST_MS;
  // Google reports a wrong key as a 400.
  if (err.status === 400 && /API key not valid|API_KEY_INVALID/i.test(err.message)) return BAD_KEY_REST_MS;
  return 0; // Timeouts, 5xx, bad output: just try the next slot.
}

/** Strips code fences and reasoning tags, and trims prose around the JSON. */
export function cleanJsonText(text: string): string {
  let s = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const first = s.search(/[[{]/);
  const last = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  return first >= 0 && last > first ? s.slice(first, last + 1) : s;
}

/**
 * Runs the request on the first slot that answers and whose output `parse`
 * accepts. Throws AiBusyError when every slot is rate limited.
 */
export async function generateWithPool<T>(req: AiRequest, parse: (text: string) => T): Promise<T> {
  const slots = buildSlots();
  if (!slots.length) throw new Error("No AI API key configured.");

  const deadline = Date.now() + MAX_WAIT_FOR_SLOT_MS;
  let lastError: unknown = null;

  for (;;) {
    let tried = 0;
    for (const slot of orderedSlots(slots)) {
      if ((restingUntil.get(slot.id) || 0) > Date.now()) continue;
      tried++;
      try {
        const text = slot.provider === "gemini" ? await callGemini(slot, req) : await callOpenRouter(slot, req);
        return parse(cleanJsonText(text));
      } catch (err) {
        lastError = err;
        const rest = restFor(err);
        if (rest) restingUntil.set(slot.id, Date.now() + rest);
        console.warn(`[ai:${req.label}] ${slot.provider} ${slot.model} failed:`, err instanceof Error ? err.message : err);
      }
    }

    // Some slot answered but failed for a non-limit reason: report it.
    const soonest = Math.min(...slots.map((s) => restingUntil.get(s.id) || 0));
    const waitMs = soonest - Date.now();
    if (tried > 0 && waitMs <= 0) break;
    if (waitMs <= 0) continue;
    if (Date.now() + waitMs > deadline) throw new AiBusyError(Math.ceil(waitMs / 1000));
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  throw lastError instanceof Error ? lastError : new Error("The AI couldn't produce a result. Please try again.");
}
