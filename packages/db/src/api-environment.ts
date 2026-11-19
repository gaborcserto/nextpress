import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";

export function loadApiEnvironment(
  development = process.env.NODE_ENV !== "production",
) {
  let failed = false;

  loadEnvConfig(resolve(__dirname, "../../../apps/api"), development, {
    info() {},
    error() {
      failed = true;
    },
  });

  if (failed) {
    throw new Error(
      "Could not load the API environment. Check the syntax and permissions of apps/api/.env files.",
    );
  }
}
