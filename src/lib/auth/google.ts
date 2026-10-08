import { GOOGLE_CLIENT_ID } from "./config";
import { signToken, verifyToken } from "./tokens";

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
}

const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

/**
 * Verifies a Google Identity Services ID token with Google's tokeninfo
 * endpoint, and checks that it was issued for this app's client ID.
 */
export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Google sign-in expired. Please try again.");

  const info = await res.json();
  if (info.aud !== GOOGLE_CLIENT_ID) throw new Error("This Google sign-in was not issued for this app.");
  if (!GOOGLE_ISSUERS.has(info.iss)) throw new Error("Unrecognised Google token issuer.");
  if (Number(info.exp) * 1000 < Date.now()) throw new Error("Google sign-in expired. Please try again.");
  if (!(info.email_verified === "true" || info.email_verified === true)) {
    throw new Error("Your Google account email is not verified.");
  }

  const email = String(info.email || "").toLowerCase().trim();
  return {
    sub: String(info.sub),
    email,
    name: String(info.name || info.given_name || email.split("@")[0]),
    picture: info.picture ? String(info.picture) : null,
  };
}

interface PendingGooglePayload extends GoogleProfile {
  typ: "google_pending";
  exp: number;
}

/** A 15 minute token that lets a new Google user finish sign up by adding a mobile number. */
export function createPendingGoogleToken(profile: GoogleProfile): string {
  return signToken({ ...profile, typ: "google_pending", exp: Math.floor(Date.now() / 1000) + 15 * 60 });
}

export function readPendingGoogleToken(token: unknown): GoogleProfile | null {
  const payload = verifyToken<PendingGooglePayload>(typeof token === "string" ? token : null, "google_pending");
  if (!payload) return null;
  return { sub: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
}
