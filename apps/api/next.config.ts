import path from "node:path";

import type { NextConfig } from "next";
const monorepoRoot = path.resolve(__dirname, "../..");
const nextConfig: NextConfig = {
  distDir: process.env.NEXTPRESS_E2E === "1" ? ".next-e2e" : ".next",
  agentRules: false,
  poweredByHeader: false,
  output: "standalone",
  serverExternalPackages: ["swagger-ui-dist"],
  turbopack: { root: monorepoRoot },
  outputFileTracingRoot: monorepoRoot,
  // Native Sharp helpers (including Windows DLLs) are loaded outside JS imports.
  outputFileTracingIncludes: {
    "/api/media{,/**}": ["../../node_modules/@img/sharp-*/lib/**/*"],
    "/api/public/media/**": ["../../node_modules/@img/sharp-*/lib/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};
export default nextConfig;
