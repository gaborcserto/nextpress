import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import turboConfig from "eslint-config-turbo/flat";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

/** Build the shared TypeScript/Turborepo config. */
export function createBaseConfig({ registerPlugins = true } = {}) {
  const typescriptConfig = {
    files: ["**/*.{ts,tsx}"],
    rules: {
      ...tsPlugin.configs["eslint-recommended"].overrides[0].rules,
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", disallowTypeAnnotations: false },
      ],
      "import/order": [
        "error",
        {
          groups: [
            ["builtin", "external"],
            ["internal"],
            ["parent", "sibling", "index", "object"],
            ["type"],
          ],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          pathGroupsExcludedImportTypes: ["builtin"],
          alphabetize: { order: "asc", caseInsensitive: true },
          "newlines-between": "always",
          sortTypesGroup: true,
          "newlines-between-types": "always",
        },
      ],
      "import/no-duplicates": "error",
    },
  };

  if (registerPlugins) {
    typescriptConfig.languageOptions = { parser: tsParser };
    typescriptConfig.plugins = {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
    };
  }

  const javascriptConfig = {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "import/order": typescriptConfig.rules["import/order"],
      "import/no-duplicates": "error",
    },
  };

  if (registerPlugins) javascriptConfig.plugins = { import: importPlugin };

  return [
    { ignores: ["coverage/**"] },
    {
      files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],

      rules: {
        ...js.configs.recommended.rules,
      },
    },
    {
      files: ["**/*.{js,mjs,cjs}"],
      languageOptions: { globals: globals.node },
    },
    ...turboConfig,
    javascriptConfig,
    typescriptConfig,
    {
      ...typescriptConfig,
      files: ["**/*.{mts,cts}"],
      languageOptions: { parser: tsParser },
      plugins: { "@typescript-eslint": tsPlugin, import: importPlugin },
    },
  ];
}

const config = createBaseConfig();

export default config;
