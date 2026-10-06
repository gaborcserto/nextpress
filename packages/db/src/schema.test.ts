import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Prisma schema", () => {
  it("uses PostgreSQL without connecting to a database", async () => {
    const schemaUrl = new URL("../prisma/schema.prisma", import.meta.url);
    const schema = await readFile(schemaUrl, "utf8");

    expect(schema).toMatch(/provider\s*=\s*"postgresql"/);
  });

  it("keeps Better Auth's refresh token expiry field mapped through a migration", async () => {
    const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
    const auth = await readFile(new URL("../../../apps/admin/src/lib/auth/auth-server.ts", import.meta.url), "utf8");
    const migration = await readFile(new URL("../prisma/migrations/20261006120000_add_refresh_token_expiry/migration.sql", import.meta.url), "utf8");

    expect(schema).toMatch(/refresh_token_expires_at\s+DateTime\?/);
    expect(auth).toMatch(/refreshTokenExpiresAt:\s*"refresh_token_expires_at"/);
    expect(migration).toMatch(/ADD COLUMN "refresh_token_expires_at" TIMESTAMP\(3\)/);
  });
});
