// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps the admin free of database dependencies, backend implementation and secret configuration", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
  );
  expect(Object.keys(manifest.dependencies)).not.toContain("@nextpress/db");
  const root = new URL("../../", import.meta.url);
  const forbidden =
    /@nextpress\/db|@prisma\/|generated\/prisma|apps\/api\/|api\/src\/|BETTER_AUTH_SECRET|DATABASE_URL|CLIENT_SECRET/;
  for (const file of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    if (!/\.[cm]?[jt]sx?$/.test(file) || file.includes(".test.")) continue;
    expect(
      readFileSync(new URL(file.replaceAll("\\", "/"), root), "utf8"),
      file,
    ).not.toMatch(forbidden);
  }
});
