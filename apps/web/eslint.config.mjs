import config from "@nextpress/eslint-config/next";

const workspaceConfig = [
  ...config,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@nextpress/db",
                "@nextpress/db/**",
                "@prisma/**",
                "**/generated/prisma/**",
                "**/packages/db/**",
                "better-auth",
                "better-auth/**",
                "api",
                "api/**",
                "admin",
                "admin/**",
                "**/apps/api/**",
                "**/apps/admin/**",
                "**/api/src/**",
                "**/admin/src/**",
              ],
              message:
                "Web consumes portable shared contracts and the public HTTP API only.",
            },
          ],
        },
      ],
    },
  },
];

export default workspaceConfig;
