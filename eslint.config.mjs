import config from "@nextpress/eslint-config/base";

export default [
  ...config,
  {
    files: ["scripts/check-changed.mjs"],
    // This uncached entry point runs outside Turbo and reads CI's own metadata.
    rules: { "turbo/no-undeclared-env-vars": "off" },
  },
];
