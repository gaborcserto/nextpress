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
    expect(() => assertDevelopmentSeedAllowed({ ...local, DATABASE_URL: "postgresql://user:pass@db.example.test:5432/cms" })).toThrow(/restricted to local/);
    expect(() => assertDevelopmentSeedAllowed({ ...local, DATABASE_URL: "postgresql://user:pass@localhost:5432/production" })).toThrow(/restricted to local/);
  });

  it("allows explicitly opted-in local verification databases", () => {
    expect(() => assertDevelopmentSeedAllowed({ ...local, DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/nextpress_dev_verify_1452_a1b2" })).not.toThrow();
  });

  it.each(["nextpress_dev_verify_", "nextpress_dev_verify", "nextpress_dev_verify_bad-name", "arbitrary"])("rejects database name %s", (name) => {
    expect(() => assertDevelopmentSeedAllowed({ ...local, DATABASE_URL: `postgresql://user:pass@localhost:5432/${name}` })).toThrow(/restricted to local/);
  });

  it("preserves production, remote, and opt-in restrictions for verification databases", () => {
    const verification = { ...local, DATABASE_URL: "postgresql://user:pass@localhost:5432/nextpress_dev_verify_policy" };
    expect(() => assertDevelopmentSeedAllowed({ ...verification, NODE_ENV: "production" })).toThrow(/disabled in production/);
    expect(() => assertDevelopmentSeedAllowed({ DATABASE_URL: verification.DATABASE_URL })).toThrow(/ALLOW_DEVELOPMENT_CONTENT_SEED/);
    expect(() => assertDevelopmentSeedAllowed({ ...verification, DATABASE_URL: "postgresql://user:pass@remote.example.test:5432/nextpress_dev_verify_policy" })).toThrow(/restricted to local/);
    expect(() => assertDevelopmentSeedAllowed({ ...verification, DATABASE_URL: "https://localhost/nextpress_dev_verify_policy" })).toThrow(/restricted to local/);
  });
});
