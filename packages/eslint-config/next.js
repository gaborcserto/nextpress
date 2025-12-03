import turboConfig from "eslint-config-turbo/flat";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/**
 * Shared ESLint config for Next.js apps (admin + web).
 * Uses flat config arrays from eslint-config-turbo and eslint-config-next.
 */
export default [
  // Turborepo recommended rules
  ...turboConfig,

  // Next.js + React + TypeScript + a11y rules
  ...nextCoreWebVitals,

  // Extra shared rules for all JS/TS files
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      // TypeScript
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", disallowTypeAnnotations: false }
      ],

      // Imports
      "import/order": [
        "warn",
        {
          groups: [
            ["builtin", "external"],
            ["internal", "parent", "sibling", "index", "object", "type"]
          ],
          alphabetize: { order: "asc", caseInsensitive: true },
          "newlines-between": "always"
        }
      ],
      "import/no-duplicates": "warn",

      // JSX formatting
      "react/jsx-max-props-per-line": [
        "error",
        { maximum: 1, when: "multiline" }
      ],
      "react/jsx-first-prop-new-line": [
        "error",
        "multiline-multiprop"
      ],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // React 17+ automatic runtime
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off"
    }
  }
];
