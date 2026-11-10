import config from "@nextpress/eslint-config/next";

const backendImports = {
  group: [
    "@nextpress/db",
    "@nextpress/db/**",
    "@prisma/**",
    "**/generated/prisma/**",
    "**/apps/api/**",
    "**/api/src/**",
    "@/lib/repos/**",
    "@/lib/services/*.server",
    "@/lib/auth/auth-server",
  ],
  message: "Admin consumes backend operations through HTTP only.",
};

const workspaceConfig = [
  ...config,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [backendImports],
        },
      ],
    },
  },
  ...["components", "primitives", "shell"].map((section) => ({
    files: [`src/ui/${section}/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}`],
    rules: {
      // Importing the containing umbrella can route a module back into itself.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            backendImports,
            {
              regex: `^@/ui/${section}(?:/index(?:[.][cm]?[jt]sx?)?)?/?$`,
              message:
                "Use relative imports within your component/feature or another module's explicit public entry point; do not import this section's umbrella barrel from inside it.",
            },
          ],
        },
      ],
    },
  })),
];

export default workspaceConfig;
