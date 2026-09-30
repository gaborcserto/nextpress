import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

import { createBaseConfig } from "./base.js";

/**
 * Shared ESLint config for Next.js apps (admin + web).
 * Extends the neutral TypeScript/Turborepo base with Next.js and React rules.
 */
const config = [
  ...createBaseConfig({ registerPlugins: false }),
  ...nextCoreWebVitals,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "react/jsx-max-props-per-line": [
        "error",
        { maximum: 1, when: "multiline" },
      ],
      "react/jsx-first-prop-new-line": ["error", "multiline-multiprop"],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
];

export default config;
