import path from "path";

import { adminSecurityHeaders } from "./src/lib/security/headers";

import type { NextConfig } from "next";

const monorepoRoot = path.resolve(__dirname, "..", "..");
const nextConfig: NextConfig = {
  agentRules: false,
  distDir: process.env.NEXTPRESS_E2E === "1" ? ".next-e2e" : ".next",
  poweredByHeader: false,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: adminSecurityHeaders(process.env.NODE_ENV === "production"),
      },
    ];
  },
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
