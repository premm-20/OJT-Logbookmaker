import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { clientIp } from "@/lib/auth/client-ip";
import { rateLimit } from "@/lib/auth/rate-limit";
import { normalizeEmail } from "@/lib/auth/config";
import { ensureSubmissionsTable } from "@/lib/submissions-db";
import { PRD_MAX_FILE_BYTES, PRD_MAX_TEXT_CHARS } from "@/lib/prd-limits";

const DETAIL_KEYS = [
  "registration_number",
  "program_name",
  "semester",
  "location",
  "industry_partner_name",
  "phone_number",
  "department",
  "designation",
  "ojt_start_date",
  "ojt_end_date",
  "start_time",
  "end_time",
] as const;

/**
 * Saves one logbook request (multipart): mode, name, email, details (JSON),
 * customPrompt, pastedText, prdText, file?. Every call adds a new row.
 */
export async function POST(request: Request) {
  try {
    const limit = rateLimit(`submission:${clientIp(request)}`, 60, 60 * 60 * 1000);
    if (!limit.ok) return NextResponse.json({ error: "Too many submissions." }, { status: 429 });

    const form = await request.formData();
    const str = (k: string, max: number) => String(form.get(k) || "").trim().slice(0, max);
    const mode = str("mode", 20) === "paste" ? "paste" : "prd";
    const name = str("name", 120).replace(/\s+/g, " ");
    const email = normalizeEmail(form.get("email")).slice(0, 200);
    let raw: Record<string, unknown> = {};
    try {
      raw = JSON.parse(String(form.get("details") || "{}"));
    } catch {
      // Bad details: keep the rest.
    }
    const details = Object.fromEntries(DETAIL_KEYS.map((k) => [k, typeof raw[k] === "string" ? (raw[k] as string).trim().slice(0, 200) : ""]));
    const customPrompt = str("customPrompt", 2000);
    const pastedText = str("pastedText", PRD_MAX_TEXT_CHARS);
    const prdText = str("prdText", PRD_MAX_TEXT_CHARS);
    const file = form.get("file");

    if (!name && !email && !pastedText && !prdText) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

    let b64: string | null = null;
    let fileName = str("fileName", 200);
    let mimeType = "";
    let sizeBytes = 0;
    if (file instanceof File) {
      if (file.size > PRD_MAX_FILE_BYTES) return NextResponse.json({ error: "File too large." }, { status: 413 });
      b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      fileName = fileName || file.name.slice(0, 200);
      mimeType = file.type || "";
      sizeBytes = file.size;
    }

    await ensureSubmissionsTable();
    const id = `sub_${randomUUID()}`;
    await getDb()`
      INSERT INTO logbook_submissions
        (id, mode, name, email, details, custom_prompt, pasted_text, prd_file_name, prd_mime_type, prd_size_bytes, prd_text, prd_file)
      VALUES (
        ${id}, ${mode}, ${name}, ${email}, ${JSON.stringify(details)}::jsonb, ${customPrompt}, ${pastedText},
        ${fileName}, ${mimeType}, ${sizeBytes}, ${prdText}, decode(${b64}::text, 'base64')
      )
    `;
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[submissions]", err);
    return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  }
}
