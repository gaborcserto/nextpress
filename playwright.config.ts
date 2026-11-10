import { defineConfig } from "@playwright/test";
import * as path from "node:path";

const productionArtifact = process.env.NEXTPRESS_E2E_WEB_ARTIFACT;

const environment = {
  NEXTPRESS_E2E: "1",
  API_INTERNAL_ORIGIN: "http://localhost:49202",
  BETTER_AUTH_URL: "http://localhost:49201",
  NEXT_PUBLIC_BETTER_AUTH_URL: "http://localhost:49201",
  NEXT_PUBLIC_ADMIN_URL: "http://localhost:49201",
  SITE_URL: "http://localhost:49200",
};

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://localhost:49201", trace: "retain-on-failure" },
  webServer: ["api", "admin", "web"].map((app, index) => ({
    command:
      app === "web" && productionArtifact
        ? `node "${path.join(productionArtifact, "apps/web/server.js")}"`
        : `node ../../node_modules/next/dist/bin/next dev --hostname localhost --port ${[49202, 49201, 49200][index]}`,
    cwd: `apps/${app}`,
    url: `http://localhost:${[49202, 49201, 49200][index]}${app === "api" ? "/api/health" : app === "admin" ? "/auth/sign-in" : ""}`,
    env: {
      ...environment,
      HOSTNAME: "localhost",
      PORT: String([49202, 49201, 49200][index]),
      NEXTPRESS_E2E: app === "web" && productionArtifact ? "0" : "1",
      NODE_ENV:
        app === "web" && productionArtifact ? "production" : "development",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  })),
});
