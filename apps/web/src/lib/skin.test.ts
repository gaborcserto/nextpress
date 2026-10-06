import { describe, expect, expectTypeOf, it } from "vitest";

import {
  activeSkin,
  defaultSkin,
  resolveColorMode,
  type PublicSkin,
  type SkinColorMode,
} from "./skin";

describe("public skin color modes", () => {
  it("uses the default skin and preserves the initial light appearance", () => {
    expect(activeSkin).toBe(defaultSkin);
    expect(activeSkin.id).toBe("default");
    expect(resolveColorMode(activeSkin)).toBe("light");
  });

  it.each(["light", "dark", "system"])(
    "accepts the default skin's supported %s preference",
    (preference) => {
      expect(resolveColorMode(defaultSkin, preference)).toBe(preference);
    },
  );

  it.each([undefined, null, "sepia", "Dark", {}, ["dark"]])(
    "falls back for an invalid preference %j",
    (preference) => {
      expect(resolveColorMode(defaultSkin, preference)).toBe("light");
    },
  );

  it.each([
    { capability: { kind: "fixed" }, expected: undefined },
    { capability: { kind: "light-only" }, expected: "light" },
    { capability: { kind: "dark-only" }, expected: "dark" },
  ] satisfies { capability: SkinColorMode; expected: string | undefined }[])(
    "ignores preferences for a $capability.kind skin",
    ({ capability, expected }) => {
      const skin: PublicSkin = { id: "single-appearance", colorMode: capability };
      for (const preference of [undefined, "light", "dark", "system", "invalid"]) {
        expect(resolveColorMode(skin, preference)).toBe(expected);
      }
    },
  );

  it("allows switching without requiring system support", () => {
    const skin: PublicSkin = {
      id: "manual-modes",
      colorMode: {
        kind: "switchable",
        supportsSystem: false,
        defaultPreference: "dark",
      },
    };
    expect(resolveColorMode(skin)).toBe("dark");
    expect(resolveColorMode(skin, "system")).toBe("dark");
    expect(resolveColorMode(skin, "light")).toBe("light");
    expect(resolveColorMode(skin, "dark")).toBe("dark");
  });

  it("leaves a system default to CSS rather than guessing the OS on the server", () => {
    const skin: PublicSkin = {
      id: "system-default",
      colorMode: {
        kind: "switchable",
        supportsSystem: true,
        defaultPreference: "system",
      },
    };
    expect(resolveColorMode(skin)).toBe("system");
    expect(resolveColorMode(skin, "invalid")).toBe("system");
    expect(resolveColorMode(skin, "dark")).toBe("dark");
  });

  it("restricts defaults to the capability's supported preferences", () => {
    expectTypeOf<
      Extract<SkinColorMode, { kind: "switchable"; supportsSystem: false }>["defaultPreference"]
    >().toEqualTypeOf<"light" | "dark">();
    expectTypeOf<
      Extract<SkinColorMode, { kind: "switchable"; supportsSystem: true }>["defaultPreference"]
    >().toEqualTypeOf<"light" | "dark" | "system">();
    expectTypeOf<
      Extract<SkinColorMode, { kind: "fixed" | "light-only" | "dark-only" }>
    >().not.toHaveProperty("defaultPreference");
  });
});
