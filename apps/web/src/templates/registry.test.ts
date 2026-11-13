import { expect, it } from "vitest";

import { resolveWebsiteTemplate, websiteTemplates } from "./registry";

it("registers Blog with all implemented presets", () => {
  expect(websiteTemplates.map(({ id, presets }) => ({ id, presets }))).toEqual([
    { id: "blog", presets: ["classic", "modern", "minimal"] },
  ]);
  expect(Object.keys(resolveWebsiteTemplate().views)).toEqual([
    "Shell",
    "Home",
    "Archive",
    "Tags",
    "Post",
    "Page",
  ]);
});
it.each([undefined, "corporate", "../../code", {}, ["blog"]])(
  "falls back to Blog for %j",
  (identity) => {
    expect(resolveWebsiteTemplate(identity).id).toBe("blog");
  },
);
it.each([undefined, "obsolete", {}, ["classic"]])(
  "falls back to Classic for %j",
  (preset) => {
    expect(resolveWebsiteTemplate("blog", preset).stylePreset).toBe("classic");
  },
);

it.each(["classic", "modern", "minimal"])(
  "resolves %s with shared Blog views",
  (preset) => {
    expect(resolveWebsiteTemplate("blog", preset).stylePreset).toBe(preset);
    expect(resolveWebsiteTemplate("blog", preset).views).toEqual(
      resolveWebsiteTemplate().views,
    );
  },
);
