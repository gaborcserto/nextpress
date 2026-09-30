import path from "path";

import type { NextConfig } from "next";

const monorepoRoot = path.resolve(__dirname, "..", "..");
const nextConfig: NextConfig = {
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
