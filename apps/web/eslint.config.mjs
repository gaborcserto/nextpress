import config from "@nextpress/eslint-config/next";

const workspaceConfig = [
  ...config,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["admin", "admin/**", "**/apps/admin/**", "**/admin/src/**"], message: "Public code must not import admin implementation." },
      ] }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/content/*.server.ts", "src/lib/content/*.server.test.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["admin", "admin/**", "**/apps/admin/**", "**/admin/src/**"], message: "Public code must not import admin implementation." },
        { group: ["@nextpress/db", "@nextpress/db/**"], message: "Use the published-content boundary in lib/content instead of database records." },
      ] }],
    },
  },
];

export default workspaceConfig;
