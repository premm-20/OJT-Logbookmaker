import { createNeonAuth } from "@neondatabase/auth/next/server";

/**
 * Neon Auth (Managed Better Auth). Accounts, passwords, Google sign-in,
 * email verification and password reset all live in Neon; this app only
 * keeps the link from a Neon user to its `usr_<mobile>` logbook account.
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    // Lax so the session survives the redirect back from Google.
    sameSite: "lax",
  },
});
