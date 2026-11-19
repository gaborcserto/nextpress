import { describe, expect, it } from "vitest";

import { formatDatabaseTarget, resolveDatabase } from "./database-config";

describe("database configuration", () => {
  it("explains missing or invalid PostgreSQL URLs without echoing the value", () => {
    expect(() => resolveDatabase({})).toThrow("DATABASE_URL is not set");

    for (const [scenario, url] of [
      ["invalid URL syntax", "not a url"],
      ["non-PostgreSQL protocol", "https://db.example.test/cms"],
      ["missing hostname", "postgresql:///cms"],
      [
        "malformed password encoding",
        "postgresql://fixture:bad%zz@localhost/cms",
      ],
    ]) {
      expect(() => resolveDatabase({ DATABASE_URL: url }), scenario).toThrow(
        /^DATABASE_URL must be a valid PostgreSQL URL$/,
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
    { scenario: "a missing database name", suffix: "" },
    { scenario: "a socket host override", suffix: "/cms?host=/tmp" },
    { scenario: "a port override", suffix: "/cms?port=55434" },
    { scenario: "multiple schemas", suffix: "/cms?schema=public&schema=other" },
    { scenario: "an empty schema", suffix: "/cms?schema=" },
  ])("rejects $scenario", ({ suffix }) => {
    expect(() =>
      resolveDatabase({
        DATABASE_URL: `postgresql://fixture:secret@localhost${suffix}`,
      }),
    ).toThrow(
      /^DATABASE_URL must identify one PostgreSQL host, port, database and schema\./,
    );
  });
});
