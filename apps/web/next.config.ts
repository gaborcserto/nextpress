import type { NextConfig } from "next";
import path from "path";

const monorepoRoot = path.resolve(__dirname, "..", "..");
const nextConfig: NextConfig = {
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
