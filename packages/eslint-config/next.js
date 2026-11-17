import tsParser from "@typescript-eslint/parser";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

import { createBaseConfig } from "./base.js";

/**
 * Shared ESLint config for Next.js apps.
 * Extends the neutral TypeScript/Turborepo base with Next.js and React rules.
 */
const config = [
  { ignores: [".next-e2e/**"] },
  ...createBaseConfig({ registerPlugins: false }),
  ...nextCoreWebVitals,
  // Next's TS override covers .ts/.tsx; config modules need the TS parser too.
  { files: ["**/*.{mts,cts}"], languageOptions: { parser: tsParser } },
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/purity": "error",
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
];

export default config;
