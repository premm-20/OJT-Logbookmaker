import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These are Node.js-only packages used in API routes.
  // Turbopack/webpack cannot bundle them — they must run natively on the server.
  serverExternalPackages: ["mammoth", "pdf-parse"],
  images: {
    // Google account profile photos
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
