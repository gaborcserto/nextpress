import config from "@nextpress/eslint-config/base";

const workspaceConfig = [
  ...config,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["react", "react/**", "react-dom", "react-dom/**", "next", "next/**", "slate", "slate-*", "@nextpress/db", "@nextpress/db/**", "**/apps/**"], message: "Shared contracts must remain framework-neutral and independent of persistence and applications." },
      ] }],
    },
  },
];

export default workspaceConfig;
