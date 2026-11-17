import { NextResponse } from "next/server";
import { generateWithPool, NO_USER_KEY_ERROR, userAiKeyFrom } from "@/lib/ai";
import { clientIp } from "@/lib/auth/client-ip";
import { rateLimit } from "@/lib/auth/rate-limit";

/** Checks that the user's pasted key works with one tiny request. */
export async function POST(req: Request) {
  const limit = rateLimit(`ai-key-test:${clientIp(req)}`, 20, 60 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ ok: false, error: "Too many checks. Try again later." }, { status: 429 });

  const userKey = userAiKeyFrom(req);
  if (!userKey) return NextResponse.json({ ok: false, error: NO_USER_KEY_ERROR }, { status: 400 });
  try {
    await generateWithPool(
      { prompt: 'Reply with the JSON {"ok": true}', temperature: 0, json: true, fast: true, label: "key-test", userKey, deadline: Date.now() + 25_000 },
      (text) => text
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "The key didn't work." }, { status: 400 });
  }
}
