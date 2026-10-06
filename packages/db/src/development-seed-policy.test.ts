import { describe, expect, it } from "vitest";

import { assertDevelopmentSeedAllowed } from "./development-seed-policy";

describe("development content seed policy", () => {
  const local = { DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/cms?schema=public", ALLOW_DEVELOPMENT_CONTENT_SEED: "true" };

  it("requires explicit opt-in and always rejects production", () => {
    expect(() => assertDevelopmentSeedAllowed({ ...local, ALLOW_DEVELOPMENT_CONTENT_SEED: "" })).toThrow(/ALLOW_DEVELOPMENT_CONTENT_SEED/);
    expect(() => assertDevelopmentSeedAllowed({ ...local, NODE_ENV: "production", ALLOW_PRODUCTION_ADMIN_SEED: "true" })).toThrow(/disabled in production/);
    expect(() => assertDevelopmentSeedAllowed({ ...local, NODE_ENV: "development" })).not.toThrow();
  });

  it("rejects remote databases even when the environment is not marked production", () => {
    expect(() => assertDevelopmentSeedAllowed({ ...local, DATABASE_URL: "postgresql://user:pass@db.example.test:5432/cms" })).toThrow(/restricted to the local cms database/);
    expect(() => assertDevelopmentSeedAllowed({ ...local, DATABASE_URL: "postgresql://user:pass@localhost:5432/production" })).toThrow(/restricted to the local cms database/);
  });
});
