import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import turboConfig from "eslint-config-turbo/flat";

/** Build the shared TypeScript/Turborepo config. */
export function createBaseConfig({ registerPlugins = true } = {}) {
  const typescriptConfig = {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", disallowTypeAnnotations: false },
      ],
      "import/order": [
        "warn",
        {
          groups: [
            ["builtin", "external"],
            ["internal", "parent", "sibling", "index", "object", "type"],
          ],
          alphabetize: { order: "asc", caseInsensitive: true },
          "newlines-between": "always",
        },
      ],
      "import/no-duplicates": "warn",
    },
  };

  if (registerPlugins) {
    typescriptConfig.languageOptions = { parser: tsParser };
    typescriptConfig.plugins = {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
    };
  }

  return [{ ignores: ["coverage/**"] }, ...turboConfig, typescriptConfig];
}

const config = createBaseConfig();

export default config;
