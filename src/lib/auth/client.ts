"use client";

import { createAuthClient } from "@neondatabase/auth/next";

// Talks to Neon Auth through this app's /api/auth/[...path] proxy route.
export const authClient = createAuthClient();
