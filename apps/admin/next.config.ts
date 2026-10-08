import path from "path";

import { adminSecurityHeaders } from "./src/lib/security/headers";
import type { NextConfig } from "next";

const monorepoRoot = path.resolve(__dirname, "..", "..");
const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["swagger-ui-dist"],
  async headers() {
    return [{ source: "/:path*", headers: adminSecurityHeaders(process.env.NODE_ENV === "production") }];
  },
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
