import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_NEON_AUTH_URL ||
    "https://ep-long-feather-b59jje5f.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth",
});
