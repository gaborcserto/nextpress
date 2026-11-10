import tsParser from "@typescript-eslint/parser";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

import { createBaseConfig } from "./base.js";

/**
 * Shared ESLint config for Next.js apps (admin + web).
 * Extends the neutral TypeScript/Turborepo base with Next.js and React rules.
 */
const config = [
  { ignores: [".next-e2e/**"] },
  ...createBaseConfig({ registerPlugins: false }),
  ...nextCoreWebVitals,
  // Next's TS override covers .ts/.tsx; config modules need the TS parser too.
  { files: ["**/*.{mts,cts}"], languageOptions: { parser: tsParser } },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
];

export default config;
