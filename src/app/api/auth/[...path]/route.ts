import { auth } from "@/lib/auth/server";

// Proxies every Neon Auth call (sign in/up, Google callback, session,
// email codes, password reset) to the project's Neon Auth server.
export const { GET, POST } = auth.handler();
