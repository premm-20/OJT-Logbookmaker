import { neon } from "@neondatabase/serverless";

/**
 * Neon PostgreSQL Serverless Client
 * Works across Vercel, Railway, and local development.
 */
export function getDb() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_Z3qxVFv5lrai@ep-long-feather-b59jje5f-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

  return neon(connectionString);
}
