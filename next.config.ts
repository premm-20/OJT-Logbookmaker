import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These are Node.js-only packages used in API routes.
  // Turbopack/webpack cannot bundle them — they must run natively on the server.
  serverExternalPackages: ["mammoth", "pdf-parse"],
};

export default nextConfig;
