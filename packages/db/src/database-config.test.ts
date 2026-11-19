import { describe, expect, it } from "vitest";

import { formatDatabaseTarget, resolveDatabase } from "./database-config";

describe("database configuration", () => {
  it("requires a valid PostgreSQL URL without echoing the value", () => {
    expect(() => resolveDatabase({})).toThrow("DATABASE_URL is not set");

    for (const value of [
      "not a url",
      "https://db.example.test/cms",
      "postgresql:///cms",
      "postgresql://fixture:bad%zz@localhost/cms",
    ]) {
      expect(() => resolveDatabase({ DATABASE_URL: value })).toThrow(
        /valid PostgreSQL URL/,
      );
    }
  });

  it("accepts local development and production PostgreSQL URLs", () => {
    const local =
      "postgresql://postgres:postgres@localhost:5432/cms?schema=public";
    const production =
      "postgresql://app:secret@db.example.test:5432/cms?sslmode=require";
    expect(resolveDatabase({ DATABASE_URL: local }).connectionString).toBe(
      local,
    );
    expect(resolveDatabase({ DATABASE_URL: production }).connectionString).toBe(
      production,
    );
  });

  it("diagnoses the target without user information or unrelated query values", () => {
    const { target } = resolveDatabase({
      DATABASE_URL:
        "postgresql://fixture:hidden@localhost/db?schema=editorial&sslpassword=hidden",
    });
    expect(formatDatabaseTarget(target)).toBe(
      'localhost:5432/db (schema "editorial")',
    );
  });

  it.each([
    "",
    "?host=/tmp",
    "/cms?port=55434",
    "/cms?schema=public&schema=other",
    "/cms?schema=",
  ])("rejects an incomplete or ambiguous target (%s)", (suffix) => {
    expect(() =>
      resolveDatabase({
        DATABASE_URL: `postgresql://fixture:secret@localhost${suffix}`,
      }),
    ).toThrow(
      /^DATABASE_URL must identify one PostgreSQL host, port, database and schema\./,
    );
  });
});
