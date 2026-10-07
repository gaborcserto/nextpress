import { describe, expect, it } from "vitest";

import { compiledSkins, defaultSkin, resolveSkin } from "./skin";

describe("compiled skin resolution", () => {
  it("registers only the existing default skin", () => {
    expect(compiledSkins).toEqual([{ id: "default" }]);
    expect(resolveSkin("default")).toBe(defaultSkin);
  });

  it.each([
    undefined, null, "", "unknown", "removed-skin", "Default", " default ",
    "../skins/custom.css", "__proto__", "constructor", 0, false, {},
    { id: "default" }, ["default"],
  ])("uses the compiled default for an unavailable or malformed identity %j", (identity) => {
    expect(resolveSkin(identity)).toBe(defaultSkin);
  });
});
