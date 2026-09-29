import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Prisma schema", () => {
  it("uses PostgreSQL without connecting to a database", async () => {
    const schemaUrl = new URL("../prisma/schema.prisma", import.meta.url);
    const schema = await readFile(schemaUrl, "utf8");

    expect(schema).toMatch(/provider\s*=\s*"postgresql"/);
  });
});
