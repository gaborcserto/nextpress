import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Prisma schema", () => {
  it("uses PostgreSQL without connecting to a database", async () => {
    const schemaUrl = new URL("../prisma/schema.prisma", import.meta.url);
    const schema = await readFile(schemaUrl, "utf8");

    expect(schema).toMatch(/provider\s*=\s*"postgresql"/);
  });

  it("adds default-visible menu state without changing existing items", async () => {
    const schema = await readFile(
      new URL("../prisma/schema.prisma", import.meta.url),
      "utf8",
    );

    const migration = await readFile(
      new URL(
        "../prisma/migrations/20261125100000_navigation_item_visibility/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(schema).toMatch(/visible\s+Boolean\s+@default\(true\)/);
    expect(migration).toMatch(
      /ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT true/,
    );
  });

  it("guards singleton Homepage migration against existing conflicting records", async () => {
    const migration = await readFile(
      new URL(
        "../prisma/migrations/20261124110000_singleton_homepage/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toMatch(/HAVING COUNT\(\*\) > 1/);
    expect(migration).toMatch(/RAISE EXCEPTION/);
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "Page_homepage_singleton_key"[\s\S]*WHERE "type" = 'PAGE' AND "layout" = 'HOME'/,
    );
    expect(migration).not.toMatch(/DELETE FROM|UPDATE "Page"/);
  });

  it("reconciles only untouched seeded Home and Posts links when matching pages exist", async () => {
    const migration = await readFile(
      new URL(
        "../prisma/migrations/20261124120000_reconcile_default_menu_pages/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toMatch(/"menuId" = 'initial-header'/);
    expect(migration).toMatch(/"id" = 'home'[\s\S]*"value" = '\/'/);
    expect(migration).toMatch(/"layout" = 'HOME'/);
    expect(migration).toMatch(/"id" = 'posts'[\s\S]*"value" = '\/posts'/);
    expect(migration).toMatch(
      /"layout" = 'POSTS'[\s\S]*HAVING COUNT\(\*\) = 1/,
    );
    expect(migration).toMatch(/"kind" = 'internal'[\s\S]*"label" = ''/);
    expect(migration).not.toMatch(/DELETE FROM/);
  });

  it("keeps Better Auth's refresh token expiry field mapped through a migration", async () => {
    const schema = await readFile(
      new URL("../prisma/schema.prisma", import.meta.url),
      "utf8",
    );

    const auth = await readFile(
      new URL("../../../apps/api/src/lib/auth/auth-server.ts", import.meta.url),
      "utf8",
    );

    const migration = await readFile(
      new URL(
        "../prisma/migrations/20261006120000_add_refresh_token_expiry/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(schema).toMatch(/refresh_token_expires_at\s+DateTime\?/);
    expect(auth).toMatch(/refreshTokenExpiresAt:\s*"refresh_token_expires_at"/);
    expect(migration).toMatch(
      /ADD COLUMN "refresh_token_expires_at" TIMESTAMP\(3\)/,
    );
  });
});
