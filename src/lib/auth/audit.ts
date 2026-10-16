import { touchLastLogin } from "./users";
import type { SessionUser } from "./session";

// Neon sessions seen by this server instance, so the time is written once per
// session rather than on every dashboard render.
const recorded = new Set<string>();

/**
 * Updates the student's last sign-in time. Only that one timestamp is kept;
 * no login history is stored. Never throws.
 */
export async function auditLogin(user: SessionUser, sessionId: string): Promise<void> {
  if (recorded.has(sessionId)) return;
  recorded.add(sessionId);
  if (recorded.size > 10000) recorded.clear();

  try {
    await touchLastLogin(user.id);
  } catch (err) {
    console.warn("[auth] Could not update last sign-in:", err);
  }
}
