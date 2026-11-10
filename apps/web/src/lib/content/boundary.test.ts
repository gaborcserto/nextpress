// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps web source and manifest free of backend dependencies, including type imports", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
  );
  expect(Object.keys(manifest.dependencies)).not.toContain("@nextpress/db");
  const root = new URL("../../", import.meta.url);

  for (const file of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    if (!/\.[cm]?[jt]sx?$/.test(file) || file.includes(".test.")) continue;
    expect(
      readFileSync(new URL(file.replaceAll("\\", "/"), root), "utf8"),
      file,
    ).not.toMatch(
      /@nextpress\/db|@prisma\/|generated\/prisma|apps\/(api|admin)\/|DATABASE_URL|BETTER_AUTH_SECRET/,
    );
  }
});
