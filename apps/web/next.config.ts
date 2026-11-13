import path from "path";

import { webSecurityHeaders } from "./src/lib/security/headers";

import type { NextConfig } from "next";

const monorepoRoot = path.resolve(__dirname, "..", "..");
const nextConfig: NextConfig = {
  agentRules: false,
  distDir: process.env.NEXTPRESS_E2E === "1" ? ".next-e2e" : ".next",
  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/live-preview",
        headers: webSecurityHeaders(process.env.NODE_ENV === "production")
          .filter((header) => header.key !== "X-Frame-Options")
          .map((header) =>
            header.key === "Content-Security-Policy"
              ? {
                  ...header,
                  value: header.value.replace(
                    "frame-ancestors 'none'",
                    process.env.PREVIEW_ADMIN_ORIGIN
                      ? `frame-ancestors ${new URL(process.env.PREVIEW_ADMIN_ORIGIN).origin}`
                      : "frame-ancestors 'none'",
                  ),
                }
              : header,
          ),
      },
      {
        source: "/((?!live-preview$).*)",
        headers: webSecurityHeaders(process.env.NODE_ENV === "production"),
      },
    ];
  },
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
