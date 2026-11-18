import tsParser from "@typescript-eslint/parser";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import reactHooks from "eslint-plugin-react-hooks";

import { createBaseConfig } from "./base.js";

/**
 * Shared ESLint config for Next.js apps.
 * Extends the neutral TypeScript/Turborepo base with Next.js and React rules.
 */
const config = [
  { ignores: ["public/**"] },
  ...createBaseConfig({ registerPlugins: false }),
  ...nextCoreWebVitals,
  // Next's TS override covers .ts/.tsx; config modules need the TS parser too.
  { files: ["**/*.{mts,cts}"], languageOptions: { parser: tsParser } },
  // Next's preset omits CommonJS, but the explicit Hooks policy covers it.
  { files: ["**/*.cjs"], plugins: { "react-hooks": reactHooks } },
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/purity": "error",
    },
  },
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
];

export default config;
