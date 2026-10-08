"use client";

import { syncClientIdentity, type ClientUser } from "@/lib/auth/client-identity";

export interface PendingGoogleSignup {
  pendingToken: string;
  profile: { name: string; email: string; picture: string | null };
}

export interface AuthResponse {
  error?: string;
  field?: string;
  user?: ClientUser;
  redirect?: string;
  needsMobile?: boolean;
  pendingToken?: string;
  profile?: PendingGoogleSignup["profile"];
  challengeToken?: string;
  debugCode?: string;
  message?: string;
}

export async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: AuthResponse }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as AuthResponse;
    if (!res.ok && !data.error) data.error = "Something went wrong. Please try again.";
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "You appear to be offline. Check your connection and try again." } };
  }
}

/** Stores the signed-in student for the dashboard pages and does a full navigation. */
export function finishAuth(user: ClientUser, next: string): void {
  syncClientIdentity(user);
  window.location.assign(next);
}
