import config from "@nextpress/eslint-config/next";

const workspaceConfig = [
  ...config,
  ...["components", "primitives", "shell"].map((section) => ({
    files: [`src/ui/${section}/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}`],
    rules: {
      // Importing the containing umbrella can route a module back into itself.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
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
