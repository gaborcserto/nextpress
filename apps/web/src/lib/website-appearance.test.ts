import { expect, it } from "vitest";

import { resolveWebsiteAppearance } from "./website-appearance";

it.each([
  undefined,
  {},
  { websiteTemplate: "obsolete", stylePreset: "modern", colorMode: "invalid" },
])("resolves safe local Blog defaults for %j", (input) => {
  expect(resolveWebsiteAppearance(input)).toMatchObject({
    websiteTemplate: "blog",
    stylePreset: "classic",
    colorMode: "light",
    listVariant: "default",
  });
});
it("preserves saved mode independently of unavailable preset", () => {
  expect(
    resolveWebsiteAppearance({
      websiteTemplate: "blog",
      stylePreset: "unavailable",
      colorMode: "system",
    }),
  ).toMatchObject({
    websiteTemplate: "blog",
    stylePreset: "classic",
    colorMode: "system",
    listVariant: "default",
  });
});
