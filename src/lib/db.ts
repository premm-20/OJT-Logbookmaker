import { neon } from "@neondatabase/serverless";

/**
 * Neon PostgreSQL Serverless Client
 * Works across Vercel, Railway, and local development.
 */
export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon connection string to .env.local (or your hosting provider's environment settings)."
    );
  }

  return neon(connectionString);
}
