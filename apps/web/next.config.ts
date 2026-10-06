import path from "path";

import { webSecurityHeaders } from "./src/lib/security/headers";
import type { NextConfig } from "next";

const monorepoRoot = path.resolve(__dirname, "..", "..");
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: webSecurityHeaders(process.env.NODE_ENV === "production") }];
  },
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
