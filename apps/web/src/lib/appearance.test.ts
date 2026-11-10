import { describe, expect, it } from "vitest";

import { publicAppearance, resolvePublicAppearance } from "./appearance";

describe("compiled public appearance", () => {
  it("preserves defaults", () => {
    expect(publicAppearance).toEqual({
      theme: "default",
      template: "default",
      colorMode: "light",
    });
  });
  it.each([undefined, null, [], "dark", { path: "evil.js" }])(
    "falls back for malformed config %j",
    (input) => {
      expect(resolvePublicAppearance(input)).toEqual(publicAppearance);
    },
  );
  it.each(["light", "dark", "system"])(
    "supports %s independently of template",
    (colorMode) => {
      expect(
        resolvePublicAppearance({ template: "compact", colorMode }),
      ).toEqual({ theme: "default", template: "compact", colorMode });
    },
  );
  it.each([
    "../../evil",
    "<script>",
    "url(javascript:alert(1))",
    {},
    ["compact"],
  ])("never interprets identifiers %j", (value) => {
    expect(
      resolvePublicAppearance({
        theme: value,
        template: value,
        colorMode: value,
      }),
    ).toEqual(publicAppearance);
  });
});
