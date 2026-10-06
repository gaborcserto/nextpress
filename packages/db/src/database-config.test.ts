import { describe, expect, it } from "vitest";

import { getDatabaseConnectionString } from "./database-config";

describe("database configuration", () => {
  it("requires a valid PostgreSQL URL without echoing the value", () => {
    expect(() => getDatabaseConnectionString({})).toThrow("DATABASE_URL is not set");
    for (const value of ["not a url", "https://db.example.test/cms", "postgresql:///cms"]) {
      expect(() => getDatabaseConnectionString({ DATABASE_URL: value })).toThrow(/valid PostgreSQL URL/);
    }
  });

  it("accepts local development and production PostgreSQL URLs", () => {
    const local = "postgresql://postgres:postgres@localhost:5432/cms?schema=public";
    const production = "postgresql://app:secret@db.example.test:5432/cms?sslmode=require";
    expect(getDatabaseConnectionString({ DATABASE_URL: local })).toBe(local);
    expect(getDatabaseConnectionString({ DATABASE_URL: production })).toBe(production);
  });
});
